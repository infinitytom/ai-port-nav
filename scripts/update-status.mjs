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
      assets: assetNames.slice(0, 20),
    };
    console.log(`✓ ${repo} ★${info.stargazers_count} ${stable?.tag_name ?? "-"} [${out.repos[repo].targets.join(",")}]`);
  } catch (e) {
    console.warn(`! ${repo}: ${e.message}（保留上次数据）`);
    if (prev[repo]) out.repos[repo] = prev[repo];
  }
}
await writeFile("data/status.json", JSON.stringify(out, null, 1) + "\n");
const missing = Object.entries(out.repos).filter(([, v]) => v.missing).map(([k]) => k);
if (missing.length) console.log(`\n失效仓库：\n${missing.join("\n")}`);
