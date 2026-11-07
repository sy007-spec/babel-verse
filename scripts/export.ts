import {db} from '../lib/db';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {markdown,originalPath,translationPath} from '../lib/export';
const root='/export/catalog',c=await db.connect(),files:Record<string,string>={};
try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const works=(await c.query("SELECT id,title,poet,language,body,source_url,citation,rights FROM works WHERE status='published' ORDER BY id")).rows;
for(const w of works){const {body,...meta}=w;files[originalPath(w.language,w.id)]=markdown({...meta,kind:'original',status:'published'},body);}
const versions=(await c.query("SELECT t.id,t.work_id,t.language,t.ai_use,u.name AS author,v.id AS version_id,v.body,v.created_at FROM translations t JOIN versions v ON v.translation_id=t.id JOIN works w ON w.id=t.work_id JOIN users u ON u.id=t.author_id WHERE t.mirror_consent AND w.status='published' AND v.status='published' ORDER BY t.id,v.created_at,v.id")).rows;
for(const v of versions){const {body,...meta}=v;files[translationPath(v.language,v.work_id,v.id,v.version_id)]=markdown({...meta,kind:'translation',rights:'Copyright retained by author. No reuse license granted.',status:'published'},body);}
for(const lang of [...new Set(works.map(w=>w.language))]){files[`indexes/${lang}/index.md`]=markdown({language:lang,kind:'index'},works.filter(w=>w.language===lang).map(w=>`- [${w.id}](../../${originalPath(w.language,w.id)})`).join('\n'));}
const tags=(await c.query("SELECT work_id,labels FROM tags JOIN works ON works.id=tags.work_id WHERE tags.status='published' AND works.status='published' ORDER BY work_id,labels::text")).rows;
files['taxonomy/moods.json']=JSON.stringify(tags,null,2)+'\n';await c.query('COMMIT');
// Rebuild only the dedicated generated directory, never a repository or runtime parent.
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
for(const path of Object.keys(files).sort()){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),files[path]);}
const manifest={schema:1,files:Object.keys(files).sort().map(path=>({path,sha256:createHash('sha256').update(files[path]).digest('hex')}))};await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Exported ${works.length} works, ${versions.length} versions; private data excluded`);
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
