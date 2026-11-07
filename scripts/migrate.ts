import {readFile} from 'node:fs/promises';
import {db} from '../lib/db';
const c=await db.connect();try{await c.query('BEGIN');await c.query(await readFile('db/001.sql','utf8'));await c.query('COMMIT');console.log('Migration 1 applied');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
