#!/usr/bin/env python3
"""Generador de datos SINTÉTICOS de anuncios de empleo en línea (OJA) — proyecto Viz_OJA.

Reproduce la estructura y los órdenes de magnitud plausibles de un corpus real de OJA
mexicano para poder construir y probar las visualizaciones antes de tener los datos
reales. Ningún registro corresponde a una vacante real, ninguna empresa es real y los
códigos SINCO son ilustrativos (respetan la estructura de 4 dígitos y los nombres de
los grandes grupos, pero deben sustituirse por el catálogo oficial).

Campos, alineados con el corpus real:
  - titulo del anuncio
  - descripcion y descripcion de tareas
  - habilidades requeridas con clasificación ESCO
  - clasificación hacia SINCO (código, método, confianza, estado)
  - índice construido de ocupación emergente (valor, componentes, clasificación)
  - atributos complementarios: modalidad, salario ofertado, requisitos, plataforma,
    entidad federativa, sector

Uso:  python3 scripts/generar_datos_sinteticos.py
"""
from __future__ import annotations

import csv
import json
import math
import random
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

SEMILLA = 20260909
random.seed(SEMILLA)

RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"
AGG = DATA / "agg"

MES_INICIO = (2021, 1)
MES_FIN = (2026, 8)
N_OBJETIVO = 6000

# --------------------------------------------------------------------------------------
# 1. Diccionario de habilidades con clasificación ESCO
#    etiqueta -> (grupo ESCO, es_nueva, año de aparición en el mercado)
# --------------------------------------------------------------------------------------

GRUPOS_ESCO = {
    "S1": "Comunicación, colaboración y creatividad",
    "S2": "Habilidades de información",
    "S3": "Asistencia y cuidado",
    "S4": "Habilidades de gestión",
    "S5": "Trabajo con computadoras",
    "S6": "Manipulación y movimiento",
    "S7": "Construcción",
    "S8": "Trabajo con maquinaria y equipo especializado",
    "K": "Conocimientos",
    "T": "Habilidades transversales",
}

HABILIDADES: dict[str, tuple[str, bool, int]] = {
    # --- digitales consolidadas
    "programación en Python": ("S5", False, 2005),
    "programación en JavaScript": ("S5", False, 2004),
    "desarrollo de servicios web": ("S5", False, 2008),
    "administración de bases de datos": ("S5", False, 2000),
    "consultas SQL": ("S5", False, 2000),
    "control de versiones con Git": ("S5", False, 2010),
    "administración de servidores Linux": ("S5", False, 2000),
    "uso de hojas de cálculo avanzadas": ("S5", False, 1998),
    "visualización de datos": ("S2", False, 2012),
    "estadística aplicada": ("K", False, 1990),
    "aprendizaje automático": ("K", False, 2014),
    "diseño de interfaces de usuario": ("S1", False, 2010),
    "investigación con usuarios": ("S2", False, 2012),
    "gestión de proyectos ágiles": ("S4", False, 2010),
    "análisis de requerimientos": ("S2", False, 1998),
    "pruebas de software": ("S5", False, 2000),
    "seguridad de la información": ("K", False, 2005),
    "cómputo en la nube": ("K", False, 2012),
    "automatización de procesos": ("S5", False, 2015),
    "mercadotecnia digital": ("K", False, 2010),
    "optimización para buscadores": ("S5", False, 2008),
    "análisis de métricas web": ("S2", False, 2010),
    "gestión de redes sociales": ("S1", False, 2010),
    "redacción de contenidos": ("S1", False, 1990),
    "atención a clientes": ("S3", False, 1990),
    "contabilidad financiera": ("K", False, 1980),
    "elaboración de estados financieros": ("S2", False, 1980),
    "cumplimiento normativo": ("K", False, 1995),
    "gestión de inventarios": ("S4", False, 1990),
    "logística y distribución": ("K", False, 1990),
    "manejo de montacargas": ("S8", False, 1980),
    "conducción de vehículos de carga": ("S6", False, 1980),
    "soldadura MIG/MAG": ("S7", False, 1980),
    "lectura de planos": ("S7", False, 1970),
    "operación de máquinas herramienta CNC": ("S8", False, 1990),
    "mantenimiento preventivo de maquinaria": ("S8", False, 1985),
    "instalaciones eléctricas residenciales": ("S7", False, 1970),
    "diagnóstico automotriz": ("S8", False, 1985),
    "cuidados de enfermería": ("S3", False, 1970),
    "administración de medicamentos": ("S3", False, 1970),
    "toma de signos vitales": ("S3", False, 1970),
    "planeación didáctica": ("S1", False, 1980),
    "evaluación del aprendizaje": ("S2", False, 1980),
    "preparación de alimentos": ("S6", False, 1970),
    "manejo higiénico de alimentos": ("K", False, 1995),
    "atención en punto de venta": ("S3", False, 1985),
    "manejo de caja": ("S2", False, 1985),
    "captura de datos": ("S5", False, 1995),
    "archivo y gestión documental": ("S2", False, 1980),
    "elaboración de reportes": ("S2", False, 1985),
    "trabajo en equipo": ("T", False, 1980),
    "comunicación efectiva": ("T", False, 1980),
    "resolución de problemas": ("T", False, 1980),
    "inglés de negocios": ("T", False, 1985),
    "pensamiento crítico": ("T", False, 1990),
    "adaptabilidad al cambio": ("T", False, 1995),
    # --- nuevas / emergentes
    "ingeniería de instrucciones (prompting)": ("S5", True, 2022),
    "evaluación de modelos de lenguaje": ("S2", True, 2022),
    "diseño de flujos con agentes de IA": ("S5", True, 2023),
    "generación aumentada por recuperación (RAG)": ("K", True, 2023),
    "afinamiento de modelos fundacionales": ("S5", True, 2022),
    "orquestación de modelos en producción (MLOps)": ("S5", True, 2020),
    "monitoreo de deriva de modelos": ("S2", True, 2021),
    "gobernanza de datos para IA": ("K", True, 2021),
    "auditoría algorítmica": ("S2", True, 2022),
    "evaluación de sesgos en sistemas automatizados": ("S2", True, 2022),
    "documentación de riesgos de IA": ("S1", True, 2023),
    "etiquetado y curación de datos de entrenamiento": ("S2", True, 2020),
    "verificación de respuestas generadas por IA": ("S2", True, 2023),
    "infraestructura como código": ("S5", True, 2019),
    "orquestación de contenedores": ("S5", True, 2019),
    "ingeniería de plataformas internas": ("S5", True, 2022),
    "observabilidad de sistemas distribuidos": ("S5", True, 2021),
    "seguridad de cargas de trabajo en la nube": ("K", True, 2020),
    "respuesta a incidentes en entornos híbridos": ("S5", True, 2021),
    "modelado de amenazas": ("S2", True, 2020),
    "diseño de experiencias conversacionales": ("S1", True, 2021),
    "analítica de producto digital": ("S2", True, 2019),
    "experimentación A/B a escala": ("S2", True, 2019),
    "automatización de mercadotecnia": ("S5", True, 2019),
    "gestión de comercio electrónico transfronterizo": ("K", True, 2021),
    "gestión de mercados en línea (marketplaces)": ("S4", True, 2019),
    "prevención de fraude digital": ("K", True, 2020),
    "identidad digital y biometría": ("K", True, 2021),
    "medición de huella de carbono": ("K", True, 2021),
    "reporteo de criterios ESG": ("S2", True, 2021),
    "economía circular aplicada": ("K", True, 2022),
    "instalación de sistemas fotovoltaicos": ("S7", True, 2019),
    "dimensionamiento de sistemas de almacenamiento de energía": ("S7", True, 2022),
    "mantenimiento de vehículos eléctricos": ("S8", True, 2021),
    "diagnóstico de sistemas de alto voltaje": ("S8", True, 2022),
    "gestión de carga de flotas eléctricas": ("S4", True, 2023),
    "optimización de ruta de última milla": ("S4", True, 2020),
    "coordinación de operaciones con repartidores independientes": ("S4", True, 2020),
    "teleconsulta y acompañamiento remoto de pacientes": ("S3", True, 2020),
    "gestión de expedientes clínicos electrónicos": ("S5", True, 2020),
    "diseño instruccional para entornos digitales": ("S1", True, 2020),
    "producción de contenido educativo audiovisual": ("S1", True, 2020),
    "automatización robótica de procesos (RPA)": ("S5", True, 2019),
    "integración de sistemas mediante API": ("S5", True, 2018),
    "desarrollo de proveedores para nearshoring": ("S4", True, 2022),
}

# --------------------------------------------------------------------------------------
# 2. Catálogo de familias ocupacionales
# --------------------------------------------------------------------------------------

GRANDES_GRUPOS = {
    "1": "Funcionarios, directores y jefes",
    "2": "Profesionistas y técnicos",
    "3": "Trabajadores auxiliares en actividades administrativas",
    "4": "Comerciantes, empleados en ventas y agentes de ventas",
    "5": "Trabajadores en servicios personales y vigilancia",
    "6": "Trabajadores en actividades agrícolas, ganaderas, forestales, caza y pesca",
    "7": "Trabajadores artesanales, en la construcción y otros oficios",
    "8": "Operadores de maquinaria industrial, ensambladores, choferes y conductores de transporte",
    "9": "Trabajadores en actividades elementales y de apoyo",
}

