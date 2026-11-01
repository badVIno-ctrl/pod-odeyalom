# Мастеринг выбранных дублей: обрезка тишины, HPF, лёгкая комната, −18 LUFS, лимитер, mp3.
# usage: python3 master.py selection.json outdir
import sys, json, os, subprocess, numpy as np, soundfile as sf, librosa, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve

sel = json.load(open(sys.argv[1]))
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
SR = 44100
rng = np.random.default_rng(7)

def room_ir(rt60, sr, predelay_ms=8, bright=0.5):
    n = int(sr * rt60 * 1.2)
    t = np.arange(n) / sr
    env = np.exp(-6.91 * t / rt60)
    ir = rng.standard_normal(n) * env
    # чем дальше, тем глуше: простая НЧ-фильтрация хвоста
    sos = butter(2, 2500 + 4000 * bright, 'low', fs=sr, output='sos')
    ir = sosfilt(sos, ir)
    pd = int(sr * predelay_ms / 1000)
    ir = np.concatenate([np.zeros(pd), ir])
    return ir / np.sqrt(np.sum(ir ** 2))

PRESET = {
    # wet — доля «комнаты», rt60 — длина хвоста, hp — срез низа
    'indoor':  {'wet': 0.10, 'rt60': 0.32, 'hp': 80, 'bright': 0.4},
    'outdoor': {'wet': 0.035, 'rt60': 0.18, 'hp': 90, 'bright': 0.7},
    'spider':  {'wet': 0.16, 'rt60': 0.45, 'hp': 60, 'bright': 0.3},
}

def soft_limit(y, ceiling_db=-1.5):
    c = 10 ** (ceiling_db / 20)
    peak = np.max(np.abs(y))
    if peak <= c: return y
    # мягкое ограничение только верхушек
    k = c * 0.85
    out = np.where(np.abs(y) <= k, y, np.sign(y) * (k + (c - k) * np.tanh((np.abs(y) - k) / (c - k))))
    return out

report = {}
for item in sel:
    src, dst, preset = item['src'], item['dst'], PRESET[item.get('preset', 'indoor')]
    y, sr = sf.read(src, always_2d=False)
    if y.ndim > 1: y = y.mean(1)
    y = librosa.resample(y.astype(np.float64), orig_sr=sr, target_sr=SR) if sr != SR else y.astype(np.float64)
    iv = librosa.effects.split(y, top_db=item.get('top_db', 42), frame_length=1024, hop_length=256)
    if len(iv):
        s = max(0, iv[0][0] - int(0.08 * SR)); e = min(len(y), iv[-1][1] + int(0.22 * SR))
        y = y[s:e]
    # плавные края
    f = int(0.012 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    y = sosfilt(butter(2, preset['hp'], 'high', fs=SR, output='sos'), y)
    if item.get('preset') == 'spider':
        # чуть больше «груди» у паука: мягкий подъём 120–250 Гц
        low = sosfilt(butter(2, [110, 260], 'band', fs=SR, output='sos'), y)
        y = y + 0.25 * low
    ir = room_ir(preset['rt60'], SR, bright=preset['bright'])
    wet = fftconvolve(y, ir)[:len(y) + int(0.25 * SR)]
    dry = np.concatenate([y, np.zeros(len(wet) - len(y))])
    y = dry * (1 - preset['wet']) + wet * preset['wet'] * 0.9
    # хвост обрезаем там, где он ушёл ниже −60 дБ от пика
    thr = np.max(np.abs(y)) * 10 ** (-60 / 20)
    nz = np.where(np.abs(y) > thr)[0]
    if len(nz): y = y[: min(len(y), nz[-1] + int(0.03 * SR))]
    f = int(0.03 * SR); y[-f:] *= np.linspace(1, 0, f)
    meter = pyln.Meter(SR)
    target = item.get('lufs', -18.0)
    try:
        lufs = meter.integrated_loudness(y)
        y = y * 10 ** ((target - lufs) / 20)
    except Exception:
        y = y / (np.max(np.abs(y)) + 1e-9) * 0.5
    y = soft_limit(y, -1.5)
    tmp = dst + '.wav'
    sf.write(tmp, y.astype(np.float32), SR, subtype='PCM_16')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', str(SR),
                    '-codec:a', 'libmp3lame', '-b:a', '112k', dst], check=True)
    os.remove(tmp)
    report[os.path.basename(dst)] = {'src': os.path.basename(src), 'dur': round(len(y) / SR, 2),
                                     'peak_db': round(20 * np.log10(np.max(np.abs(y)) + 1e-9), 1)}
    print(os.path.basename(dst), report[os.path.basename(dst)], flush=True)
json.dump(report, open(os.path.join(outdir, 'master_report.json'), 'w'), ensure_ascii=False, indent=1)
