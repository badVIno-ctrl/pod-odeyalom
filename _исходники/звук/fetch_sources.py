#!/usr/bin/env python3
# Скачивает исходные CC0-записи и сэмплы в папку «сырьё» рядом со скриптом (≈ 550 МБ, нужен интернет).
# После этого можно пересобрать звуки и музыку: python3 build_sfx.py, python3 build_music.py.
import os, sys, zipfile, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get('SFX_SRC', os.path.join(HERE, 'сырьё'))
OGA = 'https://opengameart.org/sites/default/files/'
VCSL = 'https://raw.githubusercontent.com/sgossner/VCSL/master/'

FILES = {  # имя в «сырьё/» → адрес
    'heartbeat_slow_0.wav': OGA + 'heartbeat_slow_0.wav',                       # bart, «Heartbeat sounds»
    **{f'Seagull_Ambient_{i}.wav': OGA + f'Seagull%20Ambient%20{i}.wav' for i in (4, 5, 6)},  # Rango Mango
    **{f'wave_0{i}_cc0-11505__transitking__wavesound.flac': OGA + f'wave_0{i}_cc0-11505__transitking__wavesound.flac' for i in (1, 2, 3, 4)},
}
ZIPS = {  # папка в «сырьё/» → архив
    'x/oga100': OGA + '100-CC0-SFX_0.zip',          # rubberduck, «100 CC0 SFX»
    'x/flips': OGA + 'book_flips_-_starninjas.zip',  # StarNinjas, «10 Book Page Flips»
    'x/pencil': OGA + 'pencil.zip',                  # AntumDeluge, «Pencil Sounds»
    'x/more': OGA + 'MoreSounds.zip',                # OwlishMedia, «202 More Sound Effects»
}

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(path + '.part', 'wb') as f: f.write(r.read())
    os.replace(path + '.part', path)
    print('ok', os.path.relpath(path, RAW))

def main():
    jobs = [(u, os.path.join(RAW, n)) for n, u in FILES.items()]
    jobs += [(u, os.path.join(RAW, 'zip', os.path.basename(urllib.parse.urlparse(u).path))) for u in ZIPS.values()]
    # VCSL (CC0): файлы из vcsl-files.txt, путь в репозитории «сплющен»: / → __, пробел → _, без запятых
    for p in open(os.path.join(HERE, 'vcsl-files.txt'), encoding='utf-8').read().split('\n'):
        if p.strip():
            jobs.append((VCSL + urllib.parse.quote(p), os.path.join(RAW, 'vcsl', p.replace('/', '__').replace(' ', '_').replace(',', ''))))
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: get(*j), jobs))
    for d, u in ZIPS.items():
        z = os.path.join(RAW, 'zip', os.path.basename(urllib.parse.urlparse(u).path))
        with zipfile.ZipFile(z) as zf: zf.extractall(os.path.join(RAW, d))
    print('Готово:', RAW)

if __name__ == '__main__':
    sys.exit(main())
