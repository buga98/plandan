import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, CalendarDays, CalendarOff, Check, CheckSquare2, ChevronLeft, ChevronRight,
  Circle, Clock3, Flame, Info, Menu, Minus, NotebookPen, Plus, RefreshCw, Settings as SettingsIcon,
  SmilePlus, Target, TimerReset, X
} from 'lucide-react'
import { fetchInitialBootstrap, mutate, postToWorker, readBootstrap, registerServiceWorker, subscribeWorker, writeBootstrap } from './store'
import { dateKey, dayEnd, dayStart, formatTime, isoForLocal, keyToDate, monthGrid, occurrencesBetween, safeTimeZone, shiftKey, todayKey } from './model'
import type { Bootstrap, Habit, ItemType, Occurrence, PlannerItem, Reflection, Settings } from './types'

type View = 'calendar' | 'habits' | 'more' | 'tasks' | 'notes' | 'focus' | 'insights' | 'checkin' | 'daysOff' | 'settings' | 'info'

type Strings = Record<string, string>
const copy: Record<'HR'|'EN'|'DE', Strings> = {
  HR: {
    calendar:'Kalendar', habits:'Navike', more:'Dodatno', today:'Danas', add:'Dodaj', task:'Zadatak', event:'Događaj', note:'Bilješka',
    tasks:'Svi zadaci', notes:'Sve bilješke', focus:'Fokus', insights:'Uvidi', checkin:'Dnevni check-in', daysOff:'Slobodni dani', settings:'Postavke', info:'O aplikaciji',
    synced:'Sinkronizirano', syncing:'Sinkronizacija…', offline:'Offline', emptyDay:'Nema planiranih stavki.', title:'Naslov', description:'Opis', date:'Datum', time:'Vrijeme', save:'Spremi', cancel:'Odustani',
    allDay:'Cijeli dan', repeat:'Ponavljanje', reminder:'Podsjetnik', none:'Bez', daily:'Dnevno', weekly:'Tjedno', monthly:'Mjesečno', yearly:'Godišnje',
    newHabit:'Nova navika', targetDay:'Cilj / dan', targetWeek:'Cilj / tjedan', streak:'niz', planning:'Planiranje', progress:'Napredak', app:'Aplikacija',
    mood:'Raspoloženje', energy:'Energija', gratitude:'Zahvalan sam za…', reflection:'Bilješka dana', start:'Pokreni', pause:'Pauza', reset:'Reset', done:'Gotovo',
    language:'Jezik', theme:'Tema', timezone:'Vremenska zona', light:'Svijetla', dark:'Tamna', system:'Sustav', logout:'Odjava', fast:'PlanDan v2 · lokalno',
    instant:'Sve glavne interakcije rade lokalno. Server se sinkronizira u pozadini.', noHabits:'Još nema navika.', noTasks:'Nema zadataka.', noNotes:'Nema bilješki.',
    weekDone:'zadataka završeno ovaj tjedan', focusMinutes:'minuta fokusa', habitsDone:'navika odrađeno danas', saveDayOff:'Spremi slobodan dan', label:'Naziv',
    loading:'Učitavam lokalne podatke…', retry:'Pokušaj ponovno', unauthorized:'Sesija je istekla.', install:'Instaliraj ovu stranicu kao PWA za najbrži osjećaj aplikacije.'
  },
  EN: {
    calendar:'Calendar', habits:'Habits', more:'More', today:'Today', add:'Add', task:'Task', event:'Event', note:'Note', tasks:'All tasks', notes:'All notes', focus:'Focus', insights:'Insights', checkin:'Daily check-in', daysOff:'Days off', settings:'Settings', info:'About', synced:'Synced', syncing:'Syncing…', offline:'Offline', emptyDay:'Nothing planned.', title:'Title', description:'Description', date:'Date', time:'Time', save:'Save', cancel:'Cancel', allDay:'All day', repeat:'Repeat', reminder:'Reminder', none:'None', daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly', newHabit:'New habit', targetDay:'Target / day', targetWeek:'Target / week', streak:'streak', planning:'Planning', progress:'Progress', app:'App', mood:'Mood', energy:'Energy', gratitude:'I am grateful for…', reflection:'Daily note', start:'Start', pause:'Pause', reset:'Reset', done:'Done', language:'Language', theme:'Theme', timezone:'Time zone', light:'Light', dark:'Dark', system:'System', logout:'Log out', fast:'PlanDan v2 · local', instant:'Primary interactions run locally. Server sync happens in the background.', noHabits:'No habits yet.', noTasks:'No tasks.', noNotes:'No notes.', weekDone:'tasks completed this week', focusMinutes:'focus minutes', habitsDone:'habits done today', saveDayOff:'Save day off', label:'Label', loading:'Loading local data…', retry:'Retry', unauthorized:'Session expired.', install:'Install this page as a PWA for the fastest app-like experience.'
  },
  DE: {
    calendar:'Kalender', habits:'Gewohnheiten', more:'Mehr', today:'Heute', add:'Hinzufügen', task:'Aufgabe', event:'Termin', note:'Notiz', tasks:'Alle Aufgaben', notes:'Alle Notizen', focus:'Fokus', insights:'Einblicke', checkin:'Tages-Check-in', daysOff:'Freie Tage', settings:'Einstellungen', info:'Über die App', synced:'Synchronisiert', syncing:'Synchronisiert…', offline:'Offline', emptyDay:'Nichts geplant.', title:'Titel', description:'Beschreibung', date:'Datum', time:'Zeit', save:'Speichern', cancel:'Abbrechen', allDay:'Ganztägig', repeat:'Wiederholen', reminder:'Erinnerung', none:'Keine', daily:'Täglich', weekly:'Wöchentlich', monthly:'Monatlich', yearly:'Jährlich', newHabit:'Neue Gewohnheit', targetDay:'Ziel / Tag', targetWeek:'Ziel / Woche', streak:'Serie', planning:'Planung', progress:'Fortschritt', app:'App', mood:'Stimmung', energy:'Energie', gratitude:'Dankbar für…', reflection:'Tagesnotiz', start:'Start', pause:'Pause', reset:'Reset', done:'Fertig', language:'Sprache', theme:'Design', timezone:'Zeitzone', light:'Hell', dark:'Dunkel', system:'System', logout:'Abmelden', fast:'PlanDan v2 · lokal', instant:'Hauptinteraktionen laufen lokal. Der Server synchronisiert im Hintergrund.', noHabits:'Noch keine Gewohnheiten.', noTasks:'Keine Aufgaben.', noNotes:'Keine Notizen.', weekDone:'Aufgaben diese Woche erledigt', focusMinutes:'Fokusminuten', habitsDone:'Gewohnheiten heute erledigt', saveDayOff:'Freien Tag speichern', label:'Name', loading:'Lokale Daten werden geladen…', retry:'Erneut versuchen', unauthorized:'Sitzung abgelaufen.', install:'Installiere diese Seite als PWA für das schnellste App-Gefühl.'
  }
}

