#!/usr/bin/env python3
"""Arma data/anuncios.json: los datos de la escena 3, sobre de dónde salen los OJA."""
import json
import random
import unicodedata
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import icono_de  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"
random.seed(11)

registros = [json.loads(l) for l in (DATA / "oja_sintetico.jsonl").open(encoding="utf-8")]
serie = json.loads((DATA / "agg" / "serie_mensual.json").read_text(encoding="utf-8"))
total = len(registros)

# --- plataformas ----------------------------------------------------------------
plat = Counter(r["plataforma"] for r in registros)
plataformas = [{"nombre": n, "n": c, "porcentaje": round(100 * c / total, 1)}
               for n, c in plat.most_common()]

# --- composición por gran grupo --------------------------------------------------
gg = Counter((r["sinco"]["gran_grupo"], r["sinco"]["nombre_gran_grupo"]) for r in registros)
grandes_grupos = [{"codigo": k[0], "nombre": k[1], "n": v, "porcentaje": round(100 * v / total, 1)}
                  for k, v in sorted(gg.items(), key=lambda kv: -kv[1])]

# --- lo que traen los anuncios ---------------------------------------------------
con_salario = sum(1 for r in registros if r["salario"]["declarado"])
modalidad = Counter(r["modalidad"] for r in registros)
tareas_por_anuncio = sum(len(r["tareas"]) for r in registros) / total
habilidades_por_anuncio = sum(len(r["habilidades_esco"]) for r in registros) / total

# --- la lluvia: tarjetas de oferta, con lo que trae cualquier anuncio ------------
# Antes eran títulos sueltos en una píldora. Un anuncio real trae puesto, quién
# contrata, dónde, modalidad, sueldo y requisitos: eso es lo que hay que ver antes
# de contar que ese texto se vuelve datos comparables.
MODALIDAD_TXT = {"remoto": "Remoto", "hibrido": "Híbrido", "presencial": "Presencial"}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
         "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fecha_larga(iso):
    a, m, d = iso.split("-")
    return f"{int(d)} de {MESES[int(m) - 1]}"


def sueldo_txt(sal):
    if not sal["declarado"]:
        return None
    return f'${sal["min_mxn"]:,} – ${sal["max_mxn"]:,}'.replace(",", ",")


por_familia = {}
for r in registros:
    por_familia.setdefault(r["familia_ocupacional"], []).append(r)

