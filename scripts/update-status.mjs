// 抓取每个 GitHub 仓库的星数、最近推送、最新 Release，并从 Release 文件名识别移植目标平台
// 用法：GITHUB_TOKEN=xxx node scripts/update-status.mjs
import { readFile, writeFile } from "node:fs/promises";

const { projects } = JSON.parse(await readFile("data/projects.json", "utf8"));
const repos = [...new Set(projects.map((p) => p.repo).filter(Boolean))];
const headers = { Accept: "application/vnd.github+json", "User-Agent": "ai-port-nav" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

// 文件名 → 目标平台
const TARGET_RULES = [
  ["windows", /(^|[^a-z])win(dows)?(32|64)?([^a-z]|$)|\.exe$|\.msi$|msvc|mingw/i],
  ["macos", /mac(os)?|osx|darwin|\.dmg$|apple|universal2?/i],
  ["linux", /linux|appimage|\.deb$|\.rpm$|flatpak|ubuntu|steamdeck|steam[-_ ]?deck/i],
  ["android", /android|\.apk$/i],
  ["switch", /switch|\.nro$|\.nsp$|[-_.]nx[-_.]/i],
  ["ios", /\bios\b|\.ipa$|iphone/i],
  ["ps4", /ps4|orbis|goldhen/i],
  ["ps5", /ps5|prospero/i],
  ["vita", /vita|\.vpk$/i],
  ["web", /wasm|web(assembly)?[-_.]|browser/i],
];
const SKIP = /source|src|symbols|\.pdb$|debug-?info|checksum|sha256|\.sig$/i;

function detectTargets(assets) {
  const set = new Set();
  for (const a of assets) {
    if (SKIP.test(a)) continue;
    for (const [t, re] of TARGET_RULES) if (re.test(a)) set.add(t);
  }
  return [...set];
}

async function gh(path) {
  const r = await fetch(`https://api.github.com/${path}`, { headers });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}


// ---------- 可玩性信号：README 关键句 + 近期问题反馈 ----------
const PLAY_RE = /(fully playable|completable|beatable|playable from start to finish|100% playable|can be (completed|beaten)|playable|not (yet )?playable|work in progress|wip|early (alpha|access|stage)|alpha|beta|experimental|known issues|softlock|crash(es)?|可通关|可游玩|不可玩|开发中)/i;
const BUG_RE = /crash|freez|hang|black screen|softlock|soft-lock|stuck|won'?t (start|boot|launch)|doesn'?t (start|boot|launch)|segfault|access violation|闪退|卡死|黑屏|无法启动/i;
const README_PLAT = [
  ["windows", /\bwindows\b|\bwin(32|64)\b/i], ["linux", /\blinux\b|steam ?deck|appimage|flatpak/i], ["macos", /\bmac ?os\b|\bosx\b|apple silicon/i],
  ["android", /\bandroid\b/i], ["ios", /\bios\b|iphone|ipad/i], ["switch", /nintendo switch|switch homebrew|\.nro\b/i],
  ["ps4", /\bps4\b.*(homebrew|goldhen|jailbr)/i], ["ps5", /\bps5\b.*(homebrew|jailbr|etahen)/i], ["vita", /ps ?vita.*(homebrew|vpk)/i],
];
async function signals(repo) {
  const sig = {};
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } });
    if (r.ok) {
      const text = (await r.text()).replace(/<[^>]+>/g, " ").replace(/[#*_`>|\[\]]/g, " ");
      const lines = text.split(/(?<=[.!?。！？])\s+|\n+/).map((l) => l.trim()).filter((l) => l.length > 12 && l.length < 260);
      sig.readme = lines.filter((l) => PLAY_RE.test(l)).slice(0, 4);
      // README 中提到的运行平台（只看含 run/play/build/support/download 等语境的句子，减少误判）
      const ctx = lines.filter((l) => /run|play|build|support|download|release|platform|运行|支持|下载|平台/i.test(l));
      sig.readmeTargets = README_PLAT.filter(([, re]) => ctx.some((l) => re.test(l))).map(([k]) => k);
    }
  } catch {}
  try {
    const iss = (await gh(`repos/${repo}/issues?state=all&per_page=50&sort=created&direction=desc`)) || [];
    const real = iss.filter((i) => !i.pull_request);
    const since = Date.now() - 30 * 864e5;
    const recent = real.filter((i) => new Date(i.created_at) > since);
    const bugs = recent.filter((i) => BUG_RE.test(i.title));
    sig.issues30d = recent.length;
    sig.bugs30d = bugs.length;
    sig.open = real.filter((i) => i.state === "open").length;
    sig.bugTitles = bugs.slice(0, 5).map((i) => i.title.slice(0, 120));
  } catch {}
  return sig;
}

const out = { generated: new Date().toISOString(), repos: {} };
let prev = {};
try { prev = JSON.parse(await readFile("data/status.json", "utf8")).repos || {}; } catch {}

for (const repo of repos) {
  try {
    const info = await gh(`repos/${repo}`);
    if (!info) { out.repos[repo] = { missing: true }; console.log(`✗ ${repo} 404`); continue; }
    const rels = (await gh(`repos/${repo}/releases?per_page=6`)) || [];
    const stable = rels.find((r) => !r.draft && !r.prerelease) || rels.find((r) => !r.draft) || null;
    // 取最近一个带附件的 release 识别平台
    const withAssets = rels.find((r) => !r.draft && r.assets?.length);
    const assetNames = withAssets ? withAssets.assets.map((a) => a.name) : [];
    out.repos[repo] = {
      stars: info.stargazers_count,
      pushed_at: info.pushed_at,
      archived: info.archived,
      release: stable ? { tag: stable.tag_name, published_at: stable.published_at, prerelease: stable.prerelease } : null,
      targets: detectTargets(assetNames),
      signals: await signals(repo),
      assets: assetNames.slice(0, 20),
    };
    {
      const r = out.repos[repo], rt = r.signals?.readmeTargets || [];
      // 原平台本身不算运行平台（如 Switch 游戏的 README 里提到 Switch）
      const ORIG = { Switch: "switch", PS4: "ps4", PS5: "ps5", "PS Vita": "vita", PC: "windows" };
      const origs = new Set(projects.filter((p) => p.repo === repo).map((p) => ORIG[p.platform]).filter(Boolean));
      const rt2 = rt.filter((t) => !origs.has(t));
      // 没有发布过下载包的项目（纯反编译、早期线索）不据 README 推断
      if (!r.targets.length && rt2.length && r.release) { r.targets = rt2; r.targetsFrom = "readme"; }
      else if (r.targets.length) { r.targetsFrom = "assets"; const extra = rt.filter((t) => !r.targets.includes(t) && !origs.has(t)); if (extra.length) r.targetsReadmeOnly = extra; }
    }
    console.log(`✓ ${repo} ★${info.stargazers_count} ${stable?.tag_name ?? "-"} [${out.repos[repo].targets.join(",")}]`);
  } catch (e) {
    console.warn(`! ${repo}: ${e.message}（保留上次数据）`);
    if (prev[repo]) out.repos[repo] = prev[repo];
  }
}
await writeFile("data/status.json", JSON.stringify(out, null, 1) + "\n");
const missing = Object.entries(out.repos).filter(([, v]) => v.missing).map(([k]) => k);
if (missing.length) console.log(`\n失效仓库：\n${missing.join("\n")}`);
