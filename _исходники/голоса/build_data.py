# Собирает data/dialogue.json, data/lipsync.json и script.tsv из lines.py и готовых mp3.
# usage: python3 build_data.py   (ROOT — папка игры)
import os, re, json, subprocess, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('ROOT', '/data/game/Пять дней жара')
src = os.path.join(HERE, 'lines.py')
if os.path.exists(src):
    exec(open(src, encoding='utf-8').read())
else:  # читаем script.tsv
    L = []
    for line in open(os.path.join(HERE, 'script.tsv'), encoding='utf-8'):
        if not line.strip() or line.startswith('#'): continue
        L.append(tuple(line.rstrip('\n').split('\t')))
VOICE = os.path.join(ROOT, 'assets', 'audio', 'voice')

def env(path, sr=16000, hop=0.05):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    n = int(sr * hop); frames = max(1, int(np.ceil(len(x) / n)))
    x = np.pad(x, (0, frames * n - len(x)))
    rms = np.sqrt((x.reshape(frames, n) ** 2).mean(axis=1))
    ref = np.percentile(rms, 92) + 1e-9
    v = np.clip(rms / ref, 0, 1.15)
    v = np.where(rms < ref * 0.12, 0, v)            # тишина — рот закрыт
    v = np.convolve(v, [0.25, 0.5, 0.25], 'same')   # мягче
    return ''.join(str(int(round(min(9, max(0, a ** 0.8 * 9))))) for a in v)

dialogue, lips, rows = [], {}, ['# id\tspeaker\tpreset\ttext\ttts  («+» перед ударной гласной)']
missing = []
for (id_, spk, preset, text, tts) in L:
    mp3 = os.path.join(VOICE, f'{id_}.mp3')
    dialogue.append(dict(id=id_, speaker=spk, text=text, audio=f'audio/voice/{id_}.mp3'))
    rows.append('\t'.join([id_, spk, preset, text, tts]))
    if os.path.exists(mp3): lips[id_] = env(mp3)
    else: missing.append(id_)
json.dump(dialogue, open(os.path.join(ROOT, 'data', 'dialogue.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(lips, open(os.path.join(ROOT, 'data', 'lipsync.json'), 'w', encoding='utf-8'), ensure_ascii=False)
open(os.path.join(HERE, 'script.tsv'), 'w', encoding='utf-8').write('\n'.join(rows) + '\n')  # рядом со скриптом
ids = {l[0] for l in L}
extra = [f for f in os.listdir(VOICE) if f.endswith('.mp3') and f[:-4] not in ids]
print('lines', len(L), 'lips', len(lips), 'missing', missing, 'obsolete', sorted(extra))
