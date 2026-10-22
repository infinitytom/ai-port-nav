// 对 projects.json 中只有 "search" 的条目调用 GitHub 搜索，输出候选仓库到 data/candidates.json 供人工核对
import { readFile, writeFile } from "node:fs/promises";

const { projects } = JSON.parse(await readFile("data/projects.json", "utf8"));
const headers = { Accept: "application/vnd.github+json", "User-Agent": "ai-port-nav" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = { generated: new Date().toISOString(), candidates: {} };
for (const p of projects.filter((p) => p.search && !p.repo)) {
  const u = `https://api.github.com/search/repositories?per_page=4&q=${encodeURIComponent(p.search)}`;
  const r = await fetch(u, { headers });
  if (!r.ok) { console.warn(`! ${p.id} HTTP ${r.status}`); await sleep(8000); continue; }
  const j = await r.json();
  out.candidates[p.id] = j.items.map((i) => ({
    repo: i.full_name, desc: (i.description || "").slice(0, 160), stars: i.stargazers_count,
    pushed: i.pushed_at?.slice(0, 10), fork: i.fork, archived: i.archived,
  }));
  console.log(`${p.id}: ${out.candidates[p.id].map((c) => c.repo).join(", ") || "-"}`);
  await sleep(2500); // 搜索接口限速 30 次/分钟
}
await writeFile("data/candidates.json", JSON.stringify(out, null, 1) + "\n");
