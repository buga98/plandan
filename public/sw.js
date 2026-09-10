const PUBLIC_CACHE = 'plandan-public-v6';
const PRIVATE_CACHE = 'plandan-private-v6';
const DB_NAME = 'plandan-local-first-v1';
const DB_VERSION = 1;
const APP_ROUTES = ['/app', '/app/habits', '/app/more', '/app/more/tasks', '/app/more/notes', '/app/more/days-off', '/app/more/checkin', '/app/focus', '/app/insights', '/app/settings'];
const PUBLIC_SHELL = ['/', '/login', '/register', '/info', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/languages/hr.png', '/languages/en.svg', '/languages/de.svg'];

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('idMap')) db.createObjectStore('idMap', { keyPath: 'localId' });
      if (!db.objectStoreNames.contains('apiCache')) db.createObjectStore('apiCache', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => { dbPromise = null; reject(request.error); };
  });
  return dbPromise;
}

async function idbGet(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAdd(store, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(value);
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function clearLocalData() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'queue', 'idMap', 'apiCache'], 'readwrite');
    for (const name of ['meta', 'queue', 'idMap', 'apiCache']) tx.objectStore(name).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  await caches.delete(PRIVATE_CACHE);
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-PlanDan-Offline': '1', ...extraHeaders }
  });
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function localId(prefix) {
  return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getBootstrap() {
  return (await idbGet('meta', 'bootstrap'))?.value || null;
}

async function setBootstrap(value) {
  if (!value) return;
  await idbPut('meta', { key: 'bootstrap', value, updatedAt: Date.now() });
}

async function refreshBootstrap() {
  const response = await fetch('/api/sync/bootstrap', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error(`bootstrap ${response.status}`);
  const data = await response.json();
  const existing = await getBootstrap();
  if (existing?.profile?.id && data?.profile?.id && existing.profile.id !== data.profile.id) {
    await clearLocalData();
  }
  await setBootstrap(data);
  await idbPut('apiCache', { key: '/api/sync/bootstrap', body: data, updatedAt: Date.now() });
  return data;
}


async function maybeRefreshBootstrap(maxAgeMs = 30_000) {
  if (await queueCount()) return false;
  const row = await idbGet('meta', 'bootstrap');
  if (!row || Date.now() - Number(row.updatedAt || 0) > maxAgeMs) {
    try { await refreshBootstrap(); return true; } catch {}
  }
  return false;
}

function isProbablyOnline() {
  return self.navigator?.onLine !== false;
}

function safeTimeZone(value) {
  try {
    if (!value) return 'Europe/Zagreb';
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return 'Europe/Zagreb';
  }
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const raw = Object.fromEntries(formatter.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return { year: raw.year, month: raw.month, day: raw.day, hour: raw.hour, minute: raw.minute, second: raw.second };
}

function partsAsUtcMs(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function zonedDateToUtc(parts, timeZone) {
  const tz = safeTimeZone(timeZone);
  let guess = new Date(partsAsUtcMs(parts));
  for (let i = 0; i < 4; i += 1) {
    const actual = zonedParts(guess, tz);
    const delta = partsAsUtcMs(parts) - partsAsUtcMs(actual);
    if (!delta) break;
    guess = new Date(guess.getTime() + delta);
  }
  return guess;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addLocal(parts, repeat, interval, n) {
  const step = Math.max(1, Number(interval || 1)) * n;
  if (repeat === 'DAILY' || repeat === 'WEEKLY') {
    const days = repeat === 'DAILY' ? step : step * 7;
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: parts.hour, minute: parts.minute, second: parts.second };
  }
  if (repeat === 'MONTHLY') {
    const rawMonth = parts.month - 1 + step;
    const year = parts.year + Math.floor(rawMonth / 12);
    const monthIndex = ((rawMonth % 12) + 12) % 12;
    const month = monthIndex + 1;
    return { year, month, day: Math.min(parts.day, daysInMonth(year, month)), hour: parts.hour, minute: parts.minute, second: parts.second };
  }
  if (repeat === 'YEARLY') {
    const year = parts.year + step;
    return { year, month: parts.month, day: Math.min(parts.day, daysInMonth(year, parts.month)), hour: parts.hour, minute: parts.minute, second: parts.second };
  }
  return parts;
}

function occurrencesBetween(item, from, to, timeZone, max = 5000) {
  const baseRaw = item.startAt || item.dueAt;
  if (!baseRaw) return [];
  const base = new Date(baseRaw);
  if (item.repeatType === 'NONE') return base >= from && base <= to ? [base] : [];
  const baseParts = zonedParts(base, timeZone || 'Europe/Zagreb');
  const results = [];
  for (let n = 0; n < max; n += 1) {
    const candidate = zonedDateToUtc(addLocal(baseParts, item.repeatType, item.repeatInterval || 1, n), timeZone || 'Europe/Zagreb');
    if (item.repeatUntil && candidate > new Date(item.repeatUntil)) break;
    if (candidate > to) break;
    if (candidate >= from) results.push(candidate);
  }
  return results;
}

function itemOccurrences(item, from, to, timeZone) {
  const dates = occurrencesBetween(item, from, to, timeZone);
  const duration = item.startAt && item.endAt ? Math.max(0, new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) : 0;
  return dates.map((occurrenceAt) => {
    const state = (item.occurrenceStates || []).find((entry) => new Date(entry.occurrenceAt).getTime() === occurrenceAt.getTime());
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description || null,
      allDay: Boolean(item.allDay),
      priority: item.priority || 'MEDIUM',
      category: item.category || null,
      color: item.color || null,
      repeatType: item.repeatType || 'NONE',
      occurrenceAt: occurrenceAt.toISOString(),
      occurrenceEndAt: duration ? new Date(occurrenceAt.getTime() + duration).toISOString() : null,
      completedAt: item.repeatType === 'NONE' ? item.completedAt || null : state?.completedAt || null,
      reminders: (item.reminders || []).map((r) => Number(r.offsetMinutes))
    };
  });
}

function dateKeyUtc(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function zonedDateKey(value, timeZone) {
  const p = zonedParts(new Date(value), safeTimeZone(timeZone));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function shiftDateKey(key, days) {
  const [year, month, day] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function zonedDayBoundary(key, timeZone, nextDay = false) {
  const target = nextDay ? shiftDateKey(key, 1) : key;
  const [year, month, day] = target.split('-').map(Number);
  return zonedDateToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, safeTimeZone(timeZone));
}

function statsFromBootstrap(boot) {
  const timezone = safeTimeZone(boot.settings?.timezone);
  const todayKey = zonedDateKey(new Date(), timezone);
  const fromKey = shiftDateKey(todayKey, -6);
  const from = zonedDayBoundary(fromKey, timezone);
  const to = new Date(zonedDayBoundary(todayKey, timezone, true).getTime() - 1);
  let totalTasks = 0, completedTasks = 0;
  const daily = Array.from({ length: 7 }, (_, idx) => ({ date: shiftDateKey(fromKey, idx), total: 0, completed: 0 }));
  const dailyByDate = new Map(daily.map((row) => [row.date, row]));
  for (const item of boot.items || []) {
    if (item.type !== 'TASK' || item.isInbox) continue;
    for (const occurrence of itemOccurrences(item, from, to, timezone)) {
      totalTasks += 1;
      const done = Boolean(occurrence.completedAt);
      if (done) completedTasks += 1;
      const row = dailyByDate.get(zonedDateKey(occurrence.occurrenceAt, timezone));
      if (row) { row.total += 1; if (done) row.completed += 1; }
    }
  }
  const focus = (boot.focusSessions || []).filter((x) => x.completed && new Date(x.startedAt) >= from && new Date(x.startedAt) <= to);
  const focusMinutes = focus.reduce((sum, x) => sum + Number(x.durationMin || 0), 0);
  const habits = boot.habits || [];
  const habitTarget = habits.reduce((sum, h) => sum + Number(h.targetPerWeek || 0), 0);
  const habitDone = habits.reduce((sum, h) => sum + (h.checkins || []).filter((c) => {
    const key = dateKeyUtc(c.date);
    return key >= fromKey && key <= todayKey && Number(c.count || 1) >= Math.max(1, Number(h.targetPerDay || 1));
  }).length, 0);
  const reflections = (boot.reflections || []).filter((r) => {
    const key = dateKeyUtc(r.date);
    return key >= fromKey && key <= todayKey;
  });
  const moods = reflections.map((r) => r.mood).filter((x) => typeof x === 'number');
  const energies = reflections.map((r) => r.energy).filter((x) => typeof x === 'number');
  return {
    totalTasks,
    completedTasks,
    completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    focusMinutes,
    focusSessions: focus.length,
    habitDone,
    habitTarget,
    habitConsistency: habitTarget ? Math.min(100, Math.round((habitDone / habitTarget) * 100)) : 0,
    avgMood: moods.length ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : null,
    avgEnergy: energies.length ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : null,
    daily
  };
}

function offlineGetFromBootstrap(url, boot) {
  const path = url.pathname;
  if (!boot) return null;
  if (path === '/api/sync/bootstrap') return jsonResponse(boot);
  if (path === '/api/items') {
    if (url.searchParams.get('inbox') === '1') {
      const items = (boot.items || []).filter((item) => item.isInbox).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return jsonResponse({ items });
    }
    const from = new Date(url.searchParams.get('from') || '');
    const to = new Date(url.searchParams.get('to') || '');
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return jsonResponse({ error: 'INVALID_RANGE' }, 400);
    const timezone = safeTimeZone(boot.settings?.timezone);
    const occurrences = (boot.items || []).filter((item) => !item.isInbox).flatMap((item) => itemOccurrences(item, from, to, timezone));
    occurrences.sort((a, b) => new Date(a.occurrenceAt) - new Date(b.occurrenceAt));
    return jsonResponse({ occurrences });
  }
  const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
  if (itemMatch) {
    const item = (boot.items || []).find((x) => x.id === decodeURIComponent(itemMatch[1]));
    return item ? jsonResponse({ item }) : jsonResponse({ error: 'NOT_FOUND' }, 404);
  }
  if (path === '/api/habits') return jsonResponse({ habits: boot.habits || [] });
  if (path === '/api/day-offs') {
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    let days = boot.dayOffs || [];
    if (from && to) days = days.filter((x) => dateKeyUtc(x.date) >= from && dateKeyUtc(x.date) <= to);
    return jsonResponse({ days });
  }
  if (path === '/api/tasks/overdue') {
    const before = new Date(url.searchParams.get('before') || '');
    const tasks = (boot.items || []).filter((x) => x.type === 'TASK' && !x.isInbox && x.repeatType === 'NONE' && !x.completedAt && x.dueAt && new Date(x.dueAt) < before).sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
    return jsonResponse({ tasks });
  }
  if (path === '/api/reflection') {
    const key = url.searchParams.get('date') || '';
    const reflection = (boot.reflections || []).find((r) => dateKeyUtc(r.date) === key) || null;
    return jsonResponse({ reflection });
  }
  if (path === '/api/settings') return jsonResponse({ settings: boot.settings || null });
  if (path === '/api/stats') return jsonResponse(statsFromBootstrap(boot));
  return null;
}

function makeLocalItem(payload, id) {
  const now = new Date().toISOString();
  return {
    id,
    userId: 'local',
    type: payload.type || 'TASK',
    title: payload.title || '',
    description: payload.description || null,
    startAt: payload.startAt || null,
    endAt: payload.endAt || null,
    dueAt: payload.dueAt || null,
    allDay: Boolean(payload.allDay),
    completedAt: null,
    priority: payload.priority || 'MEDIUM',
    category: payload.category || null,
    color: payload.color || null,
    isInbox: Boolean(payload.isInbox),
    repeatType: payload.isInbox ? 'NONE' : (payload.repeatType || 'NONE'),
    repeatInterval: Number(payload.repeatInterval || 1),
    repeatUntil: payload.repeatUntil || null,
    createdAt: now,
    updatedAt: now,
    reminders: (payload.reminderOffsets || []).map((offsetMinutes, index) => ({ id: `${id}-r${index}`, itemId: id, userId: 'local', offsetMinutes, createdAt: now })),
    occurrenceStates: []
  };
}

async function applyLocalMutation(url, method, body, tempId) {
  const boot = cloneJson(await getBootstrap()) || { syncedAt: null, profile: null, settings: null, items: [], habits: [], reflections: [], focusSessions: [], dayOffs: [] };
  const path = url.pathname;
  const now = new Date().toISOString();

  if (path === '/api/items' && method === 'POST') {
    boot.items = boot.items || [];
    boot.items.push(makeLocalItem(body || {}, tempId));
  } else {
    const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
    const occMatch = path.match(/^\/api\/items\/([^/]+)\/occurrence$/);
    if (itemMatch && method === 'PATCH') {
      const id = decodeURIComponent(itemMatch[1]);
      const item = (boot.items || []).find((x) => x.id === id);
      if (item) {
        Object.assign(item, body || {}, { updatedAt: now });
        if (body?.isInbox === true) {
          item.startAt = null; item.endAt = null; item.dueAt = null; item.repeatType = 'NONE'; item.repeatUntil = null; item.reminders = [];
        }
        if (Array.isArray(body?.reminderOffsets)) item.reminders = body.reminderOffsets.map((offsetMinutes, index) => ({ id: `${id}-local-r${index}`, itemId: id, userId: item.userId || 'local', offsetMinutes, createdAt: now }));
      }
    } else if (itemMatch && method === 'DELETE') {
      const id = decodeURIComponent(itemMatch[1]);
      boot.items = (boot.items || []).filter((x) => x.id !== id);
    } else if (occMatch && method === 'POST') {
      const id = decodeURIComponent(occMatch[1]);
      const item = (boot.items || []).find((x) => x.id === id);
      if (item) {
        if (item.repeatType === 'NONE') item.completedAt = body?.completed ? now : null;
        else {
          item.occurrenceStates = item.occurrenceStates || [];
          const existing = item.occurrenceStates.find((x) => new Date(x.occurrenceAt).getTime() === new Date(body?.occurrenceAt).getTime());
          if (existing) existing.completedAt = body?.completed ? now : null;
          else item.occurrenceStates.push({ id: `${id}-state-${Date.now()}`, itemId: id, occurrenceAt: body?.occurrenceAt, completedAt: body?.completed ? now : null, skippedAt: null, createdAt: now, updatedAt: now });
        }
      }
    }
  }

  if (path === '/api/habits' && method === 'POST') {
    boot.habits = boot.habits || [];
    boot.habits.push({ id: tempId, userId: 'local', name: body?.name || '', emoji: body?.emoji || '✓', color: body?.color || '#7c5cff', targetPerWeek: Number(body?.targetPerWeek || 7), targetPerDay: Number(body?.targetPerDay || 1), reminderMode: body?.reminderMode || 'NONE', reminderTime: body?.reminderTime || null, reminderIntervalMinutes: body?.reminderIntervalMinutes || null, reminderStartTime: body?.reminderStartTime || null, reminderEndTime: body?.reminderEndTime || null, archived: false, createdAt: now, updatedAt: now, checkins: [] });
  }
  const habitDelete = path.match(/^\/api\/habits\/([^/]+)$/);
  const habitCheck = path.match(/^\/api\/habits\/([^/]+)\/checkin$/);
  if (habitDelete && method === 'PATCH') {
    const id = decodeURIComponent(habitDelete[1]); const habit = (boot.habits || []).find((x)=>x.id===id); if (habit) Object.assign(habit, body || {}, { updatedAt: now });
  }
  if (habitDelete && method === 'DELETE') {
    const id = decodeURIComponent(habitDelete[1]);
    boot.habits = (boot.habits || []).filter((x) => x.id !== id);
  }
  if (habitCheck && method === 'POST') {
    const id = decodeURIComponent(habitCheck[1]);
    const habit = (boot.habits || []).find((x) => x.id === id);
    if (habit) {
      habit.checkins = habit.checkins || [];
      const semantic = `${body?.date}T00:00:00.000Z`;
      let count = body?.count;
      if (count === undefined && body?.done !== undefined) count = body.done ? Number(habit.targetPerDay || 1) : 0;
      const existing = habit.checkins.find((x) => dateKeyUtc(x.date) === body?.date);
      if (Number(count || 0) > 0) {
        if (existing) existing.count = Number(count); else habit.checkins.push({ id: `${id}-check-${body.date}`, habitId: id, date: semantic, count: Number(count), createdAt: now });
      } else habit.checkins = habit.checkins.filter((x) => dateKeyUtc(x.date) !== body?.date);
    }
  }

  if (path === '/api/day-offs' && method === 'POST') {
    boot.dayOffs = boot.dayOffs || [];
    const id = tempId || localId('dayoff'); const semantic = `${body?.date}T00:00:00.000Z`; const idx = boot.dayOffs.findIndex((x)=>dateKeyUtc(x.date)===body?.date);
    const value = { id, userId:'local', date:semantic, label:body?.label||'', color:body?.color||'#ef5da8', createdAt:now, updatedAt:now };
    if (idx>=0) boot.dayOffs[idx] = { ...boot.dayOffs[idx], ...value, id: boot.dayOffs[idx].id }; else boot.dayOffs.push(value);
  }
  const dayOffDelete = path.match(/^\/api\/day-offs\/([^/]+)$/);
  if (dayOffDelete && method === 'DELETE') { const id=decodeURIComponent(dayOffDelete[1]); boot.dayOffs=(boot.dayOffs||[]).filter((x)=>x.id!==id); }

  if (path === '/api/reflection' && method === 'PUT') {
    boot.reflections = boot.reflections || [];
    const idx = boot.reflections.findIndex((x) => dateKeyUtc(x.date) === body?.date);
    const value = { id: idx >= 0 ? boot.reflections[idx].id : `local-reflection-${body?.date}`, userId: 'local', date: `${body?.date}T00:00:00.000Z`, mood: body?.mood ?? null, energy: body?.energy ?? null, gratitude: body?.gratitude || null, note: body?.note || null, createdAt: idx >= 0 ? boot.reflections[idx].createdAt : now, updatedAt: now };
    if (idx >= 0) boot.reflections[idx] = value; else boot.reflections.push(value);
  }

  if (path === '/api/focus' && method === 'POST') {
    boot.focusSessions = boot.focusSessions || [];
    boot.focusSessions.push({ id: tempId || localId('focus'), userId: 'local', durationMin: Number(body?.durationMin || 1), label: body?.label || null, completed: body?.completed !== false, startedAt: body?.startedAt, endedAt: body?.endedAt, createdAt: now });
  }

  if (path === '/api/settings' && method === 'PATCH') {
    boot.settings = { ...(boot.settings || {}), ...(body || {}), updatedAt: now };
  }

  boot.syncedAt = boot.syncedAt || null;
  await setBootstrap(boot);
  return boot;
}

async function cacheApiResponse(request, response) {
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) return;
  try {
    const body = await response.clone().json();
    await idbPut('apiCache', { key: new URL(request.url).pathname + new URL(request.url).search, body, updatedAt: Date.now() });
  } catch {}
}

function isOfflineCapableApi(url) {
  return url.pathname === '/api/items' || /^\/api\/items\/[^/]+(?:\/occurrence)?$/.test(url.pathname) ||
    url.pathname === '/api/habits' || /^\/api\/habits\/[^/]+(?:\/checkin)?$/.test(url.pathname) ||
    url.pathname === '/api/reflection' || url.pathname === '/api/focus' || url.pathname === '/api/settings' ||
    url.pathname === '/api/day-offs' || /^\/api\/day-offs\/[^/]+$/.test(url.pathname) || url.pathname === '/api/tasks/overdue' ||
    url.pathname === '/api/stats' || url.pathname === '/api/sync/bootstrap';
}

async function handleApiGet(request, url) {
  const boot = await getBootstrap();
  const derived = offlineGetFromBootstrap(url, boot);
  if (derived) return derived;
  const cached = await idbGet('apiCache', url.pathname + url.search);
  if (cached) return jsonResponse(cached.body);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      await cacheApiResponse(request, response);
      if (url.pathname === '/api/sync/bootstrap') {
        try { await setBootstrap(await response.clone().json()); } catch {}
      }
    }
    return response;
  } catch {
    return jsonResponse({ error: 'OFFLINE_NO_CACHE' }, 503);
  }
}

function queueDedupeKey(method, path, body) {
  if (method === 'PATCH' && /^\/api\/(items|habits)\/[^/]+$/.test(path)) return `${method}:${path}`;
  if (method === 'POST' && /^\/api\/habits\/[^/]+\/checkin$/.test(path)) return `${method}:${path}:${body?.date || ''}`;
  if (method === 'POST' && /^\/api\/items\/[^/]+\/occurrence$/.test(path)) return `${method}:${path}:${body?.occurrenceAt || ''}`;
  if (method === 'PUT' && path === '/api/reflection') return `${method}:${path}:${body?.date || ''}`;
  if (method === 'PATCH' && path === '/api/settings') return `${method}:${path}`;
  return null;
}

async function enqueueMutation(entry, body) {
  const dedupeKey = queueDedupeKey(entry.method, entry.url.split('?')[0], body);
  if (dedupeKey) {
    const all = await idbGetAll('queue');
    for (const current of all) {
      if (current.dedupeKey !== dedupeKey) continue;
      if (entry.method === 'PATCH') {
        let previous = {};
        try { previous = current.bodyText ? JSON.parse(current.bodyText) : {}; } catch {}
        entry.bodyText = JSON.stringify({ ...previous, ...(body || {}) });
      }
      await idbDelete('queue', current.id);
    }
    entry.dedupeKey = dedupeKey;
  }
  return idbAdd('queue', entry);
}

async function handleApiMutation(request, url, event) {
  const method = request.method.toUpperCase();
  const bodyText = method === 'DELETE' ? '' : await request.clone().text().catch(() => '');
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch {}

  let tempId = null;
  if (url.pathname === '/api/items' && method === 'POST') tempId = localId('item');
  if (url.pathname === '/api/habits' && method === 'POST') tempId = localId('habit');
  if (url.pathname === '/api/focus' && method === 'POST') tempId = localId('focus');
  if (url.pathname === '/api/day-offs' && method === 'POST') tempId = localId('dayoff');

  const localBoot = await applyLocalMutation(url, method, body, tempId);
  await enqueueMutation({ method, url: url.pathname + url.search, bodyText, createdAt: Date.now(), tempId }, body);
  await broadcastStatus(isProbablyOnline() ? 'syncing' : 'pending');
  await broadcast({ type: 'PLANDAN_LOCAL_CHANGE' });

  if (event && isProbablyOnline()) event.waitUntil(processQueue());
  try { if ('sync' in self.registration) await self.registration.sync.register('plandan-sync'); } catch {}

  if (url.pathname === '/api/items' && method === 'POST') return jsonResponse({ item: (localBoot.items || []).find((x) => x.id === tempId), offline: !isProbablyOnline(), queued: true }, 202);
  if (url.pathname === '/api/habits' && method === 'POST') return jsonResponse({ habit: (localBoot.habits || []).find((x) => x.id === tempId), offline: !isProbablyOnline(), queued: true }, 202);
  if (url.pathname === '/api/day-offs' && method === 'POST') return jsonResponse({ day: (localBoot.dayOffs || []).find((x) => x.id === tempId), offline: !isProbablyOnline(), queued: true }, 202);
  if (url.pathname === '/api/reflection' && method === 'PUT') {
    const reflection = (localBoot.reflections || []).find((x) => dateKeyUtc(x.date) === body?.date) || null;
    return jsonResponse({ reflection, offline: !isProbablyOnline(), queued: true }, 202);
  }
  return jsonResponse({ ok: true, offline: !isProbablyOnline(), queued: true }, 202);
}

async function resolveMappedId(id) {
  const row = await idbGet('idMap', id);
  return row?.serverId || id;
}

async function resolveQueuedUrl(rawUrl) {
  let url = rawUrl;
  const match = url.match(/^\/api\/(items|habits|day-offs)\/([^/?]+)(.*)$/);
  if (match && match[2].startsWith('local-')) {
    const serverId = await resolveMappedId(decodeURIComponent(match[2]));
    url = `/api/${match[1]}/${encodeURIComponent(serverId)}${match[3] || ''}`;
  }
  return url;
}

async function replaceLocalIdInBootstrap(local, server) {
  const boot = cloneJson(await getBootstrap());
  if (!boot) return;
  for (const item of boot.items || []) {
    if (item.id === local) item.id = server;
    for (const reminder of item.reminders || []) if (reminder.itemId === local) reminder.itemId = server;
    for (const state of item.occurrenceStates || []) if (state.itemId === local) state.itemId = server;
  }
  for (const habit of boot.habits || []) {
    if (habit.id === local) habit.id = server;
    for (const checkin of habit.checkins || []) if (checkin.habitId === local) checkin.habitId = server;
  }
  for (const day of boot.dayOffs || []) if (day.id === local) day.id = server;
  await setBootstrap(boot);
}

async function processQueueUnlocked() {
  const queue = (await idbGetAll('queue')).sort((a, b) => Number(a.id) - Number(b.id));
  if (!queue.length) {
    await maybeRefreshBootstrap();
    await broadcastStatus('synced');
    return;
  }
  try {
    const identityResponse = await fetch('/api/sync/bootstrap', { credentials: 'include', cache: 'no-store' });
    if (identityResponse.ok) {
      const remote = await identityResponse.json();
      const local = await getBootstrap();
      if (local?.profile?.id && remote?.profile?.id && local.profile.id !== remote.profile.id) {
        await clearLocalData();
        await setBootstrap(remote);
        await broadcastStatus('synced');
        return;
      }
    }
  } catch {}
  await broadcastStatus('syncing');
  for (const entry of queue) {
    const resolvedUrl = await resolveQueuedUrl(entry.url);
    const headers = entry.bodyText ? { 'Content-Type': 'application/json' } : undefined;
    let response;
    try {
      response = await fetch(resolvedUrl, { method: entry.method, headers, body: entry.bodyText || undefined, credentials: 'include' });
    } catch {
      await broadcastStatus('pending');
      return;
    }
    if (response.status === 401) {
      await broadcastStatus('auth-required');
      return;
    }
    if (!response.ok) {
      if (response.status >= 500) { await broadcastStatus('pending'); return; }
      // Invalid queued mutation should not block the rest forever.
      await idbDelete('queue', entry.id);
      continue;
    }
    if (entry.tempId && (entry.url === '/api/items' || entry.url === '/api/habits' || entry.url === '/api/day-offs')) {
      try {
        const data = await response.clone().json();
        const serverId = data.item?.id || data.habit?.id || data.day?.id;
        if (serverId) {
          await idbPut('idMap', { localId: entry.tempId, serverId });
          await replaceLocalIdInBootstrap(entry.tempId, serverId);
        }
      } catch {}
    }
    await idbDelete('queue', entry.id);
  }
  try { await refreshBootstrap(); } catch {}
  await broadcastStatus('synced');
  await broadcast({ type: 'PLANDAN_SYNC_COMPLETE' });
}

let syncPromise = null;
async function processQueue() {
  if (syncPromise) return syncPromise;
  syncPromise = processQueueUnlocked().finally(() => { syncPromise = null; });
  return syncPromise;
}

async function queueCount() {
  return (await idbGetAll('queue')).length;
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

async function broadcastStatus(status) {
  await broadcast({ type: 'PLANDAN_SYNC_STATUS', status, pending: await queueCount() });
}

function extractAssets(html) {
  const out = new Set();
  const regex = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html))) {
    const value = match[1];
    if (value.startsWith('/_next/static/') || value.startsWith('/icons/')) out.add(value);
  }
  return [...out];
}