# perfil: emergente | transicion | consolidada
# peso: (peso relativo al inicio del periodo, peso relativo al final)
# modalidad: (remoto, híbrido, presencial)
OCUPACIONES = [
    dict(
        familia="Ingeniería de prompts e IA generativa", perfil="emergente",
        titulos=["Ingeniero de Prompts", "Prompt Engineer", "Especialista en IA Generativa",
                 "Ingeniero de IA Generativa", "Especialista en Modelos de Lenguaje"],
        sinco=("2151", "Desarrolladores y analistas de software y multimedia", "2"),
        sectores=[("Servicios de tecnologías de la información", 6), ("Comercio electrónico", 2),
                  ("Servicios financieros", 2), ("Consultoría", 2), ("Manufactura", 1)],
        modalidad=(0.55, 0.35, 0.10), salario=(35000, 78000), peso=(0.15, 9.0),
        confianza=(0.18, 0.45),
        habilidades=["programación en Python", "aprendizaje automático", "cómputo en la nube",
                     "análisis de requerimientos", "inglés de negocios", "pensamiento crítico"],
        nuevas=["ingeniería de instrucciones (prompting)", "evaluación de modelos de lenguaje",
                "diseño de flujos con agentes de IA", "generación aumentada por recuperación (RAG)",
                "afinamiento de modelos fundacionales"],
        tareas=["Diseñar y probar instrucciones para modelos de lenguaje en casos de negocio",
                "Documentar los criterios de evaluación de las respuestas del modelo",
                "Colaborar con equipos de producto para definir casos de uso de IA",
                "Integrar modelos mediante interfaces de programación",
                "Medir el desempeño y el costo de las soluciones implementadas"],
        tareas_nuevas=["Construir bancos de evaluación para comparar versiones de modelos",
                       "Diseñar cadenas de agentes que resuelven tareas de varios pasos",
                       "Definir barreras de seguridad para las respuestas generadas"],
    ),
    dict(
        familia="Operación de modelos en producción (MLOps)", perfil="emergente",
        titulos=["Ingeniero MLOps", "Especialista en MLOps", "Ingeniero de Machine Learning",
                 "Ingeniero de Plataformas de IA"],
        sinco=("2152", "Administradores de sistemas y de bases de datos", "2"),
        sectores=[("Servicios de tecnologías de la información", 6), ("Servicios financieros", 3),
                  ("Telecomunicaciones", 2), ("Comercio al por menor", 1)],
        modalidad=(0.50, 0.40, 0.10), salario=(45000, 95000), peso=(0.3, 6.5),
        confianza=(0.25, 0.52),
        habilidades=["programación en Python", "cómputo en la nube", "administración de servidores Linux",
                     "control de versiones con Git", "aprendizaje automático"],
        nuevas=["orquestación de modelos en producción (MLOps)", "monitoreo de deriva de modelos",
                "infraestructura como código", "orquestación de contenedores",
                "observabilidad de sistemas distribuidos"],
        tareas=["Automatizar el ciclo de entrenamiento y despliegue de modelos",
                "Administrar la infraestructura de cómputo para cargas de aprendizaje automático",
                "Implementar tableros de monitoreo del desempeño de los modelos",
                "Optimizar costos de procesamiento en la nube"],
        tareas_nuevas=["Detectar y remediar la deriva de datos y de modelos en producción",
                       "Versionar conjuntos de datos y artefactos de entrenamiento"],
    ),
    dict(
        familia="Auditoría algorítmica y ética de IA", perfil="emergente",
        titulos=["Auditor de Algoritmos", "Especialista en Ética de IA",
                 "Analista de Riesgos de Inteligencia Artificial", "Especialista en Gobernanza de IA"],
        sinco=("2634", "Especialistas en ciencias sociales y afines", "2"),
        sectores=[("Servicios financieros", 4), ("Consultoría", 3), ("Sector público", 2),
                  ("Servicios de tecnologías de la información", 2)],
        modalidad=(0.45, 0.40, 0.15), salario=(38000, 82000), peso=(0.05, 3.2),
        confianza=(0.12, 0.35),
        habilidades=["cumplimiento normativo", "estadística aplicada", "elaboración de reportes",
                     "pensamiento crítico", "inglés de negocios"],
        nuevas=["auditoría algorítmica", "evaluación de sesgos en sistemas automatizados",
                "documentación de riesgos de IA", "gobernanza de datos para IA"],
        tareas=["Revisar el cumplimiento normativo de sistemas automatizados de decisión",
                "Elaborar reportes de riesgo para comités internos",
                "Capacitar a las áreas de negocio en uso responsable de IA"],
        tareas_nuevas=["Evaluar sesgos y desempeño diferenciado de modelos por grupo poblacional",
                       "Documentar la trazabilidad de los datos de entrenamiento",
                       "Diseñar políticas internas de uso de sistemas generativos"],
    ),
    dict(
        familia="Curación y etiquetado de datos para IA", perfil="emergente",
        titulos=["Especialista en Curación de Datos", "Analista de Etiquetado de Datos",
                 "Revisor de Contenido para IA", "Especialista en Calidad de Datos de Entrenamiento"],
        sinco=("3113", "Capturistas y operadores de equipo de cómputo", "3"),
        sectores=[("Servicios de tecnologías de la información", 5), ("Servicios profesionales", 2),
                  ("Comercio electrónico", 2)],
        modalidad=(0.70, 0.20, 0.10), salario=(12000, 26000), peso=(0.2, 4.0),
        confianza=(0.20, 0.48),
        habilidades=["captura de datos", "elaboración de reportes", "pensamiento crítico",
                     "uso de hojas de cálculo avanzadas", "comunicación efectiva"],
        nuevas=["etiquetado y curación de datos de entrenamiento",
                "verificación de respuestas generadas por IA", "gobernanza de datos para IA"],
        tareas=["Revisar y clasificar grandes volúmenes de texto e imágenes",
                "Aplicar guías de anotación y reportar casos ambiguos",
                "Verificar la consistencia entre anotadores"],
        tareas_nuevas=["Validar la calidad de respuestas producidas por modelos generativos",
                       "Proponer mejoras a las guías de anotación a partir de casos límite"],
    ),
    dict(
        familia="Ingeniería de plataformas y confiabilidad", perfil="emergente",
        titulos=["Ingeniero de Plataformas", "Platform Engineer", "Ingeniero de Confiabilidad de Sitio",
                 "Especialista en DevOps"],
        sinco=("2152", "Administradores de sistemas y de bases de datos", "2"),
        sectores=[("Servicios de tecnologías de la información", 6), ("Servicios financieros", 3),
                  ("Comercio electrónico", 2), ("Telecomunicaciones", 1)],
        modalidad=(0.50, 0.40, 0.10), salario=(42000, 90000), peso=(0.6, 5.0),
        confianza=(0.30, 0.58),
        habilidades=["administración de servidores Linux", "cómputo en la nube", "programación en Python",
                     "control de versiones con Git", "seguridad de la información"],
        nuevas=["infraestructura como código", "orquestación de contenedores",
                "ingeniería de plataformas internas", "observabilidad de sistemas distribuidos"],
        tareas=["Construir y mantener la infraestructura de despliegue continuo",
                "Definir estándares de operación para los equipos de desarrollo",
                "Atender incidentes de disponibilidad de los servicios"],
        tareas_nuevas=["Desarrollar plataformas internas de autoservicio para equipos de producto",
                       "Instrumentar trazas distribuidas y objetivos de nivel de servicio"],
    ),
    dict(
        familia="Ciberseguridad en la nube", perfil="emergente",
        titulos=["Especialista en Ciberseguridad en la Nube", "Analista de Seguridad Cloud",
                 "Ingeniero de Seguridad de la Información", "Especialista en DevSecOps"],
        sinco=("2153", "Especialistas en seguridad informática", "2"),
        sectores=[("Servicios financieros", 4), ("Servicios de tecnologías de la información", 4),
                  ("Sector público", 2), ("Telecomunicaciones", 2)],
        modalidad=(0.40, 0.45, 0.15), salario=(40000, 88000), peso=(0.5, 4.5),
        confianza=(0.32, 0.62),
        habilidades=["seguridad de la información", "administración de servidores Linux",
                     "cómputo en la nube", "cumplimiento normativo", "inglés de negocios"],
        nuevas=["seguridad de cargas de trabajo en la nube", "respuesta a incidentes en entornos híbridos",
                "modelado de amenazas", "infraestructura como código"],
        tareas=["Monitorear y responder a incidentes de seguridad",
                "Realizar evaluaciones de vulnerabilidades",
                "Definir políticas de acceso y cifrado"],
        tareas_nuevas=["Asegurar contenedores y cargas de trabajo distribuidas en varias nubes",
                       "Modelar amenazas sobre arquitecturas de microservicios"],
    ),
    dict(
        familia="Instalación de sistemas fotovoltaicos", perfil="emergente",
        titulos=["Técnico Instalador de Paneles Solares", "Técnico en Energía Solar Fotovoltaica",
                 "Instalador de Sistemas Fotovoltaicos", "Supervisor de Instalaciones Solares"],
        sinco=("7411", "Electricistas y trabajadores en instalaciones eléctricas", "7"),
        sectores=[("Construcción", 4), ("Energía", 4), ("Servicios profesionales", 2), ("Manufactura", 1)],
        modalidad=(0.02, 0.08, 0.90), salario=(11000, 26000), peso=(0.6, 4.2),
        confianza=(0.35, 0.65),
        habilidades=["instalaciones eléctricas residenciales", "lectura de planos",
                     "mantenimiento preventivo de maquinaria", "trabajo en equipo"],
        nuevas=["instalación de sistemas fotovoltaicos",
                "dimensionamiento de sistemas de almacenamiento de energía"],
        tareas=["Instalar y conectar módulos fotovoltaicos en techos y estructuras",
                "Realizar pruebas de funcionamiento y puesta en marcha",
                "Elaborar reportes de instalación y mantenimiento"],
        tareas_nuevas=["Dimensionar sistemas de almacenamiento en baterías para autoconsumo",
                       "Gestionar el trámite de interconexión a la red eléctrica"],
    ),
    dict(
        familia="Electromovilidad y vehículos eléctricos", perfil="emergente",
        titulos=["Técnico en Vehículos Eléctricos", "Especialista en Electromovilidad",
                 "Técnico de Mantenimiento de Flota Eléctrica"],
        sinco=("7231", "Mecánicos y ajustadores de vehículos de motor", "7"),
        sectores=[("Manufactura", 4), ("Transporte", 3), ("Comercio al por menor", 2), ("Energía", 1)],
        modalidad=(0.02, 0.10, 0.88), salario=(13000, 32000), peso=(0.2, 3.0),
        confianza=(0.28, 0.58),
        habilidades=["diagnóstico automotriz", "mantenimiento preventivo de maquinaria",
                     "lectura de planos", "trabajo en equipo"],
        nuevas=["mantenimiento de vehículos eléctricos", "diagnóstico de sistemas de alto voltaje",
                "gestión de carga de flotas eléctricas"],
        tareas=["Diagnosticar fallas en sistemas eléctricos y electrónicos vehiculares",
                "Realizar mantenimiento preventivo y correctivo",
                "Registrar historiales de servicio de la flota"],
        tareas_nuevas=["Dar servicio a baterías de tracción y sistemas de alto voltaje",
                       "Programar la operación de la infraestructura de carga"],
    ),
    dict(
        familia="Sostenibilidad y reporteo ESG", perfil="emergente",
        titulos=["Analista de Sostenibilidad", "Especialista ESG", "Analista de Huella de Carbono",
                 "Coordinador de Sostenibilidad Corporativa"],
        sinco=("2143", "Ingenieros en ecología y ambientales", "2"),
        sectores=[("Manufactura", 3), ("Servicios financieros", 3), ("Consultoría", 3),
                  ("Energía", 2), ("Comercio al por menor", 1)],
        modalidad=(0.30, 0.45, 0.25), salario=(22000, 55000), peso=(0.25, 3.4),
        confianza=(0.22, 0.50),
        habilidades=["elaboración de reportes", "estadística aplicada", "cumplimiento normativo",
                     "uso de hojas de cálculo avanzadas", "inglés de negocios"],
        nuevas=["medición de huella de carbono", "reporteo de criterios ESG",
                "economía circular aplicada"],
        tareas=["Recopilar información ambiental y social de las operaciones",
                "Elaborar reportes para inversionistas y autoridades",
                "Dar seguimiento a metas de sostenibilidad"],
        tareas_nuevas=["Calcular la huella de carbono de alcance 1, 2 y 3",
                       "Preparar la divulgación bajo estándares internacionales de sostenibilidad"],
    ),
    dict(
        familia="Coordinación de última milla", perfil="emergente",
        titulos=["Coordinador de Última Milla", "Supervisor de Operaciones de Reparto",
                 "Analista de Logística de Última Milla"],
        sinco=("1324", "Jefes de departamento de abastecimiento, distribución y afines", "1"),
        sectores=[("Comercio electrónico", 5), ("Transporte", 3), ("Comercio al por menor", 2)],
        modalidad=(0.15, 0.35, 0.50), salario=(16000, 38000), peso=(0.5, 3.6),
        confianza=(0.30, 0.60),
        habilidades=["logística y distribución", "gestión de inventarios", "elaboración de reportes",
                     "atención a clientes", "uso de hojas de cálculo avanzadas"],
        nuevas=["optimización de ruta de última milla",
                "coordinación de operaciones con repartidores independientes",
                "integración de sistemas mediante API"],
        tareas=["Programar y supervisar rutas de entrega",
                "Dar seguimiento a indicadores de servicio y de costo",
                "Atender incidencias con clientes y transportistas"],
        tareas_nuevas=["Optimizar rutas mediante plataformas de asignación dinámica",
                       "Coordinar redes de repartidores con esquemas de trabajo por aplicación"],
    ),
    dict(
        familia="Prevención de fraude digital", perfil="emergente",
        titulos=["Especialista en Prevención de Fraude", "Analista de Riesgo Digital",
                 "Especialista en Identidad Digital", "Analista Antifraude"],
        sinco=("2412", "Especialistas en finanzas y análisis de riesgo", "2"),
        sectores=[("Servicios financieros", 6), ("Comercio electrónico", 3), ("Telecomunicaciones", 1)],
        modalidad=(0.40, 0.40, 0.20), salario=(24000, 60000), peso=(0.4, 3.0),
        confianza=(0.30, 0.62),
        habilidades=["estadística aplicada", "consultas SQL", "cumplimiento normativo",
                     "elaboración de reportes", "seguridad de la información"],
        nuevas=["prevención de fraude digital", "identidad digital y biometría",
                "evaluación de sesgos en sistemas automatizados"],
        tareas=["Analizar patrones de transacciones sospechosas",
                "Definir reglas de detección y umbrales de alerta",
                "Coordinar la investigación de casos con áreas legales"],
        tareas_nuevas=["Validar procesos de identidad digital y verificación biométrica",
                       "Ajustar modelos automáticos de puntaje de riesgo"],
    ),
    dict(
        familia="Coordinación de telemedicina", perfil="emergente",
        titulos=["Coordinador de Telemedicina", "Especialista en Salud Digital",
                 "Enfermero de Teleconsulta", "Coordinador de Programas de Salud Remota"],
        sinco=("2221", "Enfermeras profesionales", "2"),
        sectores=[("Salud", 7), ("Servicios de tecnologías de la información", 2), ("Sector público", 1)],
        modalidad=(0.45, 0.30, 0.25), salario=(18000, 42000), peso=(0.15, 2.4),
        confianza=(0.20, 0.48),
        habilidades=["cuidados de enfermería", "atención a clientes", "elaboración de reportes",
                     "comunicación efectiva"],
        nuevas=["teleconsulta y acompañamiento remoto de pacientes",
                "gestión de expedientes clínicos electrónicos"],
        tareas=["Agendar y dar seguimiento a consultas a distancia",
                "Orientar a pacientes sobre el uso de las plataformas de atención",
                "Registrar la información clínica en sistemas electrónicos"],
        tareas_nuevas=["Realizar triage y acompañamiento clínico por videoconsulta",
                       "Monitorear a distancia signos vitales enviados por dispositivos"],
    ),
    # ---------------- en transición ----------------
    dict(
        familia="Ciencia de datos", perfil="transicion",
        titulos=["Científico de Datos", "Data Scientist", "Analista de Datos Senior",
                 "Especialista en Modelos Predictivos"],
        sinco=("2120", "Matemáticos, actuarios y estadísticos", "2"),
        sectores=[("Servicios financieros", 4), ("Comercio electrónico", 3),
                  ("Servicios de tecnologías de la información", 3), ("Manufactura", 1)],
        modalidad=(0.40, 0.45, 0.15), salario=(30000, 70000), peso=(2.0, 4.5),
        confianza=(0.55, 0.82),
        habilidades=["programación en Python", "estadística aplicada", "consultas SQL",
                     "visualización de datos", "aprendizaje automático", "inglés de negocios"],
        nuevas=["monitoreo de deriva de modelos", "gobernanza de datos para IA"],
        tareas=["Construir modelos predictivos a partir de datos históricos",
                "Preparar y depurar conjuntos de datos",
                "Comunicar hallazgos a áreas de negocio",
                "Diseñar experimentos para evaluar intervenciones"],
        tareas_nuevas=["Integrar componentes de IA generativa en flujos analíticos"],
    ),
    dict(
        familia="Desarrollo de software", perfil="transicion",
        titulos=["Desarrollador Full Stack", "Ingeniero de Software", "Programador Backend",
                 "Desarrollador Frontend"],
        sinco=("2151", "Desarrolladores y analistas de software y multimedia", "2"),
        sectores=[("Servicios de tecnologías de la información", 6), ("Servicios financieros", 2),
                  ("Comercio electrónico", 2), ("Telecomunicaciones", 1)],
        modalidad=(0.45, 0.40, 0.15), salario=(25000, 65000), peso=(6.0, 8.0),
        confianza=(0.72, 0.94),
        habilidades=["programación en JavaScript", "desarrollo de servicios web", "consultas SQL",
                     "control de versiones con Git", "pruebas de software", "gestión de proyectos ágiles"],
        nuevas=["integración de sistemas mediante API", "orquestación de contenedores"],
        tareas=["Desarrollar y mantener aplicaciones web",
                "Escribir pruebas automatizadas",
                "Participar en revisiones de código",
                "Documentar componentes y servicios"],
        tareas_nuevas=["Integrar asistentes de código y componentes de IA en el flujo de desarrollo"],
    ),
    dict(
        familia="Diseño de experiencia de usuario", perfil="transicion",
        titulos=["Diseñador UX/UI", "Diseñador de Producto Digital", "Investigador UX",
                 "Diseñador de Experiencia Conversacional"],
        sinco=("2711", "Diseñadores gráficos, multimedia y de producto", "2"),
        sectores=[("Servicios de tecnologías de la información", 4), ("Comercio electrónico", 3),
                  ("Servicios financieros", 2), ("Consultoría", 1)],
        modalidad=(0.45, 0.40, 0.15), salario=(22000, 55000), peso=(2.5, 3.6),
        confianza=(0.60, 0.88),
        habilidades=["diseño de interfaces de usuario", "investigación con usuarios",
                     "análisis de métricas web", "comunicación efectiva"],
        nuevas=["diseño de experiencias conversacionales", "analítica de producto digital",
                "experimentación A/B a escala"],
        tareas=["Diseñar flujos e interfaces para productos digitales",
                "Realizar pruebas de usabilidad",
                "Construir prototipos interactivos",
                "Mantener el sistema de diseño"],
        tareas_nuevas=["Diseñar interacciones con asistentes conversacionales"],
    ),
    dict(
        familia="Mercadotecnia digital y crecimiento", perfil="transicion",
        titulos=["Especialista en Growth Marketing", "Coordinador de Mercadotecnia Digital",
                 "Community Manager", "Especialista en Comercio Electrónico"],
        sinco=("2431", "Especialistas en mercadotecnia y publicidad", "2"),
        sectores=[("Comercio electrónico", 4), ("Comercio al por menor", 3), ("Servicios profesionales", 2),
                  ("Servicios financieros", 1)],
        modalidad=(0.40, 0.35, 0.25), salario=(15000, 42000), peso=(3.0, 4.2),
        confianza=(0.55, 0.85),
        habilidades=["mercadotecnia digital", "gestión de redes sociales", "análisis de métricas web",
                     "redacción de contenidos", "optimización para buscadores"],
        nuevas=["automatización de mercadotecnia", "experimentación A/B a escala",
                "gestión de mercados en línea (marketplaces)",
                "gestión de comercio electrónico transfronterizo"],
        tareas=["Planear y ejecutar campañas en medios digitales",
                "Analizar el desempeño de las campañas",
                "Gestionar el calendario de contenidos",
                "Coordinar proveedores creativos"],
        tareas_nuevas=["Automatizar la generación de contenido con herramientas de IA",
                       "Operar catálogos en mercados en línea internacionales"],
    ),
    dict(
        familia="Inteligencia de negocios", perfil="transicion",
        titulos=["Analista de Business Intelligence", "Analista de Datos", "Desarrollador BI"],
        sinco=("2511", "Analistas de sistemas y de información", "2"),
        sectores=[("Servicios financieros", 3), ("Comercio al por menor", 3), ("Manufactura", 2),
                  ("Servicios de tecnologías de la información", 2)],
        modalidad=(0.35, 0.40, 0.25), salario=(18000, 45000), peso=(2.5, 3.4),
        confianza=(0.65, 0.90),
        habilidades=["consultas SQL", "visualización de datos", "uso de hojas de cálculo avanzadas",
                     "elaboración de reportes", "análisis de requerimientos"],
        nuevas=["analítica de producto digital", "integración de sistemas mediante API"],
        tareas=["Construir tableros e informes para las áreas de negocio",
                "Modelar y depurar fuentes de datos",
                "Levantar requerimientos de información"],
        tareas_nuevas=["Habilitar consultas en lenguaje natural sobre los tableros"],
    ),
    dict(
        familia="Automatización de procesos", perfil="transicion",
        titulos=["Especialista en RPA", "Analista de Automatización de Procesos",
                 "Desarrollador de Automatizaciones"],
        sinco=("2511", "Analistas de sistemas y de información", "2"),
        sectores=[("Servicios financieros", 3), ("Servicios profesionales", 3), ("Manufactura", 2),
                  ("Sector público", 1)],
        modalidad=(0.40, 0.40, 0.20), salario=(20000, 50000), peso=(1.0, 2.6),
        confianza=(0.45, 0.75),
        habilidades=["automatización de procesos", "análisis de requerimientos", "programación en Python",
                     "elaboración de reportes"],
        nuevas=["automatización robótica de procesos (RPA)", "integración de sistemas mediante API",
                "diseño de flujos con agentes de IA"],
        tareas=["Documentar y rediseñar procesos administrativos",
                "Construir y mantener robots de software",
                "Medir los ahorros generados por la automatización"],
        tareas_nuevas=["Incorporar agentes de IA en procesos con pasos no estructurados"],
    ),
    # ---------------- consolidadas ----------------
    dict(
        familia="Contabilidad", perfil="consolidada",
        titulos=["Contador General", "Auxiliar Contable", "Contador de Costos", "Analista Contable"],
        sinco=("2411", "Contadores y auditores", "2"),
        sectores=[("Servicios profesionales", 4), ("Manufactura", 3), ("Comercio al por menor", 2),
                  ("Construcción", 1)],
        modalidad=(0.10, 0.25, 0.65), salario=(12000, 32000), peso=(7.0, 6.4),
        confianza=(0.86, 0.98),
        habilidades=["contabilidad financiera", "elaboración de estados financieros",
                     "cumplimiento normativo", "uso de hojas de cálculo avanzadas"],
        nuevas=[],
        tareas=["Registrar operaciones contables y conciliaciones",
                "Preparar declaraciones fiscales",
                "Elaborar estados financieros mensuales",
                "Atender auditorías internas y externas"],
        tareas_nuevas=["Operar la facturación y los complementos digitales ante la autoridad fiscal",
                       "Conciliar información con sistemas contables en la nube"],
    ),
    dict(
        familia="Apoyo administrativo", perfil="consolidada",
        titulos=["Auxiliar Administrativo", "Asistente Administrativo", "Analista Administrativo"],
        sinco=("3111", "Auxiliares y asistentes administrativos", "3"),
        sectores=[("Servicios profesionales", 3), ("Sector público", 3), ("Manufactura", 2),
                  ("Salud", 2), ("Construcción", 1)],
        modalidad=(0.08, 0.20, 0.72), salario=(8000, 18000), peso=(9.0, 7.6),
        confianza=(0.88, 0.99),
        habilidades=["archivo y gestión documental", "captura de datos", "atención a clientes",
                     "uso de hojas de cálculo avanzadas", "comunicación efectiva"],
        nuevas=[],
        tareas=["Gestionar documentación y archivos de la oficina",
                "Atender llamadas y correspondencia",
                "Apoyar en la elaboración de reportes",
                "Controlar agendas y logística de reuniones"],
        tareas_nuevas=["Digitalizar expedientes y archivarlos en la nube",
                       "Atender solicitudes por chat y mensajería institucional"],
    ),
    dict(
        familia="Enfermería", perfil="consolidada",
        titulos=["Enfermera General", "Enfermero Titulado", "Auxiliar de Enfermería"],
        sinco=("2221", "Enfermeras profesionales", "2"),
        sectores=[("Salud", 9), ("Sector público", 2)],
        modalidad=(0.01, 0.03, 0.96), salario=(10000, 24000), peso=(5.0, 5.4),
        confianza=(0.90, 0.99),
        habilidades=["cuidados de enfermería", "administración de medicamentos", "toma de signos vitales",
                     "trabajo en equipo"],
        nuevas=[],
        tareas=["Brindar cuidados a pacientes hospitalizados",
                "Administrar medicamentos según indicación médica",
                "Registrar la evolución clínica de los pacientes",
                "Preparar material y equipo de curación"],
        tareas_nuevas=["Registrar la atención en el expediente clínico electrónico",
                       "Usar dispositivos de monitoreo conectados"],
    ),
    dict(
        familia="Ventas en piso", perfil="consolidada",
        titulos=["Vendedor de Piso", "Asesor de Ventas", "Promotor de Ventas"],
        sinco=("4221", "Vendedores y dependientes en establecimientos", "4"),
        sectores=[("Comercio al por menor", 8), ("Comercio electrónico", 1)],
        modalidad=(0.02, 0.05, 0.93), salario=(7000, 15000), peso=(8.0, 6.8),
        confianza=(0.88, 0.99),
        habilidades=["atención en punto de venta", "atención a clientes", "manejo de caja",
                     "comunicación efectiva"],
        nuevas=[],
        tareas=["Atender y asesorar a los clientes en el punto de venta",
                "Mantener el acomodo y la limpieza del área",
                "Realizar cortes de caja",
                "Apoyar en el control de inventario del piso"],
        tareas_nuevas=["Atender pedidos en línea para recolección en tienda",
                       "Consultar existencias en tiempo real desde una aplicación"],
    ),
    dict(
        familia="Transporte y reparto", perfil="consolidada",
        titulos=["Chofer Repartidor", "Operador de Camión", "Conductor de Reparto Local"],
        sinco=("8322", "Conductores de camiones y camionetas de carga", "8"),
        sectores=[("Transporte", 5), ("Comercio al por menor", 3), ("Comercio electrónico", 2)],
        modalidad=(0.00, 0.02, 0.98), salario=(9000, 20000), peso=(6.0, 6.6),
        confianza=(0.85, 0.98),
        habilidades=["conducción de vehículos de carga", "logística y distribución",
                     "atención a clientes", "manejo de montacargas"],
        nuevas=[],
        tareas=["Realizar entregas conforme a la ruta asignada",
                "Verificar la carga y la documentación de embarque",
                "Reportar incidencias durante el trayecto"],
        tareas_nuevas=["Operar aplicaciones de seguimiento de entregas en tiempo real",
                       "Comprobar entregas con evidencia fotográfica en la aplicación"],
    ),
    dict(
        familia="Soldadura", perfil="consolidada",
        titulos=["Soldador", "Soldador de Estructuras", "Soldador Industrial"],
        sinco=("7212", "Soldadores y oxicortadores", "7"),
        sectores=[("Manufactura", 5), ("Construcción", 4), ("Energía", 1)],
        modalidad=(0.00, 0.02, 0.98), salario=(10000, 24000), peso=(3.5, 3.4),
        confianza=(0.88, 0.99),
        habilidades=["soldadura MIG/MAG", "lectura de planos", "mantenimiento preventivo de maquinaria",
                     "trabajo en equipo"],
        nuevas=[],
        tareas=["Realizar uniones soldadas conforme a especificación",
                "Preparar y habilitar material",
                "Inspeccionar visualmente los cordones de soldadura"],
        tareas_nuevas=["Registrar el avance de obra en tableta o teléfono",
                       "Trabajar con procedimientos de soldadura certificados digitalmente"],
    ),
    dict(
        familia="Operación de máquinas herramienta", perfil="consolidada",
        titulos=["Operador de CNC", "Operador de Torno CNC", "Programador de Máquinas CNC"],
        sinco=("7223", "Operadores de máquinas herramienta", "7"),
        sectores=[("Manufactura", 8), ("Servicios profesionales", 1)],
        modalidad=(0.00, 0.02, 0.98), salario=(11000, 26000), peso=(3.0, 3.2),
        confianza=(0.85, 0.98),
        habilidades=["operación de máquinas herramienta CNC", "lectura de planos",
                     "mantenimiento preventivo de maquinaria", "elaboración de reportes"],
        nuevas=[],
        tareas=["Operar y ajustar máquinas de control numérico",
                "Verificar dimensiones con instrumentos de medición",
                "Registrar la producción por turno"],
        tareas_nuevas=["Cargar y depurar programas de maquinado generados por software CAM",
                       "Reportar la producción en el sistema de planta"],
    ),
    dict(
        familia="Recepción y atención al público", perfil="consolidada",
        titulos=["Recepcionista", "Anfitrión de Recepción", "Ejecutivo de Atención a Clientes"],
        sinco=("3221", "Recepcionistas y telefonistas", "3"),
        sectores=[("Servicios profesionales", 3), ("Salud", 3), ("Turismo y hospedaje", 3)],
        modalidad=(0.03, 0.07, 0.90), salario=(7500, 15000), peso=(4.0, 3.4),
        confianza=(0.88, 0.99),
        habilidades=["atención a clientes", "archivo y gestión documental", "comunicación efectiva",
                     "captura de datos"],
        nuevas=[],
        tareas=["Recibir y canalizar a visitantes y llamadas",
                "Registrar citas y controlar agendas",
                "Apoyar en tareas administrativas de la recepción"],
        tareas_nuevas=["Administrar la agenda desde plataformas en línea",
                       "Atender el primer contacto por canales digitales"],
    ),
    dict(
        familia="Docencia básica", perfil="consolidada",
        titulos=["Docente de Primaria", "Profesor de Educación Básica", "Maestro de Grupo"],
        sinco=("2341", "Profesores de educación primaria", "2"),
        sectores=[("Educación", 9), ("Sector público", 2)],
        modalidad=(0.05, 0.10, 0.85), salario=(9000, 20000), peso=(4.5, 4.2),
        confianza=(0.90, 0.99),
        habilidades=["planeación didáctica", "evaluación del aprendizaje", "comunicación efectiva",
                     "trabajo en equipo"],
        nuevas=["diseño instruccional para entornos digitales"],
        tareas=["Planear y conducir las sesiones de clase",
                "Evaluar el avance de los alumnos",
                "Comunicarse con madres, padres y tutores"],
        tareas_nuevas=["Preparar materiales y actividades para plataformas educativas en línea",
                       "Registrar evaluaciones en plataformas educativas"],
    ),
    dict(
        familia="Servicios de alimentos", perfil="consolidada",
        titulos=["Cocinero", "Auxiliar de Cocina", "Cocinero de Línea"],
        sinco=("5111", "Cocineros y preparadores de alimentos", "5"),
        sectores=[("Turismo y hospedaje", 5), ("Comercio al por menor", 3), ("Salud", 1)],
        modalidad=(0.00, 0.01, 0.99), salario=(8000, 18000), peso=(4.0, 3.8),
        confianza=(0.90, 0.99),
        habilidades=["preparación de alimentos", "manejo higiénico de alimentos", "trabajo en equipo",
                     "gestión de inventarios"],
        nuevas=[],
        tareas=["Preparar los alimentos conforme a recetas y estándares",
                "Cuidar la higiene y la inocuidad en la cocina",
                "Controlar insumos y mermas"],
        tareas_nuevas=["Preparar pedidos para plataformas de entrega a domicilio",
                       "Coordinar pedidos que llegan por varias aplicaciones"],
    ),
    dict(
        familia="Servicios bancarios de ventanilla", perfil="consolidada",
        titulos=["Cajero Bancario", "Ejecutivo de Ventanilla", "Promotor de Servicios Bancarios"],
        sinco=("3212", "Cajeros, taquilleros y receptores de pagos", "3"),
        sectores=[("Servicios financieros", 9)],
        modalidad=(0.00, 0.05, 0.95), salario=(9000, 17000), peso=(3.0, 2.2),
        confianza=(0.88, 0.99),
        habilidades=["manejo de caja", "atención a clientes", "cumplimiento normativo",
                     "captura de datos"],
        nuevas=[],
        tareas=["Realizar operaciones de depósito, retiro y pago de servicios",
                "Cuadrar la caja al cierre del día",
                "Promover productos financieros"],
        tareas_nuevas=["Orientar a clientes en el uso de la banca digital",
                       "Acompañar al cliente en el uso de la banca en línea"],
    ),
    dict(
        familia="Mecánica automotriz", perfil="consolidada",
        titulos=["Mecánico Automotriz", "Técnico de Servicio Automotriz", "Hojalatero y Pintor"],
        sinco=("7231", "Mecánicos y ajustadores de vehículos de motor", "7"),
        sectores=[("Transporte", 4), ("Comercio al por menor", 3), ("Manufactura", 2)],
        modalidad=(0.00, 0.02, 0.98), salario=(9000, 22000), peso=(3.5, 3.2),
        confianza=(0.88, 0.99),
        habilidades=["diagnóstico automotriz", "mantenimiento preventivo de maquinaria",
                     "lectura de planos", "atención a clientes"],
        nuevas=[],
        tareas=["Diagnosticar y reparar fallas mecánicas",
                "Realizar servicios de mantenimiento programado",
                "Explicar al cliente el trabajo realizado"],
        tareas_nuevas=["Usar equipos de diagnóstico electrónico conectados a plataformas del fabricante",
                       "Consultar boletines técnicos en línea del fabricante"],
    ),
]


