'use client'

import { Lang } from '@/lib/i18n'

const languages:{code:Lang;label:string;short:string;icon:string}[]=[
 {code:'HR',label:'Hrvatski',short:'HR',icon:'/languages/hr.png'},
 {code:'EN',label:'English',short:'EN',icon:'/languages/en.svg'},
 {code:'DE',label:'Deutsch',short:'DE',icon:'/languages/de.svg'},
]

export default function LanguageSwitch({value,onChange,compact=true}:{value:Lang;onChange:(lang:Lang)=>void;compact?:boolean}){
 return <div className={`langSwitch ${compact?'compact':'languageCards'}`} role="group" aria-label="Language">
  {languages.map(language=><button
   type="button"
   key={language.code}
   className={value===language.code?'active':''}
   onClick={()=>onChange(language.code)}
   title={language.label}
   aria-pressed={value===language.code}
  >
   <img src={language.icon} alt="" aria-hidden="true"/>
   <span>{compact?language.short:language.label}</span>
  </button>)}
 </div>
}
