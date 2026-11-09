# babelverse · 诗无疆

可追溯的经典诗歌与多语言译作平台。产品规则见 [SPEC.md](SPEC.md)。

代码：非商业源码可见许可（不是OSI开源）。商业使用须另行授权。内容版权独立，公版原诗不属平台独占；用户译作版权归作者，商业再许可另签协议。见LICENSE和CONTENT-LICENSE.md。

## 运行

Linux服务器需Docker Compose、Python3、Git。运行 `python3 ops.py init` 创建仅本机可读运行配置；配置值不得进入Git。然后 `python3 ops.py build`、`python3 ops.py migrate`、`python3 ops.py restart`、`python3 ops.py health`。更新先备份，检查通过后 `python3 ops.py deploy`。只对本项目生效。

`runtime/web.env`配置OIDC issuer/client/org/project及ZITADEL_GRANT_TOKEN（见SPEC.md“身份与账户”），要求已验证邮箱；回调为https://babelverse.seii.top/auth/callback。`runtime/worker.env`配置HTTPS兼容Chat Completions服务与模型；缺失时不发布。GeoIP Country数据库放在runtime/geoip/country.mmdb，遵守供应商许可；不可用时以浏览器语言回退，不伪装IP识别。

管理员通过SSH运行 `python3 ops.py review queue` 查看待收录来源；将经人工核对的出处和完整版本证据放在runtime/evidence，用 `python3 ops.py review evidence work UUID /evidence/file.txt 核验说明` 重新排队模型审核。普通译作、标签与留言可通过 `review decide version|tag|comment UUID published|private|review 理由` 复核（`review queue comment` 列出待审留言）；作品不能绕过真实性审核直接发布。

每日03:00 Asia/Shanghai由systemd调用 `python3 ops.py export`，仅导出已发布且有镜像授权的文本到catalog；不导出身份、网络、私人正文或内部证据。导出是数据库派生镜像，GitHub编辑不得直接覆盖业务数据库。目录自带与网站同一引擎的搜索：`node catalog/search.mjs '作者:苏轼 明月'`，语法见 [catalog/SEARCH.md](catalog/SEARCH.md)（源文件在 catalog-tools/）。备份包含私密数据，仅保存在服务器backups，不推送。

## 验证

`npm ci && npm test && npm run check && npm run build`。账户功能的真实数据库检查：在worker容器内运行 `npx tsx scripts/account-integration.ts`（创建并删除临时数据库）。真实数据库约束和公网端到端验证另见部署记录，不能由单元测试代替。历史正文不可变，票不可改写，数据库唯一约束防止并发重复票。设备凭证可被清除，不能承诺绝对一人一票。