async function warmPrivateShell(force = false) {
  const last = await idbGet('meta', 'shellWarmAt');
  if (!force && last && Date.now() - Number(last.value || 0) < 6 * 60 * 60 * 1000) return;
  const cache = await caches.open(PRIVATE_CACHE);
  const assetSet = new Set();
  await Promise.all(APP_ROUTES.map(async (route) => {
    try {
      const response = await fetch(route, { credentials: 'include', cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      if (!response.ok || response.redirected || !type.includes('text/html')) return;
      await cache.put(route, response.clone());
      const html = await response.text();
      for (const asset of extractAssets(html)) assetSet.add(asset);
    } catch {}
  }));
  await Promise.all([...assetSet].map(async (asset) => {
    try {
      if (await cache.match(asset)) return;
      const response = await fetch(asset, { cache: 'reload' });
      if (response.ok) await cache.put(asset, response);
    } catch {}
  }));
  await idbPut('meta', { key: 'shellWarmAt', value: Date.now(), updatedAt: Date.now() });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PUBLIC_CACHE).then((cache) => cache.addAll(PUBLIC_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => ![PUBLIC_CACHE, PRIVATE_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') && isOfflineCapableApi(url)) {
    if (request.method === 'GET') event.respondWith(handleApiGet(request, url));
    else event.respondWith(handleApiMutation(request, url, event));
    return;
  }

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(PRIVATE_CACHE);
      const cached = await cache.match(url.pathname);

      // App routes are shell-first. This keeps navigation instant and fully usable offline.
      // While online, refresh the private shell in the background for the next visit.
      const networkRefresh = (async () => {
        try {
          const response = await fetch(request);
          const type = response.headers.get('content-type') || '';
          if (response.ok && !response.redirected && type.includes('text/html')) {
            await cache.put(url.pathname, response.clone());
          }
          return response;
        } catch {
          return null;
        }
      })();

      if (cached) {
        event.waitUntil(networkRefresh.then(() => undefined));
        return cached;
      }

      const response = await networkRefresh;
      if (response) return response;
      return (await cache.match('/app')) || new Response('PlanDan offline shell is not ready yet. Open the app once while online.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  if (request.mode === 'navigate') {
    const publicRoute = ['/', '/login', '/register', '/info'].includes(url.pathname);
    event.respondWith(fetch(request).then(async (response) => {
      if (publicRoute && response.ok) (await caches.open(PUBLIC_CACHE)).put(url.pathname, response.clone());
      return response;
    }).catch(async () => (await caches.open(PUBLIC_CACHE)).match(url.pathname) || (await caches.open(PUBLIC_CACHE)).match('/')));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/languages/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      const privateCache = await caches.open(PRIVATE_CACHE);
      const publicCache = await caches.open(PUBLIC_CACHE);
      const cached = (await privateCache.match(request)) || (await publicCache.match(request));
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await publicCache.put(request, response.clone());
        return response;
      } catch {
        return cached || new Response('', { status: 503 });
      }
    })());
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PLANDAN_WARM_APP') event.waitUntil(warmPrivateShell(Boolean(data.force)));
  if (data.type === 'PLANDAN_SYNC_NOW') event.waitUntil(processQueue());
  if (data.type === 'PLANDAN_REFRESH_DATA') event.waitUntil((async()=>{ if(await queueCount()) return; try{await refreshBootstrap();await broadcast({type:'PLANDAN_DATA_REFRESHED'});await broadcastStatus('synced')}catch{} })());
  if (data.type === 'PLANDAN_CLEAR_PRIVATE') event.waitUntil(clearLocalData());
  if (data.type === 'PLANDAN_GET_STATUS') event.waitUntil(broadcastStatus('status'));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'plandan-sync') event.waitUntil(processQueue());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'PlanDan';
  const options = {
    body: data.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-64.png',
    tag: data.tag || 'plandan-reminder', renotify: Boolean(data.renotify),
    data: { url: data.url || '/app' }, vibrate: [120, 70, 120]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/app';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) { client.navigate(target); return client.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
