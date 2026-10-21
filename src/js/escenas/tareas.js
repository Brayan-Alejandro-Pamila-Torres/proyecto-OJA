/* ============================================================================
   Escena 2 — «La clasificación se basa en tareas»
   Toma las dos ocupaciones que comparten el renglón 2151 y las compara por lo
   que realmente hacen. Tres momentos: los dos nombres y sus tareas, lo poco que
   tienen en común frente a lo que es nuevo, y la separación de lo nuevo.
   ========================================================================= */

import { seguir, observarBeats, alAparecer, movimientoReducido } from '../scroll-engine.js';

let movil = false;
let ANCHO = 980;
let ALTO = 470;

const SPRITE = 'src/assets/iconos.svg';
// en pantallas grandes el tablero crece en vez de dejar hueco alrededor
const TOPE_ESCALA = 1.28;

// por beat: cuánto se corre el tablero para dejarle sitio a la tarjeta
// las tres tarjetas van a la derecha: las columnas se quedan con la izquierda
const DESPLAZO = { 0: [-175, 0], 1: [-175, 0], 2: [-120, 0] };


export async function montarTareas(raiz) {
  const escena = document.querySelector('[data-escena="tareas"]');
  if (!escena) return;

  const lienzo = escena.querySelector('[data-lienzo]');
  const escala = escena.querySelector('[data-escala]');
  const capaColumnas = escena.querySelector('[data-columnas]');
  const capaHilos = escena.querySelector('[data-hilos]');
  const beats = [...escena.querySelectorAll('.beat')];
  const envoltorio = escena.closest('[data-progreso]');
  const relleno = envoltorio?.querySelector('[data-progreso-relleno]');

  const datos = await fetch('data/tareas.json').then((r) => r.json());

  movil = window.innerWidth < 760;
  ANCHO = movil ? 348 : 980;
  ALTO = movil ? 400 : 500;
  escala.style.width = `${ANCHO}px`;
  escala.style.height = `${ALTO}px`;
  capaHilos.setAttribute('viewBox', `0 0 ${ANCHO} ${ALTO}`);

  const MAX = movil ? { propias: 4, comunes: 2 } : { propias: 5, comunes: 3 };

  const propias = (lado) => datos.tareas.filter((t) => t.lado === lado).slice(0, MAX.propias);
  const comunes = datos.tareas.filter((t) => t.lado === 'ambas').slice(0, MAX.comunes);

  // cada columna lleva sus tareas propias más las comunes: las comunes aparecen
  // en las dos, que es justamente lo que se quiere mostrar
  const columnas = [
    { lado: 'izquierda', info: datos.columnas.izquierda, tareas: [...propias('izquierda'), ...comunes] },
    { lado: 'derecha', info: datos.columnas.derecha, tareas: [...propias('derecha'), ...comunes] },
  ];

  /* ---- geometría --------------------------------------------------------- */

  const anchoFicha = movil ? 164 : 260;
  const xColumna = movil
    ? { izquierda: 6, derecha: 178 }
    : { izquierda: 170, derecha: 460 };
  const yCabeza = { izquierda: 0, derecha: 0 };

  /* ---- encabezados y fichas ---------------------------------------------- */

  let html = '';
  for (const col of columnas) {
    html += `<div class="columna__cabeza" data-lado="${col.lado}"
                  style="left:${xColumna[col.lado]}px; top:${yCabeza[col.lado]}px; width:${anchoFicha}px">
               <svg aria-hidden="true"><use href="${SPRITE}#i-${col.info.icono}"></use></svg>
               <div>
                 <div class="columna__titulo">${col.info.titulo}</div>
                 <div class="columna__dato">${col.info.n_anuncios.toLocaleString('es-MX')} anuncios</div>
               </div>
             </div>`;
  }

  const fichas = [];
  for (const col of columnas) {
    for (const t of col.tareas) {
      const i = fichas.length;
      fichas.push({ col: col.lado, datos: t });
      html += `<div class="tarea" data-i="${i}" data-lado="${col.lado}"
                    data-comun="${t.lado === 'ambas' ? 'si' : 'no'}"
                    data-nueva="${t.nueva ? 'si' : 'no'}" title="${t.texto}">
                 <span class="tarea__texto">${t.texto}</span>
               </div>`;
    }
  }

  html += `<div class="marco-nuevo" data-marco>
             <span class="marco-nuevo__etiqueta">Un trabajo que el catálogo no nombra</span>
           </div>`;

  capaColumnas.innerHTML = html;

  const elementos = [...capaColumnas.querySelectorAll('.tarea')];
  elementos.forEach((el, i) => (fichas[i].el = el));

  // medir primero, escribir después
  const altoCabeza = capaColumnas.querySelector('.columna__cabeza').offsetHeight + 14;
  for (const f of fichas) f.alto = f.el.offsetHeight;

  /* ---- posiciones -------------------------------------------------------- */

  const apilar = (lado) => {
    let y = yCabeza[lado] + altoCabeza;
    for (const f of fichas.filter((f) => f.col === lado)) {
      f.columna = { x: xColumna[lado], y };
      y += f.alto + 6;
    }
  };
  apilar('izquierda');
  apilar('derecha');

  // al separar lo nuevo, esas fichas se juntan al centro
  const nuevas = fichas.filter((f) => f.datos.nueva);
  const altoGrupo = nuevas.reduce((a, f) => a + f.alto + 6, -6);
  let yGrupo = (ALTO - altoGrupo) / 2;
  const xGrupo = (ANCHO - anchoFicha) / 2;
  for (const f of nuevas) {
    f.grupo = { x: xGrupo, y: yGrupo };
    yGrupo += f.alto + 6;
  }

  const marco = capaColumnas.querySelector('[data-marco]');
  Object.assign(marco.style, {
    left: `${xGrupo - 16}px`,
    top: `${(ALTO - altoGrupo) / 2 - 16}px`,
    width: `${anchoFicha + 32}px`,
    height: `${altoGrupo + 32}px`,
  });

  /* ---- hilos entre las tareas comunes ------------------------------------ */

  if (!movil) {
    const izq = fichas.filter((f) => f.col === 'izquierda' && f.datos.lado === 'ambas');
    const der = fichas.filter((f) => f.col === 'derecha' && f.datos.lado === 'ambas');
    capaHilos.innerHTML = izq
      .map((a, i) => {
        const b = der[i];
        if (!b) return '';
        const x1 = a.columna.x + anchoFicha;
        const y1 = a.columna.y + a.alto / 2;
        const x2 = b.columna.x;
        const y2 = b.columna.y + b.alto / 2;
        const m = (x1 + x2) / 2;
        return `<path class="hilo" d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}"/>`;
      })
      .join('');
  }

  /* ---- textos que dependen de los datos ---------------------------------- */

  const c = datos.conteo;
  const total = c.universo_izquierda + c.universo_derecha - c.universo_comunes;
  const nuevasIzq = fichas.filter((f) => f.col === 'izquierda' && f.datos.nueva).length;
  const nuevasDer = fichas.filter((f) => f.col === 'derecha' && f.datos.nueva).length;
  escena.querySelector('[data-titulo-comunes]').textContent =
    `De ${total} tareas, sólo ${c.universo_comunes} son comunes.`;
  escena.querySelector('[data-texto-comunes]').textContent =
    `Lo que comparten es la coordinación y la documentación de cualquiera que trabaje en el `
    + `mismo campo. Y ${nuevasDer} de las tareas de la derecha son nuevas: no existían hace `
    + `cinco años y ninguna cabe en la descripción oficial del renglón.`
    + (nuevasIzq
      ? ` Al trabajo de la izquierda también le ${nuevasIzq === 1 ? 'llegó una' : `llegaron ${nuevasIzq}`}: `
        + 'ninguna ocupación se queda quieta.'
      : '');

  /* ---- colocación por beat ----------------------------------------------- */

  // segundos tiempos: las tareas caen dentro del beat 0, lo nuevo se enciende
  // dentro del beat 1. Son estados del lienzo, no índices de beat.
  let tareasALaVista = false;
  let mostrarNuevas = false;
  let beatActual = 0;

  function colocar(beat) {
    beatActual = beat;
    lienzo.dataset.beat = String(beat);
    if (beat >= 1) tareasALaVista = true;
    lienzo.classList.toggle('tareas--nuevas', mostrarNuevas);
    const [dx, dy] = movil ? [0, 0] : (DESPLAZO[beat] ?? [0, 0]);
    escala.style.setProperty('--dx', `${dx}px`);
    escala.style.setProperty('--dy', `${dy}px`);

    fichas.forEach((f, i) => {
      const separado = beat >= 2 && f.datos.nueva;
      const destino = separado ? f.grupo : f.columna;
      f.el.style.setProperty('--x', `${destino.x}px`);
      f.el.style.setProperty('--y', `${destino.y}px`);
      f.el.style.setProperty('--dd', movimientoReducido() ? '0ms' : `${(i % 6) * 60}ms`);
      f.el.classList.toggle('tarea--visible', tareasALaVista);
    });
  }

  let relojSecuencia = [];
  /* Un golpe de trackpad puede llevarse varios beats por delante. Cuando el
     lector llega así, hacerle esperar el segundo tiempo de una escena que no vio
     empezar sólo le deja el lienzo a medio armar: se resuelve de inmediato.
     `alAsentar` corre ANTES que `alCambiar` en la misma pasada, así que el salto
     se registra al cambiar de beat y se consume cuando la tarjeta se asienta,
     una o dos pasadas después. */
  let salto = false;

  /* Beat 0: primero se lee el renglón compartido, después caen las tareas.
     Beat 1: primero se ven las comunes, después se enciende lo nuevo. */
  function secuenciar(beat, inmediato) {
    relojSecuencia.forEach(clearTimeout);
    relojSecuencia = [];
    const pausa = (ms) => (inmediato ? 0
      : movimientoReducido() ? Math.min(ms, 260) : ms);
    // el reloj comprueba en qué beat estamos: si el lector ya se fue, no hace nada
    const luego = (ms, fn) => relojSecuencia.push(setTimeout(() => {
      if (beatActual === beat) fn();
    }, pausa(ms)));
    if (beat === 0) {
      luego(620, () => { tareasALaVista = true; colocar(0); });
    } else if (beat === 1) {
      luego(1500, () => { mostrarNuevas = true; colocar(1); });
    }
  }

  colocar(0);
  observarBeats(beats, {
    raiz,
    alCambiar: (beat, previo) => {
      salto = previo >= 0 && Math.abs(beat - previo) > 1;
      if (beat === 0) tareasALaVista = false;
      if (beat < 1) mostrarNuevas = false;
      if (beat >= 2) mostrarNuevas = true;   // al bajar, lo nuevo ya venía encendido
      colocar(beat);
    },
    alAsentar: (i) => secuenciar(i, salto),
    asiento: 0.9,
  });
  alAparecer(escena, () => colocar(Number(lienzo.dataset.beat) || 0), { raiz });

  /* ---- escala y progreso -------------------------------------------------- */

  function ajustarEscala() {
    const caja = escena.querySelector('.scrolly__fijo').getBoundingClientRect();
    const margen = movil ? 16 : 40;
    const k = Math.min(TOPE_ESCALA, (caja.width - margen) / ANCHO, (caja.height - (movil ? 40 : 96)) / ALTO);
    escala.style.setProperty('--k', Math.max(0.4, k).toFixed(3));
  }
  ajustarEscala();
  window.addEventListener('resize', ajustarEscala, { passive: true });

  if (envoltorio && relleno) {
    seguir(envoltorio, {
      raiz,
      pasos: 400,
      alAvanzar: (p) => { relleno.style.transform = `scaleX(${p})`; },
      alEntrarSalir: (dentro) => envoltorio.classList.toggle('progreso--visible', dentro),
    });
  }
}
