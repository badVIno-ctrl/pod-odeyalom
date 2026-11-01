import sys, os, json, re, difflib
import numpy as np, soundfile as sf
import scipy.signal as sg
from faster_whisper import WhisperModel
exec(open('/data/tts/lines.py', encoding='utf-8').read())
ref = {l[0]: l[3] for l in L}
d = sys.argv[1]; ids = sys.argv[2:]
m = WhisperModel(os.environ.get('WM', 'small'), device='cpu', compute_type='int8', cpu_threads=2)
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[^а-яё ]', ' ', s.lower().replace('ё', 'е'))).strip()
out = {}
for f in sorted(os.listdir(d)):
    if not f.endswith('.wav'): continue
    id_ = f[:-4]
    if ids and id_ not in ids: continue
    x, sr = sf.read(os.path.join(d, f), dtype='float32')
    if x.ndim > 1: x = x.mean(axis=1)
    if sr != 16000: x = sg.resample_poly(x, 16000, sr).astype(np.float32)
    segs, info = m.transcribe(x, language='ru', beam_size=5, vad_filter=False)
    hyp = ' '.join(s.text for s in segs)
    r = difflib.SequenceMatcher(None, norm(ref.get(id_, '')).split(), norm(hyp).split()).ratio()
    out[id_] = dict(hyp=hyp.strip(), score=round(r, 2))
    print(f'{id_}\t{r:.2f}\t{hyp.strip()}', flush=True)
json.dump(out, open(os.path.join(d, 'whisper.json'), 'w'), ensure_ascii=False, indent=1)
