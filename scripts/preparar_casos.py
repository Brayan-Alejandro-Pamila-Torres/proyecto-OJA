#!/usr/bin/env python3
"""Arma data/casos.json: los datos de la escena de cierre de la introducción.

Tres ocupaciones que puntúan alto en el índice, de mundos distintos, presentadas
como la entrada de catálogo que todavía no tienen. El énfasis está en lo que dice
su descripción de puesto —tareas y habilidades— y en por qué el índice las
señala; el sueldo va como un dato más, no como argumento.
"""
import json
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import icono_de  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"

# las cinco señales del índice, dichas en palabras llanas
SENALES = [
    ("novedad_tareas", "Pide tareas que antes no existían"),
    ("novedad_habilidades", "Pide saberes que antes no se pedían"),
    ("ajuste_sinco", "No encaja del todo en ningún renglón"),
    ("crecimiento_reciente", "Ya no es un caso aislado"),
    ("dispersion_sectorial", "Aparece en sectores muy distintos"),
]

CASOS = [
    {"familia": "Ingeniería de prompts e IA generativa", "titulo": "Ingeniero de Prompts",
     "mundo": "Tecnología", "icono": "cerebro"},
    {"familia": "Instalación de sistemas fotovoltaicos", "titulo": "Técnico Instalador de Paneles Solares",
     "mundo": "Energía y oficios", "icono": "casa"},
    {"familia": "Coordinación de telemedicina", "titulo": "Coordinador de Telemedicina",
     "mundo": "Salud", "icono": "estetoscopio"},
]

registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]
tareas_cat = {t["texto"]: t for t in json.loads((DATA / "tareas_catalogo.json").read_text(encoding="utf-8"))}
cobertura = {d["codigo_4d"]: d for d in json.loads((DATA / "agg" / "cobertura_sinco.json").read_text(encoding="utf-8"))}
ranking = json.loads((DATA / "agg" / "ocupaciones_emergentes.json").read_text(encoding="utf-8"))

por_familia = {}
for r in registros:
    por_familia.setdefault(r["familia_ocupacional"], []).append(r)


def mediana(v):
    v = sorted(v)
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def arma_caso(spec):
    rs = por_familia[spec["familia"]]
    n = len(rs)

    frec_tareas = Counter(t for r in rs for t in r["tareas"])
    nuevas = [(t, c) for t, c in frec_tareas.most_common()
              if tareas_cat.get(t, {}).get("es_nueva")]

    habs = {}
    for r in rs:
        for h in r["habilidades_esco"]:
            habs.setdefault(h["label"], {"grupo": h["grupo_esco"], "nueva": h["es_nueva"], "n": 0})
            habs[h["label"]]["n"] += 1
    habs_nuevas = sorted([{"label": k, **v} for k, v in habs.items() if v["nueva"]],
                         key=lambda d: -d["n"])

    comp = {k: round(sum(r["indice_emergencia"]["componentes"][k] for r in rs) / n, 3)
            for k, _ in SENALES}

    modalidad = Counter(r["modalidad"] for r in rs)
    sueldos = [(r["salario"]["min_mxn"] + r["salario"]["max_mxn"]) / 2
               for r in rs if r["salario"]["declarado"]]

    anios = Counter(r["anio"] for r in rs)
    primer, ultimo = min(anios), max(anios)

    c4 = rs[0]["sinco"]["codigo_4d"]
    vecinas = [f["familia"] for f in cobertura[c4]["familias"] if f["familia"] != spec["familia"]]

    return {
        "familia": spec["familia"],
        "titulo": spec["titulo"],
        "mundo": spec["mundo"],
        "icono": spec["icono"],
        "n_anuncios": n,
        "indice": round(sum(r["indice_emergencia"]["valor"] for r in rs) / n, 3),
        "senales": comp,
        "sinco": {
            "codigo_4d": c4,
            "nombre_4d": rs[0]["sinco"]["nombre_4d"],
            "codigo_2d": rs[0]["sinco"]["codigo_2d"],
            "nombre_2d": rs[0]["sinco"]["nombre_2d"],
            "comparte_con": vecinas,
        },
        "crecimiento": {
            "primer_anio": primer, "n_primer": anios[primer],
            "ultimo_anio": ultimo, "n_ultimo": anios[ultimo],
            "multiplicador": round(anios[ultimo] / anios[primer], 1) if anios[primer] else None,
        },
        "tarea_estrella": nuevas[0][0] if nuevas else None,
        "tareas_nuevas": [{"texto": t, "n": c} for t, c in nuevas[:3]],
        "n_tareas_distintas": len(frec_tareas),
        "habilidades_nuevas": [{"label": h["label"], "grupo": h["grupo"], "n": h["n"]}
                               for h in habs_nuevas[:4]],
        "n_habilidades_distintas": len(habs),
        "modalidad": {k: round(100 * v / n, 1) for k, v in modalidad.most_common()},
        "salario": {
            "mediana": round(mediana(sueldos)) if sueldos else None,
            "declara_pct": round(100 * len(sueldos) / n, 1),
        },
    }


