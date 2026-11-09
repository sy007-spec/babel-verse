// Babelverse content search engine. Plain dependency-free ESM shared verbatim by the
// site (/api/catalog) and the exported Git catalog (catalog/search.mjs), so both
// answer the same query the same way.
//
// Query syntax (terms are ANDed):
//   明月 苏轼            every term must match somewhere (title, poet, body, translations)
//   作者:苏轼 / poet:    restrict a term to a field: 题|title, 作者|poet, 正文|body, 译|translation
//   "大江东去"            quoted phrase (may contain spaces or colons)
//   春|秋                 any alternative may match
//   -中秋                 exclude works matching the term
//   lang:lzh 集:songci-300-v2 心情:思乡 体裁:ci   filters
// Traditional/simplified, full/half width, case and punctuation are ignored, so
// 幾時 matches 几时 and 明月几时有把酒 matches across the comma.

const SKIP = /[\p{P}\p{S}\p{Z}\p{C}\s]/u;
export const FIELDS = {title: 'title', 题: 'title', 题目: 'title', 標題: 'title', 标题: 'title', 詞牌: 'title', 词牌: 'title',
  poet: 'poet', author: 'poet', 作者: 'poet', 诗人: 'poet', 詩人: 'poet', 词人: 'poet', 詞人: 'poet',
  body: 'body', text: 'body', 正文: 'body', 原文: 'body', 句: 'body',
  translation: 'translation', 译: 'translation', 譯: 'translation', 译文: 'translation', 譯文: 'translation'};
export const FILTERS = {lang: 'language', language: 'language', 语言: 'language', 語言: 'language',
  collection: 'collection', 集: 'collection', 选集: 'collection', 選集: 'collection',
  mood: 'mood', 心情: 'mood', genre: 'genre', 体裁: 'genre', 體裁: 'genre'};
export const MOODS = {思乡: 'homesick', 乡愁: 'homesick', 宁静: 'peaceful', 平静: 'peaceful', 闲适: 'peaceful', 希望: 'hopeful',
  期盼: 'hopeful', 忧伤: 'melancholy', 惆怅: 'melancholy', 哀愁: 'melancholy', 爱情: 'love', 相思: 'love', 爱: 'love', 惊奇: 'wonder', 赞叹: 'wonder'};
const WEIGHT ={title: 10, poet: 8, first: 6, body: 4, translation: 3};
// Classical variant forms that OpenCC keeps distinct; collapsing them on both the
// query and the text only widens recall, it never hides a match.
export const VARIANTS = {沈: '沉', 箇: '个', 喫: '吃', 牕: '窗', 窻: '窗', 窓: '窗', 綵: '彩', 煖: '暖', 脣: '唇', 鴈: '雁',
  鷰: '燕', 蘂: '蕊', 蕋: '蕊', 祇: '只', 秪: '只', 衹: '只', 迴: '回', 囘: '回', 峯: '峰', 崑: '昆', 鍼: '针', 銷: '消'};

