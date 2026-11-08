import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createSearch} from '../lib/search-core.mjs';
import {charMap} from '../lib/charmap';
import {searchFiles,searchLine,type CatalogWork} from '../lib/export';

const map=charMap(),engine=createSearch(map);
const works:CatalogWork[]=[
  {id:'00000000-0000-4000-8000-000000000001',title:'水調歌頭·明月幾時有',poet:'蘇軾',language:'lzh-Hant',genre:'ci',body:'明月幾時有，把酒問青天。\n不知天上宮闕，今夕是何年。',collections:[{id:'songci-300-v2',number:120}],moods:['melancholy'],translations:[{language:'en',path:'translations/en/x/y/z.md',body:'When will the bright moon appear?'}]},
  {id:'00000000-0000-4000-8000-000000000002',title:'念奴娇·赤壁怀古',poet:'苏轼',language:'lzh',genre:'ci',body:'大江东去，浪淘尽，千古风流人物。',collections:[{id:'songci-300-v2',number:121}],moods:[],translations:[]},
  {id:'00000000-0000-4000-8000-000000000003',title:'静夜思',poet:'李白',language:'lzh',genre:'shi',body:'床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',collections:[],moods:['homesick'],translations:[]},
  {id:'00000000-0000-4000-8000-000000000004',title:'風流子·木葉亭皋下',poet:'張耒',language:'lzh-Hant',genre:'ci',body:'空恨碧雲離合，青鳥沈浮。',collections:[],moods:[],translations:[]}];
const index=works.map(engine.prepare),ids=(q:string,extra={})=>engine.search(index,q,extra).results.map(r=>r.work.id.slice(-1));

test('simplified and traditional queries find both scripts, ignoring punctuation',()=>{
  assert.deepEqual(ids('明月几时有'),['1']);assert.deepEqual(ids('明月幾時有'),['1']);
  assert.deepEqual(ids('明月几时有把酒'),['1'],'matches across the comma');
  assert.deepEqual(ids('苏轼').sort(),['1','2']);assert.deepEqual(ids('沉浮'),['4'],'variant 沈/沉 unified');});
test('fields, phrases, alternatives, exclusions and filters',()=>{
  assert.deepEqual(ids('作者:苏轼 -明月'),['2']);assert.deepEqual(ids('题:赤壁'),['2']);assert.deepEqual(ids('作者:赤壁'),[]);
  assert.deepEqual(ids('"大江 东去"'),['2']);assert.deepEqual(ids('赤壁|静夜').sort(),['2','3']);
  assert.deepEqual(ids('明月 lang:lzh-Hant'),['1']);assert.deepEqual(ids('明月 lang:lzh').sort(),['1','3'],'lang prefix covers scripts');
  assert.deepEqual(ids('明月 心情:思乡'),['3']);assert.deepEqual(ids('体裁:shi 明月'),['3']);
  assert.deepEqual(ids('集:songci-300-v2 苏轼'),['1','2']);assert.deepEqual(ids('苏轼',{collection:['songci-300-v2']}),['1','2']);
  assert.deepEqual(ids('译:bright moon'),['1']);assert.deepEqual(ids('BRIGHT'),['1'],'case-insensitive translation search');});
test('ranking prefers title and exact poet matches over body text',()=>{
  assert.equal(ids('明月')[0],'1','title hit outranks body-only hit');assert.deepEqual(ids('静夜思'),['3']);});
test('fuzzy fallback only when nothing matches exactly, with per-character highlights',()=>{
  const r=engine.search(index,'床前光');assert.equal(r.fuzzy,true);assert.equal(r.results[0].work.id.slice(-1),'3');
  const s=r.results[0].snippets[0];assert.equal(s.text,'床前明月光，');assert.deepEqual(s.marks,[[0,2],[4,5]]);
  assert.equal(engine.search(index,'明月').fuzzy,false);
  const split=engine.search(index,'苏轼大江');assert.deepEqual(split.results.map(r=>r.work.id.slice(-1)),['2'],'unspaced query is split');assert.equal(split.fuzzy,true);assert.deepEqual(ids('完全不存在的词'),[]);});
test('snippets mark the original text, not the normalized form',()=>{
  const s=engine.search(index,'问青天').results[0].snippets[0];assert.equal(s.text.slice(s.marks[0][0],s.marks[0][1]),'問青天');});
test('git catalog search files and standalone CLI agree with the site engine',async()=>{
  const files=searchFiles(works,map,{core:await readFile('lib/search-core.mjs','utf8'),cli:await readFile('catalog-tools/search.mjs','utf8'),guide:'# guide\n'});
  assert.equal(files['search/works.jsonl'].trim().split('\n').length,4);assert.ok(/## (苏轼 \/ 蘇軾|蘇軾 \/ 苏轼)（2）/.test(files['indexes/poets.md']),'poet index merges scripts');
  assert.ok(files['indexes/first-lines.md'].includes('床前明月光，'));assert.ok(files['indexes/lzh-Hant/index.md'].includes('| [水調歌頭·明月幾時有]'));
  assert.ok(!files['search/works.jsonl'].includes('mirror_consent')&&!files['search/works.jsonl'].includes('author_id'));
  assert.equal(searchLine(works[0],map).split(' ')[1],'苏轼');
  const dir=await mkdtemp(join(tmpdir(),'bv-catalog-'));
  try{for(const [p,c] of Object.entries(files)){await mkdir(join(dir,p,'..'),{recursive:true});await writeFile(join(dir,p),c);}
    const run=(q:string)=>JSON.parse(execFileSync(process.execPath,[join(dir,'search.mjs'),q,'--json'],{encoding:'utf8'}));
    for(const q of ['明月几时有','作者:苏轼 -明月','床前光','明月 心情:思乡','译:moon'])assert.deepEqual(run(q).results.map((r:{id:string})=>r.id.slice(-1)),ids(q),q);
    assert.ok(execFileSync(process.execPath,[join(dir,'search.mjs'),'大江东去'],{encoding:'utf8'}).includes('【大江东去】'));
  }finally{await rm(dir,{recursive:true,force:true});}});