# --------------------------------------------------------------------------------------
# 2b. Tareas comunes
#     Dos ocupaciones que caen en el mismo grupo unitario comparten parte de su trabajo.
#     Sin esto, ninguna familia compartiría tareas con otra y cualquier comparación entre
#     ellas mediría el diseño del generador, no el mercado.
# --------------------------------------------------------------------------------------

TAREAS_COMUNES_CODIGO = {
    "2151": ["Escribir y revisar código", "Documentar los desarrollos realizados",
             "Estimar tiempos de entrega con el equipo"],
    "2152": ["Vigilar la disponibilidad de los servicios",
             "Documentar la configuración de la infraestructura",
             "Atender guardias de soporte"],
    "2221": ["Registrar la información del paciente",
             "Comunicarse con el equipo médico tratante",
             "Explicar indicaciones al paciente y su familia"],
    "7231": ["Diagnosticar fallas en el vehículo", "Registrar el servicio realizado",
             "Solicitar refacciones al almacén"],
    "2511": ["Levantar requerimientos con las áreas usuarias",
             "Documentar los procesos del área", "Presentar resultados a los solicitantes"],
}

TAREAS_COMUNES_GG = {
    "1": ["Coordinar al personal a su cargo", "Dar seguimiento a indicadores del área",
          "Elaborar reportes para la dirección"],
    "2": ["Documentar el trabajo realizado", "Participar en reuniones de seguimiento",
          "Capacitar a personal de nuevo ingreso"],
    "3": ["Atender solicitudes internas", "Mantener actualizados los registros del área",
          "Elaborar reportes de actividades"],
    "4": ["Atender a los clientes", "Registrar las operaciones del día",
          "Mantener el orden del área de trabajo"],
    "5": ["Atender a los clientes", "Cumplir con los protocolos de higiene y seguridad",
          "Reportar incidencias al supervisor"],
    "7": ["Cumplir con las normas de seguridad en el trabajo",
          "Mantener herramienta y equipo en buen estado", "Reportar avances al supervisor"],
    "8": ["Cumplir con las normas de seguridad en el trabajo",
          "Llevar el registro de la operación", "Reportar incidencias al supervisor"],
}


