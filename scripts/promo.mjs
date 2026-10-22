// 录制网站宣传视频：node scripts/promo.mjs <网址> <输出目录>
// 生成 webm，由工作流转成 mp4
import { chromium } from "playwright";
import { mkdir, readdir, rename } from "node:fs/promises";

const URL_ = process.argv[2] || "https://infinitytom.github.io/ai-port-nav/";
const OUT = process.argv[3] || "promo-out";
const W = 1920, H = 1080;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: process.env.CHANNEL || undefined });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark", locale: "zh-CN",
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);

// ---------- 片头 / 片尾卡片 ----------
const card = (title, sub, foot = "") => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&family=Noto+Sans+SC:wght@400;900&display=swap" rel="stylesheet">
<style>
html,body{margin:0;height:100%;background:#141210;color:#f1ece4;font-family:"Noto Sans SC",sans-serif;overflow:hidden}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;
 background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.025) 3px 4px),radial-gradient(circle at 50% 40%,#2a1608,#141210 65%)}
.logo{font:700 30px "JetBrains Mono",monospace;letter-spacing:.2em;color:#e8590c;opacity:0;animation:in .8s .1s forwards}
h1{font-size:132px;font-weight:900;margin:24px 0 18px;letter-spacing:-.01em;opacity:0;animation:in .9s .35s forwards}
p{font-size:40px;color:#a39a8e;margin:0;opacity:0;animation:in .9s .8s forwards}
.foot{margin-top:56px;font:700 38px "JetBrains Mono",monospace;color:#f1ece4;background:#e8590c;padding:14px 30px;border-radius:14px;opacity:0;animation:in .9s 1.3s forwards}
@keyframes in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
</style></head><body><div class="logo">◧ PORT/NAV</div><h1>${title}</h1><p>${sub}</p>${foot ? `<div class="foot">${foot}</div>` : ""}</body></html>`;

// ---------- 字幕条 ----------
async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById("__cap");
    if (!el) {
      const st = document.createElement("style");
      st.textContent = `#__cap{position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(20px);z-index:99999;
        background:rgba(20,18,16,.88);color:#fff;font:700 40px "Noto Sans SC",sans-serif;padding:18px 36px;border-radius:16px;
        border-left:8px solid #e8590c;box-shadow:0 20px 60px rgba(0,0,0,.5);opacity:0;transition:opacity .45s,transform .45s;white-space:nowrap;backdrop-filter:blur(8px)}
        #__cap.on{opacity:1;transform:translateX(-50%)}
        #__hl{position:absolute;z-index:99998;border:4px solid #e8590c;border-radius:14px;pointer-events:none;transition:all .4s;box-shadow:0 0 0 9999px rgba(0,0,0,.35)}`;
      document.head.appendChild(st);
      el = document.createElement("div"); el.id = "__cap"; document.body.appendChild(el);
    }
    el.classList.remove("on");
    setTimeout(() => { el.textContent = t; el.classList.add("on"); }, t ? 250 : 0);
    if (!t) el.classList.remove("on");
  }, text);
  await wait(500);
}
async function smoothScrollTo(y, ms = 1400) {
  await page.evaluate(async ([y, ms]) => {
    const s = scrollY, d = y - s, t0 = performance.now();
    await new Promise((res) => { const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, s + d * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  }, [y, ms]);
}
const topOf = (sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
async function clickSlow(sel) {
  const el = page.locator(sel).first();
  const b = await el.boundingBox();
  if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await wait(250); }
  await el.click(); await wait(900);
}

// 1. 片头
await page.setContent(card("AI 移植游戏导航", "老游戏的原生 PC 移植，一站找齐"));
await wait(3600);

// 2. 首页
await page.goto(URL_, { waitUntil: "networkidle" });
// 放大页面内容，让 1180px 宽的版面铺满 1080p 画面（字幕不放大）
await page.addStyleTag({ content: ".hero,main,.foot{zoom:1.45}" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.race([
  Promise.all([...document.images].filter((i) => !i.complete && i.getBoundingClientRect().top < innerHeight).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
  new Promise((r) => setTimeout(r, 6000)),
]));
await wait(800);
await caption("反编译 · 静态重编译 · 原生移植");
await wait(2200);
const n = await page.evaluate(() => document.querySelectorAll("#grid .card").length);
await caption(`已收录 ${n} 个项目，每周自动更新`);
await wait(2200);

// 3. 编辑推荐（横向滚动）
await smoothScrollTo((await topOf("#featured")) - 140, 1400);
await caption("编辑推荐：新手从这里开始");
await wait(800);
await page.evaluate(async () => {
  const el = document.getElementById("featured"); const max = el.scrollWidth - el.clientWidth; const t0 = performance.now();
  await new Promise((res) => { const f = (t) => { const k = Math.min(1, (t - t0) / 5200); el.scrollLeft = max * (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
});
await wait(600);
await page.evaluate(() => document.getElementById("featured").scrollTo({ left: 0, behavior: "smooth" }));
await wait(900);

// 4. 按目标平台
await smoothScrollTo((await topOf("#targets")) - 120, 1300);
await caption("想在哪里玩？按移植平台一键筛选");
await wait(700);
for (const t of ["windows", "linux", "macos", "android"]) { await clickSlow(`.tab[data-t="${t}"]`); await wait(500); }
await clickSlow(`.tab[data-t="ps5"]`);
await caption("甚至可以玩到移植到 PS5 的版本");
await wait(2000);
await clickSlow(`.tab[data-t=""]`);

// 5. 较新主机：Switch、PS4
await caption("较新主机也来了：Switch 的御天之剑、奥德赛……");
await clickSlow(`.chip[data-p="Switch"]`);
await smoothScrollTo((await topOf("#grid")) - 220, 1100);
await wait(1000);
await smoothScrollTo((await topOf("#grid")) + 600, 2800);
await wait(500);
await smoothScrollTo((await topOf("#targets")) - 120, 1100);
await caption("PS4 独占：血源、战神 III、最后的守护者");
await clickSlow(`.chip[data-p="PS4"]`);
await smoothScrollTo((await topOf("#grid")) - 220, 1100);
await wait(1000);
await smoothScrollTo((await topOf("#grid")) + 900, 3400);
await wait(700);
await smoothScrollTo((await topOf("#targets")) - 120, 1200);
await clickSlow(`.chip[data-p=""]`);

// 6. 搜索
await caption("中英文搜索，秒找想玩的游戏");
await page.locator("#q").click();
await page.keyboard.type("塞尔达", { delay: 220 });
await wait(1000);
await smoothScrollTo((await topOf("#grid")) - 220, 1000);
await wait(2200);
await smoothScrollTo((await topOf("#targets")) - 120, 1000);
await page.locator("#q").fill("");
await page.locator("#q").dispatchEvent("input");
await wait(400);

// 7. AI 参与度
await caption("标注 AI 参与程度：AI 主导 / 允许辅助 / 纯人工");
await page.selectOption("#fAI", "ai");
await wait(900);
await smoothScrollTo((await topOf("#grid")) - 220, 1000);
await wait(1200);
await smoothScrollTo((await topOf("#grid")) + 1400, 3600);
await wait(600);
await page.selectOption("#fAI", "");

// 8. 收录原则
await smoothScrollTo((await topOf(".info")) - 160, 2200);
await caption("只收录需自备正版游戏文件的项目，不提供 ROM");
await wait(3200);
await caption("");

// 9. 片尾
await page.setContent(card("AI 移植游戏导航", "收藏起来，每周都有新游戏", "infinitytom.github.io/ai-port-nav"));
await wait(4200);

const vpath = await page.video().path();
await ctx.close(); await browser.close();
await rename(vpath, `${OUT}/promo.webm`);
console.log("done", `${OUT}/promo.webm`);
