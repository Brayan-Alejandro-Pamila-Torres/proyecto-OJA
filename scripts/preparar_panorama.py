#!/usr/bin/env python3
"""Arma data/panorama.json: el respaldo de los tres primeros módulos de Resultados.

  R1 · contador del acervo
  R2 · reparto por entidad federativa
  R3 · modalidad por gran grupo del SINCO, filtrable por entidad

Una advertencia que el archivo lleva dentro y la página repite en pantalla: las
cifras del ACERVO (poco más de 200 000 anuncios, unos 5 000 nuevos por semana) son
del proyecto real y las declara quien lo opera. Todo lo demás —los repartos, los
porcentajes, la modalidad— sale del corpus SINTÉTICO de prueba, que tiene 5 999
anuncios. Son dos universos distintos y la página no los puede presentar como uno.
"""
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CORPUS = RAIZ / "data" / "oja_sintetico.csv"
DESTINO = RAIZ / "data" / "panorama.json"

# --- cifras declaradas del acervo real (no salen del corpus de prueba) --------
ACERVO = {
    "total": 200000,
    "por_semana": 5000,
    "fuente": "Acervo del proyecto, declarado por el equipo. No procede del corpus de prueba.",
    "nota": "PENDIENTE: fijar fecha de corte del acervo.",
}

# nombre en el corpus -> clave oficial de entidad federativa
CVE = {
    "Aguascalientes": "01", "Baja California": "02", "Baja California Sur": "03",
    "Campeche": "04", "Coahuila": "05", "Colima": "06", "Chiapas": "07",
    "Chihuahua": "08", "Ciudad de México": "09", "Durango": "10", "Guanajuato": "11",
    "Guerrero": "12", "Hidalgo": "13", "Jalisco": "14", "Estado de México": "15",
    "Michoacán": "16", "Morelos": "17", "Nayarit": "18", "Nuevo León": "19",
    "Oaxaca": "20", "Puebla": "21", "Querétaro": "22", "Quintana Roo": "23",
    "San Luis Potosí": "24", "Sinaloa": "25", "Sonora": "26", "Tabasco": "27",
    "Tamaulipas": "28", "Tlaxcala": "29", "Veracruz": "30", "Yucatán": "31",
    "Zacatecas": "32",
}
# el corpus usa algunos nombres que no sirven en pantalla
ALIAS = {"México": "Estado de México"}

# Abreviaturas oficiales del INEGI (Catálogo Único de Claves de Áreas
# Geoestadísticas). Son las que van en el selector del tablero, solas: el
# nombre completo aparece en el panel, que es donde el lector confirma.
# El orden por clave ES el alfabético del INEGI —«Ch» después de «Co», como
# manda el alfabeto tradicional—, así que no hay que reordenar nada.
ABREV = {
    "01": "Ags.", "02": "BC", "03": "BCS", "04": "Camp.", "05": "Coah.",
    "06": "Col.", "07": "Chis.", "08": "Chih.", "09": "CDMX", "10": "Dgo.",
    "11": "Gto.", "12": "Gro.", "13": "Hgo.", "14": "Jal.", "15": "Méx.",
    "16": "Mich.", "17": "Mor.", "18": "Nay.", "19": "NL", "20": "Oax.",
    "21": "Pue.", "22": "Qro.", "23": "Q. Roo", "24": "SLP", "25": "Sin.",
    "26": "Son.", "27": "Tab.", "28": "Tamps.", "29": "Tlax.", "30": "Ver.",
    "31": "Yuc.", "32": "Zac.",
}
NOMBRE = {v: k for k, v in CVE.items()}

# cuántas entradas lleva cada columna del panel del tablero
TOPE_PANEL = 4

# lo que el corpus no reparte por entidad
SIN_ENTIDAD = {
    "Nacional (remoto)": ("sin_sede", "Sin sede fija", "Se ofrece como remoto para todo el país."),
    "Otras": ("resto", "Resto del país", "El corpus de prueba agrupa aquí a las entidades con pocos anuncios."),
}