def tareas_comunes(codigo, gran_grupo):
    return TAREAS_COMUNES_CODIGO.get(codigo) or TAREAS_COMUNES_GG.get(gran_grupo, [])


# --------------------------------------------------------------------------------------
# 3. ESCO: el corpus real clasifica al nivel de grupo S1–S8, así que todo se remapea ahí
# --------------------------------------------------------------------------------------

REMAPEO_S = {
    "estadística aplicada": "S2", "aprendizaje automático": "S5", "seguridad de la información": "S5",
    "cómputo en la nube": "S5", "mercadotecnia digital": "S1", "contabilidad financiera": "S2",
    "cumplimiento normativo": "S2", "logística y distribución": "S4",
    "manejo higiénico de alimentos": "S6", "generación aumentada por recuperación (RAG)": "S5",
    "gobernanza de datos para IA": "S2", "seguridad de cargas de trabajo en la nube": "S5",
    "gestión de comercio electrónico transfronterizo": "S4", "prevención de fraude digital": "S2",
    "identidad digital y biometría": "S5", "medición de huella de carbono": "S2",
    "economía circular aplicada": "S2", "trabajo en equipo": "S1", "comunicación efectiva": "S1",
    "resolución de problemas": "S2", "inglés de negocios": "S1", "pensamiento crítico": "S2",
    "adaptabilidad al cambio": "S1",
}

