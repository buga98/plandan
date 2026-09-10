'use client'
import { BarChart3, CalendarOff, CheckSquare2, ChevronRight, Info, NotebookPen, Settings, SmilePlus, TimerReset } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import FastLink from './FastLink'
const groups=[
 {title:'planningTools',items:[{href:'/app/more/tasks',key:'allTasks',desc:'allTasksHint',icon:CheckSquare2},{href:'/app/more/notes',key:'allNotes',desc:'allNotesHint',icon:NotebookPen},{href:'/app/more/days-off',key:'holidaysDaysOff',desc:'holidaysHint',icon:CalendarOff}]},
 {title:'progressTools',items:[{href:'/app/focus',key:'focus',desc:'focusMoreHint',icon:TimerReset},{href:'/app/insights',key:'insights',desc:'insightsMoreHint',icon:BarChart3},{href:'/app/more/checkin',key:'reflections',desc:'checkinMoreHint',icon:SmilePlus}]},
 {title:'appTools',items:[{href:'/app/settings',key:'settings',desc:'settingsMoreHint',icon:Settings},{href:'/info',key:'info',desc:'infoMoreHint',icon:Info}]}
]
export default function MoreClient(){const {t}=useI18n();return <div className="morePage"><div className="simplePageHead"><h1>{t('more')}</h1><p>{t('moreSubtitle')}</p></div>{groups.map(g=><section key={g.title} className="moreSection"><h2>{t(g.title)}</h2><div className="moreList">{g.items.map(({href,key,desc,icon:Icon})=><FastLink href={href} className="moreRow card" key={href}><span className="moreIcon"><Icon size={20}/></span><span className="moreCopy"><strong>{t(key)}</strong><small>{t(desc)}</small></span><ChevronRight size={19} className="muted"/></FastLink>)}</div></section>)}</div>}
