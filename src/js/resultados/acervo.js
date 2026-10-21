/* ============================================================================
   R1 · Cuántos anuncios — el contador del acervo
   Doscientos globos, uno por cada mil anuncios.

   Aquí el movimiento va con el RELOJ, no con el scroll, al revés que en el
   resto de la página. La razón: este módulo abre la sección y ya está en
   pantalla cuando el lector llega, así que no hay recorrido que seguir —atarlo
   al scroll lo dejaría congelado en cero hasta que alguien empujara—. Arranca
   un segundo después de montarse, cuenta, y termina. No se rearma al volver:
   una cifra que vuelve a cero cada vez que pasas por delante distrae.

   ADVERTENCIA EDITORIAL: estas cifras son del acervo real y las declara el
   equipo del proyecto. Todo lo demás de la sección sale del corpus de prueba, y
   los dos universos no se pueden presentar como uno. El pie que lo decía aquí
   se retiró a petición del usuario: la distinción tiene que quedar dicha en el
   párrafo de entrada del módulo o en la nota metodológica. Está anotado en
   PLAN.md como pendiente abierto.
   ========================================================================= */

import { movimientoReducido, recorta01 } from '../scroll-engine.js';
import { svg } from '../figura-anuncio.js';

const POR_GLOBO = 1000;
const ESPERA = 1000;      // ms de calma antes de que empiece a contar
const CUENTA = 2600;      // ms que tarda en llegar a la cifra completa

/** Frena al final: los últimos miles se leen en lugar de pasar de golpe. */
const desacelerar = (t) => 1 - (1 - t) ** 3;

export function montarAcervo(caja, datos, raiz) {
  const { total } = datos.acervo;
  const n = Math.round(total / POR_GLOBO);

  /* Los doscientos globos son iguales. Antes los cinco últimos iban en un morado
     más hondo y se levantaban, para señalar lo que llegó esta semana; con la
     nota fuera, distinguirlos sólo dejaba una anomalía en la esquina sin nada
     que la explicara. El montón dice «cuántos»: una sola cosa, un solo tono. */
  const globos = Array.from({ length: n }, () =>
    `<span class="globo" data-on="no"
           >${svg('presencial', 17, { solido: true, color: 'currentColor' })}</span>`).join('');

  caja.innerHTML = `
    <p class="acervo__cifra"><span class="acervo__mas" aria-hidden="true">+</span
      ><span data-cifra>0</span></p>
    <p class="acervo__rotulo">anuncios de empleo recogidos hasta hoy</p>
    <div class="acervo__campo" data-campo>${globos}</div>`;

  const cifra = caja.querySelector('[data-cifra]');
  const campo = caja.querySelector('[data-campo]');
  const piezas = [...campo.children];

  let encendidos = 0;

  function pintar(avance) {
    const quiero = Math.round(avance * n);
    if (quiero === encendidos) return;
    const desde = Math.min(encendidos, quiero);
    const hasta = Math.max(encendidos, quiero);
    for (let i = desde; i < hasta; i++) piezas[i].dataset.on = i < quiero ? 'si' : 'no';
    encendidos = quiero;
    cifra.textContent = (quiero * POR_GLOBO).toLocaleString('es-MX');
  }

  function alFinal() {
    piezas.forEach((el) => { el.dataset.on = 'si'; });
    encendidos = n;
    cifra.textContent = total.toLocaleString('es-MX');
  }

  if (movimientoReducido()) { alFinal(); return; }

  // el reloj arranca al montarse el módulo, que es cuando se abre la sección
  setTimeout(() => {
    const t0 = performance.now();
    function cuadro(ahora) {
      const ms = ahora - t0;
      pintar(desacelerar(recorta01(ms / CUENTA)));
      if (ms < CUENTA) requestAnimationFrame(cuadro);
      else alFinal();
    }
    requestAnimationFrame(cuadro);
  }, ESPERA);
}
