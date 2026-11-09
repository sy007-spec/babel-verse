import {z} from 'zod';
import {db} from './db';

export const SECTIONS=['summary','favorites','history','comments','submissions'] as const;
export type Section=typeof SECTIONS[number];
const uuid=z.string().uuid();
export const accountAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('favorite'),work_id:uuid,on:z.boolean()}),
 z.object({action:z.literal('read'),work_id:uuid}),
 z.object({action:z.literal('forget'),work_id:uuid}),
 z.object({action:z.literal('clear_history')}),
 z.object({action:z.literal('delete_comment'),id:uuid})]);
export type AccountAction=z.infer<typeof accountAction>;
/** Daily per-account limits for account writes (reads are cheap but still bounded). */
export const ACTION_LIMIT:Record<AccountAction['action'],number>={favorite:300,read:1000,forget:300,clear_history:20,delete_comment:100};

const work='w.id AS work_id,w.title,w.poet,w.language';
/** Everything here is the signed-in reader's own data; other readers' private rows are never joined in. */
export async function accountSection(user:string,section:Section){
 if(section==='summary'){const r=await db.query(`SELECT
  (SELECT count(*)::int FROM favorites f JOIN works w ON w.id=f.work_id AND w.status='published' WHERE f.user_id=$1) AS favorites,
  (SELECT count(*)::int FROM reading_history h JOIN works w ON w.id=h.work_id AND w.status='published' WHERE h.user_id=$1) AS history,
  (SELECT count(*)::int FROM comments WHERE author_id=$1 AND status<>'deleted') AS comments,
  (SELECT count(*)::int FROM translations WHERE author_id=$1)+(SELECT count(*)::int FROM works WHERE author_id=$1)+(SELECT count(*)::int FROM tags WHERE author_id=$1)+(SELECT count(*)::int FROM votes WHERE author_id=$1)+(SELECT count(*)::int FROM payment_orders WHERE author_id=$1) AS submissions`,[user]);return r.rows[0];}
 if(section==='favorites')return {items:(await db.query(`SELECT ${work},f.created_at FROM favorites f JOIN works w ON w.id=f.work_id AND w.status='published' WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 500`,[user])).rows};
 if(section==='history')return {items:(await db.query(`SELECT ${work},h.first_read_at,h.last_read_at,h.read_count FROM reading_history h JOIN works w ON w.id=h.work_id AND w.status='published' WHERE h.user_id=$1 ORDER BY h.last_read_at DESC LIMIT 500`,[user])).rows};
 if(section==='comments')return {items:(await db.query(`SELECT c.id,c.body,c.status,c.created_at,${work} FROM comments c JOIN works w ON w.id=c.work_id WHERE c.author_id=$1 AND c.status<>'deleted' ORDER BY c.created_at DESC LIMIT 500`,[user])).rows};
 const [versions,works,tags,votes,orders]=await Promise.all([
  db.query(`SELECT t.id,t.language,t.ai_use,v.id AS version_id,v.body,v.status,v.created_at,${work} FROM translations t JOIN versions v ON v.translation_id=t.id JOIN works w ON w.id=t.work_id WHERE t.author_id=$1 ORDER BY v.created_at DESC LIMIT 200`,[user]),
  db.query('SELECT id,title,poet,status,created_at FROM works WHERE author_id=$1 ORDER BY created_at DESC LIMIT 200',[user]),
  db.query(`SELECT g.id,g.labels,g.status,g.created_at,${work} FROM tags g JOIN works w ON w.id=g.work_id WHERE g.author_id=$1 ORDER BY g.created_at DESC LIMIT 200`,[user]),
  db.query(`SELECT o.id,o.score,o.created_at,t.language,${work} FROM votes o JOIN translations t ON t.id=o.translation_id JOIN works w ON w.id=t.work_id WHERE o.author_id=$1 ORDER BY o.created_at DESC LIMIT 200`,[user]),
  db.query('SELECT id,state,work_id,amount_cents,created_at FROM payment_orders WHERE author_id=$1 ORDER BY created_at DESC LIMIT 100',[user])]);
 return {versions:versions.rows,works:works.rows,tags:tags.rows,votes:votes.rows,orders:orders.rows};
}

/** Returns false when the target does not exist or does not belong to the reader. */
export async function applyAccountAction(user:string,a:AccountAction){
 const published=async(id:string)=>!!(await db.query("SELECT 1 FROM works WHERE id=$1 AND status='published'",[id])).rowCount;
 if(a.action==='favorite'){if(!a.on){await db.query('DELETE FROM favorites WHERE user_id=$1 AND work_id=$2',[user,a.work_id]);return true;}
  if(!await published(a.work_id))return false;await db.query('INSERT INTO favorites(user_id,work_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user,a.work_id]);return true;}
 if(a.action==='read'){if(!await published(a.work_id))return false;await db.query('INSERT INTO reading_history(user_id,work_id) VALUES($1,$2) ON CONFLICT(user_id,work_id) DO UPDATE SET last_read_at=now(),read_count=reading_history.read_count+1',[user,a.work_id]);return true;}
 if(a.action==='forget'){await db.query('DELETE FROM reading_history WHERE user_id=$1 AND work_id=$2',[user,a.work_id]);return true;}
 if(a.action==='clear_history'){await db.query('DELETE FROM reading_history WHERE user_id=$1',[user]);return true;}
 // Comments are withdrawn, not erased: the moderation audit trail keeps its target.
 return !!(await db.query("UPDATE comments SET status='deleted',deleted_at=now() WHERE id=$1 AND author_id=$2 AND status<>'deleted'",[a.id,user])).rowCount;
}
