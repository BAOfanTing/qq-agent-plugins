# qq-agent-plugins

**qq-agent-plus 的官方插件索引。** 控制台「设置 → 插件」默认就是读这里（宿主侧可用 `plugins.indexUrls` / `plugins.indexUrl` 改成别处，也可以同时挂多个来源）。

## 怎么装

打开机器人的网页控制台 → 「设置 → 插件」→ 打开「启用插件功能」→ 列表里点某个插件的「安装」→ 再点「启用」。

**装上 ≠ 授权**：装完只是进了插件目录，还得显式启用，它的工具才会交给模型。

## 这个仓库里有什么

```
plugins/index.json          索引：控制台读的就是它
plugins/packages/*.tar.gz   包（与索引里 sha256 逐字节对应）—— 给镜像/CDN 走的那一份
scripts/verify-index.mjs    自检：结构 + 仓库内产物 + 真下载核对
```

同一份包同时挂在本仓库的 **滚动 Release**（tag 固定为 `packages`）上（`downloadUrl` 指的就是它）：下载与"被下载了多少次"都从那里统计。

**加插件、升版本都不需要新建 Release**：把包提交到 `plugins/packages/`，CI（`.github/workflows/sync-packages.yml`）会把它同步到 `packages` 这个 Release 上。资产名固定为 `<id>-<version>.tar.gz`，已存在的不动（换内容请升版本），旧版本的不删（旧条目还指着它们）。

**源码与打包脚本不在这个仓库**，在宿主项目（`qq-agent-plus`）的 `examples/plugins/<id>/`；发布一个插件用的也是那边的 `scripts/plugin-pack.mjs`（打包 + 自测 + 生成条目一气做完）。

## 索引格式

```json
{
  "version": 1,
  "plugins": [
    {
      "id": "my-plugin",            // 必填：小写字母/数字/连字符，2-32 位，与插件目录名一致
      "name": "我的插件",
      "version": "1.0.0",           // 必填
      "description": "一句话说清它给机器人加了什么能力",
      "author": "你的名字",
      "homepage": "https://github.com/你/你的插件",
      "apiVersion": 1,              // 插件契约版本；对不上会被标成"本机装不了"
      "minVersion": "0.8.5",        // 要求的最低宿主版本
      "tags": ["社区", "工具"],
      "capabilities": ["tools", "http"],   // 使用者主要靠这一行判断要不要信
      "downloadUrl": "https://…/my-plugin-1.0.0.tar.gz",   // 或 tarball / url
      "sha256": "…64 位十六进制…",   // 必填：包先按它校验再换入
      "publisher": "你的名字",        // 可选：登记了公钥的发布者会被验签（见下）
      "signature": "…Ed25519 签名…"  // 可选
    }
  ]
}
```

必填项缺一个，这条就会被跳过（页面上会列出被跳过的条目**与原因**——不会静默消失）。

## 提交一个插件（PR 流程）

1. 在宿主项目里写插件、打包、自测（`node scripts/plugin-pack.mjs <插件目录>`，它会用宿主自己的安装器真装一遍）；
2. 把打出来的包提交到本仓库的 `plugins/packages/`；
3. 改 `plugins/index.json` 加一条，`downloadUrl` 固定写成
   `https://github.com/sakurawwwxh/qq-agent-plugins/releases/download/packages/<id>-<version>.tar.gz`
   （**不用手动建 Release**：合并进 main 后 CI 会把缺的包传到 `packages` 那个滚动 Release 上）；
4. 本地跑一遍 `node scripts/verify-index.mjs --no-remote`，然后提 PR（模板会问你权限、是否签名、源码在哪）。
   PR 阶段只做离线核对——新包还没上 Release，远端核对要等合并后那班 CI 做。

CI 会跑同一个脚本；**每天还会自动跑一次并做真下载核对** —— 谁删了 Release、换了文件、或者镜像挂了，当天就会在这里暴露，而不是等使用者装的时候才发现。

## 索引字段（给作者与维护者）

必填：`id` / `version` / `sha256` / 下载地址（`downloadUrl`、`tarball`、`url` 任选其一，按这个顺序取第一个）。

可选：

| 字段 | 用途 |
| --- | --- |
| `name` / `description` / `author` / `homepage` | 市场列表与详情页显示 |
| `tags` / `category` | 搜索与分类 |
| `capabilities` | **使用者主要靠它判断要不要信**：`tools` / `observe` / `schedule` / `http` / `log` / `storage` / `config` / `send` |
| `apiVersion` / `minVersion` | 兼容门控：对不上的条目照样列出来，但标成"本机装不了"并说明原因 |
| `icon` / `screenshots` | 市场里的图标与截图（http(s) 地址） |
| `readme` / `readmeUrl` / `changelogUrl` | 详情页正文与两个外链 |
| `size` | 包大小（发布脚本自动填） |
| `updatedAt` | 发布脚本填（这条走的是宿主仓库的 `plugin-publish.mjs`） |
| `downloads` | 由**本仓库的 `stats.yml` 每天从 Release 资产计数写回**（`scripts/update-downloads.mjs`）；上架当天该字段可能还是空的，主机的市场页这时按名字兜底排序 |
| `mirrors` | 备用下载地址（走镜像/CDN 的那份），宿主按 [主地址, 这些, 派生镜像] 顺序试 |
| `revoked` + `revokedReason` | **撤回**：宿主读到就拒载、界面标出来（集中下架） |
| `deprecated` + `deprecatedReason` | 弃用（有替代品），仍然可装但会提示 |

