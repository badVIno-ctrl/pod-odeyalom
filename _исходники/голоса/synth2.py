# Синтез голосов v2: медленнее, чёткие паузы, чистый голос паука. usage: python3 synth2.py [ID ...] [--laugh]
import sys, os, re, json, subprocess, numpy as np, soundfile as sf, torch
import scipy.signal as sg, pyloudnorm as pyln
torch.set_num_threads(2)
SR = 48000
ROOT = os.environ.get('ROOT', '/data/game/Пять дней жара')
OUT = os.environ.get('OUT', f'{ROOT}/assets/audio/voice')
RAW = os.environ.get('RAW', '/data/tts/raw2'); os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lines.py'), encoding='utf-8').read())
args = [a for a in sys.argv[1:] if not a.startswith('--')]
only = set(args)

import contextlib, io
with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
    model, _ = torch.hub.load(repo_or_dir='snakers4/silero-models', model='silero_tts', language='ru', speaker='v5_2_ru', trust_repo=True)

# rate: x-slow | slow | medium; pitch: x-low … x-high. room — доля «комнаты», pres — подъём разборчивости (дБ, 2–4 кГц).
PRESETS = {
  'mom':        dict(spk='baya',    pitch='medium', rate='medium',   room=0.07, rt=0.30, hp=90,  pres=1.5),
  'mom_slow':   dict(spk='baya',    pitch='medium', rate='slow',     room=0.06, rt=0.30, hp=90,  pres=2.0),
  'mom_soft':   dict(spk='baya',    pitch='low',    rate='slow', room=0.06, rt=0.30, hp=90,  pres=1.0, gain=-2),
  'mom_out':    dict(spk='baya',    pitch='medium', rate='medium',   room=0.02, rt=0.20, hp=90,  pres=1.5),
  'boy':        dict(spk='kseniya', pitch='x-high', rate='slow',   room=0.07, rt=0.30, hp=120, pres=1.0),
  'boy_weak':   dict(spk='kseniya', pitch='x-high', rate='x-slow', room=0.07, rt=0.30, hp=120, pres=0.5, gain=-2.5),
  'boy_out':    dict(spk='kseniya', pitch='x-high', rate='slow',   room=0.02, rt=0.20, hp=120, pres=1.0),
  'spider':     dict(spk='aidar',   pitch='low',    rate='slow', room=0.09, rt=0.38, hp=70,  pres=3.0, body=2.5),
  'spider_out': dict(spk='aidar',   pitch='low',    rate='slow', room=0.05, rt=0.25, hp=70,  pres=3.0, body=2.0),
  'spider_tiny':dict(spk='aidar',   pitch='x-high', rate='slow', room=0.12, rt=0.45, hp=180, pres=2.0, gain=-3),  # не используется: другой голос
  # тихая реплика Тихона (S124): тот же голос и высота, что у 'spider', только тише и чуть дальше
  'spider_soft':dict(spk='aidar',   pitch='low',    rate='slow', room=0.12, rt=0.42, hp=70,  pres=2.5, body=2.5, gain=-3),
  # тайная глава: маленькая Аня (другой голос, чем у мальчика) и её мама — из кухни, за стенкой
  'girl':       dict(spk='xenia',   pitch='x-high', rate='slow',   room=0.07, rt=0.30, hp=130, pres=1.0),
  'girl_soft':  dict(spk='xenia',   pitch='x-high', rate='slow',   room=0.08, rt=0.32, hp=130, pres=0.5, gain=-3),
  'grandma_far':dict(spk='kseniya', pitch='low',    rate='medium', room=0.24, rt=0.55, hp=170, pres=0.0, gain=-4, lp=3600),
  'doctor':     dict(spk='eugene',  pitch='low',    rate='70%',    room=0.07, rt=0.30, hp=70,  pres=2.0),
  'medic':      dict(spk='eugene',  pitch='medium', rate='70%',    room=0.07, rt=0.30, hp=80,  pres=2.0),
}

def ssml(tts, p):
    t = tts.replace('…', '...').replace('«', '').replace('»', '')
    t = t.replace('&', ' и ')
    # паузы: многоточие, тире, конец предложения внутри реплики
    t = re.sub(r'\.\.\.\s*(?=\S)', '... <break time="420ms"/> ', t)
    t = re.sub(r'\s+—\s+', ', <break time="200ms"/> ', t)
    t = re.sub(r'([.!?])\s+(?=[^<\s])', r'\1 <break time="300ms"/> ', t)
    t = re.sub(r':\s+', ': <break time="200ms"/> ', t)
    return f'<speak><break time="250ms"/><prosody pitch="{p["pitch"]}" rate="{p["rate"]}">{t}</prosody></speak>'