casos = [arma_caso(c) for c in CASOS]

# --- un ejemplo corto por señal, sacado del corpus -------------------------------

def sectores_de(familia):
    return Counter(r["sector"] for r in por_familia[familia]).most_common()


tareas_nuevas = Counter()
habs_nuevas = Counter()
for r in registros:
    for t in r["tareas"]:
        if tareas_cat.get(t, {}).get("es_nueva"):
            tareas_nuevas[t] += 1
    for h in r["habilidades_esco"]:
        if h["es_nueva"]:
            habs_nuevas[h["label"]] += 1

familia_de_tarea = {t["texto"]: t["familias"][0] for t in tareas_cat.values() if t["familias"]}

# el que más creció
crecimientos = []
for f, rs in por_familia.items():
    anios = Counter(r["anio"] for r in rs)
    pri, ult = min(anios), max(anios)
    if anios[pri]:
        crecimientos.append((anios[ult] / anios[pri], f, pri, anios[pri], ult, anios[ult]))
crecimientos.sort(reverse=True)
mult, fam_crece, a0, n0, a1, n1 = crecimientos[0]

# Las que ya tienen volumen propio dentro de la ventana observada. OJO: la clave
# interna sigue siendo `crecimiento_reciente` porque así se llama el componente
# del índice en el corpus; lo que cambió es lo que se enseña. El componente sigue
# calculándose como crecimiento interanual y hay que sustituirlo cuando llegue la
# fórmula real: con seis meses de anuncios no hay serie que lo sostenga.
volumenes = sorted(
    ((len(rs), f) for f, rs in por_familia.items() if rs[0]["perfil_familia"] == "emergente"),
    reverse=True)

# el que aparece en más sectores: sólo entre las que no son consolidadas, porque
# la señal sólo dice algo si distingue; el trabajo de siempre también está en todos
# los sectores y meterlo aquí la volvería trivial
emergentes = {f for f, rs in por_familia.items() if rs[0]["perfil_familia"] != "consolidada"}
dispersion = sorted(((len(sectores_de(f)), f) for f in emergentes), reverse=True)
n_sec, fam_disp = dispersion[0]
sectores_top = [s for s, _ in sectores_de(fam_disp)[:4]]

# un cajón compartido, para la señal de ajuste
compartido = next(c for c in casos if c["sinco"]["comparte_con"])

# Varios ejemplos por señal, no uno: con uno solo el lector no sabe si la señal
# describe un patrón o una anécdota. Se toman de mundos distintos cuando se puede.
N_EJEMPLOS = 3

tareas_ej = [t for t, _ in tareas_nuevas.most_common(N_EJEMPLOS)]
habs_ej = [h for h, _ in habs_nuevas.most_common(N_EJEMPLOS)]
compartidos = [c for c in casos if c["sinco"]["comparte_con"]][:N_EJEMPLOS]

# Todos los ejemplos tienen la misma forma —el sujeto entrecomillado y, en voz
# baja, el dato que lo sostiene— para que la lista se lea de un vistazo y quepa.
EJEMPLOS = {
    "novedad_tareas": [
        {"texto": f"«{t}»", "fuente": familia_de_tarea.get(t, "")}
        for t in tareas_ej
    ],
    "novedad_habilidades": [
        {"texto": f"«{h}»", "fuente": f"{habs_nuevas[h]} anuncios la piden"}
        for h in habs_ej
    ],
    "ajuste_sinco": [
        {"texto": f"«{c['titulo']}»",
         "fuente": f"cae en {c['sinco']['codigo_4d']}, junto con {c['sinco']['comparte_con'][0].lower()}"}
        for c in compartidos
    ],
    # Volumen dentro de la ventana observada, no crecimiento entre años: con seis
    # meses de anuncios no hay serie que sostenga una tendencia, pero sí se puede
    # decir cuántas empresas distintas la piden aquí y ahora. Eso es lo que separa
    # una ocupación que está nnaciendo de un título inventado por alguien.
    "crecimiento_reciente": [
        {"texto": f"«{f}»", "fuente": f"{n} anuncios en la ventana observada"}
        for n, f in volumenes[:N_EJEMPLOS]
    ],
    "dispersion_sectorial": [
        {"texto": f"«{f}»",
         "fuente": f"{n} sectores: {', '.join(x for x, _ in sectores_de(f)[:2]).lower()}…"}
        for n, f in dispersion[:N_EJEMPLOS]
    ],
}

# --- galería del cierre: pocas, de mundos distintos ------------------------------

GALERIA = [
    "Ingeniería de prompts e IA generativa",
    "Instalación de sistemas fotovoltaicos",
    "Coordinación de telemedicina",
    "Auditoría algorítmica y ética de IA",
    "Curación y etiquetado de datos para IA",
    "Coordinación de última milla",
]
MUNDOS = {
    "Ingeniería de prompts e IA generativa": "Tecnología",
    "Instalación de sistemas fotovoltaicos": "Energía y oficios",
    "Coordinación de telemedicina": "Salud",
    "Auditoría algorítmica y ética de IA": "Regulación y riesgo",
    "Curación y etiquetado de datos para IA": "Apoyo administrativo",
    "Coordinación de última milla": "Logística",
}


