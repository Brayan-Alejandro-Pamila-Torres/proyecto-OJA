/* ============================================================================
   Motor de scroll — Viz_OJA
   Un solo bucle de requestAnimationFrame para toda la página. En cada cuadro
   primero se mide (lectura de layout) y después se escribe, para no provocar
   recálculos innecesarios. El avance se cuantiza antes de notificar, así que
   sólo se toca el DOM cuando el valor cambia de verdad.

   Funciona igual con el scroll de la ventana o con un contenedor propio
   (cada sección del "libro" tiene el suyo).
   ========================================================================= */

const mediaMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
export const movimientoReducido = () => mediaMovimiento.matches;

export const recorta01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---- viewport cacheado -------------------------------------------------- */

let vw = window.innerWidth;
let vh = window.innerHeight;
const suscriptoresResize = new Set();

export const viewport = () => ({ w: vw, h: vh });

export function alRedimensionar(fn) {
  suscriptoresResize.add(fn);
  return () => suscriptoresResize.delete(fn);
}

/* ---- bucle único -------------------------------------------------------- */

const pistas = new Set();
const coordinadores = new Set();
const raices = new Map(); // elemento (o window) -> nº de pistas que lo usan
let cuadroPendiente = 0;

/** Suaviza el paso de 0 a 1: sin esto la entrada de la tarjeta se siente mecánica. */
const suavizar = (t) => {
  const x = recorta01(t);
  return x * x * (3 - 2 * x);
};

function pedirCuadro() {
  if (!cuadroPendiente) cuadroPendiente = requestAnimationFrame(cuadro);
}

function cuadro() {
  cuadroPendiente = 0;

  // 1) medir todo de una sola vez
  for (const c of coordinadores) {
    if (!c.sitios) medirSitios(c);
    const s = c.raiz ? c.raiz.scrollTop : window.scrollY;
    c.distancias = c.sitios.map((sitio) => s - sitio);
  }

  const medidas = [];
  const cacheRaiz = new Map();
  for (const p of pistas) {
    let datosRaiz = cacheRaiz.get(p.raiz);
    if (!datosRaiz) {
      datosRaiz = p.raiz
        ? { top: p.raiz.getBoundingClientRect().top, alto: p.raiz.clientHeight }
        : { top: 0, alto: vh };
      cacheRaiz.set(p.raiz, datosRaiz);
    }
    const r = p.el.getBoundingClientRect();
    const relativo = r.top - datosRaiz.top;
    const alto = r.height || 1;
    const crudo =
      p.modo === 'salida'
        ? recorta01(-relativo / alto)
        : p.modo === 'travesia'
          ? recorta01((datosRaiz.alto - relativo) / (alto + datosRaiz.alto))
          : recorta01((datosRaiz.alto - relativo) / alto);
    const dentro = relativo < datosRaiz.alto && relativo + alto > 0;
    medidas.push([p, crudo, dentro]);
  }

  // 2) escribir
  for (const c of coordinadores) aplicarCoordinador(c);

  for (const [p, crudo, dentro] of medidas) {
    if (dentro !== p.dentro) {
      p.dentro = dentro;
      p.alEntrarSalir?.(dentro);
    }
    const q = Math.round(crudo * p.pasos) / p.pasos;
    if (q !== p.ultimo) {
      p.ultimo = q;
      p.alAvanzar(q, crudo);
    }
  }
}

function registrarRaiz(raiz) {
  const n = raices.get(raiz) || 0;
  raices.set(raiz, n + 1);
  if (n === 0) {
    (raiz || window).addEventListener('scroll', pedirCuadro, { passive: true });
  }
}

function liberarRaiz(raiz) {
  const n = (raices.get(raiz) || 1) - 1;
  if (n <= 0) {
    raices.delete(raiz);
    (raiz || window).removeEventListener('scroll', pedirCuadro);
  } else {
    raices.set(raiz, n);
  }
}