def ir(seconds, rt, seed=1):
    r = np.random.default_rng(seed); n = int(SR*seconds)
    t = np.arange(n)/SR
    x = r.standard_normal(n) * np.exp(-6.91*t/rt)
    b, a = sg.butter(2, [250/(SR/2), 5000/(SR/2)], 'band'); x = sg.lfilter(b, a, x)
    x[:int(0.006*SR)] = 0
    return x / np.sqrt((x**2).sum())

def peq(x, f0, gain_db, q=0.9):
    # пиковый фильтр (RBJ)
    A = 10**(gain_db/40); w0 = 2*np.pi*f0/SR; al = np.sin(w0)/(2*q)
    b = [1+al*A, -2*np.cos(w0), 1-al*A]; a = [1+al/A, -2*np.cos(w0), 1-al/A]
    return sg.lfilter(np.array(b)/a[0], np.array(a)/a[0], x)

def trim(x, thr_db=-50, pre=0.12, post=0.25):
    env = np.abs(x); win = int(0.01*SR)
    env = np.convolve(env, np.ones(win)/win, 'same')
    thr = 10**(thr_db/20) * env.max()
    idx = np.where(env > thr)[0]
    if not len(idx): return x
    a = max(0, idx[0]-int(pre*SR)); b = min(len(x), idx[-1]+int(post*SR))
    y = x[a:b].copy()
    f = int(0.01*SR); y[:f] *= np.linspace(0,1,f); y[-f:] *= np.linspace(1,0,f)
    return y

def process(x, p):
    b, a = sg.butter(2, p['hp']/(SR/2), 'high'); x = sg.lfilter(b, a, x)
    if p.get('body'): x = peq(x, 180, p['body'], 0.8)
    if p.get('pres'): x = peq(x, 3000, p['pres'], 0.8)
    x = trim(x)
    if p['room'] > 0:
        wet = sg.fftconvolve(x, ir(p['rt']*1.3, p['rt']))
        dry = np.concatenate([x, np.zeros(len(wet)-len(x))])
        x = dry + p['room'] * wet * (np.sqrt((x**2).mean()) / (np.sqrt((wet**2).mean())+1e-9))
        thr = np.abs(x).max() * 10**(-55/20); nz = np.where(np.abs(x) > thr)[0]
        if len(nz): x = x[:nz[-1]+int(0.03*SR)]
        f = int(0.03*SR); x[-f:] *= np.linspace(1,0,f)
    bb, aa = sg.butter(1, 12000/(SR/2), 'low'); x = sg.lfilter(bb, aa, x)
    if p.get('lp'): bb, aa = sg.butter(2, p['lp']/(SR/2), 'low'); x = sg.lfilter(bb, aa, x)  # голос из-за стены
    meter = pyln.Meter(SR); lufs = meter.integrated_loudness(x)
    x = pyln.normalize.loudness(x, lufs, -18.0 + p.get('gain', 0))
    peak = 10**(-1.5/20)
    x = np.where(np.abs(x) > peak, np.sign(x)*(peak + (1-peak)*np.tanh((np.abs(x)-peak)/(1-peak))), x)
    return np.clip(x, -0.99, 0.99)

# Смех паука тем же голосом, что и реплики (иначе у паука «два голоса»): python3 synth2.py --laugh
if '--laugh' in sys.argv:
    a = model.apply_tts(ssml_text='<speak><prosody pitch="low" rate="slow">Х+е-х+е-х+е-х+е.</prosody></speak>',
                        speaker=PRESETS['spider']['spk'], sample_rate=SR).numpy().astype(np.float64)
    y = process(a, PRESETS['spider']); wav = f'{RAW}/spider_laugh.wav'; sf.write(wav, y, SR)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-ac','1','-ar','48000','-b:a','112k',f'{ROOT}/assets/audio/sfx/spider_laugh.mp3'], check=True)
    print('spider_laugh', round(len(y)/SR, 2), 's'); sys.exit(0)

report = {}
for (id_, spk, preset, text, tts) in L:
    if only and id_ not in only: continue
    p = PRESETS[preset]
    a = model.apply_tts(ssml_text=ssml(tts, p), speaker=p['spk'], sample_rate=SR).numpy().astype(np.float64)
    y = process(a, p)
    wav = f'{RAW}/{id_}.wav'; sf.write(wav, y, SR)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-ac','1','-ar','48000','-b:a','112k',f'{OUT}/{id_}.mp3'], check=True)
    dur = len(y)/SR; chars = len(re.sub(r'[^А-Яа-яЁёA-Za-z]', '', text))
    report[id_] = dict(dur=round(dur,2), cps=round(chars/dur,1), preset=preset)
    print(id_, preset, round(dur,2), 's', round(chars/dur,1), 'c/s', flush=True)
json.dump(report, open(f'{RAW}/report.json','w'), ensure_ascii=False, indent=1)
