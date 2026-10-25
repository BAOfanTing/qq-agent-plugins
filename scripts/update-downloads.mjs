// 把 Release 资产的下载计数写回索引（README 里承诺的那个定时任务）。
//
// 为什么要它：市场里"下载量"是排序维度之一，也是使用者判断"这插件有没有人在用"的唯一线索；
// 让人手填既不现实也必然过期。GitHub 的下载计数只存在于 Release 资产上，所以每天读一次、写回索引。
//
// 用法：node scripts/update-downloads.mjs [--repo owner/name]
//   CI 里由 GITHUB_TOKEN 提供权限（.github/workflows/stats.yml，contents: write）；
//   本地跑需要已登录的 gh。写不进去（无 token、非仓库目录）就只打印不报错——统计失败不该让 CI 变红。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};

const indexPath = path.join(root, 'plugins', 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const plugins = Array.isArray(index.plugins) ? index.plugins : [];

// 仓库名：可以从 remote 推，也可以显式给
let repo = flag('repo', '');
if (!repo) {
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  const url = String(remote.stdout || '').trim();
  const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
  repo = match ? match[1] : '';
}
if (!repo) {
  console.log('· 推不出仓库名（没有 origin remote），跳过下载量统计');
  process.exit(0);
}

const api = spawnSync('gh', ['api', `repos/${repo}/releases?per_page=100`, '--paginate'], { cwd: root, encoding: 'utf8' });
if (api.status !== 0) {
  console.log(`· 读 Release 失败，跳过下载量统计：${String(api.stderr || '').trim().slice(0, 200)}`);
  process.exit(0);
}
let releases = [];
try { releases = JSON.parse(String(api.stdout || '[]')); } catch { releases = []; }

// 资产名 → 下载次数
const counts = new Map();
for (const release of releases) {
  for (const asset of release?.assets ?? []) {
    if (!asset?.name) continue;
    counts.set(asset.name, (counts.get(asset.name) || 0) + Number(asset.download_count || 0));
  }
}

let changed = 0;
for (const item of plugins) {
  const url = String(item.downloadUrl || item.tarball || item.url || '');
  const base = path.basename(url.split('?')[0]);
  if (!base || !counts.has(base)) continue;
  const next = counts.get(base);
  if (Number(item.downloads || 0) === next) continue;
  item.downloads = next;
  changed += 1;
}
if (!changed) {
  console.log(`· 下载量没有变化（${plugins.length} 条，资产计数 ${counts.size} 个）`);
  process.exit(0);
}
index.updatedAt = new Date().toISOString().slice(0, 10);
// 保留仓库现有 EOL：index.json 是 CRLF，直接写 LF 会让下一次成功提交变成整文件翻红
//（GH006 修好后第一条 stats 提交就是几百行全 diff）。先读原文判断，再按原格式写回。
const original = fs.readFileSync(indexPath, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2).replace(/\n/g, eol) + eol);
console.log(`✓ 已更新 ${changed} 条下载量（仓库 ${repo}）`);
