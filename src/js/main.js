/* ============================================================================
   Punto de entrada
   ========================================================================= */

import { crearShell } from './shell.js';
import { seguir, alAparecer, movimientoReducido } from './scroll-engine.js';
import { crearPatron } from './patron.js';
import { montarApertura } from './escenas/apertura.js';
import { montarTareas } from './escenas/tareas.js';
import { montarAnuncios } from './escenas/anuncios.js';
import { montarCasos } from './escenas/casos.js';
import { montarResultados } from './resultados.js';
import { montarModoReferencia } from './modo-referencia.js';
import { montarAnclaje } from './anclaje.js';

const shell = crearShell();
const raizIntro = shell.raizDe('intro');

/* ---- portada: la constante gráfica se dibuja al cargar y se aleja al bajar */
const portada = document.querySelector('.portada');
const contPatron = portada?.querySelector('[data-patron]');

if (contPatron) {
  crearPatron(contPatron, { lineas: 10, semilla: 1971 });
  requestAnimationFrame(() => contPatron.classList.add('patron--dibujado'));

  seguir(portada, {
    raiz: raizIntro,
    modo: 'salida',
    pasos: 120,
    alAvanzar: (p) => {
      portada.style.setProperty('--salida', p.toFixed(3));
    },
  });
}

/* ---- escena de apertura -------------------------------------------------- */
montarApertura(raizIntro);
montarTareas(raizIntro);
montarAnuncios(raizIntro);
montarCasos(raizIntro);

/* ---- Resultados se monta la primera vez que se abre, no al cargar ----------- */
const raizResultados = shell.raizDe('resultados');
shell.alAbrir('resultados', () => montarResultados(raizResultados));

/* ---- un dato real, para comprobar la carga de datos ---------------------- */
const conteo = document.querySelector('[data-conteo]');
if (conteo) {
  fetch('data/agg/serie_mensual.json')
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((serie) => {
      const total = serie.reduce((a, d) => a + d.total, 0);
      const desde = serie[0].mes;
      const hasta = serie.at(-1).mes;
      const fmt = (m) => {
        const [a, mm] = m.split('-');
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
          'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${meses[+mm - 1]} de ${a}`;
      };
      conteo.textContent =
        `${total.toLocaleString('es-MX')} anuncios analizados, de ${fmt(desde)} a ${fmt(hasta)}. ` +
        `Datos de prueba.`;
    })
    .catch(() => {
      conteo.textContent = 'Datos de prueba: 5 999 anuncios entre 2021 y 2026.';
    });
}

/* ---- la señal de salida aparece al llegar al final ----------------------- */
const salida = document.querySelector('[data-salida]');
if (salida) {
  alAparecer(salida, () => salida.classList.add('salida--visible'), { raiz: raizIntro });
}

/* ---- volver al principio de la sección ----------------------------------- */
/* Quien scrollea es el cuerpo de la sección, no la ventana, así que un ancla
   `#arriba` no serviría: hay que mover ese contenedor. Se respeta la preferencia
   de movimiento reducido, donde el salto es instantáneo. */
document.querySelectorAll('[data-al-inicio]').forEach((boton) => {
  boton.addEventListener('click', () => {
    const raiz = boton.closest('[data-raiz-scroll]');
    if (!raiz) return;
    raiz.scrollTo({ top: 0, behavior: movimientoReducido() ? 'auto' : 'smooth' });
  });
});

/* ---- modo referencia: `?ref` en la dirección, o Alt+R -------------------- */
/* Sirve para señalar sin ambigüedad: rotula cada pieza con su nombre y dice en
   qué beat estás. No pesa nada mientras está apagado. */
montarModoReferencia();

/* ---- anclaje de scroll --------------------------------------------------- */
/* Impide que un golpe de trackpad se salte varios beats. Coloca el punto de
   anclaje de cada beat en su sitio de lectura. */
montarAnclaje();

/* ---- revelado suave de bloques de prosa ---------------------------------- */
document.querySelectorAll('.prosa').forEach((bloque) => {
  const raiz = bloque.closest('[data-raiz-scroll]');
  alAparecer(bloque, () => bloque.classList.add('prosa--visible'), { raiz });
});
