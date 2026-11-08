import {createSearch} from './search-core.mjs';
import {db} from './db';
import {charMap} from './charmap';

export const engine = createSearch(charMap());

export type SiteWork = {id: string; title: string; poet: string; language: string; period: string; genre: string; body: string; source_url: string; citation: string; rights: string;
  collections: {id: string; number: number}[]; moods: string[]; translations: {language: string; body: string}[]};
type Prepared = ReturnType<typeof engine.prepare>;
let index: {at: number; items: Prepared[]} | undefined, loading: Promise<Prepared[]> | undefined;
const TTL = 60_000;

/** All published, public content as search records. Pending/private text never enters the index. */
async function load() {
  const [works, members, tags, versions] = await Promise.all([
    db.query("SELECT id,title,poet,language,period,genre,body,source_url,citation,rights,created_at FROM works WHERE status='published'"),
    db.query("SELECT e.collection_id AS id,e.number,e.work_id FROM collection_entries e JOIN works w ON w.id=e.work_id WHERE w.status='published'"),
    db.query("SELECT work_id,labels FROM tags WHERE status='published'"),
    db.query("SELECT DISTINCT ON (t.id) t.work_id,t.language,v.body FROM translations t JOIN versions v ON v.translation_id=t.id WHERE v.status='published' ORDER BY t.id,v.created_at DESC,v.id DESC")]);
  const group = <T extends {work_id: string}>(rows: T[]) => { const m = new Map<string, T[]>(); for (const r of rows) m.set(r.work_id, [...(m.get(r.work_id) || []), r]); return m; };
  const c = group(members.rows), t = group(tags.rows), v = group(versions.rows);
  return works.rows.map(w => engine.prepare({...w,
    collections: (c.get(w.id) || []).map(r => ({id: r.id, number: r.number})),
    moods: [...new Set((t.get(w.id) || []).flatMap(r => Array.isArray(r.labels) ? r.labels : []))],
    translations: (v.get(w.id) || []).map(r => ({language: r.language, body: r.body}))}));
}
export async function searchIndex() {
  if (index && Date.now() - index.at < TTL) return index.items;
  loading ||= load().then(items => { index = {at: Date.now(), items}; return items; }).finally(() => { loading = undefined; });
  return loading;
}
