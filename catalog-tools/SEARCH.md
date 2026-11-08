# 搜索本目录 / Searching this catalog

本目录是 https://babelverse.seii.top 已发布公开内容的每日镜像。原文保留来源繁简版本，所以同一首诗可能以繁体或简体存放；下面三种方式都能用简体或繁体查到。

This catalog is a daily mirror of published content on https://babelverse.seii.top. Originals keep their source script (traditional or simplified); every method below finds them with either script.

## 1. 命令行（推荐）/ Command line (recommended)

需要 Node.js 18+，无需安装依赖，与网站使用同一搜索引擎。Node.js 18+, no install, same engine as the website.

```sh
git clone --depth 1 https://github.com/sy007-spec/babel-verse.git
cd babel-verse
node catalog/search.mjs '明月几时有'
node catalog/search.mjs '作者:苏轼 -中秋'
node catalog/search.mjs '题:念奴娇|水调歌头' --all
node catalog/search.mjs '床前光'                 # 无完全匹配时自动近似 / fuzzy fallback
node catalog/search.mjs '心情:思乡' --json        # 机器可读 / machine readable
node catalog/search.mjs '作者:李清照' --paths | xargs cat
```

| 写法 / Syntax | 含义 / Meaning |
|---|---|
| `明月 苏轼` | 所有词都要匹配（标题、作者、正文、译文）/ all terms must match |
| `题:` `title:` · `作者:` `poet:` · `正文:` `body:` · `译:` `translation:` | 限定字段 / restrict to a field |
| `"大江东去"` | 短语，可含空格或冒号 / phrase |
| `春\|秋` | 任一即可 / any alternative |
| `-中秋` | 排除 / exclude |
| `lang:lzh-Hant` · `集:songci-300-v2` · `心情:思乡` · `体裁:ci` | 过滤 / filters |

繁简、全半角、大小写和标点都被忽略：`幾時` 等同 `几时`，`明月几时有把酒` 可跨逗号匹配；常见异体（如 沈/沉、鴈/雁）也视为同字。结果按命中字段排序：标题 > 作者 > 首句 > 正文 > 译文。

Traditional/simplified, width, case and punctuation are ignored, and common variant characters are unified. Ranking: title > poet > first line > text > translation.

## 2. GitHub 网页搜索 / GitHub code search

每个原文文件的 `search:` 字段保存了简化、去标点的标题、作者与全文，因此在 GitHub 搜索框中用简体也能命中繁体原文：

Each original's `search:` front-matter line holds simplified, punctuation-free title, poet and text, so simplified queries match traditional originals:

```
repo:sy007-spec/babel-verse path:catalog/originals 明月几时有
repo:sy007-spec/babel-verse path:catalog/originals 苏轼 念奴娇
```

## 3. grep / git grep

`search/works.jsonl` 每行一首作品（含路径、选集编号、心情与已授权译文），适合 `grep`、`jq` 等工具：

`search/works.jsonl` has one work per line (path, collection numbers, moods, consented translations):

```sh
git grep -n '把酒问青天' -- 'catalog/originals/*'
grep '苏轼' catalog/search/works.jsonl | jq -r '.title + "\t" + .path'
```

## 索引 / Indexes

- [作者索引 / By poet](indexes/poets.md)
- [首句索引 / By first line](indexes/first-lines.md)
- 按语言 / By language: `indexes/<language>/index.md`
- 选集 / Collections: `collections/<id>/index.md`

本目录由数据库导出生成，请勿直接编辑；数据库是唯一权威。Generated from the database; do not edit here.
