#!/usr/bin/env python3
"""Arma data/anatomia.json: los datos de la escena 4.

Un anuncio completo sirve de ancla, y cada uno de sus atributos se acompaña de
lo que ese mismo atributo revela en el corpus entero. El anuncio da lo concreto;
el agregado da el peso.
"""
import json
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import icono_de  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"

GRUPOS_ESCO = {
    "S1": "Comunicación, colaboración y creatividad",
    "S2": "Habilidades de información",
    "S3": "Asistencia y cuidado",
    "S4": "Gestión",
    "S5": "Trabajo con computadoras",
    "S6": "Manipulación y movimiento",
    "S7": "Construcción",
    "S8": "Maquinaria y equipo especializado",
}
MODALIDAD = {"remoto": "Remoto", "hibrido": "Híbrido", "presencial": "Presencial"}

registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]
catalogo_tareas = {t["texto"]: t for t in
                   json.loads((DATA / "tareas_catalogo.json").read_text(encoding="utf-8"))}
total = len(registros)


def mediana(v):
    v = sorted(v)
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def punto_salarial(r):
    return (r["salario"]["min_mxn"] + r["salario"]["max_mxn"]) / 2


# --- el anuncio ancla: rico, con salario declarado y de una ocupación emergente
candidatos = [r for r in registros
              if r["familia_ocupacional"] == "Ciberseguridad en la nube"
              and r["salario"]["declarado"]
              and len(r["tareas"]) >= 5
              and len(r["habilidades_esco"]) >= 5
              and r["requisitos"]["ingles"]]
ancla = candidatos[len(candidatos) // 2]

anuncio = {
    "titulo": ancla["titulo_anuncio"],
    "icono": icono_de(ancla["familia_ocupacional"]),
    "plataforma": ancla["plataforma"],
    "fecha": ancla["fecha_publicacion"],
    "entidad": ancla["entidad_federativa"],
    "sector": ancla["sector"],
    "descripcion": ancla["descripcion_puesto"],
    "tareas": [{"texto": t, "nueva": catalogo_tareas.get(t, {}).get("es_nueva", False)}
               for t in ancla["tareas"][:5]],
    "habilidades": [{"label": h["label"], "grupo": h["grupo_esco"],
                     "nombre_grupo": GRUPOS_ESCO.get(h["grupo_esco"], h["grupo_esco"]),
                     "nueva": h["es_nueva"]}
                    for h in ancla["habilidades_esco"][:5]],
    "modalidad": ancla["modalidad"],
    "salario": ancla["salario"],
    "requisitos": ancla["requisitos"],
    "sinco": {"codigo_4d": ancla["sinco"]["codigo_4d"], "nombre_4d": ancla["sinco"]["nombre_4d"]},
}

# --- agregados, uno por atributo -----------------------------------------------

n_tareas = sum(len(r["tareas"]) for r in registros)
con_nueva = sum(1 for r in registros
                if any(catalogo_tareas.get(t, {}).get("es_nueva") for t in r["tareas"]))
tareas_nuevas = Counter()
for r in registros:
    for t in r["tareas"]:
        if catalogo_tareas.get(t, {}).get("es_nueva"):
            tareas_nuevas[t] += 1

hab_grupo = Counter()
hab_nuevas = Counter()
n_hab = 0
for r in registros:
    for h in r["habilidades_esco"]:
        hab_grupo[h["grupo_esco"]] += 1
        n_hab += 1
        if h["es_nueva"]:
            hab_nuevas[h["label"]] += 1

modalidad = Counter(r["modalidad"] for r in registros)
mod_por_gg = {}
for r in registros:
    d = mod_por_gg.setdefault(r["sinco"]["nombre_gran_grupo"],
                              {"remoto": 0, "hibrido": 0, "presencial": 0, "total": 0})
    d[r["modalidad"]] += 1
    d["total"] += 1

con_salario = [r for r in registros if r["salario"]["declarado"]]
sal_por_modalidad = {}
for r in con_salario:
    sal_por_modalidad.setdefault(r["modalidad"], []).append(punto_salarial(r))
sal_por_perfil = {}
for r in con_salario:
    sal_por_perfil.setdefault(r["perfil_familia"], []).append(punto_salarial(r))

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "total_anuncios": total,
    "anuncio": anuncio,
    "agregados": {
        "tareas": {
            "promedio": round(n_tareas / total, 1),
            "pct_con_tarea_nueva": round(100 * con_nueva / total, 1),
            "top_nuevas": [{"texto": t, "n": n} for t, n in tareas_nuevas.most_common(4)],
        },
        "habilidades": {
            "promedio": round(n_hab / total, 1),
            "por_grupo": [{"grupo": g, "nombre": GRUPOS_ESCO[g], "n": hab_grupo[g],
                           "porcentaje": round(100 * hab_grupo[g] / n_hab, 1)}
                          for g in sorted(hab_grupo, key=lambda g: -hab_grupo[g])],
            "top_nuevas": [{"label": l, "n": n} for l, n in hab_nuevas.most_common(4)],
        },
        "modalidad": {
            "reparto": [{"clave": k, "nombre": MODALIDAD[k], "n": v,
                         "porcentaje": round(100 * v / total, 1)}
                        for k, v in modalidad.most_common()],
            "por_gran_grupo": sorted(
                [{"nombre": k, **{m: round(100 * v[m] / v["total"], 1)
                                  for m in ("remoto", "hibrido", "presencial")},
                  "total": v["total"]}
                 for k, v in mod_por_gg.items()],
                key=lambda d: -d["remoto"]),
        },
        "salario": {
            "pct_declara": round(100 * len(con_salario) / total, 1),
            "mediana": round(mediana([punto_salarial(r) for r in con_salario])),
            "por_modalidad": sorted(
                [{"clave": k, "nombre": MODALIDAD[k], "mediana": round(mediana(v)), "n": len(v)}
                 for k, v in sal_por_modalidad.items()],
                key=lambda d: -d["mediana"]),
            "por_perfil": sorted(
                [{"perfil": k, "mediana": round(mediana(v)), "n": len(v)}
                 for k, v in sal_por_perfil.items()],
                key=lambda d: -d["mediana"]),
        },
    },
}

destino = DATA / "anatomia.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
a = salida["agregados"]
print(f"data/anatomia.json — {destino.stat().st_size/1024:.0f} KB")
print(f"ancla: {anuncio['titulo']} · {anuncio['modalidad']} · {anuncio['entidad']}")
print(f"tareas: {a['tareas']['promedio']} por anuncio, {a['tareas']['pct_con_tarea_nueva']}% con al menos una nueva")
print("ESCO:", ", ".join(f"{g['grupo']} {g['porcentaje']}%" for g in a['habilidades']['por_grupo'][:5]))
print("modalidad:", ", ".join(f"{m['nombre']} {m['porcentaje']}%" for m in a['modalidad']['reparto']))
print("salario mediano por modalidad:", ", ".join(f"{m['nombre']} ${m['mediana']:,}" for m in a['salario']['por_modalidad']))