SUBGRUPOS_2D = {
    "13": "Coordinadores y jefes de área en producción, servicios y actividades administrativas",
    "21": "Profesionistas en ciencias exactas, ingeniería y tecnologías de la información",
    "22": "Profesionistas en ciencias de la salud",
    "23": "Profesionistas en educación",
    "24": "Profesionistas en ciencias económico-administrativas",
    "25": "Profesionistas en análisis de sistemas y de información",
    "26": "Profesionistas en ciencias sociales y humanidades",
    "27": "Profesionistas en artes, diseño y comunicación",
    "31": "Trabajadores auxiliares en actividades administrativas",
    "32": "Trabajadores de apoyo en atención al público y manejo de valores",
    "42": "Empleados de ventas en establecimientos",
    "51": "Trabajadores en la preparación y el servicio de alimentos",
    "72": "Trabajadores en la fabricación y el mantenimiento de productos metálicos y maquinaria",
    "74": "Trabajadores en instalaciones y mantenimiento eléctrico",
    "83": "Conductores de transporte terrestre",
}

# --------------------------------------------------------------------------------------
# 4. Contexto: plataformas anonimizadas, entidades, escolaridad, contratos
# --------------------------------------------------------------------------------------

PLATAFORMAS = [("Plataforma A", 30), ("Plataforma B", 24), ("Plataforma C", 20),
               ("Plataforma D", 15), ("Plataforma E", 11)]

