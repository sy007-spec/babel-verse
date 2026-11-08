import {Converter} from 'opencc-js';

// Single-character traditional→simplified table. The site and the exported catalog
// tool both fold text with this exact table, so their results agree.
const RANGES: [number, number][] = [[0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0x20000, 0x2a6df]];
let cached: Record<string, string> | undefined;
export function charMap() {
  if (cached) return cached;
  const convert = Converter({from: 't', to: 'cn'}), map: Record<string, string> = {};
  for (const [a, b] of RANGES) for (let c = a; c <= b; c++) {
    const ch = String.fromCodePoint(c), s = convert(ch);
    if (s !== ch && Array.from(s).length === 1) map[ch] = s;
  }
  return cached = map;
}
