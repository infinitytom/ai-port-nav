// 抓取每个 GitHub 仓库的星数、最近推送、最新 Release，写入 data/status.json
// 用法：GITHUB_TOKEN=xxx node scripts/update-status.mjs
import { readFile, writeFile } from "node:fs/promises";

const { projects } = JSON.parse(await readFile("data/projects.json", "utf8"));
const repos = [...new Set(projects.map((p) => p.repo).filter(Boolean))];
const headers = { Accept: "application/vnd.github+json", "User-Agent": "ai-port-nav" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const r = await fetch(`https://api.github.com/${path}`, { headers });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

const out = { generated: new Date().toISOString(), repos: {} };
let prev = {};
try { prev = JSON.parse(await readFile("data/status.json", "utf8")).repos || {}; } catch {}

for (const repo of repos) {
  try {
    const info = await gh(`repos/${repo}`);
    if (!info) { out.repos[repo] = { missing: true }; console.log(`✗ ${repo} 404`); continue; }
    let rel = await gh(`repos/${repo}/releases/latest`);
    if (!rel) { const list = await gh(`repos/${repo}/releases?per_page=1`); rel = list?.[0] || null; }
    out.repos[repo] = {
      stars: info.stargazers_count,
      pushed_at: info.pushed_at,
      archived: info.archived,
      release: rel ? { tag: rel.tag_name, published_at: rel.published_at, prerelease: rel.prerelease } : null,
    };
    console.log(`✓ ${repo} ★${info.stargazers_count} ${rel?.tag_name ?? "-"}`);
  } catch (e) {
    console.warn(`! ${repo}: ${e.message}（保留上次数据）`);
    if (prev[repo]) out.repos[repo] = prev[repo];
  }
}
await writeFile("data/status.json", JSON.stringify(out, null, 1) + "\n");
const missing = Object.entries(out.repos).filter(([, v]) => v.missing).map(([k]) => k);
if (missing.length) console.log(`\n失效仓库：\n${missing.join("\n")}`);
