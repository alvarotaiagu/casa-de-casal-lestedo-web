# Saca de los PNG de su logo (2021) las versiones de la web, el favicon y la imagen para compartir.
# Uso: python -I scripts/marca.py   El logo NO se redibuja: es su PNG recortado y reducido.
import pathlib
from PIL import Image, ImageDraw, ImageFont, ImageOps
R = pathlib.Path(__file__).resolve().parent.parent
L = R.parent / 'casa-de-casal-lestedo-bocetos/ref/logo'
M = R / 'marca'; M.mkdir(exist_ok=True)
NOCHE = (18, 26, 36)
for src, dst in [('Logo-CasadeCasal-Sinfondo.png', 'logo-oro.png'), ('Logo-CasadeCasal-BlancoSinFondo.png', 'logo-blanco.png'), ('Logo-CasadeCasal-NegroSinFondo.png', 'logo-negro.png')]:
    im = Image.open(L / src).convert('RGBA'); im = im.crop(im.getbbox())
    im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
    im.save(M / dst, optimize=True); print(dst, im.size)
oro = Image.open(M / 'logo-oro.png')
# favicon: la «C» del tejado (la mitad izquierda del logo), sobre azul noche
import numpy as np
from scipy import ndimage
def piezas(img, cuales):
    a = np.array(img); et, n = ndimage.label(a[..., 3] > 40)
    areas = ndimage.sum(np.ones_like(et), et, range(1, n + 1))
    orden = [int(i) + 1 for i in np.argsort(-areas)]          # de mayor a menor
    a[..., 3] = np.where(np.isin(et, [orden[k] for k in cuales]), a[..., 3], 0)
    r = Image.fromarray(a); return r.crop(r.getbbox())
# las dos piezas mayores son la media luna y el brazo del tejado: juntas, la «C»
for img, nom in [(oro, 'oro'), (Image.open(M / 'logo-blanco.png'), 'blanco')]:
    piezas(img, [0, 1]).save(M / f'c-{nom}.png', optimize=True)
    piezas(img, [1]).save(M / f'tejado-{nom}.png', optimize=True)
    print('c y tejado', nom)
a = np.array(piezas(oro, [0, 1]))
c = Image.fromarray(a); c = c.crop(c.getbbox())
for n, lado in [('favicon-32.png', 32), ('apple-touch-icon.png', 180), ('icono-512.png', 512)]:
    f = Image.new('RGBA', (lado, lado), NOCHE + (255,)); k = c.copy(); k.thumbnail((round(lado * .8), round(lado * .8)), Image.LANCZOS)
    f.alpha_composite(k, ((lado - k.width) // 2, (lado - k.height) // 2)); f.convert('RGB').save(M / n); print(n)
# imagen para compartir: la casa con el logo blanco encima
og = ImageOps.fit(Image.open(R / 'img/fotos/portada-casa-1200.jpg').convert('RGB'), (1200, 630), centering=(.5, .55))
velo = Image.new('RGBA', og.size, NOCHE + (0,)); d = ImageDraw.Draw(velo)
for x in range(700): d.line([(x, 0), (x, 630)], fill=NOCHE + (int(235 * (1 - x / 700) ** 1.2),))
og = Image.alpha_composite(og.convert('RGBA'), velo)
bl = Image.open(M / 'logo-blanco.png'); bl.thumbnail((420, 420), Image.LANCZOS); og.alpha_composite(bl, (70, 215))
(R / 'img').mkdir(exist_ok=True); og.convert('RGB').save(R / 'img/og.jpg', quality=84); print('og.jpg')
# versiones ligeras para la web (paleta de 48 colores con transparencia): cabecera, cortina y pie
for nom, ancho in [('logo-blanco', 300), ('logo-oro', 300), ('logo-oro', 840), ('tejado-oro', 290), ('tejado-oro', 120)]:
    im = Image.open(M / f'{nom}.png').convert('RGBA')
    im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    im.quantize(colors=48, method=Image.Quantize.FASTOCTREE).save(M / f'{nom}-{ancho}.png', optimize=True)
    print(f'{nom}-{ancho}.png', (M / f'{nom}-{ancho}.png').stat().st_size // 1024, 'KB')
# el logo sin el brazo del tejado (para la cortina y el pie, donde el tejado entra aparte)
a = np.array(Image.open(M / 'logo-oro.png').convert('RGBA')); et, n = ndimage.label(a[..., 3] > 40)
areas = ndimage.sum(np.ones_like(et), et, range(1, n + 1)); tejado = int(np.argsort(-areas)[1]) + 1
# lo que no es tejado: se dilata un poco la pieza para llevarse también su borde suavizado
zona = ndimage.binary_dilation(et == tejado, iterations=3) & ~np.isin(et, [l for l in range(1, n + 1) if l != tejado])
a[..., 3] = np.where(zona, 0, a[..., 3])
sin = Image.fromarray(a)
sin.resize((840, round(sin.height * 840 / sin.width)), Image.LANCZOS).quantize(colors=48, method=Image.Quantize.FASTOCTREE).save(M / 'logo-oro-sin-tejado-840.png', optimize=True)
print('logo-oro-sin-tejado-840.png', sin.size)