/**
 * Sigue el avance de un elemento dentro de su contenedor de scroll.
 *
 * modo:
 *   'recorrido' (por omisión) — 0 cuando el borde superior entra por abajo,
 *                               1 cuando el elemento termina de salir por arriba.
 *                               Es el modo de las escenas con contenido pegajoso.
 *   'salida'    — 0 mientras el elemento está arriba del todo, 1 cuando ya salió.
 *                 Sirve para portadas y elementos que arrancan en pantalla.
 *   'travesia'  — 0 al asomarse por abajo, 1 al desaparecer por arriba, contando
 *                 también el alto del contenedor. Útil para parallax largos.
 *
 * @param {Element} el
 * @param {{raiz?:Element|null, pasos?:number, modo?:string, alAvanzar:Function, alEntrarSalir?:Function}} opciones
 * @returns {Function} función para dejar de seguirlo
 */
export function seguir(el, { raiz = null, pasos = 200, modo = 'recorrido', alAvanzar, alEntrarSalir } = {}) {
  const pista = { el, raiz, pasos, modo, alAvanzar, alEntrarSalir, ultimo: -1, dentro: null };
  pistas.add(pista);
  registrarRaiz(raiz);
  pedirCuadro();
  return () => {
    pistas.delete(pista);
    liberarRaiz(raiz);
  };
}

/* ---- beats: la tarjeta aparece por cercanía, no por umbral -------------- */

/**
 * Calcula, para cada beat, la posición de scroll en la que su tarjeta queda en
 * su sitio, y cuánto espacio tiene hacia cada vecina. La envolvente de opacidad
 * se deriva de ese espacio: así dos tarjetas nunca se enciman ni queda un hueco,
 * aunque los beats tengan líneas de lectura distintas.
 */
/**
 * Dónde tiene que quedar el scroll para que un beat esté en su sitio de lectura.
 *
 * Es la única definición de ese punto en todo el proyecto, y tiene que seguir
 * siéndolo: el anclaje de scroll coloca sus puntos aquí mismo, y si cada uno lo
 * calculara por su cuenta el anclaje acabaría peleando con la animación.
 *
 * La línea de lectura no es la misma para todos: las tarjetas al pie descansan
 * más abajo que las centradas.
 */
export function sitioDeBeat(beat, raiz = null) {
  const alto = raiz ? raiz.clientHeight : vh;
  const topeRaiz = raiz ? raiz.getBoundingClientRect().top : 0;
  const scroll = raiz ? raiz.scrollTop : window.scrollY;
  const objetivo = beat.querySelector('.tarjeta') ?? beat;
  const r = objetivo.getBoundingClientRect();
  const centro = r.top + r.height / 2 - topeRaiz + scroll;
  return centro - alto * (beat.dataset.pos === 'pie' ? 0.78 : 0.5);
}

function medirSitios(c) {
  c.alto = c.raiz ? c.raiz.clientHeight : vh;
  c.sitios = c.beats.map((b) => sitioDeBeat(b, c.raiz));
  const alto = c.alto;

  const holgura = alto * 0.5; // para los extremos, que no tienen vecina
  c.limiteSube = c.sitios.map((sitio, i) =>
    (i > 0 ? (sitio - c.sitios[i - 1]) / 2 : holgura));
  c.limiteBaja = c.sitios.map((sitio, i) =>
    (i < c.sitios.length - 1 ? (c.sitios[i + 1] - sitio) / 2 : holgura));
}

