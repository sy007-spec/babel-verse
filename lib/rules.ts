import {createHash} from 'node:crypto';
import {Converter} from 'opencc-js';
const simplified=Converter({from:'t',to:'cn'});
export function normalizeSearch(text:string){return simplified(text.normalize('NFKC')).toLowerCase();}
export function fingerprint(text:string){ return createHash('sha256').update(normalizeSearch(text).replace(/[\p{P}\p{Z}\s]/gu,'')).digest('hex'); }
export function units(text:string){return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text.normalize('NFC').replace(/\r\n/g,'\n').trim()),v=>v.segment);}
export function changeRatio(base:string,next:string){
 const a=units(base),b=units(next); if(!a.length)return b.length?1:0;
 if(Math.abs(a.length-b.length)/a.length>.3)return 1;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const n=[i]; for(let j=1;j<=b.length;j++)n[j]=Math.min(n[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=n;}
 return row[b.length]/a.length;
}
export function checkRevision(first:string,previous:string,next:string){return changeRatio(first,next)<=.3&&changeRatio(previous,next)<=.3;}
export const moods=['homesick','peaceful','hopeful','melancholy','love','wonder'] as const;
export function safeLanguage(s:string){try {return Intl.getCanonicalLocales(s)[0]||'und';}catch{throw new Error('INVALID_LANGUAGE');}}
export function safeId(s:string){if(!/^[a-zA-Z0-9_-]+$/.test(s))throw new Error('INVALID_PATH');return s;}