ENTIDADES = [("Ciudad de México", 24), ("Nuevo León", 14), ("Jalisco", 11), ("México", 10),
             ("Querétaro", 6), ("Guanajuato", 5), ("Puebla", 4), ("Baja California", 4),
             ("Coahuila", 3), ("Chihuahua", 3), ("Yucatán", 3), ("Veracruz", 3),
             ("Sonora", 2), ("San Luis Potosí", 2), ("Aguascalientes", 2), ("Quintana Roo", 2),
             ("Sinaloa", 1), ("Michoacán", 1), ("Tamaulipas", 1), ("Morelos", 1), ("Otras", 3)]

ESCOLARIDAD_POR_GG = {
    "1": [("Licenciatura", 7), ("Maestría", 2), ("Bachillerato", 1)],
    "2": [("Licenciatura", 7), ("Maestría", 2), ("Técnico superior universitario", 1)],
    "3": [("Bachillerato", 5), ("Técnico superior universitario", 3), ("Licenciatura", 2)],
    "4": [("Bachillerato", 6), ("Secundaria", 3), ("Técnico superior universitario", 1)],
    "5": [("Secundaria", 5), ("Bachillerato", 4), ("Carrera técnica", 1)],
    "7": [("Carrera técnica", 5), ("Bachillerato", 3), ("Secundaria", 2)],
    "8": [("Secundaria", 6), ("Bachillerato", 3), ("Carrera técnica", 1)],
}

CONTRATOS = [("Tiempo completo", 78), ("Medio tiempo", 8), ("Por proyecto u obra determinada", 9),
             ("Por honorarios", 5)]

PRESTACIONES = ["prestaciones de ley", "prestaciones superiores a las de ley",
                "vales de despensa", "seguro de gastos médicos menores", "fondo de ahorro",
                "capacitación continua", "horario flexible"]


def elegir(pares):
    """Elige una opción de una lista [(valor, peso), ...]."""
    valores = [v for v, _ in pares]
    pesos = [p for _, p in pares]
    return random.choices(valores, weights=pesos, k=1)[0]


def meses_periodo(inicio, fin):
    a, m = inicio
    salida = []
    while (a, m) <= fin:
        salida.append((a, m))
        m += 1
        if m == 13:
            a, m = a + 1, 1
    return salida


def entropia_normalizada(pesos):
    total = sum(pesos)
    ps = [p / total for p in pesos if p > 0]
    if len(ps) <= 1:
        return 0.0
    h = -sum(p * math.log(p) for p in ps)
    return h / math.log(len(ps))


def recorta(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


# --------------------------------------------------------------------------------------
# 5. Generación
# --------------------------------------------------------------------------------------

MESES = meses_periodo(MES_INICIO, MES_FIN)
N_MESES = len(MESES)

# Curva de peso de cada familia ocupacional a lo largo del periodo (interpolación geométrica)
for occ in OCUPACIONES:
    w0, w1 = occ["peso"]
    occ["curva"] = [w0 * (w1 / w0) ** (i / (N_MESES - 1)) for i in range(N_MESES)]
    occ["dispersion"] = entropia_normalizada([p for _, p in occ["sectores"]])

# Volumen mensual total: crece ~1.1 % mensual con estacionalidad y ruido
def volumen_mes(i):
    base = 55 * (1.011 ** i)
    estacional = 1 + 0.14 * math.sin(2 * math.pi * ((MESES[i][1] - 1) / 12) - 0.9)
    return max(20, int(round(base * estacional * random.uniform(0.90, 1.10))))

volumenes = [volumen_mes(i) for i in range(N_MESES)]
factor = N_OBJETIVO / sum(volumenes)
volumenes = [max(15, int(round(v * factor))) for v in volumenes]


def crecimiento_reciente(occ, i):
    """Crecimiento interanual de la familia, llevado a escala 0–1."""
    j = max(0, i - 12)
    if occ["curva"][j] <= 0:
        return 0.5
    tasa = occ["curva"][i] / occ["curva"][j] - 1.0
    return recorta(math.log1p(max(tasa, -0.9)) / math.log(3.0))


def construir_habilidades(occ):
    """Muestra habilidades base y nuevas de la familia."""
    n_base = random.randint(3, min(5, len(occ["habilidades"])))
    elegidas = random.sample(occ["habilidades"], n_base)
    if occ["nuevas"]:
        n_nuevas = random.randint(1, min(3, len(occ["nuevas"])))
        # las habilidades nuevas se difunden con el tiempo, no aparecen desde el principio
        elegidas += random.sample(occ["nuevas"], n_nuevas)
    return elegidas


def salario_del_anuncio(occ, i, escolaridad, experiencia):
    lo, hi = occ["salario"]
    inflacion = 1.045 ** (i / 12)
    ajuste = 1.0 + 0.05 * experiencia / 5 + (0.08 if escolaridad in ("Maestría", "Doctorado") else 0.0)
    centro = random.uniform(lo, hi) * inflacion * ajuste
    ancho = random.uniform(0.10, 0.30)
    smin = int(round(centro * (1 - ancho / 2) / 500) * 500)
    smax = int(round(centro * (1 + ancho / 2) / 500) * 500)
    return smin, smax


def redactar_descripcion(occ, titulo, sector, entidad, tareas, habilidades, req, modalidad, salario):
    modalidad_txt = {"remoto": "esquema totalmente remoto",
                     "hibrido": "esquema híbrido",
                     "presencial": "trabajo presencial"}[modalidad]
    partes = [
        f"Empresa del sector {sector.lower()} solicita {titulo} para su operación en {entidad}.",
        "Responsabilidades: " + "; ".join(t.lower() for t in tareas[:4]) + ".",
        f"Requisitos: {req['escolaridad'].lower()} concluida, "
        f"{req['experiencia_anios']} años de experiencia en posiciones similares, "
        + ("inglés intermedio o avanzado, " if req["ingles"] else "")
        + "conocimientos en " + ", ".join(habilidades[:3]) + ".",
        f"Ofrecemos: {modalidad_txt}, "
        + (f"sueldo mensual de {salario[0]:,} a {salario[1]:,} pesos, " if salario else "sueldo competitivo, ")
        + ", ".join(random.sample(PRESTACIONES, 2)) + ".",
    ]
    return " ".join(partes).replace(",", ",")


registros = []
consecutivo = 0

for i, (anio, mes) in enumerate(MESES):
    pesos = [occ["curva"][i] for occ in OCUPACIONES]
    for _ in range(volumenes[i]):
        occ = random.choices(OCUPACIONES, weights=pesos, k=1)[0]
        consecutivo += 1

        dia = random.randint(1, 28)
        fecha = date(anio, mes, dia)

        titulo = random.choice(occ["titulos"])
        gg = occ["sinco"][2]
        sector = elegir(occ["sectores"])
        modalidad = random.choices(["remoto", "hibrido", "presencial"], weights=occ["modalidad"], k=1)[0]
        entidad = "Nacional (remoto)" if (modalidad == "remoto" and random.random() < 0.35) else elegir(ENTIDADES)

        escolaridad = elegir(ESCOLARIDAD_POR_GG.get(gg, ESCOLARIDAD_POR_GG["3"]))
        experiencia = random.choice([0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 8])
        ingles = random.random() < (0.62 if gg in ("1", "2") else 0.18)
        req = {"escolaridad": escolaridad, "experiencia_anios": experiencia, "ingles": ingles}

        declarado = random.random() < (0.72 if gg in ("3", "4", "5", "7", "8") else 0.55)
        salario = salario_del_anuncio(occ, i, escolaridad, experiencia) if declarado else None

        # tareas: mezcla de tareas establecidas y tareas nuevas
        n_base = random.randint(2, min(4, len(occ["tareas"])))
        tareas = random.sample(occ["tareas"], n_base)
        n_nuevas_t = 0
        if occ["tareas_nuevas"]:
            prob = {"emergente": 0.88, "transicion": 0.55, "consolidada": 0.22}[occ["perfil"]]
            # las tareas nuevas se difunden a lo largo del periodo
            prob *= 0.45 + 0.55 * (i / (N_MESES - 1))
            for t in occ["tareas_nuevas"]:
                if random.random() < prob:
                    tareas.append(t)
                    n_nuevas_t += 1
        comunes = tareas_comunes(occ["sinco"][0], gg)
        if comunes:
            tareas += random.sample(comunes, min(len(comunes), random.randint(1, 2)))
        random.shuffle(tareas)

        habilidades = construir_habilidades(occ)
        hab_detalle = []
        for h in habilidades:
            grupo, es_nueva, anio_ap = HABILIDADES[h]
            grupo = REMAPEO_S.get(h, grupo)
            hab_detalle.append({"id": "", "label": h, "grupo_esco": grupo,
                                "es_nueva": es_nueva, "anio_aparicion": anio_ap})

        confianza = round(random.uniform(*occ["confianza"]), 3)

        c_novedad_tareas = recorta(n_nuevas_t / max(len(tareas), 1) * 1.8)
        c_novedad_hab = recorta(sum(1 for h in hab_detalle if h["es_nueva"]) / len(hab_detalle) * 1.4)
        c_ajuste_sinco = recorta(1 - confianza)
        c_crecimiento = crecimiento_reciente(occ, i)
        c_dispersion = recorta(occ["dispersion"] + random.uniform(-0.05, 0.05))

        indice = (0.25 * c_novedad_tareas + 0.25 * c_novedad_hab + 0.20 * c_ajuste_sinco
                  + 0.20 * c_crecimiento + 0.10 * c_dispersion)
        indice = recorta(indice + random.uniform(-0.035, 0.035))

        codigo4 = occ["sinco"][0]
        registros.append({
            "id_oja": f"OJA-{anio}-{consecutivo:06d}",
            "fecha_publicacion": fecha.isoformat(),
            "anio": anio,
            "mes": f"{anio}-{mes:02d}",
            "plataforma": elegir(PLATAFORMAS),
            "titulo_anuncio": titulo,
            "familia_ocupacional": occ["familia"],
            "perfil_familia": occ["perfil"],
            "sector": sector,
            "entidad_federativa": entidad,
            "modalidad": modalidad,
            "tipo_contrato": elegir(CONTRATOS),
            "salario": ({"min_mxn": salario[0], "max_mxn": salario[1],
                         "periodicidad": "mensual", "declarado": True}
                        if salario else {"min_mxn": None, "max_mxn": None,
                                         "periodicidad": "mensual", "declarado": False}),
            "requisitos": req,
            "tareas": tareas,
            "habilidades_esco": hab_detalle,
            "sinco": {
                "codigo_2d": codigo4[:2],
                "nombre_2d": SUBGRUPOS_2D[codigo4[:2]],
                "codigo_4d": codigo4,
                "nombre_4d": occ["sinco"][1],
                "gran_grupo": gg,
                "nombre_gran_grupo": GRANDES_GRUPOS[gg],
                "confianza": confianza,
            },
            "indice_emergencia": {
                "valor": round(indice, 3),
                "componentes": {
                    "novedad_tareas": round(c_novedad_tareas, 3),
                    "novedad_habilidades": round(c_novedad_hab, 3),
                    "ajuste_sinco": round(c_ajuste_sinco, 3),
                    "crecimiento_reciente": round(c_crecimiento, 3),
                    "dispersion_sectorial": round(c_dispersion, 3),
                },
            },
            "descripcion_puesto": "",
        })
        registros[-1]["descripcion_puesto"] = redactar_descripcion(
            occ, titulo, sector, entidad, tareas, habilidades, req, modalidad, salario)

print(f"Generados {len(registros)} anuncios sintéticos entre {MESES[0]} y {MESES[-1]}.")

# --------------------------------------------------------------------------------------
# 6. Diccionarios: ESCO y SINCO
# --------------------------------------------------------------------------------------

usadas = sorted({h["label"] for r in registros for h in r["habilidades_esco"]})
esco = {}
contador_grupo = Counter()
for label in usadas:
    grupo, es_nueva, anio_ap = HABILIDADES[label]
    grupo = REMAPEO_S.get(label, grupo)
    contador_grupo[grupo] += 1
    esco[label] = {
        "id": f"ESCO-{grupo}-{contador_grupo[grupo]:03d}",
        "label": label,
        "grupo_esco": grupo,
        "nombre_grupo": GRUPOS_ESCO[grupo],
        "es_nueva": es_nueva,
        "anio_aparicion": anio_ap,
    }

for r in registros:
    for h in r["habilidades_esco"]:
        h["id"] = esco[h["label"]]["id"]
        h["nombre_grupo"] = esco[h["label"]]["nombre_grupo"]

# diccionario de tareas: hace falta saber cuáles son nuevas, y el corpus por sí solo
# no lo dice
tareas_dic = {}
for occ in OCUPACIONES:
    codigo, _, gg = occ["sinco"]
    grupos = [(occ["tareas"], False, "propia"), (occ["tareas_nuevas"], True, "propia"),
              (tareas_comunes(codigo, gg), False, "comun")]
    for lista, nueva, clase in grupos:
        for t in lista:
            d = tareas_dic.setdefault(t, {"texto": t, "es_nueva": nueva, "clase": clase,
                                          "familias": [], "codigos": []})
            d["es_nueva"] = d["es_nueva"] or nueva
            if clase == "comun":
                d["clase"] = "comun"
            if occ["familia"] not in d["familias"]:
                d["familias"].append(occ["familia"])
            if codigo not in d["codigos"]:
                d["codigos"].append(codigo)

catalogo = {}
for occ in OCUPACIONES:
    c4, n4, gg = occ["sinco"]
    catalogo.setdefault(gg, {"gran_grupo": gg, "nombre": GRANDES_GRUPOS[gg], "subgrupos": {}})
    sg = catalogo[gg]["subgrupos"].setdefault(
        c4[:2], {"codigo_2d": c4[:2], "nombre": SUBGRUPOS_2D[c4[:2]], "unitarios": {}})
    sg["unitarios"].setdefault(c4, {"codigo_4d": c4, "nombre": n4, "familias_oja": []})
    sg["unitarios"][c4]["familias_oja"].append(occ["familia"])

catalogo_lista = []
for gg in sorted(catalogo):
    g = catalogo[gg]
    catalogo_lista.append({
        "gran_grupo": g["gran_grupo"], "nombre": g["nombre"],
        "subgrupos": [{"codigo_2d": s["codigo_2d"], "nombre": s["nombre"],
                       "unitarios": sorted(s["unitarios"].values(), key=lambda u: u["codigo_4d"])}
                      for s in sorted(g["subgrupos"].values(), key=lambda s: s["codigo_2d"])],
    })

# --------------------------------------------------------------------------------------
# 7. Escritura de archivos
# --------------------------------------------------------------------------------------

DATA.mkdir(parents=True, exist_ok=True)
AGG.mkdir(parents=True, exist_ok=True)


def guardar_json(ruta, obj):
    ruta.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {ruta.relative_to(RAIZ)}  ({ruta.stat().st_size/1024:.0f} KB)")


print("\nArchivos:")

# 7.1 JSON Lines completo
with (DATA / "oja_sintetico.jsonl").open("w", encoding="utf-8") as f:
    for r in registros:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"  data/oja_sintetico.jsonl  ({(DATA/'oja_sintetico.jsonl').stat().st_size/1024:.0f} KB)")

