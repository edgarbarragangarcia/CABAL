#!/usr/bin/env python3
"""Convierte el Excel oficial del DANE «Proyecciones de población municipal por área, sexo y edad simple 2018-2042»
(https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion)
en un JSON compacto para el módulo Proyección 2030.

Uso:  python3 scripts/proyeccion-dane.py RUTA/PPED-AreaSexoEdadMun-2018-2042_VP.xlsx src/data/proyeccion-dane.json
(El .xlsx pesa ~130 MB; se lee en flujo, sin cargarlo entero.)
Por municipio y año (2022, 2026, 2030, 2034): [total, hombres, mujeres, 18+, hombres 18+, mujeres 18+, edades 14,15,16,17, edades 18,19,20,21,
bandas 18-24, 25-34, 35-44, 45-54, 55-64, 65+]
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

ruta, salida = sys.argv[1], sys.argv[2]
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
AÑOS = {2022, 2026, 2030, 2034}

def col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n  # A=1

z = zipfile.ZipFile(ruta)
ss = [''.join(t.text or '' for t in si.iter(NS + 't')) for si in ET.parse(z.open("xl/sharedStrings.xml")).getroot()]
H0, M0, T0 = col("J"), col("DG"), col("HD")  # primera columna de hombres 0, mujeres 0 y total ambos sexos 0
out = {}
n = 0
with z.open("xl/worksheets/sheet3.xml") as f:
    for _, el in ET.iterparse(f):
        if el.tag != NS + "row":
            continue
        v = {}
        for c in el.findall(NS + "c"):
            x = c.find(NS + "v")
            if x is None:
                continue
            v[col(c.get("r"))] = ss[int(x.text)] if c.get("t") == "s" else x.text
        el.clear()
        n += 1
        if n < 10 or v.get(6) is None:
            continue
        try:
            año = int(v[5])
        except (KeyError, ValueError):
            continue
        if año not in AÑOS or v.get(6) != "Total":
            continue
        dane = v[3]
        num = lambda c: int(float(v.get(c, 0) or 0))
        tot = [num(T0 + a) for a in range(101)]
        hom = [num(H0 + a) for a in range(101)]
        muj = [num(M0 + a) for a in range(101)]
        s = lambda xs, a, b: sum(xs[a:b + 1])
        fila = [num(7), num(8), num(9), s(tot, 18, 100), s(hom, 18, 100), s(muj, 18, 100), *tot[14:18], *tot[18:22],
                s(tot, 18, 24), s(tot, 25, 34), s(tot, 35, 44), s(tot, 45, 54), s(tot, 55, 64), s(tot, 65, 100)]
        e = out.setdefault(dane, {"n": v[4], "d": v[2], "y": {}})
        e["y"][str(año)] = fila
with open(salida, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} municipios, {sum(len(e['y']) for e in out.values())} filas")
