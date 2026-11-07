import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const admin=new Pool({connectionString:process.env.DATABASE_URL}),name='babelverse_test_'+randomUUID().replaceAll('-','');
await admin.query(`CREATE DATABASE ${name}`);const u=new URL(process.env.DATABASE_URL!);u.pathname='/'+name;const p=new Pool({connectionString:u.href});
try{
 await p.query(await readFile('db/001.sql','utf8'));const w=randomUUID(),t=randomUUID(),v=randomUUID();
 await p.query("INSERT INTO users(id,name) VALUES('author','Author'),('reader','Reader')");
 await p.query("INSERT INTO works(id,author_id,title,poet,language,body,fingerprint,source_url,citation,rights) VALUES($1,'author','T','P','zh-Hans','original','hash','https://example.org','edition','public-domain')",[w]);
 await p.query("INSERT INTO translations(id,work_id,author_id,device,language,ai_use,mirror_consent) VALUES($1,$2,'author','device-author','en','human',true)",[t,w]);await p.query("INSERT INTO versions(id,translation_id,body,status) VALUES($1,$2,'translation','published')",[v,t]);
 const votes=await Promise.allSettled(Array.from({length:10},()=>p.query("INSERT INTO votes(id,translation_id,version_id,author_id,device,score) VALUES($1,$2,$3,'reader','device-reader',5)",[randomUUID(),t,v])));assert.equal(votes.filter(x=>x.status==='fulfilled').length,1);console.log('PASS: 10 concurrent votes produce exactly one row');
 await assert.rejects(p.query('UPDATE votes SET score=1'));await assert.rejects(p.query('DELETE FROM votes'));await assert.rejects(p.query("UPDATE versions SET body='changed'"));console.log('PASS: votes and historical text reject mutation');
 await assert.rejects(p.query("INSERT INTO translations(id,work_id,author_id,device,language,ai_use,mirror_consent) VALUES($1,$2,'reader','device-author','en','human',true)",[randomUUID(),w]));console.log('PASS: shared-device duplicate translation rejected');
 const pub=await p.query("SELECT id FROM works WHERE status='published'");assert.equal(pub.rowCount,0);console.log('PASS: pending works absent from public query');
}finally{await p.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();}
