/* ============================================================================
   Modo referencia — para señalar sin ambigüedad
   Se enciende con `?ref` en la dirección, o con Alt+R en cualquier momento.
   Cada pieza con nombre aparece rotulada con el suyo, y abajo a la izquierda un
   indicador dice en qué sección y en qué beat estás, con un botón para copiar
   la referencia al portapapeles.

   Existe para una sola cosa: que una petición —«arregla la bandeja de R2»— no
   necesite ida y vuelta para saber de qué se habla. El vocabulario que usa es
   el de `guia/COMO-NOMBRAR-LAS-PARTES.md`; los dos tienen que decir lo mismo.

   REGLA: toda pieza nueva se registra aquí al nacer. Una parte sin nombre
   obliga a describirla entera cada vez que se habla de ella.

   Limitación conocida: los rótulos se dibujan con ::before, que no existe
   dentro de un SVG. Las piezas internas de una gráfica —una fila, un tramo, la
   marca fantasma— no se pueden rotular así; se nombra el lienzo que las
   contiene y ellas se citan por su texto.
   ========================================================================= */

/* Cada entrada: [selector, nombre, { todos }]
   Sin `todos`, se rotula sólo la primera aparición y el rótulo lleva «×n»: la
   idea es enseñar el nombre, no tapar la pantalla de etiquetas. */
const PIEZAS = [
  /* --- comunes ---------------------------------------------------------- */
  ['.lomo', 'cinta', { todos: true }],
  ['.progreso', 'barra de avance'],

  /* --- Introducción ------------------------------------------------------ */
  ['.portada', 'portada'],
  ['.scrolly__fijo', 'lienzo', { todos: true }],
  ['.tarjeta', 'tarjeta', { todos: true }],
  ['.prosa', 'párrafo de cierre'],
  ['.salida', 'salida'],
  ['[data-al-inicio]', 'regresar al inicio'],

  ['.apertura__pregunta', 'la pregunta'],
  ['.apertura__tablero', 'tablero'],
  ['.renglon', 'renglón'],
  ['.respuesta', 'respuesta'],
  ['.capa--tiempo', 'línea de tiempo'],
  ['.marco-cajon', 'cajón'],
  ['.remate', 'remate'],

  ['.columna__cabeza', 'columna', { todos: true }],
  ['.tarea', 'ficha de tarea'],
  ['.marco-nuevo', 'marco de lo nuevo'],

  ['.capa--lluvia', 'lluvia de ofertas'],
  ['.oferta', 'oferta'],
  ['.capa--extraccion', 'extracción'],
  ['.lente', 'lente'],
  ['.ocupaciones', 'muestrario de oficios'],
  ['.oficio', 'oficio'],
  ['.clave', 'clave'],

  ['.senales', 'señales'],
  ['.senal', 'señal'],
  ['.galeria', 'galería'],
  ['.galeria__marco', 'marco'],
  ['[data-galeria-ficha]', 'ficha'],
  ['.cortina', 'cortina'],

  /* --- Resultados --------------------------------------------------------
     Van marcadas con `zona: 'resultados'` porque esa sección se monta la
     primera vez que se abre: antes de eso sus selectores no corresponden a
     nada, y avisar de ellos sería dar una falsa alarma en cada carga. */
  ['.entrada', 'entrada', { todos: true, zona: 'resultados' }],
  ['.lienzo__pie', 'pie', { todos: true, zona: 'resultados' }],

  ['.acervo__cifra', 'cifra', { zona: 'resultados' }],
  ['.acervo__campo', 'campo de globos', { zona: 'resultados' }],
  ['.acervo__campo .globo', 'globo', { zona: 'resultados' }],

  ['.mapa__svg', 'mapa', { zona: 'resultados' }],
  ['.mapa__lluvia', 'lluvia', { zona: 'resultados' }],
  ['.marca-mapa', 'marca', { zona: 'resultados' }],
  ['.bandeja', 'bandeja', { zona: 'resultados' }],

  ['.tablero__selector', 'selector', { zona: 'resultados' }],
  ['.ent-ficha', 'abreviatura', { zona: 'resultados' }],
  ['.tablero__panel', 'panel', { zona: 'resultados' }],

  ['.explorador__lista', 'lista', { zona: 'resultados' }],
  ['.explorador__ficha', 'ficha', { zona: 'resultados' }],
  ['.filtros', 'filtros', { zona: 'resultados' }],

];