# nombre completo del gran grupo y versión corta para rotular la gráfica sin
# que el texto se salga del lienzo. El largo se conserva para el título accesible.
GRANDES_GRUPOS = {
    "1": ("Funcionarios, directores y jefes", "Funcionarios y directores"),
    "2": ("Profesionistas y técnicos", "Profesionistas y técnicos"),
    "3": ("Trabajadores auxiliares en actividades administrativas", "Auxiliares administrativos"),
    "4": ("Comerciantes, empleados en ventas y agentes de ventas", "Comercio y ventas"),
    "5": ("Trabajadores en servicios personales y vigilancia", "Servicios y vigilancia"),
    "6": ("Trabajadores en actividades agrícolas, ganaderas, forestales, caza y pesca",
          "Agricultura y pesca"),
    "7": ("Trabajadores artesanales, en la construcción y otros oficios",
          "Oficios y construcción"),
    "8": ("Operadores de maquinaria industrial, ensambladores, choferes y conductores",
          "Maquinaria y transporte"),
    "9": ("Trabajadores en actividades elementales y de apoyo", "Actividades elementales"),
}
MODS = ["presencial", "hibrido", "remoto"]
# por debajo de esto la celda no se lee como porcentaje: se marca y se dice
MINIMO_FIABLE = 30


def pct(parte, total):
    return round(parte * 100 / total, 1) if total else 0.0


def reparto_modalidad(cuenta):
    total = sum(cuenta.values())
    return {
        "n": total,
        "pct": {m: pct(cuenta.get(m, 0), total) for m in MODS},
        "fiable": total >= MINIMO_FIABLE,
    }


