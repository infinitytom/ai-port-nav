"""生成宣传视频的原创背景音乐（复古游戏感 Trance，128 BPM，A 小调）。
用法：python3 scripts/bgm.py <时长秒数> <输出.wav>
全部由代码合成，不使用任何采样或现成曲目。
"""
import sys
import wave
import numpy as np
from scipy.signal import lfilter, butter

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 96.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "bgm.wav"
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
N = int(DUR * SR)
rng = np.random.default_rng(7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def t_(sec): return np.arange(int(sec * SR)) / SR
def lp(x, fc, order=2): b, a = butter(order, min(fc / (SR / 2), 0.99), "low"); return lfilter(b, a, x)
def hp(x, fc, order=2): b, a = butter(order, fc / (SR / 2), "high"); return lfilter(b, a, x)
def saw(f, t): return 2 * ((f * t) % 1.0) - 1
def sq(f, t, w=0.5): return np.where((f * t) % 1.0 < w, 1.0, -1.0)
def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / max(a, 1e-4))
    dec = s + (1 - s) * np.exp(-(tt - a).clip(0) / max(d, 1e-4))
    e = np.where(tt < a, e, dec)
    if hold is not None:
        rel = (tt - hold).clip(0)
        e = e * np.exp(-rel / max(r, 1e-4))
    return e

L = np.zeros(N); R = np.zeros(N)
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - pan) ** 0.5 * 1.0
    R[i:i + len(sig)] += sig * (1 + pan) ** 0.5 * 1.0

# 和弦进行：Am - F - C - G
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]
bars = int(np.ceil(DUR / BAR))
end_drums = DUR - 4.6          # 片尾卡片只留铺底
intro_end = BAR * 2            # 片头两小节

# ---------- 鼓 ----------
def kick():
    t = t_(0.35); f = 45 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * 1.0 + 0.3 * np.exp(-t / 0.004) * rng.standard_normal(len(t)) * 0.2
def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    return hp(rng.standard_normal(n), 7000) * env(n, 0.001, 0.06 if open_ else 0.015)
def clap():
    n = int(0.22 * SR); x = rng.standard_normal(n)
    b, a = butter(2, [900 / (SR / 2), 3500 / (SR / 2)], "band"); x = lfilter(b, a, x)
    e = env(n, 0.001, 0.08); e[: int(0.01 * SR)] *= (np.sin(np.linspace(0, 6 * np.pi, int(0.01 * SR))) ** 2)
    return x * e
K, H, HO, C = kick(), hat(), hat(True), clap()

# 侧链包络（让铺底和贝斯随底鼓「呼吸」）
duck = np.ones(N)
t0 = intro_end
while t0 < end_drums:
    add(K, t0, 0.9)
    i = int(t0 * SR); n = int(BEAT * SR)
    seg = 1 - 0.65 * np.exp(-np.arange(n) / SR / 0.09)
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[: len(duck[i:i + n])])
    add(HO if int((t0 - intro_end) / BEAT) % 4 == 3 else H, t0 + BEAT / 2, 0.22, pan=0.3)
    add(H, t0 + BEAT / 4, 0.07, pan=-0.3); add(H, t0 + 3 * BEAT / 4, 0.07, pan=-0.3)
    t0 += BEAT
drop = BAR * 10
t0 = drop
while t0 < end_drums:
    add(C, t0 + BEAT, 0.35); add(C, t0 + 3 * BEAT, 0.35)
    t0 += BAR

# ---------- 贝斯（Trance 反拍）----------
for b in range(bars):
    start = b * BAR
    if start < intro_end or start >= end_drums: continue
    root = PROG[b % 4][0] - 24
    for k in range(4):
        st = start + k * BEAT + BEAT / 2
        if st >= end_drums: break
        n = int(BEAT / 2 * 0.95 * SR); t = t_(n / SR)
        x = 0.6 * saw(mtof(root), t) + 0.4 * sq(mtof(root - 12), t)
        x = lp(x, 900) * env(n, 0.003, 0.12, 0.6, 0.02, hold=n / SR - 0.02)
        add(x, st, 0.45)

