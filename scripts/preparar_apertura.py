#!/usr/bin/env python3
"""Arma data/apertura.json: los datos de la escena de apertura de la introducción.

Toma títulos y códigos reales del corpus y les asigna un ícono del Sistema Visual.
El ícono es del dominio de la ocupación, no del oficio literal: el set institucional
es de trazo abstracto y no pretende ilustrar herramientas.
"""
import json
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"

# familia ocupacional -> (ícono, título preferido para mostrar)
ICONOS = {
    "Enfermería": ("hospital", "Enfermera general"),
    "Coordinación de telemedicina": ("estetoscopio", "Coordinador de Telemedicina"),
    "Desarrollo de software": ("monitor", "Desarrollador Full Stack"),
    "Ingeniería de prompts e IA generativa": ("cerebro", "Ingeniero de Prompts"),
    "Operación de modelos en producción (MLOps)": ("nube", "Ingeniero MLOps"),
    "Ingeniería de plataformas y confiabilidad": ("red", "Ingeniero de Plataformas"),
    "Mecánica automotriz": ("auto", "Mecánico Automotriz"),
    "Electromovilidad y vehículos eléctricos": ("controles", "Técnico en Vehículos Eléctricos"),
    "Inteligencia de negocios": ("barras", "Analista de Business Intelligence"),
    "Automatización de procesos": ("crecimiento", "Especialista en RPA"),
    "Contabilidad": ("calculadora", "Contador General"),
    "Apoyo administrativo": ("archivero", "Auxiliar Administrativo"),
    "Ventas en piso": ("acuerdo", "Vendedor de Piso"),
    "Transporte y reparto": ("avion", "Chofer Repartidor"),
    "Docencia básica": ("escuela", "Docente de Primaria"),
    "Instalación de sistemas fotovoltaicos": ("casa", "Técnico Instalador de Paneles Solares"),
    "Mercadotecnia digital y crecimiento": ("megafono", "Community Manager"),
    "Servicios de alimentos": ("comida", "Cocinero"),
    "Soldadura": ("rompecabezas", "Soldador"),
    "Sostenibilidad y reporteo ESG": ("planta", "Analista de Sostenibilidad"),
    "Auditoría algorítmica y ética de IA": ("documento-lupa", "Auditor de Algoritmos"),
}

# la respuesta que en el beat 3 se queda sin renglón propio
SIN_RENGLON = "Ingeniería de prompts e IA generativa"

registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]

por_familia = {}
for r in registros:
    f = r["familia_ocupacional"]
    if f not in ICONOS:
        continue
    d = por_familia.setdefault(f, {
        "familia": f,
        "perfil": r["perfil_familia"],
        "codigo": r["sinco"]["codigo_4d"],
        "nombre_codigo": r["sinco"]["nombre_4d"],
        "codigo_2d": r["sinco"]["codigo_2d"],
        "nombre_2d": r["sinco"]["nombre_2d"],
        "titulos": Counter(),
        "n": 0,
        "indices": [],
    })
    d["titulos"][r["titulo_anuncio"]] += 1
    d["n"] += 1
    d["indices"].append(r["indice_emergencia"]["valor"])

respuestas = []
for f, d in por_familia.items():
    icono, titulo = ICONOS[f]
    if titulo not in d["titulos"]:
        titulo = d["titulos"].most_common(1)[0][0]
    respuestas.append({
        "titulo": titulo,
        "icono": icono,
        "familia": f,
        "perfil": d["perfil"],
        "codigo": d["codigo"],
        "nombre_codigo": d["nombre_codigo"],
        "codigo_2d": d["codigo_2d"],
        "n_anuncios": d["n"],
        "indice": round(sum(d["indices"]) / len(d["indices"]), 3),
        "sin_renglon": f == SIN_RENGLON,
    })

respuestas.sort(key=lambda r: (r["codigo"], -r["n_anuncios"]))

# los renglones son los códigos de 4 dígitos que reciben estas respuestas
renglones = {}
for r in respuestas:
    d = renglones.setdefault(r["codigo"], {
        "codigo": r["codigo"], "nombre": r["nombre_codigo"],
        "codigo_2d": r["codigo_2d"], "ocupaciones": [], "n_anuncios": 0,
    })
    d["ocupaciones"].append(r["titulo"])
    d["n_anuncios"] += r["n_anuncios"]

renglones = sorted(renglones.values(), key=lambda d: d["codigo"])

cajon_codigo = next(r["codigo"] for r in respuestas if r["sin_renglon"])
cajon = {
    "codigo": cajon_codigo,
    "nombre": next(d["nombre"] for d in renglones if d["codigo"] == cajon_codigo),
    "ocupaciones": [
        {"titulo": r["titulo"], "icono": r["icono"], "familia": r["familia"],
         "n_anuncios": r["n_anuncios"], "indice": r["indice"]}
        for r in respuestas if r["codigo"] == cajon_codigo
    ],
}

serie = json.loads((DATA / "agg" / "serie_mensual.json").read_text(encoding="utf-8"))

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "pregunta": "¿En qué trabaja usted?",
    "actualizaciones_catalogo": [
        {"anio": 2011, "etiqueta": "SINCO 2011"},
        {"anio": 2019, "etiqueta": "SINCO 2019"},
    ],
    # Acontecimientos del mundo, no datos del corpus: se dibujan con otra grafía
    # para que nadie los lea como una medición nuestra.
    "hitos": [
        {"anio": 2020, "etiqueta": "Pandemia"},
        {"anio": 2022, "etiqueta": "IA generativa de uso masivo"},
    ],
    "periodo_anuncios": {"desde": serie[0]["mes"], "hasta": serie[-1]["mes"],
                         "meses": len(serie),
                         "total": sum(d["total"] for d in serie)},
    "serie_mensual": [{"mes": d["mes"], "total": d["total"]} for d in serie],
    "respuestas": respuestas,
    "renglones": renglones,
    "cajon": cajon,
}

destino = DATA / "apertura.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"data/apertura.json — {len(respuestas)} respuestas, {len(renglones)} renglones, "
      f"{destino.stat().st_size/1024:.0f} KB")
print(f"cajón compartido: {cajon['codigo']} · {cajon['nombre']}")
for o in cajon["ocupaciones"]:
    print(f"   · {o['titulo']}  (índice {o['indice']})")