function aplicarCoordinador(c) {
  const quieto = movimientoReducido();
  let mando = c.actual;
  let mayor = -1;

  c.distancias.forEach((d, i) => {
    const tarjeta = c.tarjetas[i];
    const limite = Math.max(1, d >= 0 ? c.limiteSube[i] : c.limiteBaja[i]);
    const plano = limite * c.plano;            // tramo a opacidad plena
    const vis = 1 - suavizar((Math.abs(d) - plano) / (limite - plano));

    if (vis > mayor) {
      mayor = vis;
      mando = i;
    }

    // aviso de «la tarjeta ya llegó a su sitio»: hay escenas cuya animación no
    // debe arrancar antes, y atarla a un retraso fijo depende de a qué velocidad
    // venga scrolleando el lector
    if (c.alAsentar) {
      if (!c.asentadas[i] && vis >= c.asiento) {
        c.asentadas[i] = true;
        c.alAsentar(i);
      } else if (c.asentadas[i] && vis < 0.45) {
        c.asentadas[i] = false;
      }
    }

    if (!tarjeta) return;

    const visRedondeada = Math.round(vis * 100) / 100;
    if (visRedondeada !== c.vistas[i]) {
      c.vistas[i] = visRedondeada;
      tarjeta.style.setProperty('--vis', visRedondeada);
      tarjeta.style.pointerEvents = visRedondeada > 0.6 ? 'auto' : 'none';
    }

    // la tarjeta se resiste un poco al scroll cerca de su sitio: acompaña el
    // movimiento en vez de quedarse clavada
    const deriva = quieto
      ? 0
      : Math.round(Math.max(-46, Math.min(46, -d * c.arrastre)) * 10) / 10;
    if (deriva !== c.derivas[i]) {
      c.derivas[i] = deriva;
      tarjeta.style.setProperty('--deriva', `${deriva}px`);
    }
  });

  if (mando !== c.actual && mayor > 0) {
    const previo = c.actual;
    c.actual = mando;
    for (let j = 0; j < c.beats.length; j++) {
      if (j === mando) c.beats[j].setAttribute('data-activo', 'si');
      else c.beats[j].removeAttribute('data-activo');
    }
    c.alCambiar(mando, previo);
  }
}

/* ---- beats: qué tarjeta manda ahora ------------------------------------- */

/**
 * Observa una lista de beats y avisa cuál está en la banda central.
 * @returns {Function} función para dejar de observar
 */
/**
 * Coordina una escena: decide qué beat manda y cómo entra y sale su tarjeta.
 *
 * La tarjeta no aparece al cruzar un umbral: su opacidad depende de qué tan
 * cerca está su beat de la línea de lectura, y se desplaza con el scroll. Como
 * los beats están separados más que el radio de desvanecido, nunca se ven dos.
 *
 * @param {Element[]} beats
 * @param {{raiz?:Element|null, alCambiar:Function, radio?:number, desvanecido?:number, arrastre?:number}} opciones
 * @returns {Function} función para dejar de coordinar
 */
export function observarBeats(beats, {
  raiz = null,
  alCambiar,
  plano = 0.55,     // fracción del espacio propio en la que va a opacidad plena
  arrastre = 0.055, // cuánto se resiste al scroll
  alAsentar = null, // se llama cuando la tarjeta de un beat llega a su sitio
  asiento = 0.9,    // qué tan visible tiene que estar para considerarla asentada
} = {}) {
  const coordinador = {
    beats,
    raiz,
    alCambiar,
    plano,
    arrastre,
    alAsentar,
    asiento,
    asentadas: beats.map(() => false),
    sitios: null,
    tarjetas: beats.map((b) => b.querySelector('.tarjeta')),
    vistas: beats.map(() => -1),
    derivas: beats.map(() => -1),
    distancias: beats.map(() => Infinity),
    alto: vh,
    actual: -1,
  };

  coordinadores.add(coordinador);
  const remedir = () => { coordinador.sitios = null; };
  const soltarResize = alRedimensionar(remedir);
  registrarRaiz(raiz);
  pedirCuadro();

  return () => {
    coordinadores.delete(coordinador);
    soltarResize();
    liberarRaiz(raiz);
  };
}

/* ---- una sola vez, al entrar en pantalla -------------------------------- */

export function alAparecer(el, fn, { raiz = null, margen = '0px 0px -15% 0px' } = {}) {
  const io = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { root: raiz, rootMargin: margen, threshold: 0 }
  );
  io.observe(el);
  return () => io.disconnect();
}

/* ---- arranque ----------------------------------------------------------- */

window.addEventListener(
  'resize',
  () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    suscriptoresResize.forEach((fn) => fn(vw, vh));
    for (const p of pistas) p.ultimo = -1; // fuerza recálculo
    pedirCuadro();
  },
  { passive: true }
);

mediaMovimiento.addEventListener('change', () => {
  document.documentElement.dataset.movimiento = movimientoReducido() ? 'reducido' : 'completo';
});
document.documentElement.dataset.movimiento = movimientoReducido() ? 'reducido' : 'completo';
