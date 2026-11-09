// Real PostgreSQL check of account features in a throwaway database: run inside the worker container.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const admin=new Pool({connectionString:process.env.DATABASE_URL}),name='babelverse_test_'+randomUUID().replaceAll('-','');
await admin.query(`CREATE DATABASE ${name}`);const u=new URL(process.env.DATABASE_URL!);u.pathname='/'+name;process.env.DATABASE_URL=u.href;
const {db}=await import('../lib/db');const {accountSection,applyAccountAction}=await import('../lib/account');
try{
 for(const f of ['db/001.sql','db/002.sql','db/002.sql'])await db.query(await readFile(f,'utf8'));console.log('PASS: migrations apply and 002 is idempotent');
 await db.query("INSERT INTO users(id,name) VALUES('a','A'),('b','B')");const w=randomUUID(),hidden=randomUUID();
 for(const [id,status] of [[w,'published'],[hidden,'pending']])await db.query("INSERT INTO works(id,author_id,title,poet,language,body,fingerprint,source_url,citation,rights,status) VALUES($1,'a','T','P','lzh',$3,$3,'https://example.org','c','public-domain',$2)",[id,status,'body '+id]);
 assert.equal(await applyAccountAction('a',{action:'favorite',work_id:hidden,on:true}),false);assert.equal(await applyAccountAction('a',{action:'read',work_id:hidden}),false);console.log('PASS: unpublished works cannot be favorited or recorded');
 for(let i=0;i<2;i++)assert.equal(await applyAccountAction('a',{action:'favorite',work_id:w,on:true}),true);
 await Promise.all(Array.from({length:5},()=>applyAccountAction('a',{action:'read',work_id:w})));
 const h=(await accountSection('a','history') as any).items;assert.equal(h.length,1);assert.equal(h[0].read_count,5);assert.equal((await accountSection('a','favorites') as any).items.length,1);
 assert.equal((await accountSection('b','favorites') as any).items.length,0);assert.equal((await accountSection('b','history') as any).items.length,0);console.log('PASS: favorites idempotent, 5 concurrent reads counted once per poem, data isolated per account');
 const c=randomUUID();await db.query("INSERT INTO comments(id,work_id,author_id,device,body) VALUES($1,$2,'a','d','hello')",[c,w]);await db.query("INSERT INTO jobs(id,kind,target) VALUES($1,'comment',$2)",[randomUUID(),c]);
 await assert.rejects(db.query("INSERT INTO comments(id,work_id,author_id,device,body) VALUES($1,$2,'a','d','')",[randomUUID(),w]));
 assert.equal(await applyAccountAction('b',{action:'delete_comment',id:c}),false);assert.equal(await applyAccountAction('a',{action:'delete_comment',id:c}),true);assert.equal(await applyAccountAction('a',{action:'delete_comment',id:c}),false);
 assert.equal((await accountSection('a','comments') as any).items.length,0);assert.equal((await db.query('SELECT status FROM comments WHERE id=$1',[c])).rows[0].status,'deleted');console.log('PASS: comment jobs accepted; only the author can withdraw; withdrawn comments hidden but kept');
 const s:any=await accountSection('a','summary');assert.deepEqual([s.favorites,s.history,s.comments],[1,1,0]);
 await applyAccountAction('a',{action:'favorite',work_id:w,on:false});await applyAccountAction('a',{action:'clear_history'});const t:any=await accountSection('a','summary');assert.deepEqual([t.favorites,t.history],[0,0]);console.log('PASS: unfavorite and clear history');
 const sub:any=await accountSection('a','submissions');assert.equal(sub.works.length,2);for(const k of ['versions','tags','votes','orders'])assert.deepEqual(sub[k],[]);assert.equal((await accountSection('b','submissions') as any).works.length,0);console.log('PASS: submissions list only the reader own rows');
}finally{await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();}
