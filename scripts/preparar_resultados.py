#!/usr/bin/env python3
"""Arma data/resultados.json: el respaldo de la sección de Resultados.

Una ficha completa por familia ocupacional —las 28— para que la sección se pueda
explorar sin volver a leer el corpus en el navegador. La introducción argumenta;
esta sección deja comprobar.
"""
import json
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import icono_de  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"

SENALES = [
    ("novedad_tareas", "Pide tareas que antes no existían"),
    ("novedad_habilidades", "Pide saberes que antes no se pedían"),
    ("ajuste_sinco", "No encaja del todo en ningún renglón"),
    ("crecimiento_reciente", "Está creciendo rápido"),
    ("dispersion_sectorial", "Aparece en sectores muy distintos"),
]
GRUPOS_ESCO = {
    "S1": "Comunicación, colaboración y creatividad", "S2": "Habilidades de información",
    "S3": "Asistencia y cuidado", "S4": "Gestión", "S5": "Trabajo con computadoras",
    "S6": "Manipulación y movimiento", "S7": "Construcción",
    "S8": "Maquinaria y equipo especializado",
}
MODALIDAD = {"remoto": "Remoto", "hibrido": "Híbrido", "presencial": "Presencial"}

registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]
tareas_cat = {t["texto"]: t for t in json.loads((DATA / "tareas_catalogo.json").read_text(encoding="utf-8"))}
cobertura = {d["codigo_4d"]: d for d in json.loads((DATA / "agg" / "cobertura_sinco.json").read_text(encoding="utf-8"))}

por_familia = {}
for r in registros:
    por_familia.setdefault(r["familia_ocupacional"], []).append(r)


def cuantil(v, p):
    v = sorted(v)
    if not v:
        return None
    k = (len(v) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return round(v[lo] + (v[hi] - v[lo]) * (k - lo))


def ficha(familia, rs):
    n = len(rs)
    uno = rs[0]
    c4 = uno["sinco"]["codigo_4d"]

    frec_t = Counter(t for r in rs for t in r["tareas"])
    tareas = [{"texto": t, "n": c, "pct": round(100 * c / n, 1),
               "nueva": bool(tareas_cat.get(t, {}).get("es_nueva"))}
              for t, c in frec_t.most_common(10)]

    habs = {}
    for r in rs:
        for h in r["habilidades_esco"]:
            d = habs.setdefault(h["label"], {"grupo": h["grupo_esco"], "nueva": h["es_nueva"], "n": 0})
            d["n"] += 1
    habilidades = [{"label": k, "grupo": v["grupo"], "nombre_grupo": GRUPOS_ESCO.get(v["grupo"], v["grupo"]),
                    "nueva": v["nueva"], "n": v["n"], "pct": round(100 * v["n"] / n, 1)}
                   for k, v in sorted(habs.items(), key=lambda kv: -kv[1]["n"])[:10]]

    modalidad = Counter(r["modalidad"] for r in rs)
    sueldos = [(r["salario"]["min_mxn"] + r["salario"]["max_mxn"]) / 2
               for r in rs if r["salario"]["declarado"]]

    anios = Counter(r["anio"] for r in rs)
    serie = [{"anio": a, "n": anios[a]} for a in sorted(anios)]
    primero, ultimo = serie[0], serie[-1]

    vecinas = [f["familia"] for f in cobertura[c4]["familias"] if f["familia"] != familia]

    return {
        "familia": familia,
        "titulo": Counter(r["titulo_anuncio"] for r in rs).most_common(1)[0][0],
        "icono": icono_de(familia),
        "perfil": uno["perfil_familia"],
        "n_anuncios": n,
        "indice": round(sum(r["indice_emergencia"]["valor"] for r in rs) / n, 3),
        "senales": {k: round(sum(r["indice_emergencia"]["componentes"][k] for r in rs) / n, 3)
                    for k, _ in SENALES},
        "sinco": {
            "codigo_2d": uno["sinco"]["codigo_2d"], "nombre_2d": uno["sinco"]["nombre_2d"],
            "codigo_4d": c4, "nombre_4d": uno["sinco"]["nombre_4d"],
            "gran_grupo": uno["sinco"]["gran_grupo"],
            "nombre_gran_grupo": uno["sinco"]["nombre_gran_grupo"],
            "comparte_con": vecinas,
        },
        "tareas": tareas,
        "n_tareas_distintas": len(frec_t),
        "n_tareas_nuevas": sum(1 for t in frec_t if tareas_cat.get(t, {}).get("es_nueva")),
        "habilidades": habilidades,
        "n_habilidades_distintas": len(habs),
        "n_habilidades_nuevas": sum(1 for v in habs.values() if v["nueva"]),
        "modalidad": {k: round(100 * modalidad[k] / n, 1) for k in ("remoto", "hibrido", "presencial")},
        "salario": {
            "declara_pct": round(100 * len(sueldos) / n, 1),
            "p25": cuantil(sueldos, 0.25), "p50": cuantil(sueldos, 0.5), "p75": cuantil(sueldos, 0.75),
        },
        "serie": serie,
        "crecimiento": {
            "primer_anio": primero["anio"], "n_primer": primero["n"],
            "ultimo_anio": ultimo["anio"], "n_ultimo": ultimo["n"],
            "multiplicador": round(ultimo["n"] / primero["n"], 1) if primero["n"] else None,
        },
    }


fichas = sorted((ficha(f, rs) for f, rs in por_familia.items()), key=lambda d: -d["indice"])

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "total_anuncios": len(registros),
    "senales": [{"clave": k, "nombre": n} for k, n in SENALES],
    "grupos_esco": [{"clave": k, "nombre": v} for k, v in GRUPOS_ESCO.items()],
    "modalidades": [{"clave": k, "nombre": v} for k, v in MODALIDAD.items()],
    "ocupaciones": fichas,
    "distribucion_indice": {
        "min": min(f["indice"] for f in fichas),
        "max": max(f["indice"] for f in fichas),
    },
}

destino = DATA / "resultados.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"data/resultados.json — {destino.stat().st_size/1024:.0f} KB · {len(fichas)} ocupaciones")
print(f"índice de {salida['distribucion_indice']['min']} a {salida['distribucion_indice']['max']}")
print(f"{'ocupación':46} {'índ':>5} {'anuncios':>9} {'nuevas t/h':>11} {'sinco':>6}")
for f in fichas[:6]:
    print(f"{f['familia'][:44]:46} {f['indice']:5.3f} {f['n_anuncios']:9} "
          f"{f['n_tareas_nuevas']:4}/{f['n_habilidades_nuevas']:<6} {f['sinco']['codigo_4d']:>6}")