# una oferta por familia, de familias distintas, para que la lluvia no se repita
vistos = set()
lluvia = []
for familia, lista in por_familia.items():
    titulos = Counter(r["titulo_anuncio"] for r in lista)
    titulo = titulos.most_common(1)[0][0]
    if titulo in vistos:
        continue
    vistos.add(titulo)
    cand = [r for r in lista if r["titulo_anuncio"] == titulo]
    r = cand[len(cand) // 2]
    lluvia.append({
        "titulo": titulo,
        "icono": icono_de(familia),
        "perfil": r["perfil_familia"],
        "sector": r["sector"],
        "entidad": r["entidad_federativa"],
        "modalidad": MODALIDAD_TXT[r["modalidad"]],
        "contrato": r["tipo_contrato"],
        "sueldo": sueldo_txt(r["salario"]),
        "escolaridad": r["requisitos"]["escolaridad"],
        "experiencia": r["requisitos"]["experiencia_anios"],
        "fecha": fecha_larga(r["fecha_publicacion"]),
        "plataforma": r["plataforma"],
    })
random.shuffle(lluvia)

# --- dos anuncios para mostrar el paso de texto libre a campos ------------------
# Dos mundos distintos a propósito: uno de oficina y tecnología, otro de oficio en
# campo. Si los dos ejemplos fueran de lo mismo, el lector concluiría que esto
# sólo funciona para el trabajo de escritorio.
FAMILIAS_EJEMPLO = ["Ingeniería de prompts e IA generativa", "Instalación de sistemas fotovoltaicos"]
MODALIDAD_LARGA = {"remoto": "Trabajo remoto", "hibrido": "Trabajo híbrido", "presencial": "Presencial"}



# --- de dónde sale cada campo ----------------------------------------------------
# La animación sólo muestra datos que están escritos con esas mismas palabras en
# el anuncio, con su tramo exacto. Lo que habría que deducir o mapear a un
# vocabulario controlado no entra: afirmarlo con el mismo gesto sería falso.

def plano(t):
    """Minúsculas y sin acentos, conservando la longitud: los índices siguen sirviendo."""
    return "".join(unicodedata.normalize("NFD", c)[0].lower() for c in t)


def localiza(texto, valor):
    i = plano(texto).find(plano(valor))
    return [i, i + len(valor)] if i >= 0 else None


def arma_ejemplo(ej):
    """Un anuncio con sus campos literales, en el orden en que aparecen en el texto."""
    desc = ej["descripcion_puesto"]

    def campo(grupo, tipo, texto, valor_en_texto=None, etiqueta=None):
        tramo = localiza(desc, valor_en_texto or texto)
        if tramo is None:
            return None
        return {"grupo": grupo, "tipo": tipo, "texto": texto,
                "etiqueta": etiqueta, "origen": "texto", "tramo": tramo}

    campos = []
    for t in ej["tareas"][:4]:
        campos.append(campo("tareas", "tarea", t))
    for h in ej["habilidades_esco"][:5]:
        campos.append(campo("habilidades", "habilidad", h["label"], etiqueta=h["grupo_esco"]))
    campos.append(campo("condiciones", "modalidad", MODALIDAD_LARGA[ej["modalidad"]],
                        valor_en_texto=ej["modalidad"]))
    if ej["salario"]["declarado"]:
        campos.append(campo(
            "condiciones", "sueldo",
            f'${ej["salario"]["min_mxn"]:,} – ${ej["salario"]["max_mxn"]:,} al mes',
            valor_en_texto=f'{ej["salario"]["min_mxn"]:,} a {ej["salario"]["max_mxn"]:,} pesos'))
    campos.append(campo("condiciones", "estudios", ej["requisitos"]["escolaridad"]))
    anios = ej["requisitos"]["experiencia_anios"]
    campos.append(campo("condiciones", "experiencia",
                        f'{anios} año{"" if anios == 1 else "s"} de experiencia',
                        valor_en_texto=f'{anios} años de experiencia'))

    campos = [c for c in campos if c]
    campos.sort(key=lambda c: c["tramo"][0])

    return {
        "titulo": ej["titulo_anuncio"],
        "familia": ej["familia_ocupacional"],
        "icono": icono_de(ej["familia_ocupacional"]),
        "plataforma": ej["plataforma"],
        "fecha": ej["fecha_publicacion"],
        "descripcion": desc,
        "extraccion": {"campos": campos, "n_extraidos": len(campos)},
    }


ejemplos = []
for familia in FAMILIAS_EJEMPLO:
    cand = [r for r in registros
            if r["familia_ocupacional"] == familia
            and r["salario"]["declarado"] and len(r["tareas"]) >= 4]
    ejemplos.append(arma_ejemplo(cand[len(cand) // 2]))

# --- a quién alcanzan a ver los anuncios ----------------------------------------
# Reparto de cada 100 personas ocupadas del país. NO sale del corpus —el corpus son
# anuncios, no personas— y por eso los valores son redondos a propósito: son un
# marcador de posición hasta que se sustituyan por el dato de la ENOE. La escena
# lo dice en pantalla.
COBERTURA = {
    "fuente": "PENDIENTE: sustituir por ENOE. Valores redondos, ilustrativos.",
    "total": 100,
    "grupos": [
        {"clave": "formal", "n": 40, "visible": True,
         "nombre": "Trabajo asalariado formal", "nota": "lo que un anuncio en internet alcanza a ver"},
        {"clave": "informal", "n": 25, "visible": False,
         "nombre": "Trabajo asalariado informal", "nota": "rara vez se anuncia en internet"},
        {"clave": "cuenta_propia", "n": 25, "visible": False,
         "nombre": "Trabajo por cuenta propia", "nota": "no hay vacante que anunciar"},
        {"clave": "campo", "n": 5, "visible": False,
         "nombre": "Trabajo agropecuario", "nota": "se contrata en el lugar, no en una plataforma"},
        {"clave": "sin_pago", "n": 5, "visible": False,
         "nombre": "Trabajo sin pago", "nota": "no pasa por el mercado laboral"},
    ],
}

salida = {
    "nota": "Datos sintéticos de prueba. Ver data/README.md.",
    "cobertura": COBERTURA,
    "total": total,
    "periodo": {"desde": serie[0]["mes"], "hasta": serie[-1]["mes"], "meses": len(serie)},
    "promedio_mensual": round(total / len(serie)),
    "plataformas": plataformas,
    "grandes_grupos": grandes_grupos,
    "serie_mensual": [{"mes": d["mes"], "total": d["total"]} for d in serie],
    "riqueza": {
        "tareas_por_anuncio": round(tareas_por_anuncio, 1),
        "habilidades_por_anuncio": round(habilidades_por_anuncio, 1),
        "con_salario_pct": round(100 * con_salario / total, 1),
        "modalidad": {k: round(100 * v / total, 1) for k, v in modalidad.most_common()},
    },
    "lluvia": lluvia,
    "ejemplos": ejemplos,
}

destino = DATA / "anuncios.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"data/anuncios.json — {destino.stat().st_size/1024:.0f} KB")
print(f"{total} anuncios · {len(plataformas)} plataformas · {len(lluvia)} títulos para la lluvia")
print("plataformas:", ", ".join(f"{p['nombre']} {p['porcentaje']}%" for p in plataformas))
print("grandes grupos:", ", ".join(f"{g['codigo']} {g['porcentaje']}%" for g in grandes_grupos))
for n, ej in enumerate(salida["ejemplos"], 1):
    e = ej["extraccion"]
    print(f'ejemplo {n} — {ej["titulo"]} ({ej["familia"]}): {e["n_extraidos"]} campos literales')
    for c in e["campos"]:
        print(f'   {c["grupo"]:12} {c["texto"][:56]}')
print(f"riqueza: {salida['riqueza']['tareas_por_anuncio']} tareas, "
      f"{salida['riqueza']['habilidades_por_anuncio']} habilidades, "
      f"{salida['riqueza']['con_salario_pct']}% con salario")
