/* ============================================================================
   Utilidades compartidas por los módulos de Resultados
   ========================================================================= */

import { viewport, alRedimensionar, recorta01 } from '../scroll-engine.js';

/**
 * La ventana útil de un módulo dentro del avance de `modo: 'travesia'`.
 *
 * `travesia` va de 0 —el elemento se asoma por abajo— a 1 —termina de salir por
 * arriba—, así que el tramo en el que el módulo está de verdad en pantalla es
 * sólo una parte del recorrido, y depende del alto del elemento y del de la
 * ventana. Si se anima sobre el avance crudo, la escena se completa antes de que
 * nadie la haya visto —que es justo lo que pasó la primera vez—.
 *
 * Devuelve una función `(p) => 0..1` que reencuadra el avance entre el momento
 * en que el borde superior entra por el 85 % de la altura y aquel en que el
 * borde inferior llega al 70 %. Se recalcula al redimensionar.
 */
export function ventana(el, { entra = 0.85, sale = 0.70 } = {}) {
  let desde = 0;
  let hasta = 1;

  function medir() {
    const { h } = viewport();
    const a = el.getBoundingClientRect().height || h;
    desde = ((1 - entra) * h) / (a + h);
    hasta = (sale * h + a) / (a + h);
    if (hasta - desde < 0.08) hasta = desde + 0.08;   // módulos muy altos
  }

  medir();
  alRedimensionar(medir);
  return (p) => recorta01((p - desde) / (hasta - desde));
}

/** Un tramo dentro de otro: 0 antes de `a`, 1 después de `b`. */
export const tramo = (v, a, b) => recorta01((v - a) / (b - a));
