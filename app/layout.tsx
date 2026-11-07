import type {Metadata} from 'next';
import './style.css';
export const metadata:Metadata={title:'babelverse · 诗无疆',description:'原文有据，译意无疆。可追溯的世界经典诗歌与多语言译作。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hans"><body>{children}</body></html>}
