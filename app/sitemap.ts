import type {MetadataRoute} from 'next';
import {db} from '../lib/db';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const r=await db.query("SELECT id,created_at FROM works WHERE status='published' ORDER BY id");return [{url:'https://babelverse.seii.top/'},...r.rows.map(w=>({url:'https://babelverse.seii.top/poem/'+w.id,lastModified:w.created_at}))];}
