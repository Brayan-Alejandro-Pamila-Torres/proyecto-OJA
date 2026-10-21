#!/usr/bin/env python3
"""Arma data/tareas.json: los datos de la escena 2, sobre la clasificación por tareas.

Compara las dos ocupaciones que comparten el grupo unitario 2151 y mide cuántas
tareas tienen realmente en común, cuántas son propias de cada una y cuántas de
ellas son nuevas en el mercado.
"""
import json
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"

IZQ = "Desarrollo de software"
DER = "Ingeniería de prompts e IA generativa"
ICONOS = {IZQ: "monitor", DER: "cerebro"}
TITULOS = {IZQ: "Desarrollador Full Stack", DER: "Ingeniero de Prompts"}

MAX_PROPIAS = 5
MAX_COMUNES = 3

catalogo = {t["texto"]: t for t in json.loads((DATA / "tareas_catalogo.json").read_text(encoding="utf-8"))}
registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]

conteo = {IZQ: Counter(), DER: Counter()}
anuncios = {IZQ: 0, DER: 0}
ejemplo = None

for r in registros:
    f = r["familia_ocupacional"]
    if f not in conteo:
        continue
    anuncios[f] += 1
    for t in r["tareas"]:
        conteo[f][t] += 1
    if f == DER and ejemplo is None and r["salario"]["declarado"] and len(r["tareas"]) >= 4:
        ejemplo = r

frec = {f: {t: n / anuncios[f] for t, n in c.items()} for f, c in conteo.items()}
comunes = set(frec[IZQ]) & set(frec[DER])
propias_izq = set(frec[IZQ]) - comunes
propias_der = set(frec[DER]) - comunes

def top(conjunto, familia, n):
    return sorted(conjunto, key=lambda t: -frec[familia][t])[:n]

tareas = []
for t in top(propias_izq, IZQ, MAX_PROPIAS):
    tareas.append({"texto": t, "lado": "izquierda", "nueva": catalogo[t]["es_nueva"],
                   "frecuencia": round(frec[IZQ][t], 3)})
for t in top(comunes, IZQ, MAX_COMUNES):
    tareas.append({"texto": t, "lado": "ambas", "nueva": catalogo[t]["es_nueva"],
                   "frecuencia": round((frec[IZQ][t] + frec[DER][t]) / 2, 3)})
for t in top(propias_der, DER, MAX_PROPIAS):
    tareas.append({"texto": t, "lado": "derecha", "nueva": catalogo[t]["es_nueva"],
                   "frecuencia": round(frec[DER][t], 3)})

nuevas_der = [t for t in tareas if t["lado"] == "derecha" and t["nueva"]]

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "codigo": "2151",
    "nombre": next(r["sinco"]["nombre_4d"] for r in registros if r["familia_ocupacional"] == IZQ),
    "columnas": {
        "izquierda": {"titulo": TITULOS[IZQ], "icono": ICONOS[IZQ], "familia": IZQ,
                      "n_anuncios": anuncios[IZQ]},
        "derecha": {"titulo": TITULOS[DER], "icono": ICONOS[DER], "familia": DER,
                    "n_anuncios": anuncios[DER]},
    },
    "tareas": tareas,
    "conteo": {
        "izquierda": sum(1 for t in tareas if t["lado"] == "izquierda"),
        "derecha": sum(1 for t in tareas if t["lado"] == "derecha"),
        "ambas": sum(1 for t in tareas if t["lado"] == "ambas"),
        "nuevas_derecha": len(nuevas_der),
        "universo_izquierda": len(frec[IZQ]),
        "universo_derecha": len(frec[DER]),
        "universo_comunes": len(comunes),
    },
    "anuncio_ejemplo": {
        "titulo": ejemplo["titulo_anuncio"],
        "tareas": ejemplo["tareas"][:4],
        "habilidades": [h["label"] for h in ejemplo["habilidades_esco"]][:4],
        "modalidad": ejemplo["modalidad"],
        "salario": ejemplo["salario"],
        "escolaridad": ejemplo["requisitos"]["escolaridad"],
        "experiencia_anios": ejemplo["requisitos"]["experiencia_anios"],
    } if ejemplo else None,
}

destino = DATA / "tareas.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

c = salida["conteo"]
print(f"data/tareas.json — {destino.stat().st_size/1024:.0f} KB")
print(f"universo de tareas: {c['universo_izquierda']} en la izquierda, "
      f"{c['universo_derecha']} en la derecha, {c['universo_comunes']} en común")
print(f"en pantalla: {c['izquierda']} propias · {c['ambas']} comunes · {c['derecha']} propias "
      f"({c['nuevas_derecha']} de ellas nuevas)")
