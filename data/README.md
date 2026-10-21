# Datos — Viz_OJA

> **Todo lo que hay en esta carpeta es SINTÉTICO.** Ningún registro corresponde a una
> vacante real, ninguna empresa es real y los códigos SINCO son ilustrativos: respetan la
> estructura (primer dígito = gran grupo, 2 dígitos = subgrupo, 4 dígitos = grupo unitario)
> y los nombres de los nueve grandes grupos, pero los nombres de subgrupo y de grupo
> unitario deben sustituirse por el catálogo oficial. Sirven para construir y probar las
> visualizaciones mientras llegan los datos reales.

Generado por `scripts/generar_datos_sinteticos.py` (semilla `20260909`, reproducible).
5 999 anuncios entre enero de 2021 y agosto de 2026, en 28 familias ocupacionales:
12 emergentes, 6 en transición y 10 consolidadas.

## Archivos

| Archivo | Qué es | Uso |
|---|---|---|
| `oja_sintetico.jsonl` | corpus completo, un anuncio por línea, estructura anidada | análisis |
| `oja_sintetico.csv` | el mismo corpus, plano (listas separadas por ` \| `) | análisis |
| `oja_muestra.json` | 300 anuncios completos | la web: anatomía de un anuncio, explorador |
| `sinco_catalogo.json` | catálogo jerárquico gran grupo → subgrupo → unitario | la web: rejilla del catálogo |
| `esco_habilidades.json` | diccionario de habilidades con su grupo ESCO S1–S8 | la web y análisis |
| `agg/serie_mensual.json` | anuncios por mes y por perfil de familia | línea de tiempo |
| `agg/cobertura_sinco.json` | por código de 4 dígitos: anuncios, títulos y familias distintas | "un cajón, varias ocupaciones" |
| `agg/modalidad.json` | remoto / híbrido / presencial por gran grupo y por familia | barras apiladas |
| `agg/salarios.json` | cuartiles de salario por familia + tasa de declaración | distribución salarial |
| `agg/habilidades.json` | top de habilidades, por familia y por grupo ESCO | red o matriz de habilidades |
| `agg/ocupaciones_emergentes.json` | ranking de familias por índice de emergencia | tabla y ranking |
| `tareas_catalogo.json` | diccionario de tareas: cuáles son nuevas y qué familias las piden | escenas de tareas |
| `apertura.json` | datos de la escena 1 (respuestas, renglones, cajón compartido). `hitos` son **acontecimientos del mundo**, no mediciones: la escena los dibuja con otra grafía. `serie_mensual` **ya no se usa** en la introducción | la web |
| `tareas.json` | datos de la escena 2 (comparación de tareas del renglón 2151) | la web |
| `anuncios.json` | datos de la escena 3. `cobertura` reparte **cada 100 personas ocupadas del país** y marca cuáles alcanza a ver un anuncio: **no sale del corpus** —el corpus son anuncios, no personas— y sus valores son redondos a propósito hasta que lleguen de la ENOE. **Desde el 14 de septiembre la introducción ya no lo usa**: el beat 2 de la escena 3 dejó de contar personas y ahora muestra un muestrario de oficios. Queda para el módulo de cobertura del catálogo, en Resultados. `lluvia` trae ahora **una oferta completa por familia** (sector, entidad, modalidad, sueldo, requisitos, fecha) y `ejemplos` son **dos anuncios**, cada uno sólo con sus campos literales —`origen` siempre `texto`, con su `tramo`—. Los campos van **ordenados por su posición en el texto**. Sus bloques `plataformas`, `serie` y `riqueza` **ya no los usa la introducción** (ver abajo) | la web |
| `anatomia.json` | un anuncio ancla + el agregado de cada atributo | **reservado para Resultados** |
| `casos.json` | datos de la escena 4: **tres ejemplos por señal** del índice (`senales[].ejemplos`) y la galería de seis ocupaciones del cierre; cada ficha lleva `tareas_nuevas`, `habilidades_nuevas` y, desde el 14 de septiembre, `habilidades_pedidas` —lo que la ocupación pide y **no** es nuevo, con el porcentaje de sus anuncios que lo piden—. El bloque `casos` **ya no lo usa la introducción** (ver abajo) | la web |
| `resultados.json` | una ficha completa por familia ocupacional: tareas, habilidades, señales del índice, modalidad, salario y serie anual | la sección de Resultados |
| `panorama.json` | agregados de los tres primeros módulos de Resultados: reparto por entidad, modalidad por gran grupo del SINCO y modalidad por gran grupo × entidad | R1, R2 y R3 de Resultados |
| `mapa_entidades.json` | las 32 entidades federativas en TopoJSON, sólo estados | el mapa de R2 |
| `agg/ejemplos_indice.json` | distribución del índice + 20 anuncios que la recorren | **calibrar el umbral** |

