# Audio helpers: I/O via ffmpeg, filters, loudness (BS.1770), reverb, analysis.
import subprocess, json, os, math
import numpy as np
from scipy import signal

SR = 44100

def load(path, sr=SR, mono=True):
    ch = 1 if mono else 2
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', str(ch), '-ar', str(sr), '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)

def save_wav(path, x, sr=SR):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1: ch = 1
    else: ch = x.shape[1]
    data = np.clip(x, -1, 1).astype(np.float32).tobytes()
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', path]
    subprocess.run(cmd, input=data, check=True)

def encode(x, out_base, sr=SR, mp3=True, ogg=False, mp3_q=None, kbps=None, ogg_q=4):
    """Encode to out_base.mp3 / .ogg. x float -1..1 mono or (n,2)."""
    x = np.asarray(x, dtype=np.float64)
    ch = 1 if x.ndim == 1 else x.shape[1]
    data = np.clip(x, -1, 1).astype(np.float32).tobytes()
    outs = []
    if mp3:
        br = kbps or (96 if ch == 1 else 160)
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-',
               '-codec:a', 'libmp3lame', '-b:a', f'{br}k', out_base + '.mp3']
        subprocess.run(cmd, input=data, check=True); outs.append(out_base + '.mp3')
    if ogg:
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-',
               '-codec:a', 'libvorbis', '-q:a', str(ogg_q), out_base + '.ogg']
        subprocess.run(cmd, input=data, check=True); outs.append(out_base + '.ogg')
    return outs

def db(x): return 20 * np.log10(max(1e-12, x))
def undb(d): return 10 ** (d / 20)

def peak(x): return float(np.max(np.abs(x))) if len(x) else 0.0

# ---- BS.1770 loudness (integrated, gated) ----
def _kfilter(sr):
    # pre-filter (high shelf) + RLB highpass, coefficients for 48k adapted via bilinear design
    f0 = 1681.974450955533; G = 3.999843853973347; Q = 0.7071752369554196
    K = math.tan(math.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0 = 38.13547087602444; Q = 0.5003270373238773; K = math.tan(math.pi * f0 / sr)
    b2 = [1, -2, 1]; a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    return (b1, a1), (b2, a2)

def lufs(x, sr=SR):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1: x = x[:, None]
    (b1, a1), (b2, a2) = _kfilter(sr)
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    blk = int(0.4 * sr); hop = int(0.1 * sr)
    if len(y) < blk:
        ms = np.mean(np.sum(y ** 2, axis=1))
        return -0.691 + 10 * np.log10(max(ms, 1e-12))
    zs = []
    for s in range(0, len(y) - blk + 1, hop):
        zs.append(np.sum(np.mean(y[s:s + blk] ** 2, axis=0)))
    zs = np.array(zs)
    l = -0.691 + 10 * np.log10(np.maximum(zs, 1e-12))
    g = zs[l > -70]
    if not len(g): return -70.0
    lr = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = zs[(l > -70) & (l > lr)]
    return float(-0.691 + 10 * np.log10(np.mean(g2))) if len(g2) else float(lr + 10)

def norm_lufs(x, target, sr=SR, ceiling=-1.0):
    cur = lufs(x, sr)
    y = x * undb(target - cur)
    p = peak(y)
    if p > undb(ceiling): y = soft_limit(y, undb(ceiling))
    return y

def soft_limit(x, ceil=0.89):
    # simple lookahead-free soft clip above threshold
    t = ceil * 0.8
    y = np.copy(x)
    a = np.abs(y)
    m = a > t
    y[m] = np.sign(y[m]) * (t + (ceil - t) * np.tanh((a[m] - t) / (ceil - t)))
    return y

# ---- filters ----
def hp(x, f, sr=SR, order=2):
    sos = signal.butter(order, f, 'highpass', fs=sr, output='sos'); return signal.sosfilt(sos, x, axis=0)
def lp(x, f, sr=SR, order=2):
    sos = signal.butter(order, f, 'lowpass', fs=sr, output='sos'); return signal.sosfilt(sos, x, axis=0)
def bp(x, f1, f2, sr=SR, order=2):
    sos = signal.butter(order, [f1, f2], 'bandpass', fs=sr, output='sos'); return signal.sosfilt(sos, x, axis=0)

def peq(x, f, gain_db, q=1.0, sr=SR):
    A = 10 ** (gain_db / 40); w = 2 * math.pi * f / sr; al = math.sin(w) / (2 * q)
    b = [1 + al * A, -2 * math.cos(w), 1 - al * A]; a = [1 + al / A, -2 * math.cos(w), 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)

def shelf(x, f, gain_db, high=True, sr=SR, s=1.0):
    A = 10 ** (gain_db / 40); w = 2 * math.pi * f / sr; cs = math.cos(w); sn = math.sin(w)
    al = sn / 2 * math.sqrt((A + 1 / A) * (1 / s - 1) + 2)
    if high:
        b = [A * ((A + 1) + (A - 1) * cs + 2 * math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * cs), A * ((A + 1) + (A - 1) * cs - 2 * math.sqrt(A) * al)]
        a = [(A + 1) - (A - 1) * cs + 2 * math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - 2 * math.sqrt(A) * al]
    else:
        b = [A * ((A + 1) - (A - 1) * cs + 2 * math.sqrt(A) * al), 2 * A * ((A - 1) - (A + 1) * cs), A * ((A + 1) - (A - 1) * cs - 2 * math.sqrt(A) * al)]
        a = [(A + 1) + (A - 1) * cs + 2 * math.sqrt(A) * al, -2 * ((A - 1) + (A + 1) * cs), (A + 1) + (A - 1) * cs - 2 * math.sqrt(A) * al]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)