def ficha_galeria(familia):
    rs = por_familia[familia]
    n = len(rs)
    frec = Counter(t for r in rs for t in r["tareas"])
    nuevas = [t for t, _ in frec.most_common() if tareas_cat.get(t, {}).get("es_nueva")]
    habs = {}
    for r in rs:
        for h in r["habilidades_esco"]:
            habs.setdefault(h["label"], {"g": h["grupo_esco"], "nueva": h["es_nueva"], "n": 0})
            habs[h["label"]]["n"] += 1
    hn = sorted([{"label": k, "grupo": v["g"], "n": v["n"]} for k, v in habs.items() if v["nueva"]],
                key=lambda d: -d["n"])
    # lo que la ocupación pide y NO es nuevo: el oficio ya existente sobre el que
    # se monta. Va en la ficha junto a lo nuevo, porque una ocupación emergente
    # no es una que lo tenga todo nuevo —es una mezcla, y eso hay que verlo.
    hp = sorted([{"label": k, "n": v["n"], "pct": round(100 * v["n"] / n)}
                 for k, v in habs.items() if not v["nueva"]],
                key=lambda d: -d["n"])
    modal = Counter(r["modalidad"] for r in rs)
    sueldos = sorted((r["salario"]["min_mxn"] + r["salario"]["max_mxn"]) / 2
                     for r in rs if r["salario"]["declarado"])
    c4 = rs[0]["sinco"]["codigo_4d"]
    vecinas = [f["familia"] for f in cobertura[c4]["familias"] if f["familia"] != familia]
    return {
        "familia": familia,
        "titulo": Counter(r["titulo_anuncio"] for r in rs).most_common(1)[0][0],
        "mundo": MUNDOS[familia],
        "icono": icono_de(familia),
        "n_anuncios": n,
        "indice": round(sum(r["indice_emergencia"]["valor"] for r in rs) / n, 3),
        "sinco": {"codigo_4d": c4, "nombre_4d": rs[0]["sinco"]["nombre_4d"], "comparte_con": vecinas},
        "tareas_nuevas": nuevas[:2],
        "habilidades_nuevas": hn[:3],
        "habilidades_pedidas": hp[:3],
        "modalidad": {k: round(100 * modal[k] / n, 1) for k in ("remoto", "hibrido", "presencial")},
        "salario_mediano": round(sueldos[len(sueldos) // 2]) if sueldos else None,
    }


galeria = [ficha_galeria(f) for f in GALERIA]

# panorama: las que más alto puntúan, con el subgrupo donde caen
subgrupos = {}
for r in registros:
    subgrupos[r["sinco"]["codigo_2d"]] = r["sinco"]["nombre_2d"]
familia_2d = {r["familia_ocupacional"]: r["sinco"]["codigo_2d"] for r in registros}

panorama = [{
    "familia": d["familia"],
    "indice": d["indice_promedio"],
    "n_anuncios": d["n_anuncios"],
    "codigo_2d": familia_2d[d["familia"]],
    "nombre_2d": subgrupos[familia_2d[d["familia"]]],
    "icono": icono_de(d["familia"]),
} for d in ranking[:12]]

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "total_anuncios": len(registros),
    "senales": [{"clave": k, "nombre": n, "ejemplos": EJEMPLOS[k]} for k, n in SENALES],
    "galeria": galeria,
    "casos": casos,
    "panorama": panorama,
    "subgrupos_distintos": len({p["codigo_2d"] for p in panorama}),
}

destino = DATA / "casos.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"data/casos.json — {destino.stat().st_size/1024:.0f} KB")
for c in casos:
    comp = c["crecimiento"]
    print(f"\n{c['titulo']} · {c['mundo']}")
    print(f"  cae en {c['sinco']['codigo_4d']}"
          + (f", junto con {', '.join(c['sinco']['comparte_con'])}" if c['sinco']['comparte_con'] else ", sin vecinas"))
    print(f"  {c['n_anuncios']} anuncios · ×{comp['multiplicador']} de {comp['primer_anio']} a {comp['ultimo_anio']}")
    print(f"  tarea estrella: {c['tarea_estrella']}")
    print(f"  habilidades nuevas: {', '.join(h['label'] for h in c['habilidades_nuevas'][:2])}")
print(f"\npanorama: {len(panorama)} ocupaciones en {salida['subgrupos_distintos']} subgrupos distintos")
print(f"galería: {len(galeria)} fichas")
print("\nejemplos por señal:")
for k, _ in SENALES:
    for e in EJEMPLOS[k]:
        print(f"  {k:24} {e['texto'][:62]}")
        print(f"  {'':24} \u2514 {e['fuente'][:58]}")
