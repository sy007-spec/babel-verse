#!/usr/bin/env node
// Search a clone of the Babelverse catalog. Node 18+, no npm install needed.
//   node catalog/search.mjs '作者:苏轼 明月'
//   node catalog/search.mjs '"大江东去"' --json
// Query syntax: see catalog/SEARCH.md. Same engine as https://babelverse.seii.top.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSearch} from './search/core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), flags = new Set(args.filter(a => /^--(json|all|help|paths)$/.test(a)));
const limitAt = args.indexOf('--limit'), limit = flags.has('--all') ? Infinity : Math.max(1, Number(args[limitAt + 1]) || 20);
const query = args.filter((a, i) => !a.startsWith('--') && !(limitAt !== -1 && i === limitAt + 1)).join(' ');
if (!query || flags.has('--help')) {
  console.log(`Usage: node search.mjs <query> [--limit N | --all] [--json] [--paths]

  明月 苏轼              all terms must match (title, poet, text, translations)
  作者:苏轼 题:念奴娇     field: 题|title 作者|poet 正文|body 译|translation
  "大江东去"             phrase      春|秋  either      -中秋  exclude
  lang:lzh-Hant 集:songci-300-v2 心情:思乡 体裁:ci       filters
Traditional/simplified, width, case and punctuation are ignored.`);
  process.exit(query ? 0 : 1);
}

const engine = createSearch(JSON.parse(readFileSync(join(here, 'search', 't2s.json'), 'utf8')));
const records = readFileSync(join(here, 'search', 'works.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const {results, fuzzy} = engine.search(records.map(engine.prepare), query);
const shown = results.slice(0, limit);

if (flags.has('--json')) {
  console.log(JSON.stringify({query, total: results.length, fuzzy, results: shown.map(r => ({id: r.work.id, title: r.work.title, poet: r.work.poet,
    language: r.work.language, path: r.work.path, collections: r.work.collections, score: r.score, snippets: r.snippets}))}, null, 2));
} else if (flags.has('--paths')) {
  for (const r of shown) console.log(join(here, r.work.path));
} else {
  const tty = process.stdout.isTTY, on = tty ? '\x1b[1;31m' : '【', off = tty ? '\x1b[0m' : '】';
  const mark = s => s.marks.reduceRight((t, [a, b]) => t.slice(0, a) + on + t.slice(a, b) + off + t.slice(b), s.text);
  console.log(`${results.length} result(s)${fuzzy ? ' — no exact match, showing close matches' : ''}${shown.length < results.length ? `, showing ${shown.length}` : ''}\n`);
  for (const r of shown) {
    const c = (r.work.collections || []).map(x => `${x.id}#${String(x.number).padStart(3, '0')}`).join(' ');
    console.log(`${r.work.title} — ${r.work.poet}  [${r.work.language}]${c ? '  ' + c : ''}`);
    for (const s of r.snippets) console.log(`   ${s.field === 'body' ? '│' : s.field + ':'} ${mark(s)}`);
    console.log(`   ${r.work.path}\n`);
  }
}