### Bloques que la introducción dejó de usar

La introducción se recortó de 24 a 14 beats el 10 de septiembre de 2026 (ver `PLAN.md`). Los
generadores **siguen produciendo** todo lo de antes; lo que cambió es quién lo consume:

| Bloque | Estaba en | Destino |
|---|---|---|
| `anuncios.plataformas` | escena 3, reparto por plataforma | Resultados |
| `anuncios.serie` | escena 3, serie mensual del corpus | Resultados |
| `anuncios.riqueza` | escena 3, «lo que sí traen» | Resultados |
| `casos.casos` | escena 4, tres fichas de caso | sin uso; la galería lo cubre |
| `apertura.cajon.ocupaciones` | escena 1, panel del cajón compartido | sin uso; el cierre ahora ocurre sobre el propio renglón y sólo necesita `codigo` y `nombre` |
| `tareas.anuncio_ejemplo` | escena 2, anuncio del cierre | sin uso; ese beat se eliminó |
| `anatomia.json` | escena de anatomía, retirada antes | Resultados |

No se borró nada de `data/`: si un beat vuelve, los datos están.

## Diccionario de campos

### Identificación y contexto
| Campo | Tipo | Notas |
|---|---|---|
| `id_oja` | texto | `OJA-<año>-<consecutivo>` |
| `fecha_publicacion` | fecha | ISO `AAAA-MM-DD` |
| `mes` | texto | `AAAA-MM`, para agregar |
| `plataforma` | texto | anonimizada: `Plataforma A` … `Plataforma E` |
| `entidad_federativa` | texto | 32 entidades + `Nacional (remoto)` |
| `sector` | texto | sector de la empresa contratante |
| `familia_ocupacional` | texto | **auxiliar del generador**, no existe en el corpus real |
| `perfil_familia` | texto | `emergente` / `transicion` / `consolidada` — **auxiliar**, es la etiqueta con la que se simuló, sirve para validar el índice, no para presumirla como resultado |

### Contenido del anuncio
| Campo | Tipo | Notas |
|---|---|---|
| `titulo_anuncio` | texto | título tal como aparece publicado |
| `descripcion_puesto` | texto | párrafo redactado a partir de tareas, requisitos y oferta |
| `tareas` | lista de texto | descripción de tareas, entre 3 y 9 por anuncio. Incluye tareas propias de la ocupación, tareas nuevas y **tareas comunes** del grupo unitario o del gran grupo: sin estas últimas ninguna familia compartiría tareas con otra y cualquier comparación mediría el diseño del generador |

### Habilidades (ESCO)
`habilidades_esco` es una lista de objetos:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | `ESCO-<grupo>-<consecutivo>` |
| `label` | texto | etiqueta de la habilidad en español |
| `grupo_esco` | texto | **S1–S8**, el nivel al que clasifica el corpus real |
| `nombre_grupo` | texto | nombre del grupo ESCO |
| `es_nueva` | booleano | habilidad que aparece en el mercado a partir de ~2019 |
| `anio_aparicion` | entero | año aproximado de aparición |

Grupos: `S1` comunicación, colaboración y creatividad · `S2` habilidades de información ·
`S3` asistencia y cuidado · `S4` gestión · `S5` trabajo con computadoras ·
`S6` manipulación y movimiento · `S7` construcción · `S8` maquinaria y equipo especializado.

### Clasificación SINCO
| Campo | Tipo | Notas |
|---|---|---|
| `codigo_2d` / `nombre_2d` | texto | subgrupo |
| `codigo_4d` / `nombre_4d` | texto | grupo unitario |
| `gran_grupo` / `nombre_gran_grupo` | texto | primer dígito |
| `confianza` | 0–1 | existe en el corpus real pero **no se muestra en la página web** |