# 7.2 CSV plano
COLUMNAS = ["id_oja", "fecha_publicacion", "anio", "mes", "plataforma", "titulo_anuncio",
            "familia_ocupacional", "perfil_familia", "sector", "entidad_federativa",
            "modalidad", "tipo_contrato", "salario_declarado", "salario_min_mxn", "salario_max_mxn",
            "escolaridad", "experiencia_anios", "ingles",
            "sinco_2d", "sinco_2d_nombre", "sinco_4d", "sinco_4d_nombre", "gran_grupo",
            "sinco_confianza", "n_tareas", "tareas",
            "n_habilidades", "habilidades", "habilidades_ids", "habilidades_grupos",
            "n_habilidades_nuevas", "indice_emergencia",
            "comp_novedad_tareas", "comp_novedad_habilidades", "comp_ajuste_sinco",
            "comp_crecimiento_reciente", "comp_dispersion_sectorial", "descripcion_puesto"]

with (DATA / "oja_sintetico.csv").open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=COLUMNAS)
    w.writeheader()
    for r in registros:
        w.writerow({
            "id_oja": r["id_oja"], "fecha_publicacion": r["fecha_publicacion"],
            "anio": r["anio"], "mes": r["mes"], "plataforma": r["plataforma"],
            "titulo_anuncio": r["titulo_anuncio"], "familia_ocupacional": r["familia_ocupacional"],
            "perfil_familia": r["perfil_familia"], "sector": r["sector"],
            "entidad_federativa": r["entidad_federativa"], "modalidad": r["modalidad"],
            "tipo_contrato": r["tipo_contrato"],
            "salario_declarado": int(r["salario"]["declarado"]),
            "salario_min_mxn": r["salario"]["min_mxn"], "salario_max_mxn": r["salario"]["max_mxn"],
            "escolaridad": r["requisitos"]["escolaridad"],
            "experiencia_anios": r["requisitos"]["experiencia_anios"],
            "ingles": int(r["requisitos"]["ingles"]),
            "sinco_2d": r["sinco"]["codigo_2d"], "sinco_2d_nombre": r["sinco"]["nombre_2d"],
            "sinco_4d": r["sinco"]["codigo_4d"], "sinco_4d_nombre": r["sinco"]["nombre_4d"],
            "gran_grupo": r["sinco"]["gran_grupo"], "sinco_confianza": r["sinco"]["confianza"],
            "n_tareas": len(r["tareas"]), "tareas": " | ".join(r["tareas"]),
            "n_habilidades": len(r["habilidades_esco"]),
            "habilidades": " | ".join(h["label"] for h in r["habilidades_esco"]),
            "habilidades_ids": " | ".join(h["id"] for h in r["habilidades_esco"]),
            "habilidades_grupos": " | ".join(h["grupo_esco"] for h in r["habilidades_esco"]),
            "n_habilidades_nuevas": sum(1 for h in r["habilidades_esco"] if h["es_nueva"]),
            "indice_emergencia": r["indice_emergencia"]["valor"],
            **{f"comp_{k}": v for k, v in r["indice_emergencia"]["componentes"].items()},
            "descripcion_puesto": r["descripcion_puesto"],
        })
print(f"  data/oja_sintetico.csv  ({(DATA/'oja_sintetico.csv').stat().st_size/1024:.0f} KB)")

# 7.3 Muestra para la web
muestra = random.sample(registros, 300)
muestra.sort(key=lambda r: r["fecha_publicacion"])
guardar_json(DATA / "oja_muestra.json", muestra)
guardar_json(DATA / "sinco_catalogo.json", catalogo_lista)
guardar_json(DATA / "esco_habilidades.json", sorted(esco.values(), key=lambda h: h["id"]))
guardar_json(DATA / "tareas_catalogo.json", sorted(tareas_dic.values(), key=lambda t: t["texto"]))

