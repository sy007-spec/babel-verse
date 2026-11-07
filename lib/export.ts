import {safeId,safeLanguage} from './rules';
export function markdown(meta:Record<string,unknown>,body:string){return '---\n'+Object.keys(meta).sort().map(k=>k+': '+JSON.stringify(meta[k])).join('\n')+'\n---\n\n'+body.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'\n';}
export function originalPath(language:string,id:string){return `originals/${safeLanguage(language)}/${safeId(id)}/edition-1.md`;}
export function translationPath(language:string,work:string,id:string,version:string){return `translations/${safeLanguage(language)}/${safeId(work)}/${safeId(id)}/${safeId(version)}.md`;}
