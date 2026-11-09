import {readFile} from 'node:fs/promises';
import {db} from '../lib/db';
import {normalizeSearch} from '../lib/rules';
const c=await db.connect();try{await c.query('BEGIN');await c.query(await readFile('db/001.sql','utf8'));await c.query(await readFile('db/002.sql','utf8'));const rows=await c.query("SELECT id,title,poet,body FROM works WHERE search_text=''");for(const w of rows.rows)await c.query('UPDATE works SET search_text=$2 WHERE id=$1',[w.id,normalizeSearch(w.title+' '+w.poet+' '+w.body)]);await c.query('COMMIT');console.log('Migrations 1-2 applied');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
