// 仓库地址：用于"推荐一个项目"链接。部署后改成你的 owner/repo
const SITE_REPO = "infinitytom/ai-port-nav";

const TYPE = { decomp: "反编译移植", recomp: "静态重编译", port: "原生重写" };
const AI = { ai: "AI 主导", assist: "允许辅助", none: "纯人工", unknown: "未声明" };
const STATUS = { released: "已发布 · 可玩", beta: "测试版", wip: "开发中", decomp: "仅反编译" };
const STATUS_RANK = { released: 0, beta: 1, wip: 2, decomp: 3 };
const PLAT_ORDER = ["NES","SNES","Genesis","N64","GameCube","Wii","Switch","GBA","DS","PS1","PS2","Xbox","Xbox 360","Arcade","PC"];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const state = { q: "", platform: "", type: "", ai: "", status: "", sort: "rec" };
let projects = [], repoStatus = {};

// theme
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
    if (hasRel) out.push(`<a class="btn primary" href="https://github.com/${esc(p.repo)}/releases" target="_blank" rel="noopener">⬇ 下载 Releases</a>`);
    out.push(`<a class="btn${hasRel ? "" : " primary"}" href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener">GitHub${hasRel ? "" : " 仓库"}</a>`);
  } else if (p.url) {
    out.push(`<a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">官网 / 下载</a>`);
  } else if (p.search) {
    out.push(`<a class="btn" href="https://github.com/search?type=repositories&q=${encodeURIComponent(p.search)}" target="_blank" rel="noopener">🔍 GitHub 搜索（链接待核实）</a>`);
  }
  return out.join("");
}

function card(p) {
  const s = p.repo && repoStatus[p.repo];
  const meta = [];
  if (s) {
    if (s.missing) meta.push(`<span class="warn">⚠ 仓库已失效（可能被下架）</span>`);
    else {
      meta.push(`★ ${s.stars.toLocaleString()}`);
      if (s.release) meta.push(`${esc(s.release.tag)} · ${ago(s.release.published_at)}`);
      else if (s.pushed_at) meta.push(`更新 ${ago(s.pushed_at)}`);
      if (s.archived) meta.push(`<span class="warn">已归档</span>`);
    }
  }
  return `<article class="card">
    <h3>${esc(p.game)}</h3>
    <div class="en">${esc(p.game_en)}</div>
    <div class="tags">
      <span class="tag plat">${esc(p.platform)}</span>
      <span class="tag">${TYPE[p.type] || p.type}</span>
      <span class="ai ai-${p.ai}">${AI[p.ai]}</span>
      <span class="tag st-${p.status}">${STATUS[p.status]}</span>
    </div>
    <div class="proj">项目：<b>${esc(p.project)}</b></div>
    ${p.note ? `<p class="note">${esc(p.note)}</p>` : `<p class="note"></p>`}
    ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
    <div class="links">${links(p)}</div>
  </article>`;
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = projects.filter((p) =>
    (!state.platform || p.platform === state.platform) &&
    (!state.type || p.type === state.type) &&
    (!state.ai || p.ai === state.ai) &&
    (!state.status || p.status === state.status) &&
    (!q || [p.game, p.game_en, p.project, p.platform, p.note].join(" ").toLowerCase().includes(q))
  );
  const by = {
    rec: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || stars(b) - stars(a),
    recent: (a, b) => lastActive(b) - lastActive(a),
    stars: (a, b) => stars(b) - stars(a),
    name: (a, b) => a.game.localeCompare(b.game, "zh-CN"),
  }[state.sort];
  return list.sort(by);
}

function render() {
  const list = filtered();
  $("#grid").innerHTML = list.map(card).join("");
  $("#empty").hidden = list.length > 0;
  $("#count").textContent = `显示 ${list.length} / ${projects.length}`;
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.p === state.platform)));
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
    [new Set(projects.map((p) => p.platform)).size, "覆盖平台"],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");

  $("#featured").innerHTML = projects.filter((p) => p.featured).map(card).join("");

  const counts = {};
  projects.forEach((p) => (counts[p.platform] = (counts[p.platform] || 0) + 1));
  const plats = Object.keys(counts).sort((a, b) => (PLAT_ORDER.indexOf(a) + 99) % 99 - (PLAT_ORDER.indexOf(b) + 99) % 99);
  $("#platforms").innerHTML = `<button class="chip" data-p="">全部平台</button>` +
    plats.map((p) => `<button class="chip" data-p="${esc(p)}">${esc(p)}<i>${counts[p]}</i></button>`).join("");
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
