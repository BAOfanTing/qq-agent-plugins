# 上架一个插件

## 这个插件做什么

（一句话；它给机器人加了什么能力、为什么别人需要它）

## 包里有什么

- 插件 id：
- 版本：
- 包文件：`plugins/packages/<文件名>`
- sha256：（`node scripts/verify-index.mjs` 会核对，这里贴出来方便一眼看）
- Release：tag 与 `downloadUrl`

## 权限（使用者主要靠这一行判断要不要信）

- [ ] 我用到的能力都在 `capabilities` 里声明了（`tools` / `observe` / `schedule` / `http` / `log` / `storage` / `config` / `send`）
- [ ] 声明 `observe`（能看群消息）/ `http`（能把内容发出去）/ `send`（能**以机器人的身份在群里发言**）时，我在下面说明了为什么要用

说明：

## 源码与自测

- 源码仓库：
- [ ] 跑过 `node scripts/plugin-pack.mjs <目录>`，**自测通过**（它用宿主自己的安装器真装一遍）
- [ ] 跑过 `node scripts/verify-index.mjs`（结构 + 仓库内产物 + 真下载核对）

## 可选：发布者签名

- [ ] 我签了包（`scripts/plugin-sign.mjs`），公钥是：

## 我确认

- [ ] 包是**零依赖**的（没有第三方 npm 依赖、没有 TypeScript 源码）
- [ ] 我知道装插件等于让使用者把机器人交给我的代码跑；我会把 `capabilities` 写准
