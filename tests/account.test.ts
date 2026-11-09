import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountAction,ACTION_LIMIT,SECTIONS} from '../lib/account';
const id='00000000-0000-4000-8000-000000000001';
test('account actions accept only known shapes',()=>{
 assert.equal(accountAction.parse({action:'favorite',work_id:id,on:true}).action,'favorite');
 assert.throws(()=>accountAction.parse({action:'favorite',work_id:'../x',on:true}));
 assert.throws(()=>accountAction.parse({action:'favorite',work_id:id}));
 assert.throws(()=>accountAction.parse({action:'drop_table'}));
 assert.throws(()=>accountAction.parse({action:'delete_comment',id:'1 OR 1=1'}));});
test('every account action is rate limited and sections are fixed',()=>{
 for(const a of ['favorite','read','forget','clear_history','delete_comment'])assert.ok(ACTION_LIMIT[a as keyof typeof ACTION_LIMIT]>0);
 assert.deepEqual([...SECTIONS],['summary','favorites','history','comments','submissions']);});
