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
p{font-size:40px;line-height:1.6;text-align:center;color:#a39a8e;margin:0;opacity:0;animation:in .9s .8s forwards}
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

// 1. 片头 + 声明
await page.setContent(card("开源游戏移植资料站", "反编译 · 静态重编译 · 游戏保存"));
await wait(3400);
await page.setContent(card("先说清楚", "本站只整理开源项目的技术资料<br>不提供任何游戏、ROM、密钥或固件 · 需自备正版"));
await wait(4200);

// 2. 首页
await page.goto(URL_, { waitUntil: "networkidle" });
await page.addStyleTag({ content: ".hero,main,.foot{zoom:1.45}" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.race([
  Promise.all([...document.images].filter((i) => !i.complete && i.getBoundingClientRect().top < innerHeight).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
  new Promise((r) => setTimeout(r, 6000)),
]));
await wait(800);
await caption("开源社区如何把老游戏改写成原生程序？");
await wait(2400);
await caption("首页声明：不提供任何游戏资源，仅作技术与保存交流");
await page.evaluate(() => { const n = document.querySelector(".notice"); n.style.transition = "box-shadow .4s"; n.style.boxShadow = "0 0 0 4px #e8590c"; });
await wait(3000);
await page.evaluate(() => { document.querySelector(".notice").style.boxShadow = ""; });

// 3. 技术类型科普
await smoothScrollTo((await topOf(".info")) - 120, 2400);
await caption("反编译、静态重编译、原生重写：每种技术是什么");
await wait(3600);
await caption("AI 参与程度也会标注出来");
await wait(2600);

// 4. 社区实测的可玩性
await smoothScrollTo((await topOf("#targets")) - 120, 2200);
await caption("每个项目附社区实测结论与来源，而不只看作者自述");
await page.selectOption("#fPlay", "full");
await wait(900);
await smoothScrollTo((await topOf("#grid")) - 200, 1000);
await page.evaluate(() => { const b = document.querySelector("#grid .play"); if (b) { b.style.transition = "box-shadow .4s"; b.style.boxShadow = "0 0 0 4px #e8590c"; } });
await wait(3200);
await page.evaluate(() => { const b = document.querySelector("#grid .play"); if (b) b.style.boxShadow = ""; });
await smoothScrollTo((await topOf("#targets")) - 120, 1000);
await page.selectOption("#fPlay", "partial");
await caption("有问题的也如实标注：崩溃多、内容不全");
await wait(900);
await smoothScrollTo((await topOf("#grid")) - 200, 1000);
await wait(2600);
await smoothScrollTo((await topOf("#targets")) - 120, 1000);
await page.selectOption("#fPlay", "");

// 5. 按技术类型筛选、搜索
await caption("按技术类型、平台、AI 参与度筛选");
await page.selectOption("#fType", "recomp");
await wait(1200);
await smoothScrollTo((await topOf("#grid")) + 500, 2600);
await wait(600);
await smoothScrollTo((await topOf("#targets")) - 120, 1100);
await page.selectOption("#fType", "");
await caption("中英文搜索");
await page.locator("#q").click();
await page.keyboard.type("Recomp", { delay: 160 });
await wait(800);
await smoothScrollTo((await topOf("#grid")) - 200, 1000);
await wait(2000);
await smoothScrollTo((await topOf("#targets")) - 120, 1000);
await page.locator("#q").fill("");
await page.locator("#q").dispatchEvent("input");
await wait(400);

// 6. 玩家反馈
await smoothScrollTo((await topOf("#grid")) - 200, 1000);
await caption("玩过的玩家可以提交实测反馈，每周核实后更新");
const fb = page.locator("#grid .btn.fb").first();
const bb = await fb.boundingBox();
if (bb) await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 24 });
await page.evaluate(() => { const b = document.querySelector("#grid .btn.fb"); b.style.boxShadow = "0 0 0 4px #e8590c"; });
await wait(3000);

// 7. 收录原则
await smoothScrollTo((await topOf(".info")) - 120, 2200);
await caption("只收录开源、需自备正版的项目");
await wait(3200);
await caption("");

// 8. 片尾
await page.setContent(card("开源 · 透明 · 可核查", "游戏保存，从了解技术开始", "infinitytom.github.io/ai-port-nav"));
await wait(4400);

const vpath = await page.video().path();
await ctx.close(); await browser.close();
await rename(vpath, `${OUT}/promo.webm`);
console.log("done", `${OUT}/promo.webm`);