/** @param {Record<string,string>} charMap traditional→simplified single characters */
export function createSearch(charMap = {}) {
  const fold = ch => {
    const n = ch.normalize('NFKC').toLowerCase();
    let out = '';
    for (const c of n) { const m = charMap[c] || c; out += VARIANTS[m] || m; }
    return out;
  };
  /** Normalized text with punctuation and spacing removed. */
  const normalize = text => { let s = ''; for (const ch of String(text)) if (!SKIP.test(ch)) s += fold(ch); return s; };
  const mood = v => { const n = normalize(v); return MOODS[n] || n; };

  /** Index one field: compact text plus a map from compact offset to (line, start, end). */
  function field(lines) {
    let compact = ''; const pos = [];
    lines.forEach((line, li) => {
      let i = 0;
      for (const ch of line) {
        if (!SKIP.test(ch)) for (const c of fold(ch)) { compact += c; pos.push([li, i, i + ch.length]); }
        i += ch.length;
      }
    });
    return {lines, compact, pos};
  }

  /**
   * @param {{id:string,title:string,poet:string,body:string,language:string,genre?:string,collections?:{id:string,number:number}[],moods?:string[],translations?:{language:string,body:string}[]}} w
   */
  function prepare(w) {
    const body = String(w.body || '').replace(/\r\n/g, '\n').split('\n');
    const tr = (w.translations || []).flatMap(t => String(t.body || '').split('\n'));
    return {work: w, fields: {title: field([w.title || '']), poet: field([w.poet || '']), body: field(body), translation: field(tr)},
      language: String(w.language || '').toLowerCase(), genre: String(w.genre || '').toLowerCase(),
      collections: (w.collections || []).map(c => String(c.id).toLowerCase()), moods: (w.moods || []).map(mood),
      titleParts: String(w.title || '').split(/[·・．.]/).map(normalize).filter(Boolean)};
  }

  /** Split a query into terms and filters. Unknown prefixes stay part of the term. */
  function parse(q) {
    const terms = [], filters = {language: [], collection: [], mood: [], genre: []};
    const re = /(-?)(?:([^\s:："“”]+)[:：])?(?:["“]([^"”]*)["”]?|(\S+))/g;
    for (const m of String(q || '').slice(0, 200).matchAll(re)) {
      const negate = m[1] === '-', key = (m[2] || '').toLowerCase(), value = m[3] ?? m[4] ?? '';
      if (key && FILTERS[key]) { const v = value.toLowerCase().trim(); if (v) filters[FILTERS[key]].push(FILTERS[key] === 'mood' ? mood(v) : v); continue; }
      let fieldName = key ? FIELDS[key] : undefined, text = value;
      if (key && !fieldName) text = m[2] + ':' + value; // e.g. a URL-like or literal colon
      const alternatives = (m[3] !== undefined ? [text] : text.split('|')).map(normalize).filter(Boolean);
      if (alternatives.length) terms.push({field: fieldName, negate, alternatives});
    }
    return {terms, filters};
  }

  function occurrences(f, needle) {
    const hits = []; let at = f.compact.indexOf(needle);
    while (at !== -1 && hits.length < 50) { hits.push([at, at + needle.length]); at = f.compact.indexOf(needle, at + 1); }
    return hits;
  }
  // Fuzzy: characters in order within one line, with bounded gaps (床前光 → 床前明月光).
  function subsequence(f, needle) {
    const hits = [];
    for (let start = f.compact.indexOf(needle[0]); start !== -1 && hits.length < 5; start = f.compact.indexOf(needle[0], start + 1)) {
      let k = start, ok = true; const picked = [start];
      for (let j = 1; j < needle.length && ok; j++) {
        k = f.compact.indexOf(needle[j], k + 1);
        ok = k !== -1 && f.pos[k][0] === f.pos[start][0] && k - start <= needle.length * 3;
        picked.push(k);
      }
      if (ok && needle.length > 1) hits.push([start, k + 1, picked]);
    }
    return hits;
  }

  function matchTerm(p, term, fuzzy) {
    const names = term.field ? [term.field] : ['title', 'poet', 'body', 'translation'];
    let score = 0; const marks = [];
    for (const alt of term.alternatives) for (const name of names) {
      const f = p.fields[name], hits = fuzzy && alt.length > 1 ? subsequence(f, alt) : occurrences(f, alt);
      if (!hits.length) continue;
      const first = name === 'body' && hits.some(([s]) => f.pos[s][0] === 0);
      let s = (first ? WEIGHT.first : WEIGHT[name]) + Math.min(hits.length - 1, 4) * 0.5;
      if (name === 'title' && (f.compact === alt || p.titleParts.includes(alt))) s += 12;
      if (name === 'poet' && f.compact === alt) s += 10;
      score = Math.max(score, fuzzy ? s * 0.4 : s);
      for (const h of hits) marks.push({name, hit: h});
    }
    return {score, marks};
  }

  function snippets(p, marks) {
    const byLine = new Map();
    for (const {name, hit: [s, e, gap]} of marks) {
      const f = p.fields[name], line = f.pos[s][0], key = name + ':' + line;
      if (!byLine.has(key)) byLine.set(key, {field: name, line, text: f.lines[line], marks: []});
      const ranges = byLine.get(key).marks;
      if (gap) { // highlight only the characters a fuzzy hit actually matched
        for (const k of gap) ranges.push([f.pos[k][1], f.pos[k][2]]);
      } else { // a hit continuing onto the next line is highlighted on its first line
        let k = s; while (k + 1 < e && f.pos[k + 1][0] === line) k++;
        ranges.push([f.pos[s][1], f.pos[k][2]]);
      }
    }
    const order = {body: 0, translation: 1, title: 2, poet: 3};
    return [...byLine.values()].map(v => {
      const merged = [];
      for (const [a, b] of v.marks.sort((x, y) => x[0] - y[0])) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
      }
      return {...v, marks: merged};
    }).sort((a, b) => order[a.field] - order[b.field] || a.line - b.line).slice(0, 3);
  }

  function passes(p, filters) {
    return (!filters.language.length || filters.language.some(l => p.language === l || p.language.startsWith(l + '-')))
      && (!filters.genre.length || filters.genre.includes(p.genre))
      && (!filters.collection.length || filters.collection.some(c => p.collections.includes(c)))
      && (!filters.mood.length || filters.mood.every(m => p.moods.includes(m)));
  }

  /**
   * @param {ReturnType<typeof prepare>[]} prepared
   * @param {string} q
   * @param {{language?:string[],collection?:string[],mood?:string[],genre?:string[]}} [extra] filters from UI controls
   */
  function search(prepared, q, extra = {}) {
    const {terms, filters} = parse(q);
    for (const k of Object.keys(filters)) filters[k].push(...(extra[k] || []).filter(Boolean).map(v => k === 'mood' ? mood(v) : String(v).toLowerCase()));
    const positive = terms.filter(t => !t.negate), negative = terms.filter(t => t.negate);
    const pool = prepared.filter(p => passes(p, filters) && !negative.some(t => matchTerm(p, t, false).score > 0));
    const run = (list, fuzzy, approximate = fuzzy) => {
      const out = [];
      for (const p of pool) {
        let score = 0; const marks = [];
        for (const t of list) { const r = matchTerm(p, t, fuzzy); if (!r.score) { score = 0; break; } score += r.score; marks.push(...r.marks); }
        if (score || !list.length) out.push({work: p.work, score: approximate ? score * 0.8 : score, fuzzy: approximate, snippets: snippets(p, marks)});
      }
      return out;
    };
    let results = run(positive, false);
    // Unspaced queries such as 苏轼明月: split one long term into two that both match.
    for (let i = 0; !results.length && i < positive.length; i++) {
      const t = positive[i], alt = t.alternatives[0];
      if (t.alternatives.length !== 1 || alt.length < 4) continue;
      let best = [];
      for (let k = 2; k <= alt.length - 2; k++) {
        const split = [...positive.slice(0, i), {...t, alternatives: [alt.slice(0, k)]}, {...t, alternatives: [alt.slice(k)]}, ...positive.slice(i + 1)];
        const r = run(split, false, true);
        if (r.length && (!best.length || r.length < best.length)) best = r; // the most specific split wins
      }
      results = best;
    }
    if (!results.length && positive.length) results = run(positive, true);
    const collection = filters.collection[0];
    const number = w => (w.collections || []).find(c => String(c.id).toLowerCase() === collection)?.number ?? Infinity;
    results.sort((a, b) => b.score - a.score || number(a.work) - number(b.work) || String(a.work.title).localeCompare(String(b.work.title), 'zh') || String(a.work.id).localeCompare(String(b.work.id)));
    return {terms, filters, fuzzy: results.some(r => r.fuzzy), results};
  }

  return {normalize, parse, prepare, search};
}
