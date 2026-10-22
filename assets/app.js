// 仓库地址：用于"推荐一个项目"链接
const SITE_REPO = "infinitytom/ai-port-nav";

const TYPE = { decomp: "反编译移植", recomp: "静态重编译", port: "原生重写" };
const AI = { ai: "AI 主导", assist: "允许辅助", none: "纯人工", unknown: "未声明" };
const STATUS = { released: "已发布 · 可玩", beta: "测试版", wip: "开发中", decomp: "仅反编译" };
const STATUS_RANK = { released: 0, beta: 1, wip: 2, decomp: 3 };
const PLAT_ORDER = ["NES","SNES","Genesis","N64","GameCube","Wii","Switch","GBA","DS","PS1","PS2","Xbox","Xbox 360","Arcade","PC"];
const TARGETS = {
  windows: { name: "Windows", short: "Win" },
  macos:   { name: "macOS", short: "Mac" },
  linux:   { name: "Linux", short: "Linux" },
  switch:  { name: "Switch", short: "Switch" },
  android: { name: "安卓", short: "安卓" },
  ios:     { name: "iOS", short: "iOS" },
  web:     { name: "网页", short: "网页" },
  unknown: { name: "待确认", short: "?" },
};

// 原平台配色（封面用，仅为色调，不含任何商标元素）
const PALETTE = {
  "NES": ["#b91c1c", "#f5f0e6", "#1c1917"], "SNES": ["#6d28d9", "#c4b5fd", "#1e1b4b"],
  "Genesis": ["#1d4ed8", "#e5e7eb", "#0b0f1a"], "N64": ["#0f766e", "#f59e0b", "#0b1d2a"],
  "GameCube": ["#4338ca", "#a5b4fc", "#13112b"], "Wii": ["#0284c7", "#e0f2fe", "#0c1a26"],
  "Switch": ["#dc2626", "#38bdf8", "#140c0c"], "GBA": ["#7c3aed", "#ddd6fe", "#170f2b"],
  "DS": ["#475569", "#cbd5e1", "#0f172a"], "PS1": ["#57534e", "#e7e5e4", "#1c1917"],
  "PS2": ["#1e40af", "#93c5fd", "#020617"], "Xbox": ["#15803d", "#86efac", "#052e16"],
  "Xbox 360": ["#65a30d", "#d9f99d", "#14200a"], "Arcade": ["#be185d", "#fbbf24", "#1f0a16"],
  "PC": ["#0f766e", "#99f6e4", "#042f2e"],
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const state = { q: "", target: "", platform: "", type: "", ai: "", status: "", sort: "rec" };
let projects = [], repoStatus = {};

// ---------- 主题 ----------
(function () {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  };
})();