def main():
    filas = list(csv.DictReader(CORPUS.open(encoding="utf-8")))
    total = len(filas)

    # ---- R2 · reparto por entidad -------------------------------------------
    por_entidad = Counter(f["entidad_federativa"] for f in filas)
    entidades, aparte = [], []
    for nombre, n in por_entidad.most_common():
        # el corpus escribe «México» a secas; en el mapa y en el texto corrido
        # eso se confunde con el país, así que se normaliza aquí y en un solo sitio
        nombre = ALIAS.get(nombre, nombre)
        if nombre in SIN_ENTIDAD:
            clave, rotulo, explica = SIN_ENTIDAD[nombre]
            aparte.append({"clave": clave, "nombre": rotulo, "n": n,
                           "pct": pct(n, total), "explica": explica})
            continue
        entidades.append({"cve_ent": CVE[nombre], "nombre": nombre, "n": n,
                          "pct": pct(n, total)})
    entidades.sort(key=lambda e: -e["n"])

    con_dato = {e["cve_ent"] for e in entidades}
    sin_dato = sorted(set(CVE.values()) - con_dato)

    # ---- R3 · modalidad por gran grupo --------------------------------------
    nacional = defaultdict(Counter)
    por_ent = defaultdict(lambda: defaultdict(Counter))
    for f in filas:
        gg, mod, ent = f["gran_grupo"], f["modalidad"], f["entidad_federativa"]
        nacional[gg][mod] += 1
        if ent in CVE:
            por_ent[CVE[ent]][gg][mod] += 1

    grupos = []
    for gg in sorted(GRANDES_GRUPOS):
        presente = gg in nacional
        largo, corto = GRANDES_GRUPOS[gg]
        fila = {"clave": gg, "nombre": largo, "corto": corto, "presente": presente}
        fila.update(reparto_modalidad(nacional[gg]) if presente
                    else {"n": 0, "pct": {m: 0 for m in MODS}, "fiable": False})
        grupos.append(fila)

    modalidad_entidad = {
        cve: {gg: reparto_modalidad(c) for gg, c in gs.items()}
        for cve, gs in por_ent.items()
    }

    total_mod = Counter(f["modalidad"] for f in filas)

    # ---- R2b · el tablero por entidad ---------------------------------------
    # Una ficha por entidad con la misma forma que la del cierre de la
    # introducción: cabecera, tres columnas, barra de modalidad y pie. Las 12
    # entidades que el corpus agrupa bajo «Otras» salen igual, marcadas: que no
    # haya dato es también algo que el lector tiene que poder ver.
    filas_por_ent = defaultdict(list)
    for f in filas:
        nombre = ALIAS.get(f["entidad_federativa"], f["entidad_federativa"])
        if nombre in CVE:
            filas_por_ent[CVE[nombre]].append(f)

    def mayores(cuenta, n_total, tope=TOPE_PANEL):
        return [{"nombre": k, "n": v, "pct": pct(v, n_total)}
                for k, v in cuenta.most_common(tope)]

    tablero = []
    for cve in sorted(CVE.values()):
        ficha = {"cve_ent": cve, "abrev": ABREV[cve], "nombre": NOMBRE[cve]}
        rs = filas_por_ent.get(cve, [])
        if not rs:
            # el corpus de prueba no la separa: se dice, no se inventa
            ficha["sin_dato"] = True
            tablero.append(ficha)
            continue

        n = len(rs)
        habs = Counter()
        for f in rs:
            for h in filter(None, (x.strip() for x in f["habilidades"].split("|"))):
                habs[h] += 1
        sueldos = sorted((int(f["salario_min_mxn"]) + int(f["salario_max_mxn"])) / 2
                         for f in rs if f["salario_declarado"] == "1")

        ficha.update({
            "sin_dato": False,
            "n": n,
            "pct": pct(n, total),
            "fiable": n >= MINIMO_FIABLE,
            "ocupaciones": mayores(Counter(f["familia_ocupacional"] for f in rs), n),
            "habilidades": mayores(habs, n),
            "grupos": [{**g, "nombre": GRANDES_GRUPOS[g["nombre"]][1]}
                       for g in mayores(Counter(f["gran_grupo"] for f in rs), n, 3)],
            "modalidad": reparto_modalidad(Counter(f["modalidad"] for f in rs)),
            "salario_mediano": round(sueldos[len(sueldos) // 2]) if sueldos else None,
        })
        tablero.append(ficha)

    salida = {
        "nota": ("Los repartos y porcentajes provienen del corpus sintético de prueba "
                 f"({total} anuncios). Las cifras del acervo son declaradas y no se "
                 "calculan aquí. Ver data/README.md."),
        "acervo": ACERVO,
        "corpus": {
            "total": total,
            "modalidad": {"n": total, "pct": {m: pct(total_mod[m], total) for m in MODS},
                          "fiable": True},
        },
        "entidades": entidades,
        "aparte": aparte,
        "entidades_sin_dato": sin_dato,
        "grandes_grupos": grupos,
        "modalidad_por_entidad": modalidad_entidad,
        "tablero": tablero,
        "minimo_fiable": MINIMO_FIABLE,
    }

    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    kb = DESTINO.stat().st_size / 1024
    print(f"data/panorama.json — {kb:.0f} KB")
    print(f"  {len(entidades)} entidades con dato · {len(sin_dato)} sin dato individual")
    print(f"  aparte: {', '.join(f'{a['nombre']} {a['pct']}%' for a in aparte)}")
    print(f"  grandes grupos presentes: {sum(1 for g in grupos if g['presente'])} de 9")
    con = [t for t in tablero if not t["sin_dato"]]
    flojas = [t["abrev"] for t in con if not t["fiable"]]
    print(f"  tablero: {len(con)} fichas con dato de {len(tablero)}"
          + (f" · por debajo de {MINIMO_FIABLE} anuncios: {', '.join(flojas)}" if flojas else ""))


if __name__ == "__main__":
    main()
