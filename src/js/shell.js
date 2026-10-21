/* ============================================================================
   Shell — el "libro" de secciones con lomos laterales
   Cada sección ocupa el ancho completo menos los lomos de las demás. Al cambiar
   de sección el libro se desliza en horizontal y los lomos quedan a la vista,
   como pestañas verticales: siempre se ve dónde estás y qué falta.
   ========================================================================= */

import { alRedimensionar, viewport } from './scroll-engine.js';

const ANCHO_MOVIL = 900;

export function crearShell() {
  const libro = document.getElementById('libro');
  const secciones = [...libro.querySelectorAll('.seccion')];
  const botones = [...document.querySelectorAll('[data-ir]')];
  const nombres = secciones.map((s) => s.dataset.seccion);
  let activa = 0;
  let esMovil = false;

  // avisos para quien quiera montar una sección hasta que se abra por primera vez
  const alAbrirse = new Map();
  const yaAbiertas = new Set();

  function avisarApertura() {
    const nombre = nombres[activa];
    if (yaAbiertas.has(nombre)) return;
    yaAbiertas.add(nombre);
    alAbrirse.get(nombre)?.forEach((fn) => fn());
  }

  const anchoLomo = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lomo')) || 56;

  const duracionHoja = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-hoja')) || 720;

  let temporizadorHoja = 0;

  function acomodar(conTransicion = true, adelante = true) {
    const { w } = viewport();
    esMovil = w < ANCHO_MOVIL;
    libro.classList.toggle('libro--movil', esMovil);
    document.body.classList.toggle('es-movil', esMovil);

    const L = anchoLomo();
    const n = secciones.length;
    const anchoSeccion = esMovil ? w : w - (n - 1) * L;
    const antes = secciones.map((sec) => sec.style.getPropertyValue('--x'));

    secciones.forEach((sec, i) => {
      sec.classList.toggle('seccion--transicion', conTransicion);
      sec.classList.toggle('seccion--activa', i === activa);
      sec.classList.toggle('seccion--previa', i < activa);
      sec.classList.toggle('seccion--proxima', i > activa); 
      sec.style.setProperty('--z', String(i + 1));
      sec.style.setProperty('--ancho', `${anchoSeccion}px`);
      sec.style.setProperty('--sombra', i === 0 ? '0' : '1');
      sec.style.setProperty('--x', esMovil
        ? `${(i - activa) * w}px`
        : `${i <= activa ? i * L : w - (n - i) * L}px`);
      // El inert va en el cuerpo, no en la sección: la cinta vive dentro de la
      // sección y con inert arriba quedaba imposible de pulsar.
      const cuerpo = sec.querySelector('[data-raiz-scroll]');
      if (cuerpo) {
        cuerpo.inert = i !== activa;
        cuerpo.setAttribute('aria-hidden', String(i !== activa));
      }
      sec.removeAttribute('aria-hidden');
      sec.inert = false;

      const lomo = sec.querySelector('.lomo');
      if (lomo) {
        lomo.setAttribute('aria-current', String(i === activa));
        lomo.tabIndex = i === activa ? -1 : 0;
      }
    });

    botones.forEach((b) => {
      const esta = nombres.indexOf(b.dataset.ir) === activa;
      b.setAttribute('aria-current', esta ? 'true' : 'false');
    });

    if (conTransicion) empujarHojas(antes, adelante);
    avisarApertura();
  }

  /**
   * Las hojas que no cambian de sitio acusan el paso de la que sí, y regresan.
   * Es el detalle que separa un deslizamiento de panel de una hoja de libro.
   */
  function empujarHojas(antes, adelante) {
    clearTimeout(temporizadorHoja);
    libro.classList.add('libro--moviendo');

    secciones.forEach((sec, i) => {
      sec.classList.remove('seccion--empujada');
      if (sec.style.getPropertyValue('--x') !== antes[i]) return; // ésta sí viaja
      sec.style.setProperty('--empuje', adelante ? '-20px' : '18px');
      // reiniciar la animación: sin esto no vuelve a correr en el mismo elemento
      void sec.offsetWidth;
      sec.classList.add('seccion--empujada');
    });

    temporizadorHoja = setTimeout(() => {
      libro.classList.remove('libro--moviendo');
      secciones.forEach((sec) => sec.classList.remove('seccion--empujada'));
    }, duracionHoja() + 60);
  }

  function ir(nombre, { empujarHistorial = true } = {}) {
    const i = nombres.indexOf(nombre);
    if (i < 0 || i === activa) return;
    const adelante = i > activa;
    activa = i;
    acomodar(true, adelante);
    if (empujarHistorial) history.pushState({ seccion: nombre }, '', `#/${nombre}`);
    // el foco viaja a la sección para que el teclado siga la navegación
    const cuerpo = secciones[i].querySelector('[data-raiz-scroll]');
    cuerpo?.focus({ preventScroll: true });
  }

  botones.forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      ir(b.dataset.ir);
    })
  );

  window.addEventListener('popstate', () => {
    const nombre = location.hash.replace('#/', '') || nombres[0];
    if (nombres.includes(nombre)) {
      const destino = nombres.indexOf(nombre);
      const adelante = destino > activa;
      activa = destino;
      acomodar(true, adelante);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const paso = e.key === 'ArrowRight' ? 1 : -1;
      const destino = nombres[Math.min(nombres.length - 1, Math.max(0, activa + paso))];
      ir(destino);
    }
  });

  alRedimensionar(() => acomodar(false));

  const inicial = location.hash.replace('#/', '');
  if (nombres.includes(inicial)) activa = nombres.indexOf(inicial);
  acomodar(false);

  return {
    ir,
    raizDe: (nombre) =>
      secciones[nombres.indexOf(nombre)]?.querySelector('[data-raiz-scroll]') ?? null,
    /** Se llama la primera vez que esa sección queda activa. */
    alAbrir(nombre, fn) {
      if (yaAbiertas.has(nombre)) { fn(); return; }
      if (!alAbrirse.has(nombre)) alAbrirse.set(nombre, []);
      alAbrirse.get(nombre).push(fn);
    },
  };
}