# ---- envelopes / edits ----
def fade(x, fin=0.005, fout=0.02, sr=SR, curve=2.0):
    y = np.array(x, dtype=np.float64, copy=True)
    n = len(y); a = int(fin * sr); b = int(fout * sr)
    if a > 0:
        e = (np.linspace(0, 1, a)) ** curve
        y[:a] *= e if y.ndim == 1 else e[:, None]
    if b > 0:
        e = (np.linspace(1, 0, b)) ** curve
        y[n - b:] *= e if y.ndim == 1 else e[:, None]
    return y

def trim(x, thresh_db=-50, pre=0.004, post=0.08, sr=SR):
    a = np.abs(x if x.ndim == 1 else x.max(axis=1))
    env = signal.lfilter([1 - 0.995], [1, -0.995], a)
    th = undb(thresh_db) * max(1e-9, env.max())
    idx = np.where(env > th)[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(pre * sr)); e = min(len(x), idx[-1] + int(post * sr))
    return x[s:e]

def seg(x, t0, t1, sr=SR):
    return x[int(t0 * sr):int(t1 * sr)]

def onsets(x, sr=SR, thresh_db=-30, min_gap=0.15):
    a = np.abs(x if x.ndim == 1 else x.max(axis=1))
    env = signal.lfilter([1 - 0.99], [1, -0.99], a)
    th = undb(thresh_db) * env.max()
    out = []; last = -1e9
    above = env > th
    for i in np.where(np.diff(above.astype(int)) == 1)[0]:
        t = i / sr
        if t - last >= min_gap: out.append(round(t, 3)); last = t
    return out

def stereo(x, width=0.0):
    if x.ndim == 2: return x
    return np.stack([x, x], axis=1)

def pan(x, p):
    # p -1..1, constant power
    a = (p + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)], axis=1)

def make_ir(sr=SR, t60=1.6, predelay=0.012, damp=6000, early=True, seed=1, size=1.0):
    rng = np.random.default_rng(seed)
    n = int(sr * (t60 * 1.2 + predelay))
    t = np.arange(n) / sr
    irs = []
    for ch in range(2):
        noise = rng.standard_normal(n)
        env = np.exp(-6.91 * t / t60)
        ir = noise * env
        # frequency dependent damping: progressively lowpass by mixing two filtered versions
        lo = lp(ir, damp * 0.35, sr, 2); hi = ir
        k = np.clip(t / (t60 * 0.6), 0, 1)
        ir = hi * (1 - k) + lo * k
        ir[: int(predelay * sr)] = 0
        if early:
            for j in range(8):
                d = int(sr * (predelay + 0.004 + rng.random() * 0.03 * size))
                if d < n: ir[d] += (0.5 - 0.05 * j) * (1 if rng.random() > 0.5 else -1)
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(irs, axis=1)

def reverb(x, ir, wet=0.25, dry=1.0):
    xs = stereo(x)
    out = np.zeros((len(xs) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(xs[:, c], ir[:, c])
    y = np.zeros_like(out)
    y[:len(xs)] += xs * dry
    y += out * wet
    return y

def spectro_png(x, path, sr=SR, title=''):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    m = x if x.ndim == 1 else x.mean(axis=1)
    fig, ax = plt.subplots(2, 1, figsize=(10, 4.5), sharex=True)
    t = np.arange(len(m)) / sr
    ax[0].plot(t, m, lw=0.4); ax[0].set_title(title, fontsize=8)
    ax[1].specgram(m + 1e-9, NFFT=1024, Fs=sr, noverlap=768, cmap='magma', vmin=-120)
    ax[1].set_ylim(0, 12000)
    fig.tight_layout(); fig.savefig(path, dpi=70); plt.close(fig)

def info(path):
    x = load(path)
    return {'dur': round(len(x) / SR, 2), 'peak_db': round(db(peak(x)), 1), 'lufs': round(lufs(x), 1)}

# ---- extra helpers (momentary loudness max, circular ops) ----
def mmax(x, sr=SR):
    """Max momentary loudness (400 ms K-weighted window), LUFS-like. Short sounds padded to 400 ms."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1: x = x[:, None]
    blk = int(0.4 * sr)
    if len(x) < blk: x = np.vstack([x, np.zeros((blk - len(x), x.shape[1]))])
    (b1, a1), (b2, a2) = _kfilter(sr)
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    p = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0], np.cumsum(p)])
    ms = (c[blk:] - c[:-blk]) / blk
    return float(-0.691 + 10 * np.log10(max(ms.max(), 1e-12)))

def norm_mmax(x, target, sr=SR, ceiling=-1.0):
    y = x * undb(target - mmax(x, sr))
    p = peak(y)
    if p > undb(ceiling):
        # transients: scale down instead of limiting when far over; soft limit when close
        over = db(p) - ceiling
        if over > 2.5: y = y * undb(-(over - 2.5))
        y = soft_limit(y, undb(ceiling))
    return y

def circ_reverb(x, ir, wet=0.25, dry=1.0):
    """Circular convolution reverb for seamless loops; output length == input length (stereo)."""
    xs = stereo(x); L = len(xs)
    irf = np.zeros((L, 2))
    for c in range(2):
        h = ir[:, c]
        for s in range(0, len(h), L):  # fold long IR
            seg_ = h[s:s + L]; irf[:len(seg_), c] += seg_
    out = np.zeros_like(xs)
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(xs[:, c]) * np.fft.rfft(irf[:, c]), L)
    return xs * dry + out * wet

def circ_filter(x, sos):
    """Zero-phase-ish circular IIR: run filter over 2 periods, keep second (steady state)."""
    xx = np.concatenate([x, x], axis=0)
    y = signal.sosfilt(sos, xx, axis=0)
    return y[len(x):]
