import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const admin=new Pool({connectionString:process.env.DATABASE_URL}),name='babelverse_paytest_'+randomUUID().replaceAll('-','');
await admin.query(`CREATE DATABASE ${name}`);const u=new URL(process.env.DATABASE_URL!);u.pathname='/'+name;process.env.DATABASE_URL=u.href;
const {db}=await import('../lib/db'),{settlePayment}=await import('../lib/payments');
try{
 await db.query(await readFile('db/001.sql','utf8'));await db.query("INSERT INTO users(id,name) VALUES('a','A'),('b','B')");
 const draft={title:'Test classic',poet:'Test author',language:'en',body:'Full poem for transaction testing only.',source_url:'https://en.wikisource.org/wiki/Test',citation:'Test edition',rights:'public-domain',period:'Test',genre:'other'};
 const id=randomUUID().replaceAll('-','');await db.query("INSERT INTO payment_orders(id,author_id,device,app_id,seller_id,draft,fingerprint) VALUES($1,'a','dev','123','2088123',$2,'same-poem')",[id,JSON.stringify(draft)]);
 await Promise.all(Array.from({length:10},()=>settlePayment(id,'20261107123456789')));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM works')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM jobs')).rows[0].n,1);assert.equal((await db.query('SELECT state FROM payment_orders WHERE id=$1',[id])).rows[0].state,'paid');await assert.rejects(settlePayment(id,'20261107999999999'));
 const second=randomUUID().replaceAll('-','');await db.query("INSERT INTO payment_orders(id,author_id,device,app_id,seller_id,draft,fingerprint) VALUES($1,'b','dev2','123','2088123',$2,'same-poem')",[second,JSON.stringify(draft)]);await settlePayment(second,'20261107555555555');assert.equal((await db.query('SELECT state FROM payment_orders WHERE id=$1',[second])).rows[0].state,'refund_pending');assert.equal((await db.query('SELECT count(*)::int AS n FROM works')).rows[0].n,1);
 await assert.rejects(db.query('UPDATE payment_orders SET amount_cents=1 WHERE id=$1',[id]));
 assert.equal((await db.query("SELECT count(*)::int AS n FROM works WHERE status='published'")).rows[0].n,0);
 console.log('PASS: concurrent notifications create one pending poem/job, replay is idempotent, conflicting trade rejected, duplicate poem schedules refund, fixed 10-cent amount enforced');
}finally{await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();}