## 上架流程（一条命令 + 一个 PR）

在宿主项目里（那里有 `scripts/plugin-publish.mjs`）：

```bash
node scripts/plugin-publish.mjs examples/plugins/<你的插件>   --index-repo ../qq-agent-plugins   --category 工具 --tags 官方,工具   --homepage https://github.com/你/<仓库>
```

它会：打包 + **自测**（用宿主自己的安装器真装一遍，不过就不许上架）→ 把包放进本仓库
`plugins/packages/` → 更新 `plugins/index.json` → 跑本仓库的离线自检 → 打印要执行的 git 命令。
**加 `--push` 才会真的提交并推 main**；推上去之后 CI 把新包同步到 `packages` Release 上，再做真下载核对。
不需要发 tag，也不需要 `gh release create`。

手工做也行，三步：把包放进 `plugins/packages/` → 改 `index.json`（`downloadUrl` 指向 `packages` Release）
→ 跑 `node scripts/verify-index.mjs --no-remote` 再提 PR。

## 可信作者：自动合并

长期合作、已经过审查的作者加进 `.github/workflows/auto-merge.yml` 的白名单后，提 PR 不需要维护者点合并：
CI 的 `verify` 通过后自动 merge，随后 `sync-packages` 再把包传到 `packages` Release。

安全边界：
- 分支保护要求 PR + `verify` 通过，不能直接推 main；
- `CODEOWNERS` 把 `.github/` 与 `scripts/` 划给维护者 —— 作者改插件条目（`plugins/**`）不需要人工，
  改 CI、校验脚本、发布脚本则必须维护者批准，避免"自己改掉验证逻辑再自动合并"。

## 长期维护约定

- **产物双份**：包既在 Release（给人下载、给下载量统计），**也提交在仓库里**（给镜像/CDN 走）。
  所以作者删了仓库或 Release，已上架的东西**不会消失** —— 这是比"只挂 Release"更抗腐烂的一点。
- **一个 Release 装所有包**（`.github/workflows/sync-packages.yml`）：tag 固定 `packages`，
  推 `plugins/**` 时把缺的资产补上去。资产**只增不删**（旧条目还指着旧版本），
  同版本号不要换内容——换内容就升版本，否则同名覆盖会把下载计数清零。
- **每日真下载核对**（`.github/workflows/verify.yml`）：谁删了 Release、换了文件、镜像挂了，
  当天就暴露，而不是等使用者装的时候才发现。
- **撤回是集中动作**：条目里标 `revoked` 就行（见上表），宿主下次读到索引就拒载并在界面标注；
  使用者不需要自己改配置。举报走 issue 模板。
- **弃用 vs 撤回**：有替代品用 `deprecated`（还能装、但提示），有恶意或失效用 `revoked`（不许装、不许跑）。
- **作者不维护了怎么办**：产物已在本仓库 → 可以继续分发；源码是 MIT → 可以 fork 接手；
  维护者可以改条目里的 `author` 标注为"社区维护"，或标 `deprecated`。**条目不会因为作者消失而失效。**
- **不做什么**（免得反复讨论）：不自建商店托管、不做审核 SLA、不做评分与评论、**不做自动升级**
  —— 升级必须由使用者点。理由：这些都是平台责任，而本仓库只是索引。

## 成人向插件

官方市场接受成人向插件，但条目必须显式标注，使用者要能在安装前看见：

- `description` 以 `【成人向】` 开头，`tags` 包含 `成人向`；
- 条目写 `"nsfw": true`（当前宿主会忽略这个字段，留给后续的过滤/客户端识别）；
- README 里写明内容性质、边界与已知限制；插件不得主动向群聊发送内容（v1 也没有主动发言能力）。

## 信任与安全

- **`sha256` 必填**，且包在**换入之前**先校验。所以即使流量走了第三方镜像或 CDN（内容可能被替换），也一定会被发现并拒绝安装。
- **可选签名**（Ed25519）：发布者用宿主项目里的 `scripts/plugin-sign.mjs` 签包，使用者在 `plugins.publishers` 里登记公钥后，装之前会验签；登记了公钥却没签名或验不过，会**拒绝安装**。
- **插件跑在独立进程里**：读不到机器人配置（API Key 等）、起不了子进程、写不了文件；Linux 上连网络都是断的，要联网只能走宿主那条有审计的路。这一条是本项目与"同进程插件"最大的区别。
- **撤回**：条目里可以标 `revoked`（带原因），宿主读到就拒载并在控制台标出来——被举报/出事的插件能集中下架，不用等每个使用者自己改配置。

## 许可

本仓库只放索引与打包产物；各插件的源码许可见其源码仓库（宿主项目里对应的 `examples/plugins/<id>/`）。