/** Resultados se monta al abrirse; hasta entonces no hay nada suyo que rotular.
    Se comprueba que el lienzo del primer módulo tenga contenido: los títulos de
    los módulos están en el HTML desde el principio y no sirven de señal. */
const zonaMontada = (zona) =>
  zona !== 'resultados' || (document.querySelector('[data-acervo]')?.childElementCount ?? 0) > 0;

/* clave corta de cada módulo de Resultados, para prefijar sus piezas */
const CLAVE_MODULO = {
  acervo: 'R1', reparto: 'R2', tablero: 'R3', explorador: 'R4',
};

let encendido = false;
let indicador = null;
let vigia = null;
let relojRotulado = 0;

export function montarModoReferencia() {
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      alternar();
    }
  });
  if (new URLSearchParams(location.search).has('ref')) {
    // se espera a que las secciones diferidas se hayan montado
    setTimeout(() => alternar(true), 400);
  }
}

function alternar(forzar) {
  encendido = forzar ?? !encendido;
  document.documentElement.classList.toggle('ref', encendido);
  if (encendido) {
    rotular();
    if (!indicador) indicador = crearIndicador();
    indicador.hidden = false;
    vigilar();
  } else {
    if (indicador) indicador.hidden = true;
    vigia?.disconnect();
    vigia = null;
  }
}

/**
 * Rehace el rotulado cuando aparece contenido nuevo: Resultados se monta al
 * abrirse por primera vez, y d3 redibuja al filtrar. Sin esto, la mitad de la
 * página se quedaría sin nombre justo cuando hace falta señalarla.
 * Se agrupa con un retardo porque una transición de d3 muta el DOM decenas de
 * veces seguidas y no tiene sentido rotular en cada una.
 */
function vigilar() {
  if (vigia) return;
  vigia = new MutationObserver(() => {
    clearTimeout(relojRotulado);
    relojRotulado = setTimeout(() => { if (encendido) rotular(); }, 300);
  });
  vigia.observe(document.body, { childList: true, subtree: true });
}

/* ---- rotulado ------------------------------------------------------------ */

/** El prefijo sale de dónde vive la pieza: «escena 3», «R2», o nada. */
function prefijo(el) {
  const escena = el.closest('[data-escena]');
  if (escena) {
    const todas = [...document.querySelectorAll('[data-escena]')];
    return `escena ${todas.indexOf(escena) + 1}`;
  }
  const modulo = el.closest('.modulo');
  if (modulo && CLAVE_MODULO[modulo.id]) return CLAVE_MODULO[modulo.id];
  return '';
}

function poner(el, texto) {
  el.dataset.ref = texto;
  // el rótulo se ancla al elemento; sin contexto de posicionamiento se iría a
  // parar al primer ancestro posicionado, que puede estar en otra pantalla.
  // `position: relative` no altera el flujo, así que es seguro añadirlo.
  if (getComputedStyle(el).position === 'static') el.classList.add('ref--anclado');
}

function rotular() {
  document.querySelectorAll('[data-ref]').forEach((el) => {
    delete el.dataset.ref;
    el.classList.remove('ref--anclado');
  });

  /* los beats se numeran solos: escena N · bM */
  document.querySelectorAll('[data-escena]').forEach((escena, i) => {
    escena.querySelectorAll('.beat').forEach((beat, j) => {
      poner(beat, `escena ${i + 1} · b${j}`);
    });
  });

  /* los módulos de Resultados llevan su clave y su título */
  document.querySelectorAll('.modulo').forEach((m) => {
    const clave = CLAVE_MODULO[m.id];
    const titulo = m.querySelector('.modulo__titulo')?.textContent.trim();
    if (clave) poner(m, `${clave} · ${titulo ?? m.id}`);
  });

  const huerfanos = [];
  for (const [sel, nombre, op = {}] of PIEZAS) {
    if (!zonaMontada(op.zona)) continue;
    const encontrados = [...document.querySelectorAll(sel)];
    if (!encontrados.length) { huerfanos.push(sel); continue; }
    if (op.todos) {
      encontrados.forEach((el) => poner(el, `${prefijo(el)} ${nombre}`.trim()));
    } else {
      // una sola etiqueta por escena o módulo, con el número de repeticiones
      const porZona = new Map();
      for (const el of encontrados) {
        const zona = el.closest('[data-escena]') || el.closest('.modulo') || document.body;
        if (!porZona.has(zona)) porZona.set(zona, []);
        porZona.get(zona).push(el);
      }
      for (const [, lista] of porZona) {
        const cuenta = lista.length > 1 ? ` ×${lista.length}` : '';
        poner(lista[0], `${prefijo(lista[0])} ${nombre}${cuenta}`.trim());
      }
    }
  }

  // se avisa en voz alta en vez de fallar en silencio: un selector que ya no
  // corresponde a nada significa que una pieza cambió de nombre y este registro
  // se quedó atrás
  if (huerfanos.length) {
    console.warn('[modo referencia] selectores sin correspondencia —quizá la pieza '
      + 'cambió de clase y hay que actualizar PIEZAS:', huerfanos);
  }
}