function localeFor(lang: 'HR'|'EN'|'DE') { return lang === 'HR' ? 'hr-HR' : lang === 'DE' ? 'de-DE' : 'en-US' }
function uid(prefix='local') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}` }

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [view, setView] = useState<View>('calendar')
  const [sync, setSync] = useState(navigator.onLine ? 'synced' : 'offline')
  const [error, setError] = useState('')
  const loadingOnce = useRef(false)

  const refreshFromDisk = async () => {
    const latest = await readBootstrap()
    if (latest) setBoot(latest)
  }

  useEffect(() => {
    let stop = () => undefined
    ;(async () => {
      try {
        const initial = await fetchInitialBootstrap()
        setBoot(initial)
        const reg = await registerServiceWorker()
        stop = subscribeWorker(() => void refreshFromDisk(), status => setSync(status))
        if (reg) {
          postToWorker('PLANDAN_WARM_APP', { force: true })
          if (navigator.onLine) postToWorker('PLANDAN_REFRESH_DATA')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LOAD_FAILED')
      }
    })()
    const online = () => { setSync('syncing'); postToWorker('PLANDAN_SYNC_NOW'); postToWorker('PLANDAN_REFRESH_DATA') }
    const offline = () => setSync('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => { stop(); window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])

  const updateLocal = (fn: (current: Bootstrap) => Bootstrap) => {
    setBoot(current => {
      if (!current) return current
      const next = fn(current)
      void writeBootstrap(next)
      return next
    })
  }

  const commit = (path: string, method: string, body?: unknown) => {
    setSync(navigator.onLine ? 'syncing' : 'offline')
    void mutate(path, method, body).then(async response => {
      if (response.status === 401) { window.location.assign('/login'); return }
      await refreshFromDisk()
      if (navigator.onLine) postToWorker('PLANDAN_SYNC_NOW')
    }).catch(() => setSync(navigator.onLine ? 'pending' : 'offline'))
  }

  if (!boot) return <div className="bootScreen"><img src="/icons/icon-192.png"/><h1>PlanDan</h1><p>{error ? `Greška: ${error}` : copy.HR.loading}</p>{error && <button className="btn primary" onClick={() => location.reload()}>{copy.HR.retry}</button>}</div>

  const lang = boot.settings?.language || 'HR'
  const t = (key: string) => copy[lang][key] || copy.HR[key] || key
  const timeZone = safeTimeZone(boot.settings?.timezone)
  const locale = localeFor(lang)
  const primary: { id: View; label: string; Icon: typeof CalendarDays }[] = [
    { id:'calendar', label:t('calendar'), Icon:CalendarDays }, { id:'habits', label:t('habits'), Icon:Target }, { id:'more', label:t('more'), Icon:Menu }
  ]

  return <div className="appShell">
    <header className="topbar">
      <button className="brand" onClick={() => setView('calendar')}><img src="/icons/icon-192.png"/><span><strong>PlanDan</strong><small>{t('fast')}</small></span></button>
      <div className={`syncPill ${sync}`}><span className="syncDot"/>{sync === 'offline' ? t('offline') : sync === 'synced' ? t('synced') : t('syncing')}</div>
    </header>

    <main className="content">
      {view === 'calendar' && <CalendarScreen boot={boot} timeZone={timeZone} locale={locale} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'habits' && <HabitsScreen boot={boot} timeZone={timeZone} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'more' && <MoreScreen t={t} go={setView}/>} 
      {view === 'tasks' && <ItemsScreen type="TASK" boot={boot} timeZone={timeZone} locale={locale} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'notes' && <ItemsScreen type="NOTE" boot={boot} timeZone={timeZone} locale={locale} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'focus' && <FocusScreen boot={boot} t={t} commit={commit}/>} 
      {view === 'insights' && <InsightsScreen boot={boot} timeZone={timeZone} t={t}/>} 
      {view === 'checkin' && <CheckinScreen boot={boot} timeZone={timeZone} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'daysOff' && <DaysOffScreen boot={boot} timeZone={timeZone} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'settings' && <SettingsScreen boot={boot} t={t} updateLocal={updateLocal} commit={commit}/>} 
      {view === 'info' && <InfoScreen t={t}/>} 
    </main>

    <nav className="bottomNav">
      {primary.map(({id,label,Icon}) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={22}/><span>{label}</span></button>)}
    </nav>
  </div>
}

type Shared = { boot: Bootstrap; timeZone: string; t:(k:string)=>string; updateLocal:(fn:(b:Bootstrap)=>Bootstrap)=>void; commit:(path:string,method:string,body?:unknown)=>void }

function CalendarScreen({boot,timeZone,locale,t,updateLocal,commit}: Shared & {locale:string}) {
  const today = todayKey(timeZone)
  const [cursor,setCursor] = useState(() => { const d=keyToDate(today); return new Date(d.getFullYear(),d.getMonth(),1) })
  const [selected,setSelected] = useState(today)
  const [dayOpen,setDayOpen] = useState(false)
  const [editor,setEditor] = useState<{type:ItemType;date:string;time:string}|null>(null)
  const days = useMemo(() => monthGrid(cursor),[cursor])
  const fromKey = `${days[0].getFullYear()}-${String(days[0].getMonth()+1).padStart(2,'0')}-${String(days[0].getDate()).padStart(2,'0')}`
  const toDay = days[days.length-1]
  const toKey = `${toDay.getFullYear()}-${String(toDay.getMonth()+1).padStart(2,'0')}-${String(toDay.getDate()).padStart(2,'0')}`
  const occ = useMemo(() => occurrencesBetween(boot,dayStart(fromKey,timeZone),dayEnd(toKey,timeZone),timeZone),[boot,fromKey,toKey,timeZone])
  const byDay = useMemo(() => { const m=new Map<string,Occurrence[]>(); for(const o of occ){const k=dateKey(o.occurrenceAt,timeZone);const a=m.get(k)||[];a.push(o);m.set(k,a)} return m },[occ,timeZone])
  const selectedItems = byDay.get(selected) || []
  const weekdays = Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2026,7,17+i)))
  const monthTitle = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(cursor)

  const toggle = (o:Occurrence) => {
    const done = !o.completedAt
    updateLocal(b => ({...b,items:b.items.map(item => {
      if(item.id!==o.item.id) return item
      if(item.repeatType==='NONE') return {...item,completedAt:done?new Date().toISOString():null}
      const states=[...(item.occurrenceStates||[])]; const idx=states.findIndex(s=>new Date(s.occurrenceAt).getTime()===new Date(o.occurrenceAt).getTime())
      const state={...(idx>=0?states[idx]:{}),occurrenceAt:o.occurrenceAt,completedAt:done?new Date().toISOString():null}
      if(idx>=0) states[idx]=state; else states.push(state)
      return {...item,occurrenceStates:states}
    })}))
    commit(`/api/items/${o.item.id}/occurrence`,'POST',{occurrenceAt:o.occurrenceAt,completed:done})
  }

  return <div className="screen calendarScreen">
    <div className="screenHead"><div><h1>{monthTitle}</h1><p>{t('instant')}</p></div><div className="headActions"><button className="btn" onClick={()=>{const d=keyToDate(today);setCursor(new Date(d.getFullYear(),d.getMonth(),1));setSelected(today)}}>{t('today')}</button><button className="iconBtn" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}><ChevronLeft/></button><button className="iconBtn" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}><ChevronRight/></button></div></div>
    <section className="calendarCard">
      <div className="weekdays">{weekdays.map((x,i)=><span key={i}>{x}</span>)}</div>
      <div className="monthGrid">{days.map(d=>{const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const list=byDay.get(k)||[];const outside=d.getMonth()!==cursor.getMonth();return <button key={k} className={`day ${outside?'outside':''} ${k===today?'today':''}`} onClick={()=>{setSelected(k);setDayOpen(true)}}><strong>{d.getDate()}</strong><div className="dots">{list.slice(0,5).map((o,i)=><i key={i} className={o.completedAt?'done':''} style={{background:o.completedAt?undefined:o.item.color||undefined}}/>)}</div>{list.length>0&&<small>{list.length}</small>}</button>})}</div>
    </section>
    {dayOpen&&<DaySheet date={selected} items={selectedItems} locale={locale} timeZone={timeZone} t={t} onClose={()=>setDayOpen(false)} onToggle={toggle} onAdd={(type,time)=>setEditor({type,date:selected,time})}/>} 
    {editor&&<ItemEditor initial={editor} timeZone={timeZone} t={t} onClose={()=>setEditor(null)} onSave={body=>{setEditor(null);commit('/api/items','POST',body)}}/>}
  </div>
}

function DaySheet({date,items,locale,timeZone,t,onClose,onToggle,onAdd}:{date:string;items:Occurrence[];locale:string;timeZone:string;t:(k:string)=>string;onClose:()=>void;onToggle:(o:Occurrence)=>void;onAdd:(type:ItemType,time:string)=>void}){
  const d=keyToDate(date)
  const title=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(d)
  const [tab,setTab]=useState<'timeline'|'tasks'|'notes'>('timeline')
  const tasks=items.filter(x=>x.item.type==='TASK'), notes=items.filter(x=>x.item.type==='NOTE')
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="sheet"><div className="sheetHead"><div><small>{date}</small><h2>{title}</h2></div><button className="iconBtn" onClick={onClose}><X/></button></div><div className="tabs"><button className={tab==='timeline'?'active':''} onClick={()=>setTab('timeline')}><Clock3 size={17}/>Plan</button><button className={tab==='tasks'?'active':''} onClick={()=>setTab('tasks')}><CheckSquare2 size={17}/>{t('task')} {tasks.length?`(${tasks.length})`:''}</button><button className={tab==='notes'?'active':''} onClick={()=>setTab('notes')}><NotebookPen size={17}/>{t('note')} {notes.length?`(${notes.length})`:''}</button></div>
    <div className="sheetBody">{tab==='timeline'&&<>{items.length===0?<div className="empty">{t('emptyDay')}</div>:<div className="dayItems">{items.map(o=><OccurrenceRow key={`${o.item.id}-${o.occurrenceAt}`} o={o} locale={locale} timeZone={timeZone} onToggle={onToggle}/>)}</div>}<div className="quickRow"><button className="btn primary" onClick={()=>onAdd('TASK','09:00')}><Plus size={16}/>{t('task')}</button><button className="btn" onClick={()=>onAdd('EVENT','09:00')}><Plus size={16}/>{t('event')}</button><button className="btn" onClick={()=>onAdd('NOTE','09:00')}><Plus size={16}/>{t('note')}</button></div></>}
    {tab==='tasks'&&<><button className="btn primary full" onClick={()=>onAdd('TASK','09:00')}><Plus size={16}/>{t('task')}</button>{tasks.length?tasks.map(o=><OccurrenceRow key={`${o.item.id}-${o.occurrenceAt}`} o={o} locale={locale} timeZone={timeZone} onToggle={onToggle}/>):<div className="empty">{t('noTasks')}</div>}</>}
    {tab==='notes'&&<><button className="btn primary full" onClick={()=>onAdd('NOTE','09:00')}><Plus size={16}/>{t('note')}</button>{notes.length?notes.map(o=><OccurrenceRow key={`${o.item.id}-${o.occurrenceAt}`} o={o} locale={locale} timeZone={timeZone} onToggle={onToggle}/>):<div className="empty">{t('noNotes')}</div>}</>}</div>
  </section></div>
}

function OccurrenceRow({o,locale,timeZone,onToggle}:{o:Occurrence;locale:string;timeZone:string;onToggle:(o:Occurrence)=>void}){
  return <div className={`occRow ${o.completedAt?'completed':''}`}>{o.item.type==='TASK'?<button className={`check ${o.completedAt?'done':''}`} onClick={()=>onToggle(o)}>{o.completedAt?<Check size={14}/>:<Circle size={14}/>}</button>:<span className="typeDot"/>}<div><strong>{o.item.title}</strong><small>{o.item.allDay?'Cijeli dan':formatTime(o.occurrenceAt,locale,timeZone)}{o.item.description?` · ${o.item.description}`:''}</small></div></div>
}

function ItemEditor({initial,timeZone,t,onClose,onSave}:{initial:{type:ItemType;date:string;time:string};timeZone:string;t:(k:string)=>string;onClose:()=>void;onSave:(body:unknown)=>void}){
  const [type,setType]=useState<ItemType>(initial.type),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[date,setDate]=useState(initial.date),[time,setTime]=useState(initial.time),[allDay,setAllDay]=useState(false),[repeat,setRepeat]=useState<'NONE'|'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY'>('NONE'),[reminder,setReminder]=useState(0)
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(!title.trim())return;const at=isoForLocal(date,allDay?'09:00':time,timeZone);onSave({type,title:title.trim(),description:description||null,startAt:type==='EVENT'?at:null,endAt:null,dueAt:type==='EVENT'?null:at,allDay,priority:'MEDIUM',category:null,color:'#6f5cff',isInbox:false,repeatType:repeat,repeatInterval:1,repeatUntil:null,reminderOffsets:reminder?[reminder]:[]})}
  return <div className="overlay"><form className="modal" onSubmit={submit}><div className="sheetHead"><h2>{t('add')}</h2><button type="button" className="iconBtn" onClick={onClose}><X/></button></div><div className="segmented">{(['TASK','EVENT','NOTE'] as ItemType[]).map(x=><button type="button" key={x} className={type===x?'active':''} onClick={()=>setType(x)}>{t(x.toLowerCase())}</button>)}</div><label>{t('title')}<input autoFocus value={title} onChange={e=>setTitle(e.target.value)}/></label><label>{t('description')}<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="formGrid"><label>{t('date')}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>{t('time')}<input type="time" value={time} disabled={allDay} onChange={e=>setTime(e.target.value)}/></label></div><label className="inline"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/>{t('allDay')}</label><div className="formGrid"><label>{t('repeat')}<select value={repeat} onChange={e=>setRepeat(e.target.value as typeof repeat)}><option value="NONE">{t('none')}</option><option value="DAILY">{t('daily')}</option><option value="WEEKLY">{t('weekly')}</option><option value="MONTHLY">{t('monthly')}</option><option value="YEARLY">{t('yearly')}</option></select></label><label>{t('reminder')}<select value={reminder} onChange={e=>setReminder(Number(e.target.value))}><option value={0}>{t('none')}</option><option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option><option value={1440}>1 dan</option></select></label></div><div className="modalActions"><button type="button" className="btn" onClick={onClose}>{t('cancel')}</button><button className="btn primary" disabled={!title.trim()}>{t('save')}</button></div></form></div>
}

function HabitsScreen({boot,timeZone,t,updateLocal,commit}:Shared){
  const today=todayKey(timeZone),[open,setOpen]=useState(false),[name,setName]=useState(''),[emoji,setEmoji]=useState('💧'),[targetDay,setTargetDay]=useState(1),[targetWeek,setTargetWeek]=useState(7)
  const count=(h:Habit)=>h.checkins.find(c=>String(c.date).slice(0,10)===today)?.count||0
  const setCount=(h:Habit,next:number)=>{next=Math.max(0,Math.min(100,next));updateLocal(b=>({...b,habits:b.habits.map(x=>x.id!==h.id?x:{...x,checkins:next?(x.checkins.some(c=>String(c.date).slice(0,10)===today)?x.checkins.map(c=>String(c.date).slice(0,10)===today?{...c,count:next}:c):[...x.checkins,{date:`${today}T00:00:00.000Z`,count:next}]):x.checkins.filter(c=>String(c.date).slice(0,10)!==today)})}));commit(`/api/habits/${h.id}/checkin`,'POST',{date:today,count:next})}
  const streak=(h:Habit)=>{let n=0;for(let i=0;i<120;i++){const k=shiftKey(today,-i),v=h.checkins.find(c=>String(c.date).slice(0,10)===k)?.count||0;if(v>=Math.max(1,h.targetPerDay||1))n++;else break}return n}
  const save=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;setOpen(false);commit('/api/habits','POST',{name:name.trim(),emoji,targetPerWeek:targetWeek,targetPerDay:targetDay,reminderMode:'NONE',reminderTime:null,reminderIntervalMinutes:null,reminderStartTime:null,reminderEndTime:null,color:'#6f5cff'});setName('');setEmoji('💧')}
  return <div className="screen"><div className="screenHead"><div><h1>{t('habits')}</h1><p>{t('instant')}</p></div><button className="btn primary" onClick={()=>setOpen(true)}><Plus size={17}/>{t('newHabit')}</button></div>{boot.habits.length?<div className="habitGrid">{boot.habits.map(h=>{const current=count(h),target=Math.max(1,h.targetPerDay||1),done=current>=target;return <article className="card habitCard" key={h.id}><div className="habitTitle"><span>{h.emoji}</span><div><h3>{h.name}</h3><small><Flame size={12}/>{streak(h)} {t('streak')}</small></div></div><div className="progress"><i style={{width:`${Math.min(100,current/target*100)}%`}}/></div><div className="counter"><button className="iconBtn" onClick={()=>setCount(h,current-1)} disabled={current<=0}><Minus/></button><strong className={done?'done':''}>{done?<Check/>:current}<small>/{target}</small></strong><button className="iconBtn primary" onClick={()=>setCount(h,current+1)}><Plus/></button></div></article>})}</div>:<div className="empty card">{t('noHabits')}</div>}{open&&<div className="overlay"><form className="modal" onSubmit={save}><div className="sheetHead"><h2>{t('newHabit')}</h2><button type="button" className="iconBtn" onClick={()=>setOpen(false)}><X/></button></div><div className="formGrid"><label>Emoji<input value={emoji} maxLength={4} onChange={e=>setEmoji(e.target.value)}/></label><label>{t('targetDay')}<input type="number" min={1} max={50} value={targetDay} onChange={e=>setTargetDay(Number(e.target.value))}/></label></div><label>{t('title')}<input autoFocus value={name} onChange={e=>setName(e.target.value)}/></label><label>{t('targetWeek')}<input type="number" min={1} max={7} value={targetWeek} onChange={e=>setTargetWeek(Number(e.target.value))}/></label><div className="modalActions"><button type="button" className="btn" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div></form></div>}</div>
}

function MoreScreen({t,go}:{t:(k:string)=>string;go:(v:View)=>void}){
  const groups=[{title:t('planning'),items:[['tasks',CheckSquare2],['notes',NotebookPen],['daysOff',CalendarOff]]},{title:t('progress'),items:[['focus',TimerReset],['insights',BarChart3],['checkin',SmilePlus]]},{title:t('app'),items:[['settings',SettingsIcon],['info',Info]]}] as const
  return <div className="screen"><div className="screenHead"><div><h1>{t('more')}</h1><p>{t('instant')}</p></div></div>{groups.map(g=><section className="moreGroup" key={g.title}><h2>{g.title}</h2>{g.items.map(([id,Icon])=><button className="moreRow card" key={id} onClick={()=>go(id as View)}><span className="moreIcon"><Icon/></span><strong>{t(id)}</strong><ChevronRight/></button>)}</section>)}</div>
}

function ItemsScreen({type,boot,timeZone,locale,t,updateLocal,commit}:Shared&{type:'TASK'|'NOTE';locale:string}){
  const list=boot.items.filter(x=>x.type===type&&!x.isInbox).sort((a,b)=>new Date(b.dueAt||b.startAt||b.createdAt||0).getTime()-new Date(a.dueAt||a.startAt||a.createdAt||0).getTime())
  const [editor,setEditor]=useState(false)
  const toggle=(item:PlannerItem)=>{if(type!=='TASK')return;const next=!item.completedAt;updateLocal(b=>({...b,items:b.items.map(x=>x.id===item.id?{...x,completedAt:next?new Date().toISOString():null}:x)}));const at=item.dueAt||item.startAt;if(at)commit(`/api/items/${item.id}/occurrence`,'POST',{occurrenceAt:at,completed:next})}
  return <div className="screen"><div className="screenHead"><div><h1>{t(type==='TASK'?'tasks':'notes')}</h1></div><button className="btn primary" onClick={()=>setEditor(true)}><Plus size={16}/>{t('add')}</button></div><div className="list">{list.length?list.map(item=><div className={`card listRow ${item.completedAt?'completed':''}`} key={item.id}>{type==='TASK'?<button className={`check ${item.completedAt?'done':''}`} onClick={()=>toggle(item)}>{item.completedAt?<Check/>:<Circle/>}</button>:<NotebookPen/>}<div><strong>{item.title}</strong><small>{item.dueAt||item.startAt?new Intl.DateTimeFormat(locale,{timeZone,dateStyle:'medium'}).format(new Date(item.dueAt||item.startAt!)):''}{item.description?` · ${item.description}`:''}</small></div></div>):<div className="empty card">{t(type==='TASK'?'noTasks':'noNotes')}</div>}</div>{editor&&<ItemEditor initial={{type,date:todayKey(timeZone),time:'09:00'}} timeZone={timeZone} t={t} onClose={()=>setEditor(false)} onSave={body=>{setEditor(false);commit('/api/items','POST',body)}}/>}</div>
}

function FocusScreen({boot,t,commit}:{boot:Bootstrap;t:(k:string)=>string;commit:(path:string,method:string,body?:unknown)=>void}){
  const minutes=boot.settings?.focusMinutes||25,[left,setLeft]=useState(minutes*60),[running,setRunning]=useState(false),startRef=useRef<Date|null>(null)
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setLeft(v=>{if(v<=1){setRunning(false);const end=new Date(),start=startRef.current||new Date(end.getTime()-minutes*60000);commit('/api/focus','POST',{durationMin:minutes,label:'PlanDan Focus',startedAt:start.toISOString(),endedAt:end.toISOString(),completed:true});return minutes*60}return v-1}),1000);return()=>clearInterval(timer)},[running,minutes])
  const mm=String(Math.floor(left/60)).padStart(2,'0'),ss=String(left%60).padStart(2,'0')
  return <div className="screen focusScreen"><div className="screenHead"><h1>{t('focus')}</h1></div><div className="focusClock card"><TimerReset size={44}/><strong>{mm}:{ss}</strong><div><button className="btn primary" onClick={()=>{if(!running&&!startRef.current)startRef.current=new Date();setRunning(!running)}}>{running?t('pause'):t('start')}</button><button className="btn" onClick={()=>{setRunning(false);setLeft(minutes*60);startRef.current=null}}>{t('reset')}</button></div></div></div>
}

function InsightsScreen({boot,timeZone,t}:{boot:Bootstrap;timeZone:string;t:(k:string)=>string}){
  const today=todayKey(timeZone),weekStart=shiftKey(today,-6),weekFrom=dayStart(weekStart,timeZone),weekTo=dayEnd(today,timeZone),occ=occurrencesBetween(boot,weekFrom,weekTo,timeZone),tasks=occ.filter(x=>x.item.type==='TASK'),done=tasks.filter(x=>x.completedAt).length,focus=boot.focusSessions.filter(x=>new Date(x.startedAt)>=weekFrom&&new Date(x.startedAt)<=weekTo&&x.completed).reduce((s,x)=>s+x.durationMin,0),habitDone=boot.habits.filter(h=>(h.checkins.find(c=>String(c.date).slice(0,10)===today)?.count||0)>=Math.max(1,h.targetPerDay||1)).length
  return <div className="screen"><div className="screenHead"><h1>{t('insights')}</h1></div><div className="stats"><article className="card"><CheckSquare2/><strong>{done}/{tasks.length}</strong><span>{t('weekDone')}</span></article><article className="card"><TimerReset/><strong>{focus}</strong><span>{t('focusMinutes')}</span></article><article className="card"><Target/><strong>{habitDone}/{boot.habits.length}</strong><span>{t('habitsDone')}</span></article></div></div>
}

function CheckinScreen({boot,timeZone,t,updateLocal,commit}:Shared){
  const today=todayKey(timeZone),existing=boot.reflections.find(x=>String(x.date).slice(0,10)===today),[mood,setMood]=useState(existing?.mood||3),[energy,setEnergy]=useState(existing?.energy||3),[gratitude,setGratitude]=useState(existing?.gratitude||''),[note,setNote]=useState(existing?.note||'')
  const save=()=>{const row:Reflection={...(existing||{}),date:`${today}T00:00:00.000Z`,mood,energy,gratitude,note};updateLocal(b=>({...b,reflections:[...b.reflections.filter(x=>String(x.date).slice(0,10)!==today),row]}));commit('/api/reflection','PUT',{date:today,mood,energy,gratitude:gratitude||null,note:note||null})}
  return <div className="screen"><div className="screenHead"><h1>{t('checkin')}</h1></div><div className="card checkinCard"><Scale label={t('mood')} value={mood} set={setMood}/><Scale label={t('energy')} value={energy} set={setEnergy}/><label>{t('gratitude')}<textarea value={gratitude} onChange={e=>setGratitude(e.target.value)}/></label><label>{t('reflection')}<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><button className="btn primary full" onClick={save}>{t('save')}</button></div></div>
}
function Scale({label,value,set}:{label:string;value:number;set:(n:number)=>void}){return <div className="scale"><strong>{label}</strong><div>{[1,2,3,4,5].map(n=><button key={n} className={value===n?'active':''} onClick={()=>set(n)}>{n}</button>)}</div></div>}

function DaysOffScreen({boot,timeZone,t,commit}:Shared){const [date,setDate]=useState(todayKey(timeZone)),[label,setLabel]=useState('');return <div className="screen"><div className="screenHead"><h1>{t('daysOff')}</h1></div><div className="card miniForm"><div className="formGrid"><label>{t('date')}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>{t('label')}<input value={label} onChange={e=>setLabel(e.target.value)}/></label></div><button className="btn primary" disabled={!label.trim()} onClick={()=>{commit('/api/day-offs','POST',{date,label:label.trim(),color:'#ef5da8'});setLabel('')}}>{t('saveDayOff')}</button></div><div className="list">{boot.dayOffs.map(d=><div className="card listRow" key={d.id}><CalendarOff/><div><strong>{d.label}</strong><small>{String(d.date).slice(0,10)}</small></div></div>)}</div></div>}

function SettingsScreen({boot,t,updateLocal,commit}:{boot:Bootstrap;t:(k:string)=>string;updateLocal:(fn:(b:Bootstrap)=>Bootstrap)=>void;commit:(path:string,method:string,body?:unknown)=>void}){
  const s=boot.settings||({language:'HR',theme:'SYSTEM',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Zagreb',focusMinutes:25,breakMinutes:5} as Settings)
  const change=(patch:Partial<Settings>)=>{updateLocal(b=>({...b,settings:{...(b.settings||s),...patch}}));commit('/api/settings','PATCH',patch);if(patch.theme){const root=document.documentElement;root.dataset.theme=patch.theme==='SYSTEM'?'':patch.theme.toLowerCase()}}
  return <div className="screen"><div className="screenHead"><h1>{t('settings')}</h1></div><div className="card settingsCard"><label>{t('language')}<select value={s.language} onChange={e=>change({language:e.target.value as Settings['language']})}><option value="HR">🇭🇷 Hrvatski</option><option value="EN">🇬🇧 English</option><option value="DE">🇩🇪 Deutsch</option></select></label><label>{t('theme')}<select value={s.theme} onChange={e=>change({theme:e.target.value as Settings['theme']})}><option value="SYSTEM">{t('system')}</option><option value="LIGHT">{t('light')}</option><option value="DARK">{t('dark')}</option></select></label><label>{t('timezone')}<input value={s.timezone} onChange={e=>change({timezone:e.target.value})}/></label><button className="btn danger" onClick={()=>{void mutate('/api/auth/logout','POST').finally(()=>location.assign('/login'))}}>{t('logout')}</button></div></div>
}

function InfoScreen({t}:{t:(k:string)=>string}){return <div className="screen"><div className="screenHead"><h1>PlanDan v2</h1></div><div className="card infoCard"><img src="/icons/icon-192.png"/><h2>Instant local-first SPA</h2><p>{t('instant')}</p><p>{t('install')}</p><code>React + Vite · IndexedDB · background sync · existing PlanDan API</code></div></div>}
