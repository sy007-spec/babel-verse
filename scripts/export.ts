import {db} from '../lib/db';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {markdown,originalPath,translationPath,searchFiles,searchLine,type CatalogWork} from '../lib/export';
import {charMap} from '../lib/charmap';
const root='/export/catalog',c=await db.connect(),files:Record<string,string>={},map=charMap(),src=(p:string)=>readFile(join(import.meta.dirname,'..',p),'utf8');
try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const works=(await c.query("SELECT id,title,poet,language,genre,body,source_url,citation,rights FROM works WHERE status='published' ORDER BY id")).rows;
for(const w of works){const {body,genre,...meta}=w;files[originalPath(w.language,w.id)]=markdown({...meta,kind:'original',status:'published',search:searchLine(w,map)},body);}
const versions=(await c.query("SELECT t.id,t.work_id,t.language,t.ai_use,u.name AS author,v.id AS version_id,v.body,v.created_at FROM translations t JOIN versions v ON v.translation_id=t.id JOIN works w ON w.id=t.work_id JOIN users u ON u.id=t.author_id WHERE t.mirror_consent AND w.status='published' AND v.status='published' ORDER BY t.id,v.created_at,v.id")).rows;
for(const v of versions){const {body,...meta}=v;files[translationPath(v.language,v.work_id,v.id,v.version_id)]=markdown({...meta,kind:'translation',rights:'Copyright retained by author. No reuse license granted.',status:'published'},body);}
const members=(await c.query("SELECT e.collection_id,e.number,w.id,w.title,w.language FROM collection_entries e JOIN works w ON w.id=e.work_id WHERE w.status='published' ORDER BY e.collection_id,e.number")).rows;
for(const id of [...new Set(members.map(m=>m.collection_id))])files[`collections/${id}/index.md`]=markdown({kind:'collection',id},members.filter(m=>m.collection_id===id).map(m=>`- ${String(m.number).padStart(3,'0')} [${m.title}](../../${originalPath(m.language,m.id)})`).join('\n'));
const tags=(await c.query("SELECT work_id,labels FROM tags JOIN works ON works.id=tags.work_id WHERE tags.status='published' AND works.status='published' ORDER BY work_id,labels::text")).rows;
files['taxonomy/moods.json']=JSON.stringify(tags,null,2)+'\n';await c.query('COMMIT');
// Search records reuse exactly the public rows above: latest consented version per translation.
const latest=new Map<string,typeof versions[number]>();for(const v of versions)latest.set(v.id,v);
const records:CatalogWork[]=works.map(w=>({id:w.id,title:w.title,poet:w.poet,language:w.language,genre:w.genre,body:w.body,
  collections:members.filter(m=>m.id===w.id).map(m=>({id:m.collection_id,number:m.number})),
  moods:[...new Set(tags.filter(t=>t.work_id===w.id).flatMap(t=>Array.isArray(t.labels)?t.labels:[]))].sort(),
  translations:[...latest.values()].filter(v=>v.work_id===w.id).map(v=>({language:v.language,path:translationPath(v.language,v.work_id,v.id,v.version_id),body:v.body}))}));
Object.assign(files,searchFiles(records,map,{core:await src('lib/search-core.mjs'),cli:await src('catalog-tools/search.mjs'),guide:await src('catalog-tools/SEARCH.md')}));
// Rebuild only the dedicated generated directory, never a repository or runtime parent.
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
for(const path of Object.keys(files).sort()){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),files[path]);}
const manifest={schema:1,files:Object.keys(files).sort().map(path=>({path,sha256:createHash('sha256').update(files[path]).digest('hex')}))};await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Exported ${works.length} works, ${versions.length} versions, search index ${records.length}; private data excluded`);
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