// ---------- 生成封面 ----------
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507), h = Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296);
}
const PATTERNS = [
  // 斜条纹
  (r, [a, b]) => { let s = ""; const w = 14 + r() * 22; for (let x = -200; x < 340; x += w * 2) s += `<path d="M${x} 180L${x + 180} 0" stroke="${b}" stroke-width="${w * (0.3 + r() * 0.5)}" opacity="${0.12 + r() * 0.2}"/>`; return s; },
  // 同心圆
  (r, [a, b]) => { const cx = 200 + r() * 120, cy = r() * 120; let s = ""; for (let i = 1; i < 14; i++) s += `<circle cx="${cx}" cy="${cy}" r="${i * 18}" fill="none" stroke="${b}" stroke-width="${2 + (i % 3) * 2}" opacity="${0.28 - i * 0.015}"/>`; return s; },
  // 像素块
  (r, [a, b]) => { let s = ""; const g = 16; for (let y = 0; y < 180; y += g) for (let x = 0; x < 320; x += g) { const p = r(); if (p < 0.08 + (x / 320) * 0.35) s += `<rect x="${x}" y="${y}" width="${g - 2}" height="${g - 2}" fill="${b}" opacity="${0.15 + p}"/>`; } return s; },
  // 放射线
  (r, [a, b]) => { const cx = 240 + r() * 80, cy = 20 + r() * 60; let s = ""; const n = 18 + Math.floor(r() * 10); for (let i = 0; i < n; i += 2) { const t1 = (i / n) * Math.PI * 2, t2 = ((i + 1) / n) * Math.PI * 2; s += `<path d="M${cx} ${cy}L${cx + Math.cos(t1) * 500} ${cy + Math.sin(t1) * 500}L${cx + Math.cos(t2) * 500} ${cy + Math.sin(t2) * 500}Z" fill="${b}" opacity=".13"/>`; } return s; },
  // 波浪
  (r, [a, b]) => { let s = ""; const amp = 6 + r() * 10, f = 0.02 + r() * 0.03; for (let k = 0; k < 9; k++) { let d = ""; for (let x = 0; x <= 320; x += 8) d += `${x ? "L" : "M"}${x} ${20 + k * 18 + Math.sin(x * f + k * 0.8) * amp}`; s += `<path d="${d}" fill="none" stroke="${b}" stroke-width="2.5" opacity="${0.12 + (k % 3) * 0.08}"/>`; } return s; },
  // 透视网格
  (r, [a, b]) => { let s = ""; const hz = 70 + r() * 30; for (let i = -10; i <= 20; i++) s += `<path d="M${160 + i * 4} ${hz}L${160 + i * 60} 180" stroke="${b}" opacity=".25"/>`; for (let k = 1; k < 9; k++) { const y = hz + Math.pow(k / 8, 2) * (180 - hz); s += `<path d="M0 ${y}H320" stroke="${b}" opacity="${0.1 + k * 0.03}"/>`; } s += `<circle cx="${80 + r() * 160}" cy="${hz - 10}" r="${22 + r() * 18}" fill="${b}" opacity=".35"/>`; return s; },
];
function cover(p, big) {
  const r = rng(p.id);
  const pal = PALETTE[p.platform] || ["#44403c", "#e7e5e4", "#1c1917"];
  const [a, b, c] = pal;
  const pat = PATTERNS[Math.floor(r() * PATTERNS.length)](r, pal);
  const tg = targetsOf(p).filter((t) => t !== "unknown");
  const arrow = tg.length ? tg.map((t) => TARGETS[t].short).join(" · ") : "PC";
  const svg = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="g${p.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <linearGradient id="s${p.id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity=".88"/></linearGradient></defs>
    <rect width="320" height="180" fill="url(#g${p.id})"/>${pat}<rect width="320" height="180" fill="url(#s${p.id})"/></svg>`;
  const hue = Math.round((r() - 0.5) * 70);
  return `<div class="cover${big ? " big" : ""}" style="--hue:${hue}deg">${svg}
    <div class="cv-top"><span>${esc(p.platform)}</span><span class="cv-arrow">→</span><span>${esc(arrow)}</span></div>
    <div class="cv-text"><h3>${esc(p.game)}</h3><div class="cv-en">${esc(p.game_en)}</div></div>
  </div>`;
}

// ---------- 数据工具 ----------
function targetsOf(p) {
  const s = p.repo && repoStatus[p.repo];
  const t = (p.targets && p.targets.length ? p.targets : s?.targets) || [];
  return t.length ? t : ["unknown"];
}
function ago(iso) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso)) / 864e5;
  if (d < 1) return "今天";
  if (d < 30) return Math.floor(d) + " 天前";
  if (d < 365) return Math.floor(d / 30) + " 个月前";
  return (d / 365).toFixed(1) + " 年前";
}
const lastActive = (p) => {
  const s = p.repo && repoStatus[p.repo];
  return s ? new Date(s.release?.published_at || s.pushed_at || 0).getTime() : 0;
};
const stars = (p) => (p.repo && repoStatus[p.repo]?.stars) || 0;

function links(p) {
  const out = [];
  if (p.repo) {
    const s = repoStatus[p.repo];
    const hasRel = !s || !!s.release;
    if (hasRel) out.push(`<a class="btn primary" href="https://github.com/${esc(p.repo)}/releases" target="_blank" rel="noopener">⬇ 下载</a>`);
    out.push(`<a class="btn${hasRel ? "" : " primary"}" href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener">GitHub${hasRel ? "" : " 仓库"}</a>`);
  } else if (p.url) {
    out.push(`<a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">官网 / 下载</a>`);
  } else if (p.search) {
    out.push(`<a class="btn" href="https://github.com/search?type=repositories&q=${encodeURIComponent(p.search)}" target="_blank" rel="noopener">🔍 GitHub 搜索（待核实）</a>`);
  }
  return out.join("");
}

function card(p, big) {
  const s = p.repo && repoStatus[p.repo];
  const meta = [];
  if (s) {
    if (s.missing) meta.push(`<span class="warn">⚠ 仓库已失效</span>`);
    else {
      meta.push(`★ ${s.stars.toLocaleString()}`);
      if (s.release) meta.push(`${esc(s.release.tag)} · ${ago(s.release.published_at)}`);
      else if (s.pushed_at) meta.push(`更新 ${ago(s.pushed_at)}`);
      if (s.archived) meta.push(`<span class="warn">已归档</span>`);
    }
  }
  const tg = targetsOf(p);
  return `<article class="card">
    ${cover(p, big)}
    <div class="body">
      <div class="tags">
        <span class="tag">${TYPE[p.type] || p.type}</span>
        <span class="ai ai-${p.ai}">${AI[p.ai]}</span>
        <span class="tag st-${p.status}">${STATUS[p.status]}</span>
      </div>
      <div class="proj">项目：<b>${esc(p.project)}</b></div>
      <p class="note">${esc(p.note)}</p>
      <div class="targets">${tg.map((t) => `<span class="tgt tgt-${t}">${TARGETS[t].name}</span>`).join("")}</div>
      ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
      <div class="links">${links(p)}</div>
    </div>
  </article>`;
}

