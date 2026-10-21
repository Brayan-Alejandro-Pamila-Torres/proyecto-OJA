/* ============================================================================
   Anclaje de scroll
   ----------------------------------------------------------------------------
   El problema que resuelve: en un trackpad, un golpe entrega entre 1 500 y
   4 000 px de inercia. Un beat mide 112vh —unos 1 010 px en una ventana de
   900—, así que un solo gesto puede llevarse dos, tres o cuatro beats por
   delante. Con una rueda de ratón, que entrega ~100 px por muesca, casi nunca
   pasa. De ahí que el problema lo vean los usuarios de laptop y no los de
   escritorio.

   Cómo lo resuelve: `scroll-snap-stop: always`. Esa propiedad le prohíbe al
   navegador **saltarse un punto de anclaje**, aunque venga con inercia. El
   gesto no se cancela ni se frena a la fuerza —eso sería secuestrar el scroll,
   que se siente peor—: simplemente se detiene en el siguiente beat.

   El tipo de anclaje es `proximity` y no `mandatory`: el lector todavía puede
   descansar entre dos beats si quiere, y la animación continua sigue
   respirando. Con `mandatory` la página se volvería una diapositiva por gesto.

   Dónde se ancla: NO en el borde del beat, sino en su **sitio de lectura**, que
   es donde el motor considera que la tarjeta está en su lugar y que no es el
   mismo para todas —las tarjetas al pie descansan más abajo—. Se consigue con
   `scroll-margin-top`, que corre el área de anclaje sin tocar la maquetación:
   insertar un elemento marcador habría obligado a posicionar el beat, y eso sí
   cambia el apilamiento respecto del lienzo pegajoso.

   En navegadores sin `scroll-snap-stop` la declaración se ignora y la página se
   comporta como antes. No hay nada que degradar.

   Se probó tras `?anclaje` antes de adoptarlo; quedó fijo el 11 de septiembre de
   2026. Para apagarlo de nuevo basta con quitar el bloque `.beat` de
   `scrolly.css`: sin puntos de anclaje, el `scroll-snap-type` no hace nada.
   ========================================================================= */

import { sitioDeBeat, alRedimensionar } from './scroll-engine.js';

export function montarAnclaje() {
  const beats = [...document.querySelectorAll('[data-escena] .beat')];
  if (!beats.length) return;

  function colocar() {
    for (const beat of beats) {
      const raiz = beat.closest('[data-raiz-scroll]');
      if (!raiz) continue;
      const sitio = sitioDeBeat(beat, raiz);
      const arriba = beat.getBoundingClientRect().top
        - raiz.getBoundingClientRect().top + raiz.scrollTop;
      // scroll-margin corre el área de anclaje; puede ser negativa
      beat.style.scrollMarginTop = `${Math.round(arriba - sitio)}px`;
    }
  }

  colocar();
  alRedimensionar(colocar);
}
