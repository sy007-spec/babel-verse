import {safeId,safeLanguage} from './rules';
import {createSearch} from './search-core.mjs';
export function markdown(meta:Record<string,unknown>,body:string){return '---\n'+Object.keys(meta).sort().map(k=>k+': '+JSON.stringify(meta[k])).join('\n')+'\n---\n\n'+body.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'\n';}
export function originalPath(language:string,id:string){return `originals/${safeLanguage(language)}/${safeId(id)}/edition-1.md`;}
export function translationPath(language:string,work:string,id:string,version:string){return `translations/${safeLanguage(language)}/${safeId(work)}/${safeId(id)}/${safeId(version)}.md`;}

export type CatalogWork={id:string,title:string,poet:string,language:string,genre?:string,body:string,collections:{id:string,number:number}[],moods:string[],translations:{language:string,path:string,body:string}[]};
const firstLine=(body:string)=>body.replace(/\r\n/g,'\n').split('\n').find(l=>l.trim())?.trim()||'';
const cell=(s:string)=>s.replace(/[\[\]|]/g,c=>'\\'+c).replace(/\n/g,' ');
/**
 * Search support for the Git mirror: a simplified `search:` front-matter line per original,
 * one-record-per-line JSONL, the character table, human indexes and the standalone CLI.
 * Only already-public fields are written.
 */
export function searchFiles(works:CatalogWork[],map:Record<string,string>,tools:{cli:string,core:string,guide:string}){
  const {normalize}=createSearch(map),files:Record<string,string>={},key=(s:string)=>normalize(s)||s;
  const sorted=[...works].sort((a,b)=>key(a.title).localeCompare(key(b.title),'zh')||a.id.localeCompare(b.id));
  files['search/works.jsonl']=sorted.map(w=>JSON.stringify({id:w.id,path:originalPath(w.language,w.id),title:w.title,poet:w.poet,language:w.language,genre:w.genre||'',first_line:firstLine(w.body),collections:w.collections,moods:w.moods,translations:w.translations,body:w.body})).join('\n')+'\n';
  files['search/t2s.json']=JSON.stringify(map)+'\n';
  files['search/core.mjs']=tools.core;files['search.mjs']=tools.cli;files['SEARCH.md']=tools.guide;
  const link=(w:CatalogWork,from:string)=>`[${cell(w.title)}](${from}${originalPath(w.language,w.id)})`;
  const poets=new Map<string,CatalogWork[]>();for(const w of sorted){const k=key(w.poet);poets.set(k,[...(poets.get(k)||[]),w]);}
  files['indexes/poets.md']=markdown({kind:'index',by:'poet'},[...poets.entries()].sort(([a],[b])=>a.localeCompare(b,'zh')).map(([,ws])=>`## ${cell([...new Set(ws.map(w=>w.poet))].sort().join(' / '))}（${ws.length}）\n\n`+ws.map(w=>`- ${link(w,'../')} · ${cell(firstLine(w.body))}`).join('\n')).join('\n\n'));
  files['indexes/first-lines.md']=markdown({kind:'index',by:'first-line'},[...works].sort((a,b)=>key(firstLine(a.body)).localeCompare(key(firstLine(b.body)),'zh')||a.id.localeCompare(b.id)).map(w=>`- ${cell(firstLine(w.body))} — ${link(w,'../')} · ${cell(w.poet)}`).join('\n'));
  for(const lang of [...new Set(works.map(w=>w.language))].sort())files[`indexes/${lang}/index.md`]=markdown({language:lang,kind:'index'},'| 标题 Title | 作者 Poet | 首句 First line |\n|---|---|---|\n'+sorted.filter(w=>w.language===lang).map(w=>`| ${link(w,'../../')} | ${cell(w.poet)} | ${cell(firstLine(w.body))} |`).join('\n'));
  return files;
}
/** Simplified, punctuation-free title/poet/text for GitHub code search over traditional originals. */
export function searchLine(w:{title:string,poet:string,body:string},map:Record<string,string>){const {normalize}=createSearch(map);return [w.title,w.poet,w.body].map(normalize).join(' ');}