### Condiciones ofrecidas
| Campo | Tipo | Notas |
|---|---|---|
| `modalidad` | texto | `remoto` / `hibrido` / `presencial` |
| `tipo_contrato` | texto | tiempo completo, medio tiempo, por proyecto, honorarios |
| `salario.declarado` | booleano | ~35 % de los anuncios no declara salario |
| `salario.min_mxn` / `max_mxn` | entero o nulo | pesos mensuales, con inflación de 4.5 % anual aplicada |
| `requisitos.escolaridad` | texto | de secundaria a maestría |
| `requisitos.experiencia_anios` | entero | 0 a 8 |
| `requisitos.ingles` | booleano | |

### Índice de emergencia
`indice_emergencia.valor`, escala **0–1**, calculado **por anuncio**:

```
índice = 0.25 · novedad_tareas
       + 0.25 · novedad_habilidades
       + 0.20 · ajuste_sinco            (1 − confianza de la clasificación)
       + 0.20 · crecimiento_reciente    (crecimiento interanual de la familia)
       + 0.10 · dispersion_sectorial    (entropía de los sectores donde aparece)
```

Los cinco componentes vienen desagregados en `indice_emergencia.componentes`.
**Esta fórmula es provisional**: en cuanto esté la del corpus real se sustituye aquí y las
visualizaciones se recalculan solas.

**El umbral para declarar "emergente" todavía no está definido.** El generador no clasifica:
sólo entrega el valor. Para calibrarlo, `agg/ejemplos_indice.json` trae la distribución
completa y 20 anuncios que la recorren de extremo a extremo.

Distribución obtenida: mínimo 0.000 · p10 0.076 · p25 0.104 · mediana 0.185 · p75 0.340 ·
p90 0.526 · p95 0.584 · máximo 0.795. Promedio 0.240.

Separación por perfil (promedio del índice): familias emergentes 0.47–0.67,
en transición 0.25–0.35, consolidadas 0.04–0.18.

## Sobre los campos que no confirmaste

`plataforma`, `entidad_federativa`, `sector`, `tipo_contrato` y `requisitos` se incluyeron
porque las visualizaciones planeadas los necesitan. Si el corpus real no los trae, se quitan
las visualizaciones que dependen de ellos; si los trae con otros nombres, sólo hay que
renombrar en la capa de carga.

## Regenerar

```bash
python3 scripts/generar_datos_sinteticos.py   # el corpus y los agregados
python3 scripts/preparar_apertura.py          # escena 1
python3 scripts/preparar_tareas.py            # escena 2
python3 scripts/preparar_anuncios.py          # escena 3
```

Los seis guiones de escena leen el corpus, así que hay que correrlos después de regenerarlo.


## Sobre `panorama.json` — dos universos que no se mezclan

El bloque `acervo` (200 000 anuncios, unos 5 000 nuevos por semana) son **cifras del proyecto
real, declaradas por el equipo**. No se calculan a partir de ningún archivo de esta carpeta y
no se pueden comparar con el resto del contenido. Todo lo demás del archivo —repartos,
porcentajes, modalidad— sale del **corpus sintético de 5 999 anuncios**. La página lo dice en
el pie de cada módulo y aquí queda escrito para que nadie lo junte después por descuido.

Pendiente: fijar la fecha de corte del acervo (`acervo.nota`).

## Sobre `mapa_entidades.json`

Origen: **Marco Geoestadístico Nacional del INEGI** (`mge2010v5_0`), convertido a TopoJSON por
Diego Valle-Jones (`gist.github.com/diegovalle/5129746`). `scripts/preparar_mapa.py` conserva
sólo el objeto `states`, poda los arcos a los 1 307 que usan los estados —de 773 KB a 82 KB—,
normaliza los nombres al uso corriente y conserva `cve_ent`, que es la clave por donde debe
unirse cualquier dato del corpus.

Si esto llega a producción conviene regenerarlo desde la **versión vigente** del Marco
Geoestadístico y no desde la de 2010: los límites estatales no han cambiado, pero la
procedencia debe poder citarse tal cual.
