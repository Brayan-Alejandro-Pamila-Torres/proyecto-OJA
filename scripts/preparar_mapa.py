#!/usr/bin/env python3
"""Arma data/mapa_entidades.json: las 32 entidades federativas, sólo los estados.

Origen: Marco Geoestadístico Nacional del INEGI (mge2010v5_0), convertido a TopoJSON
por Diego Valle-Jones (gist 5129746). De ese archivo se conserva únicamente el objeto
`states` —los municipios sobran para esta página y pesan diez veces más— y se poda la
lista de arcos a los que los estados usan de verdad.

Los nombres se normalizan al uso corriente: «Distrito Federal» pasa a «Ciudad de
México», y los nombres largos se acortan al de uso común. Se conserva `cve_ent`, que es
la clave oficial y es por donde debe unirse cualquier dato del corpus.
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = Path("/tmp/mx_tj.json")
DESTINO = RAIZ / "data" / "mapa_entidades.json"

# nombre oficial largo -> nombre de uso corriente
NOMBRE = {
    "Distrito Federal": "Ciudad de México",
    "México": "Estado de México",
    "Michoacán de Ocampo": "Michoacán",
    "Veracruz de Ignacio de la Llave": "Veracruz",
    "Coahuila de Zaragoza": "Coahuila",
}
# abreviatura para rotular el mapa sin taparlo
SIGLA = {
    "01": "Ags", "02": "BC", "03": "BCS", "04": "Camp", "05": "Coah", "06": "Col",
    "07": "Chis", "08": "Chih", "09": "CDMX", "10": "Dgo", "11": "Gto", "12": "Gro",
    "13": "Hgo", "14": "Jal", "15": "Méx", "16": "Mich", "17": "Mor", "18": "Nay",
    "19": "NL", "20": "Oax", "21": "Pue", "22": "Qro", "23": "QRoo", "24": "SLP",
    "25": "Sin", "26": "Son", "27": "Tab", "28": "Tamps", "29": "Tlax", "30": "Ver",
    "31": "Yuc", "32": "Zac",
}


def arcos_de(geom):
    """Todos los índices de arco que usa una geometría, a cualquier profundidad."""
    salida = []

    def rec(a):
        if isinstance(a, list):
            if a and isinstance(a[0], int):
                salida.extend(a)
            else:
                for x in a:
                    rec(x)

    rec(geom.get("arcs", []))
    return salida


def main():
    topo = json.loads(ORIGEN.read_text())
    estados = topo["objects"]["states"]

    # 1. qué arcos hacen falta
    usados = set()
    for g in estados["geometries"]:
        for i in arcos_de(g):
            usados.add(i if i >= 0 else ~i)
    orden = sorted(usados)
    nuevo_indice = {viejo: nuevo for nuevo, viejo in enumerate(orden)}

    # 2. reescribir los índices de cada geometría
    def remapear(a):
        if isinstance(a, list):
            if a and isinstance(a[0], int):
                return [nuevo_indice[i] if i >= 0 else ~nuevo_indice[~i] for i in a]
            return [remapear(x) for x in a]
        return a

    geometrias = []
    for g in estados["geometries"]:
        cve = f"{int(g['properties']['state_code']):02d}"
        crudo = g["properties"]["state_name"]
        geometrias.append({
            "type": g["type"],
            "arcs": remapear(g["arcs"]),
            "properties": {
                "cve_ent": cve,
                "nombre": NOMBRE.get(crudo, crudo),
                "sigla": SIGLA[cve],
            },
        })

    salida = {
        "type": "Topology",
        "transform": topo["transform"],
        "arcs": [topo["arcs"][i] for i in orden],
        "objects": {"entidades": {"type": "GeometryCollection", "geometries": geometrias}},
        "fuente": ("Marco Geoestadístico Nacional, INEGI (mge2010v5_0). "
                   "Conversión a TopoJSON: gist.github.com/diegovalle/5129746"),
    }

    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")))
    print(f"data/mapa_entidades.json — {DESTINO.stat().st_size / 1024:.0f} KB · "
          f"{len(geometrias)} entidades · {len(orden)} arcos")


if __name__ == "__main__":
    main()
