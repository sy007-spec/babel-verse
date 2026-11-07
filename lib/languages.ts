export const languages=[['zh-Hans','简体中文'],['en','English'],['fr','Français'],['es','Español'],['ar','العربية'],['pt','Português'],['de','Deutsch'],['it','Italiano']];
export function supportedLanguage(value:string|null|undefined){return languages.some(([id])=>id===value)?value!:'en';}