// ---------- 筛选与渲染 ----------
function matches(p, skip) {
  const q = state.q.trim().toLowerCase();
  return (skip === "target" || !state.target || targetsOf(p).includes(state.target)) &&
    (skip === "platform" || !state.platform || p.platform === state.platform) &&
    (!state.type || p.type === state.type) &&
    (!state.ai || p.ai === state.ai) &&
    (!state.status || p.status === state.status) &&
    (!q || [p.game, p.game_en, p.project, p.platform, p.note].join(" ").toLowerCase().includes(q));
}
function sorted(list) {
  const by = {
    rec: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || stars(b) - stars(a),
    recent: (a, b) => lastActive(b) - lastActive(a),
    stars: (a, b) => stars(b) - stars(a),
    name: (a, b) => a.game.localeCompare(b.game, "zh-CN"),
  }[state.sort];
  return list.sort(by);
}

function renderTabs() {
  const count = (t) => projects.filter((p) => matches(p, "target") && (!t || targetsOf(p).includes(t))).length;
  const keys = ["", ...Object.keys(TARGETS)].filter((t) => !t || projects.some((p) => targetsOf(p).includes(t)));
  $("#targets").innerHTML = keys.map((t) =>
    `<button class="tab" role="tab" data-t="${t}" aria-selected="${state.target === t}">${t ? TARGETS[t].name : "全部"}<i>${count(t)}</i></button>`).join("");
}
function renderChips() {
  const counts = {};
  projects.filter((p) => matches(p, "platform")).forEach((p) => (counts[p.platform] = (counts[p.platform] || 0) + 1));
  const plats = Object.keys(counts).sort((a, b) => (PLAT_ORDER.indexOf(a) + 99) % 99 - (PLAT_ORDER.indexOf(b) + 99) % 99);
  if (state.platform && !counts[state.platform]) plats.push(state.platform);
  $("#platforms").innerHTML = `<span class="chips-label">原平台</span><button class="chip" data-p="" aria-pressed="${!state.platform}">全部</button>` +
    plats.map((p) => `<button class="chip" data-p="${esc(p)}" aria-pressed="${p === state.platform}">${esc(p)}<i>${counts[p] || 0}</i></button>`).join("");
}
function render() {
  renderTabs();
  renderChips();
  const list = sorted(projects.filter((p) => matches(p)));
  $("#grid").innerHTML = list.map((p) => card(p)).join("");
  $("#empty").hidden = list.length > 0;
  $("#count").textContent = `显示 ${list.length} / ${projects.length}`;
}

function fillSelect(sel, map, key) {
  for (const [k, v] of Object.entries(map)) sel.insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`);
  sel.onchange = () => { state[key] = sel.value; render(); };
}

async function init() {
  const [data, st] = await Promise.all([
    fetch("data/projects.json").then((r) => r.json()),
    fetch("data/status.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  projects = data.projects;
  repoStatus = st.repos || {};
  $("#updated").textContent = data.updated;
  $("#fetched").textContent = st.generated ? st.generated.slice(0, 10) : "尚未抓取";

  const n = (f) => projects.filter(f).length;
  $("#stats").innerHTML = [
    [projects.length, "收录项目"],
    [n((p) => p.status === "released"), "已可游玩"],
    [n((p) => p.ai === "ai"), "AI 主导制作"],
    [n((p) => targetsOf(p).includes("windows")), "支持 Windows"],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");

  $("#featured").innerHTML = projects.filter((p) => p.featured).map((p) => card(p, true)).join("");

  $("#targets").onclick = (e) => { const b = e.target.closest(".tab"); if (b) { state.target = b.dataset.t; state.platform = ""; render(); } };
  $("#platforms").onclick = (e) => { const b = e.target.closest(".chip"); if (b) { state.platform = b.dataset.p; render(); } };
  fillSelect($("#fType"), TYPE, "type");
  fillSelect($("#fAI"), AI, "ai");
  fillSelect($("#fStatus"), STATUS, "status");
  $("#sort").onchange = (e) => { state.sort = e.target.value; render(); };
  $("#q").oninput = (e) => { state.q = e.target.value; render(); };
  $("#submitLink").href = `https://github.com/${SITE_REPO}/issues/new?template=submit.yml`;
  render();
}
init();