# ---------- 铺底（超锯齿和弦）----------
pad = np.zeros(N)
for b in range(bars):
    start = b * BAR; n = int(BAR * SR); t = t_(BAR)
    x = np.zeros(n)
    for m in PROG[b % 4][1]:
        for det in (-0.12, -0.05, 0, 0.05, 0.12):
            x += saw(mtof(m + 12) * 2 ** (det / 12), t + rng.random())
    x = lp(x / 15, 2200) * env(n, 0.15, 10, 1, 0.3, hold=BAR - 0.25)
    i = int(start * SR); seg = x[: max(0, N - i)]; pad[i:i + len(seg)] += seg
fade_in = np.clip(np.arange(N) / SR / intro_end, 0, 1) ** 1.5
pad *= fade_in * duck * 0.5
L += pad * 0.95; R += pad * 1.05

# ---------- 琶音（方波 16 分音符，带回声）----------
arp = np.zeros(N)
pattern = [0, 1, 2, 1, 0, 2, 1, 2]
for b in range(bars):
    start = b * BAR
    notes = PROG[b % 4][1]
    for k in range(16):
        st = start + k * BEAT / 4
        if st >= DUR - 2.5: break
        m = notes[pattern[k % 8]] + 24 + (12 if k % 8 == 7 else 0)
        n = int(BEAT / 4 * SR); t = t_(n / SR)
        x = sq(mtof(m), t, 0.25) * env(n, 0.002, 0.05)
        i = int(st * SR); seg = x[: max(0, N - i)]; arp[i:i + len(seg)] += seg
arp = lp(arp, 5000) * 0.09 * np.clip(np.arange(N) / SR / 1.5, 0, 1)
d = int(BEAT * 0.75 * SR)
echoL = np.concatenate([np.zeros(d), arp[:-d]]) * 0.35
echoR = np.concatenate([np.zeros(d // 2), arp[:-(d // 2)]]) * 0.3
L += arp + echoL; R += arp + echoR

# ---------- 主旋律（从 drop 开始）----------
# 每小节 8 个八分音符位置，None 为休止
MEL = [
    [69, None, 72, None, 76, None, 74, 72],
    [72, None, 69, None, 65, None, 67, 69],
    [67, None, 72, None, 76, None, 79, 76],
    [74, None, 71, None, 67, None, 71, 74],
    [76, None, 74, 72, 74, None, 72, 69],
    [72, None, 69, 65, 69, None, 72, 77],
    [79, None, 76, 72, 76, None, 79, 84],
    [83, None, 79, None, 74, None, None, None],
]
lead = np.zeros(N)
for b in range(int(drop / BAR), bars):
    start = b * BAR
    if start >= end_drums: break
    phrase = MEL[(b - int(drop / BAR)) % 8]
    for k, m in enumerate(phrase):
        if m is None: continue
        st = start + k * BEAT / 2
        if st >= end_drums: break
        ln = BEAT / 2 * (2 if k + 1 < 8 and phrase[k + 1] is None else 1)
        n = int(ln * SR); t = t_(ln)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.15, 0, 1)
        f = mtof(m) * vib
        ph = np.cumsum(f) / SR
        x = 0.55 * (2 * (ph % 1) - 1) + 0.45 * np.where((ph * 1.003) % 1 < 0.5, 1, -1)
        x = lp(x, 3800) * env(n, 0.01, 0.4, 0.55, 0.06, hold=ln - 0.05)
        i = int(st * SR); seg = x[: max(0, N - i)]; lead[i:i + len(seg)] += seg
lead *= 0.16
dl = int(BEAT * 0.5 * SR)
L += lead + np.concatenate([np.zeros(dl), lead[:-dl]]) * 0.25
R += lead + np.concatenate([np.zeros(int(dl * 1.5)), lead[:-int(dl * 1.5)]]) * 0.25

# ---------- 上升噪声（drop 前一小节）----------
n = int(BAR * SR); rs = hp(rng.standard_normal(n), 3000) * np.linspace(0, 1, n) ** 2 * 0.12
add(rs, drop - BAR, 1.0)

# ---------- 母带 ----------
mix = np.stack([L, R], 1)
mix = hp(mix.T, 30).T
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
fade = np.ones(N); fo = int(3.5 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
fi = int(0.4 * SR); fade[:fi] *= np.linspace(0, 1, fi)
mix *= fade[:, None] * 0.89
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(f"{OUT}: {DUR:.2f}s, {bars} bars @ {BPM} BPM")
