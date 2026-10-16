// 校验本仓库的插件索引（自包含：不依赖任何外部仓库与 npm 包；CI 与本地都能跑）。
//
// 查三类：
//   ① 结构：必填字段（id / version / sha256 / 下载地址）、id 与 sha256 的形状、重复 id、地址是不是 http(s)；
//   ② 仓库内产物：索引里的 sha256 必须等于 `plugins/packages/<包>` 的内容 —— 那是给镜像/CDN 走的那一份，
//      它和 Release 上那份必须逐字节相同（不然装的人从 CDN 拿到的和索引说的不是同一个东西）；
//   ③ `--remote`（默认开）：把每个 downloadUrl 真下载下来核对 sha256。**这一条是每日定时跑的**：
//      作者删了 Release、换了文件、镜像挂了，都会在这里暴露，而不是等用户装的时候才发现。
//
// 用法：
//   node scripts/verify-index.mjs                # 结构 + 仓库内产物 + 真下载核对
//   node scripts/verify-index.mjs --no-remote    # 只做前两项（离线）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'plugins', 'index.json');
const urlFields = ['downloadUrl', 'tarball', 'url'];
const idRe = /^[a-z0-9][a-z0-9-]{1,31}$/;
const shaRe = /^[0-9a-f]{64}$/;
const errors = [];
const notes = [];

const sha256Of = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

let parsed = null;
try {
  parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
} catch (error) {
  console.error(`✗ 索引读不了或不是合法 JSON：${error?.message ?? error}`);
  process.exit(1);
}
const plugins = Array.isArray(parsed?.plugins) ? parsed.plugins : null;
if (!plugins) {
  console.error('✗ 索引里没有 plugins 数组');
  process.exit(1);
}

const seen = new Set();
for (const [index, item] of plugins.entries()) {
  const where = `plugins[${index}]`;
  const id = String(item?.id ?? '').trim();
  if (!idRe.test(id)) { errors.push(`${where}: id 不合法（${JSON.stringify(item?.id)}）`); continue; }
  if (seen.has(id)) errors.push(`${where}: id 重复（${id}）`);
  seen.add(id);
  const version = String(item?.version ?? '').trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) errors.push(`${id}: version 必须是 x.y.z（实际 ${JSON.stringify(item?.version)}）`);
  const sha = String(item?.sha256 ?? '').trim().toLowerCase();
  if (!shaRe.test(sha)) { errors.push(`${id}: sha256 必须是 64 位十六进制（没有它就不许上架）`); continue; }
  const url = urlFields.map((field) => String(item?.[field] ?? '').trim()).find(Boolean) || '';
  if (!/^https?:\/\//i.test(url)) { errors.push(`${id}: 缺少可下载地址（${urlFields.join(' / ')} 之一）`); continue; }
  if (!String(item?.capabilities ?? '').length || !Array.isArray(item.capabilities) || !item.capabilities.length) {
    errors.push(`${id}: capabilities 必须是非空数组（安装界面要原样展示，使用者据此判断要不要信）`);
  }

  // ② 仓库内那一份（CDN/镜像用）
  const local = path.join(root, 'plugins', 'packages', `${id}-${version}.tar.gz`);
  if (!fs.existsSync(local)) {
    errors.push(`${id}: 仓库里没有 plugins/packages/${id}-${version}.tar.gz（镜像/CDN 走的是这一份，必须提交）`);
  } else {
    const actual = sha256Of(fs.readFileSync(local));
    if (actual !== sha) errors.push(`${id}: 索引里的 sha256 与仓库内产物不一致（索引 ${sha.slice(0, 12)}… / 产物 ${actual.slice(0, 12)}…）`);
    else notes.push(`${id}: 仓库内产物与索引一致`);
  }

  // ③ 真下载核对
  if (!process.argv.includes('--no-remote')) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        errors.push(`${id}: 下载失败 HTTP ${response.status}（${url}）`);
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        const actual = sha256Of(buffer);
        if (actual !== sha) errors.push(`${id}: 下载到的内容 sha256 与索引不符（索引 ${sha.slice(0, 12)}… / 实际 ${actual.slice(0, 12)}…）`);
        else notes.push(`${id}: 远端内容核对通过（${(buffer.length / 1024).toFixed(1)}KB）`);
      }
    } catch (error) {
      errors.push(`${id}: 下载异常 —— ${error?.message ?? error}`);
    }
  }
}

for (const line of notes) console.log(`  · ${line}`);
if (errors.length) {
  console.error(`\n✗ 索引体检失败（${errors.length} 处）：`);
  for (const line of errors) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`\n✓ 索引体检通过：${plugins.length} 条，产物与 sha256 一致${process.argv.includes('--no-remote') ? '（未做远端核对）' : '，远端下载核对通过'}`);
