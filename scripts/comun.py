"""Piezas compartidas por los guiones de preparación de datos."""

# familia ocupacional -> (ícono del Sistema Visual, título preferido para mostrar)
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
    "Ciberseguridad en la nube": ("candado", "Especialista en Ciberseguridad en la Nube"),
    "Curación y etiquetado de datos para IA": ("portapapeles", "Especialista en Curación de Datos"),
    "Coordinación de última milla": ("bicicleta", "Coordinador de Última Milla"),
    "Prevención de fraude digital": ("dinero", "Especialista en Prevención de Fraude"),
    "Ciencia de datos": ("linea-datos", "Científico de Datos"),
    "Diseño de experiencia de usuario": ("laptop-datos", "Diseñador UX/UI"),
    "Recepción y atención al público": ("telefono", "Recepcionista"),
    "Operación de máquinas herramienta": ("controles", "Operador de CNC"),
    "Servicios bancarios de ventanilla": ("porcentaje", "Cajero Bancario"),
}

ICONO_POR_DEFECTO = "persona"


def icono_de(familia):
    return ICONOS.get(familia, (ICONO_POR_DEFECTO, familia))[0]