# --------------------------------------------------------------------------------------
# 8. Agregados para las visualizaciones
# --------------------------------------------------------------------------------------

def cuantiles(valores, cortes=(0.25, 0.5, 0.75), dec=0):
    v = sorted(valores)
    if not v:
        return {}
    def q(p):
        k = (len(v) - 1) * p
        lo, hi = math.floor(k), math.ceil(k)
        return v[lo] if lo == hi else v[lo] + (v[hi] - v[lo]) * (k - lo)
    return {f"p{int(c*100)}": (round(q(c)) if dec == 0 else round(q(c), dec)) for c in cortes}

# 8.1 serie mensual por perfil
serie = {}
for r in registros:
    d = serie.setdefault(r["mes"], {"mes": r["mes"], "total": 0,
                                    "emergente": 0, "transicion": 0, "consolidada": 0})
    d["total"] += 1
    d[r["perfil_familia"]] += 1
guardar_json(AGG / "serie_mensual.json", [serie[m] for m in sorted(serie)])

# 8.2 cobertura del catálogo: cuántos títulos distintos caen en cada código de 4 dígitos
cob = {}
for r in registros:
    c4 = r["sinco"]["codigo_4d"]
    d = cob.setdefault(c4, {"codigo_4d": c4, "nombre_4d": r["sinco"]["nombre_4d"],
                            "codigo_2d": r["sinco"]["codigo_2d"], "nombre_2d": r["sinco"]["nombre_2d"],
                            "gran_grupo": r["sinco"]["gran_grupo"],
                            "n_anuncios": 0, "titulos": Counter(), "familias": Counter(),
                            "indices": []})
    d["n_anuncios"] += 1
    d["titulos"][r["titulo_anuncio"]] += 1
    d["familias"][r["familia_ocupacional"]] += 1
    d["indices"].append(r["indice_emergencia"]["valor"])

cobertura = []
for c4, d in sorted(cob.items()):
    cobertura.append({
        "codigo_4d": c4, "nombre_4d": d["nombre_4d"],
        "codigo_2d": d["codigo_2d"], "nombre_2d": d["nombre_2d"], "gran_grupo": d["gran_grupo"],
        "n_anuncios": d["n_anuncios"],
        "n_titulos_distintos": len(d["titulos"]),
        "n_familias_distintas": len(d["familias"]),
        "familias": [{"familia": f, "n": n} for f, n in d["familias"].most_common()],
        "titulos_top": [{"titulo": t, "n": n} for t, n in d["titulos"].most_common(8)],
        "indice_emergencia_promedio": round(sum(d["indices"]) / len(d["indices"]), 3),
        "indice_emergencia_max": round(max(d["indices"]), 3),
    })
guardar_json(AGG / "cobertura_sinco.json", cobertura)

# 8.3 modalidad por gran grupo y por familia
mod_gg, mod_fam = {}, {}
for r in registros:
    for destino, clave, extra in ((mod_gg, r["sinco"]["gran_grupo"], r["sinco"]["nombre_gran_grupo"]),
                                  (mod_fam, r["familia_ocupacional"], r["perfil_familia"])):
        d = destino.setdefault(clave, {"clave": clave, "etiqueta": extra,
                                       "remoto": 0, "hibrido": 0, "presencial": 0, "total": 0})
        d[r["modalidad"]] += 1
        d["total"] += 1
guardar_json(AGG / "modalidad.json", {
    "por_gran_grupo": [mod_gg[k] for k in sorted(mod_gg)],
    "por_familia": sorted(mod_fam.values(), key=lambda d: -d["total"]),
})

# 8.4 salarios por familia (sólo anuncios con salario declarado)
sal = {}
for r in registros:
    if not r["salario"]["declarado"]:
        continue
    punto = (r["salario"]["min_mxn"] + r["salario"]["max_mxn"]) / 2
    d = sal.setdefault(r["familia_ocupacional"], {"familia": r["familia_ocupacional"],
                                                  "perfil": r["perfil_familia"], "valores": []})
    d["valores"].append(punto)
salarios = []
for d in sal.values():
    salarios.append({"familia": d["familia"], "perfil": d["perfil"], "n": len(d["valores"]),
                     **cuantiles(d["valores"]),
                     "min": round(min(d["valores"])), "max": round(max(d["valores"]))})
salarios.sort(key=lambda d: -d["p50"])
guardar_json(AGG / "salarios.json", {
    "por_familia": salarios,
    "declaracion": {"con_salario": sum(1 for r in registros if r["salario"]["declarado"]),
                    "sin_salario": sum(1 for r in registros if not r["salario"]["declarado"])},
})

# 8.5 habilidades
hab_cnt, hab_por_fam = Counter(), {}
for r in registros:
    for h in r["habilidades_esco"]:
        hab_cnt[h["label"]] += 1
        hab_por_fam.setdefault(r["familia_ocupacional"], Counter())[h["label"]] += 1
guardar_json(AGG / "habilidades.json", {
    "top": [{"label": l, "n": n, "grupo_esco": esco[l]["grupo_esco"],
             "nombre_grupo": esco[l]["nombre_grupo"], "es_nueva": esco[l]["es_nueva"],
             "anio_aparicion": esco[l]["anio_aparicion"]}
            for l, n in hab_cnt.most_common(40)],
    "por_familia": [{"familia": f,
                     "habilidades": [{"label": l, "n": n, "es_nueva": esco[l]["es_nueva"]}
                                     for l, n in c.most_common(10)]}
                    for f, c in sorted(hab_por_fam.items())],
    "por_grupo_esco": [{"grupo_esco": g, "nombre": GRUPOS_ESCO[g],
                        "n": sum(hab_cnt[l] for l in hab_cnt if esco[l]["grupo_esco"] == g)}
                       for g in sorted({h["grupo_esco"] for h in esco.values()})],
})

# 8.6 ranking de familias por índice de emergencia
fam = {}
for r in registros:
    d = fam.setdefault(r["familia_ocupacional"], {
        "familia": r["familia_ocupacional"], "perfil": r["perfil_familia"],
        "sinco_4d": r["sinco"]["codigo_4d"], "sinco_4d_nombre": r["sinco"]["nombre_4d"],
        "sinco_2d": r["sinco"]["codigo_2d"], "n": 0, "indices": [], "primer_mes": r["mes"],
        "ultimo_mes": r["mes"], "n_ultimo_anio": 0, "n_primer_anio": 0})
    d["n"] += 1
    d["indices"].append(r["indice_emergencia"]["valor"])
    d["primer_mes"] = min(d["primer_mes"], r["mes"])
    d["ultimo_mes"] = max(d["ultimo_mes"], r["mes"])
    if r["anio"] == MES_FIN[0]:
        d["n_ultimo_anio"] += 1
    if r["anio"] == MES_INICIO[0]:
        d["n_primer_anio"] += 1

ranking = []
for d in fam.values():
    ranking.append({
        "familia": d["familia"], "perfil": d["perfil"],
        "sinco_2d": d["sinco_2d"], "sinco_4d": d["sinco_4d"], "sinco_4d_nombre": d["sinco_4d_nombre"],
        "n_anuncios": d["n"],
        "indice_promedio": round(sum(d["indices"]) / len(d["indices"]), 3),
        "indice_p90": round(sorted(d["indices"])[int(0.9 * (len(d["indices"]) - 1))], 3),
        "n_primer_anio": d["n_primer_anio"], "n_ultimo_anio": d["n_ultimo_anio"],
    })
ranking.sort(key=lambda d: -d["indice_promedio"])
guardar_json(AGG / "ocupaciones_emergentes.json", ranking)

# 8.7 ejemplos para calibrar el umbral del índice (decil por decil)
por_indice = sorted(registros, key=lambda r: r["indice_emergencia"]["valor"])
ejemplos = []
for k in range(20):
    idx = min(len(por_indice) - 1, int(k / 19 * (len(por_indice) - 1)))
    r = por_indice[idx]
    ejemplos.append({
        "percentil": round(k / 19 * 100),
        "indice": r["indice_emergencia"]["valor"],
        "componentes": r["indice_emergencia"]["componentes"],
        "titulo_anuncio": r["titulo_anuncio"],
        "familia_ocupacional": r["familia_ocupacional"],
        "sinco_4d": r["sinco"]["codigo_4d"], "sinco_4d_nombre": r["sinco"]["nombre_4d"],
        "tareas": r["tareas"],
        "habilidades_nuevas": [h["label"] for h in r["habilidades_esco"] if h["es_nueva"]],
        "modalidad": r["modalidad"],
        "salario": r["salario"],
    })
valores = [r["indice_emergencia"]["valor"] for r in registros]
guardar_json(AGG / "ejemplos_indice.json", {
    "nota": ("El umbral para declarar una ocupación como emergente todavía NO está definido. "
             "Estos 20 anuncios recorren la distribución del índice para poder calibrarlo."),
    "distribucion": {
        "n": len(valores), "min": round(min(valores), 3), "max": round(max(valores), 3),
        "promedio": round(sum(valores) / len(valores), 3),
        **cuantiles(valores, (0.10, 0.25, 0.5, 0.75, 0.90, 0.95), dec=3),
        "histograma": [{"desde": round(b / 20, 2), "hasta": round((b + 1) / 20, 2),
                        "n": sum(1 for v in valores if b / 20 <= v < (b + 1) / 20)}
                       for b in range(20)],
    },
    "ejemplos": ejemplos,
})

print(f"\nÍndice de emergencia — promedio {sum(valores)/len(valores):.3f}, "
      f"mín {min(valores):.3f}, máx {max(valores):.3f}")
print("Umbral de 'emergente': PENDIENTE de definir (ver data/agg/ejemplos_indice.json)")
