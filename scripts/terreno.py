# Prepara el terreno del Pico en 3D a partir de datos del IGN (CC BY 4.0, © Instituto Geográfico Nacional):
#   - MDT05 (modelo digital del terreno, paso de 5 m) por WCS: ../casa-de-casal-lestedo-bocetos/ref/terreno/mdt5.tif
#   - Ortofoto PNOA por WMS:                                     ../casa-de-casal-lestedo-bocetos/ref/terreno/pnoa-2048.jpg
# Caja: lat 42,7835–42,8285, lon −8,4856 – −8,4244 (unos 5 × 5 km alrededor de la casa y el Pico).
# Salida en img/terreno/: alturas-N.bin (Uint16, decímetros, fila 0 = norte), foto-1024.jpg, foto-1536.jpg, terreno.json
# Uso: python -I scripts/terreno.py
import json, math, pathlib
import numpy as np
from PIL import Image
R = pathlib.Path(__file__).resolve().parent.parent
REF = R.parent / 'casa-de-casal-lestedo-bocetos/ref/terreno'
OUT = R / 'img/terreno'; OUT.mkdir(parents=True, exist_ok=True)
S, N, O, E = 42.7835, 42.8285, -8.4856, -8.4244
lat0 = (S + N) / 2
ancho = (E - O) * 111320 * math.cos(math.radians(lat0))   # metros de oeste a este
alto = (N - S) * 110950                                    # metros de sur a norte
dem = np.array(Image.open(REF / 'mdt5.tif'), dtype=np.float32)
for n in (192, 256):
    a = np.array(Image.fromarray(dem).resize((n, n), Image.BILINEAR), dtype=np.float32)
    (OUT / f'alturas-{n}.bin').write_bytes(np.round(a * 10).astype('<u2').tobytes())
    print(f'alturas-{n}.bin', a.min(), a.max())
foto = Image.open(REF / 'pnoa-2048.jpg').convert('RGB')
foto.resize((1536, 1536), Image.LANCZOS).save(OUT / 'foto-1536.jpg', quality=76, optimize=True, progressive=True)
foto.resize((1024, 1024), Image.LANCZOS).save(OUT / 'foto-1024.jpg', quality=80, optimize=True, progressive=True)
def local(lat, lon):   # metros desde el centro: x hacia el este, z hacia el sur
    return [round((lon - (O + E) / 2) / (E - O) * ancho, 1), round(((S + N) / 2 - lat) / (N - S) * alto, 1)]
def altura(lat, lon):
    h, w = dem.shape
    return float(dem[int((N - lat) / (N - S) * h), int((lon - O) / (E - O) * w)])
meta = {
    'caja': {'s': S, 'n': N, 'o': O, 'e': E}, 'ancho': round(ancho, 1), 'alto': round(alto, 1),
    'min': float(dem.min()), 'max': float(dem.max()),
    'casa': {'xz': local(42.80472, -8.46366), 'h': altura(42.80472, -8.46366)},
    'pico': {'xz': local(42.8072, -8.4469), 'h': 533.0},
    'fuente': 'MDT05 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)',
}
(OUT / 'terreno.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
print(json.dumps(meta, ensure_ascii=False))
for f in sorted(OUT.iterdir()): print(f.name, f.stat().st_size // 1024, 'KB')
