// 从维基百科词条获取游戏封面（信息框主图），写入 data/covers.json
// 只保存图片地址（热链 upload.wikimedia.org），不把图片复制进仓库
// 每个项目可在 projects.json 用 "wiki" 指定英文维基词条名；"cover" 可直接指定图片地址；"wiki": false 表示不用封面
import { readFile, writeFile } from "node:fs/promises";

const { projects } = JSON.parse(await readFile("data/projects.json", "utf8"));
let prev = {};
try { prev = JSON.parse(await readFile("data/covers.json", "utf8")).covers || {}; } catch {}
const UA = { "User-Agent": "ai-port-nav/1.0 (https://github.com/infinitytom/ai-port-nav)" };
const API = "https://en.wikipedia.org/w/api.php";

async function q(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "of"].includes(w));

async function lookup(p) {
  const base = { prop: "pageimages|info", piprop: "thumbnail|name", pithumbsize: "480", pilicense: "any", inprop: "url", redirects: "1" };
  // 1) 精确词条
  const title = p.wiki || p.game_en;
  let d = await q({ action: "query", titles: title, ...base });
  let page = d.query?.pages?.[0];
  if (page && !page.missing && page.thumbnail) return { page, how: "title" };
  if (p.wiki) return null; // 指定了词条但没图，不再猜
  // 2) 搜索 "<英文名> video game"，并要求标题与英文名有足够重合
  d = await q({ action: "query", generator: "search", gsrsearch: `${p.game_en} video game`, gsrlimit: "3", ...base });
  const want = new Set(words(p.game_en));
  for (const pg of (d.query?.pages || []).sort((a, b) => a.index - b.index)) {
    if (!pg.thumbnail) continue;
    const got = words(pg.title);
    const hit = got.filter((w) => want.has(w)).length;
    if (hit >= Math.min(2, want.size)) return { page: pg, how: "search" };
  }
  return null;
}

const out = { generated: new Date().toISOString(), covers: {} };
const seen = new Map(); // 同一英文名只查一次
for (const p of projects) {
  if (p.wiki === false) continue;
  if (p.cover) { out.covers[p.id] = { src: p.cover, source: "manual" }; continue; }
  const key = p.wiki || p.game_en;
  try {
    if (!seen.has(key)) seen.set(key, await lookup(p));
    const res = seen.get(key);
    if (res) {
      out.covers[p.id] = { src: res.page.thumbnail.source, w: res.page.thumbnail.width, h: res.page.thumbnail.height, page: res.page.fullurl, title: res.page.title, how: res.how };
      console.log(`✓ ${p.id} ← ${res.page.title} (${res.how})`);
    } else console.log(`· ${p.id} 无封面`);
  } catch (e) {
    console.warn(`! ${p.id}: ${e.message}（保留上次）`);
    if (prev[p.id]) out.covers[p.id] = prev[p.id];
  }
}
await writeFile("data/covers.json", JSON.stringify(out, null, 1) + "\n");
console.log(`\n封面 ${Object.keys(out.covers).length}/${projects.length}`);
