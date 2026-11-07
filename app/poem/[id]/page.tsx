import {notFound} from 'next/navigation';
import {db} from '../../../lib/db';
export const dynamic='force-dynamic';
async function work(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))notFound();const r=await db.query("SELECT id,title,poet,language,body,citation,source_url,rights FROM works WHERE id=$1 AND status='published'",[id]);if(!r.rowCount)notFound();return r.rows[0];}
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const w=await work((await params).id);return {title:w.title+' · '+w.poet+' | babelverse',description:w.body,alternates:{canonical:'https://babelverse.seii.top/poem/'+w.id}};}
export default async function Poem({params}:{params:Promise<{id:string}>}){const w=await work((await params).id);return <main><a className="brand" href="/">babel<span>verse</span></a><p className="eyebrow">ORIGINAL · {w.language}</p><article lang={w.language}><h1>{w.title}</h1><p>{w.poet}</p><div className="verse">{w.body}</div></article><p>{w.citation}</p><a href={w.source_url} rel="noreferrer">出处 / Source ↗</a><p>{w.rights}</p><a className="primary" href={'/?work='+w.id}>阅读译作与参与 / Translations &amp; contributions →</a></main>}