/* ---- indicador de posición ----------------------------------------------- */

function crearIndicador() {
  const caja = document.createElement('aside');
  caja.className = 'ref-hud';
  caja.innerHTML = `
    <p class="ref-hud__seccion" data-hud-seccion></p>
    <p class="ref-hud__donde" data-hud-donde>—</p>
    <p class="ref-hud__cita" data-hud-cita></p>
    <div class="ref-hud__pie">
      <button type="button" data-hud-copiar>Copiar referencia</button>
      <span class="ref-hud__tecla">Alt+R para apagar</span>
    </div>`;
  document.body.appendChild(caja);

  const elSeccion = caja.querySelector('[data-hud-seccion]');
  const elDonde = caja.querySelector('[data-hud-donde]');
  const elCita = caja.querySelector('[data-hud-cita]');
  const boton = caja.querySelector('[data-hud-copiar]');

  let referencia = '';
  let pendiente = 0;

  function calcular() {
    pendiente = 0;
    const seccion = document.querySelector('.seccion--activa');
    if (!seccion) return;
    const raiz = seccion.querySelector('[data-raiz-scroll]');
    elSeccion.textContent = seccion.dataset.seccion === 'intro'
      ? '00 · Introducción' : '01 · Resultados';

    const caja0 = raiz.getBoundingClientRect();
    const linea = caja0.top + raiz.clientHeight * 0.5;

    // el beat o el módulo que cruza la línea de lectura
    const candidatos = [...raiz.querySelectorAll('.beat, .modulo')];
    let actual = null;
    for (const c of candidatos) {
      const r = c.getBoundingClientRect();
      if (r.top <= linea && r.bottom > linea) actual = c;
    }

    if (!actual) {
      const portada = raiz.querySelector('.portada');
      const enPortada = portada && portada.getBoundingClientRect().bottom > linea;
      referencia = enPortada ? 'portada' : '';
      elDonde.textContent = referencia || '—';
      elCita.textContent = '';
      return;
    }

    referencia = actual.dataset.ref ?? '';
    elDonde.textContent = referencia || '—';
    const texto = actual.querySelector('h2, h3')?.textContent.trim()
      ?? actual.closest('.scrolly')?.querySelector('[data-lienzo] h2')?.textContent.trim();
    elCita.textContent = texto ? `«${recortar(texto)}»` : '';
  }

  const recortar = (t) => {
    const limpio = t.replace(/\s+/g, ' ');
    return limpio.length > 64 ? `${limpio.slice(0, 61)}…` : limpio;
  };

  const pedir = () => { if (!pendiente) pendiente = requestAnimationFrame(calcular); };
  document.querySelectorAll('[data-raiz-scroll]').forEach((r) =>
    r.addEventListener('scroll', pedir, { passive: true }));
  window.addEventListener('resize', pedir, { passive: true });
  document.querySelectorAll('[data-ir]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(pedir, 800)));

  boton.addEventListener('click', async () => {
    const cita = elCita.textContent ? ` — ${elCita.textContent}` : '';
    const texto = `${elSeccion.textContent} · ${referencia || '—'}${cita}`;
    try {
      await navigator.clipboard.writeText(texto);
      boton.textContent = 'Copiado';
    } catch {
      // sin permiso de portapapeles queda a la vista para copiar a mano
      boton.textContent = texto;
    }
    setTimeout(() => { boton.textContent = 'Copiar referencia'; }, 1800);
  });

  calcular();
  return caja;
}
