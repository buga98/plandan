export type HolidayCountry = 'HR'|'DE'|'AT'|'CH'|'GB'|'US'
export type Holiday = { date:string; key:string; name:string }

type Lang='HR'|'EN'|'DE'
const names:Record<string,Record<Lang,string>>={
 newYear:{HR:'Nova godina',EN:"New Year's Day",DE:'Neujahr'}, epiphany:{HR:'Sveta tri kralja',EN:'Epiphany',DE:'Heilige Drei Könige'},
 goodFriday:{HR:'Veliki petak',EN:'Good Friday',DE:'Karfreitag'}, easter:{HR:'Uskrs',EN:'Easter Sunday',DE:'Ostersonntag'}, easterMon:{HR:'Uskrsni ponedjeljak',EN:'Easter Monday',DE:'Ostermontag'},
 labour:{HR:'Praznik rada',EN:'Labour Day',DE:'Tag der Arbeit'}, ascension:{HR:'Uzašašće',EN:'Ascension Day',DE:'Christi Himmelfahrt'}, whitMon:{HR:'Duhovski ponedjeljak',EN:'Whit Monday',DE:'Pfingstmontag'}, corpus:{HR:'Tijelovo',EN:'Corpus Christi',DE:'Fronleichnam'},
 statehood:{HR:'Dan državnosti',EN:'Statehood Day',DE:'Tag der Staatlichkeit'}, antifascist:{HR:'Dan antifašističke borbe',EN:'Anti-Fascist Struggle Day',DE:'Tag des antifaschistischen Kampfes'}, victory:{HR:'Dan pobjede i domovinske zahvalnosti',EN:'Victory and Homeland Thanksgiving Day',DE:'Tag des Sieges und der heimatlichen Dankbarkeit'}, assumption:{HR:'Velika Gospa',EN:'Assumption Day',DE:'Mariä Himmelfahrt'}, allSaints:{HR:'Svi sveti',EN:'All Saints’ Day',DE:'Allerheiligen'}, remembrance:{HR:'Dan sjećanja',EN:'Remembrance Day',DE:'Gedenktag'}, christmas:{HR:'Božić',EN:'Christmas Day',DE:'1. Weihnachtstag'}, stephen:{HR:'Sveti Stjepan',EN:'St. Stephen’s Day',DE:'Stefanitag'},
 unity:{HR:'Dan njemačkog jedinstva',EN:'German Unity Day',DE:'Tag der Deutschen Einheit'}, nationalAT:{HR:'Nacionalni dan Austrije',EN:'Austrian National Day',DE:'Nationalfeiertag'}, immaculate:{HR:'Bezgrešno začeće',EN:'Immaculate Conception',DE:'Mariä Empfängnis'}, nationalCH:{HR:'Švicarski nacionalni dan',EN:'Swiss National Day',DE:'Bundesfeier'},
 earlyMay:{HR:'Svibanjski blagdan',EN:'Early May bank holiday',DE:'Early May Bank Holiday'}, springBank:{HR:'Proljetni bank holiday',EN:'Spring bank holiday',DE:'Spring Bank Holiday'}, summerBank:{HR:'Ljetni bank holiday',EN:'Summer bank holiday',DE:'Summer Bank Holiday'}, boxing:{HR:'Boxing Day',EN:'Boxing Day',DE:'Boxing Day'},
 mlk:{HR:'Dan Martina Luthera Kinga Jr.',EN:'Martin Luther King Jr. Day',DE:'Martin Luther King Jr. Day'}, presidents:{HR:'Dan predsjednika',EN:"Presidents' Day",DE:'Presidents’ Day'}, memorial:{HR:'Memorial Day',EN:'Memorial Day',DE:'Memorial Day'}, juneteenth:{HR:'Juneteenth',EN:'Juneteenth',DE:'Juneteenth'}, independence:{HR:'Dan neovisnosti SAD-a',EN:'Independence Day',DE:'Unabhängigkeitstag'}, laborUS:{HR:'Labor Day',EN:'Labor Day',DE:'Labor Day'}, columbus:{HR:'Columbus / Indigenous Peoples’ Day',EN:'Columbus / Indigenous Peoples’ Day',DE:'Columbus / Indigenous Peoples’ Day'}, veterans:{HR:'Dan veterana',EN:'Veterans Day',DE:'Veterans Day'}, thanksgiving:{HR:'Dan zahvalnosti',EN:'Thanksgiving Day',DE:'Thanksgiving'}
}
function key(d:Date){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
function at(y:number,m:number,d:number){return new Date(Date.UTC(y,m-1,d))}
function add(d:Date,n:number){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x}
function easterSunday(year:number){
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1
 return at(year,month,day)
}
function nthWeekday(year:number,month:number,weekday:number,n:number){const first=at(year,month,1);const delta=(weekday-first.getUTCDay()+7)%7;return at(year,month,1+delta+(n-1)*7)}
function lastWeekday(year:number,month:number,weekday:number){const last=at(year,month+1,0);const delta=(last.getUTCDay()-weekday+7)%7;return add(last,-delta)}
function observed(d:Date){const wd=d.getUTCDay();return wd===6?add(d,2):wd===0?add(d,1):d}
export function holidaysForYear(year:number,country:HolidayCountry,lang:Lang='HR'):Holiday[]{
 const e=easterSunday(year); const raw:{d:Date;k:string}[]=[]; const push=(d:Date,k:string)=>raw.push({d,k})
 push(at(year,1,1),'newYear')
 if(country==='HR'){
  push(at(year,1,6),'epiphany');push(e,'easter');push(add(e,1),'easterMon');push(at(year,5,1),'labour');push(add(e,60),'corpus');push(at(year,5,30),'statehood');push(at(year,6,22),'antifascist');push(at(year,8,5),'victory');push(at(year,8,15),'assumption');push(at(year,11,1),'allSaints');push(at(year,11,18),'remembrance');push(at(year,12,25),'christmas');push(at(year,12,26),'stephen')
 } else if(country==='DE'){
  push(add(e,-2),'goodFriday');push(add(e,1),'easterMon');push(at(year,5,1),'labour');push(add(e,39),'ascension');push(add(e,50),'whitMon');push(at(year,10,3),'unity');push(at(year,12,25),'christmas');push(at(year,12,26),'stephen')
 } else if(country==='AT'){
  push(at(year,1,6),'epiphany');push(add(e,1),'easterMon');push(at(year,5,1),'labour');push(add(e,39),'ascension');push(add(e,50),'whitMon');push(add(e,60),'corpus');push(at(year,8,15),'assumption');push(at(year,10,26),'nationalAT');push(at(year,11,1),'allSaints');push(at(year,12,8),'immaculate');push(at(year,12,25),'christmas');push(at(year,12,26),'stephen')
 } else if(country==='CH'){
  push(add(e,39),'ascension');push(at(year,8,1),'nationalCH');push(at(year,12,25),'christmas')
 } else if(country==='GB'){
  push(add(e,-2),'goodFriday');push(add(e,1),'easterMon');push(nthWeekday(year,5,1,1),'earlyMay');push(lastWeekday(year,5,1),'springBank');push(lastWeekday(year,8,1),'summerBank');push(observed(at(year,12,25)),'christmas');let box=observed(at(year,12,26));if(key(box)===key(observed(at(year,12,25))))box=add(box,1);push(box,'boxing')
 } else if(country==='US'){
  raw[0]={d:observed(at(year,1,1)),k:'newYear'};push(nthWeekday(year,1,1,3),'mlk');push(nthWeekday(year,2,1,3),'presidents');push(lastWeekday(year,5,1),'memorial');push(observed(at(year,6,19)),'juneteenth');push(observed(at(year,7,4)),'independence');push(nthWeekday(year,9,1,1),'laborUS');push(nthWeekday(year,10,1,2),'columbus');push(observed(at(year,11,11)),'veterans');push(nthWeekday(year,11,4,4),'thanksgiving');push(observed(at(year,12,25)),'christmas')
 }
 const dedup=new Map<string,{d:Date;k:string}>();for(const x of raw)dedup.set(`${key(x.d)}-${x.k}`,x)
 return [...dedup.values()].sort((a,b)=>a.d.getTime()-b.d.getTime()).map(x=>({date:key(x.d),key:x.k,name:names[x.k]?.[lang]||names[x.k]?.HR||x.k}))
}
export function holidaysBetween(from:Date,to:Date,country:HolidayCountry,lang:Lang='HR'){
 const out:Holiday[]=[];for(let y=from.getFullYear();y<=to.getFullYear();y++)out.push(...holidaysForYear(y,country,lang));const a=`${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`,b=`${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`;return out.filter(h=>h.date>=a&&h.date<=b)
}
