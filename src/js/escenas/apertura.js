/* ============================================================================
   Escena de apertura — «¿En qué trabaja usted?»
   Seis momentos: la pregunta, las respuestas, el orden, el tiempo, la respuesta
   que no cabe y el renglón compartido.

   El tablero trabaja en un espacio fijo de 980 × 540 y se escala para caber.
   Cada respuesta guarda dos posiciones —dispersa y en su renglón— y sólo se
   escribe su transform cuando cambia el beat.
   ========================================================================= */

import { seguir, observarBeats, alAparecer, movimientoReducido } from '../scroll-engine.js';
import { conSemilla } from '../patron.js';

// el tablero cambia de traza según el ancho de pantalla
let movil = false;
let ANCHO = 980;
let ALTO = 540;
let X_RENGLONES = 500;     // dónde empieza la zona de fichas dentro de un renglón
let SANGRIA = 260;         // hueco a la izquierda, donde se para la tarjeta
let ALTO_RENGLON = 30;

// en pantallas angostas el catálogo se lee como lista, no como tabla
const CODIGOS_MOVIL = ['2151', '2152', '2221', '7231', '2411'];
/* Doce renglones en vez de dieciséis. La lista sigue leyéndose como larga, pero
   el tablero baja de alto, la escala sube y todo se ve más grande y más aireado.
   2151 tiene que estar: es el renglón del que trata el cierre. */
const CODIGOS_ESCRITORIO = ['2151', '2152', '2221', '2411', '2511',
                            '3111', '4221', '5111', '7231', '8322'];
const SPRITE = 'src/assets/iconos.svg';
// en pantallas grandes el tablero crece en vez de dejar hueco alrededor
const TOPE_ESCALA = 1.28;

/* El tablero ya no se corre en horizontal. Correrlo metía los renglones y las
   fichas bajo la cinta lateral, que es la que los cortaba. Ahora ocupa todo el
   ancho y la tarjeta se esquiva con una zona vetada. */
const DESPLAZO = {
  0: [0, 0],
  1: [0, -10],
  2: [0, -145],   // la tabla sube y la tarjeta se queda abajo, sin encimarse
  3: [0, -80],    // la línea de tiempo vive arriba, la tarjeta al pie
  4: [0, -125],  // los dos tiempos del cierre: la tarjeta va al pie
};

const svgUso = (icono) =>
  `<svg class="respuesta__icono" aria-hidden="true"><use href="${SPRITE}#i-${icono}"></use></svg>`;

export async function montarApertura(raiz) {
  const escena = document.querySelector('[data-escena="apertura"]');
  if (!escena) return;

  const lienzo = escena.querySelector('[data-lienzo]');
  const escala = escena.querySelector('[data-escala]');
  const capaRenglones = escena.querySelector('[data-renglones]');
  const capaRespuestas = escena.querySelector('[data-respuestas]');
  const capaTiempo = escena.querySelector('[data-tiempo]');
  const capaCierre = escena.querySelector('[data-cierre]');
  const beats = [...escena.querySelectorAll('.beat')];
  const envoltorio = escena.closest('[data-progreso]');
  const relleno = envoltorio?.querySelector('[data-progreso-relleno]');

  const datos = await fetch('data/apertura.json').then((r) => r.json());

  movil = window.innerWidth < 760;
  ANCHO = movil ? 348 : 980;
  ALTO = movil ? 430 : 534;
  X_RENGLONES = movil ? 14 : 495;
  SANGRIA = movil ? 0 : 290;
  escala.style.setProperty('--sangria', `${SANGRIA}px`);
  ALTO_RENGLON = movil ? 26 : 46;
  escala.style.width = `${ANCHO}px`;
  escala.style.height = `${ALTO}px`;
  lienzo.dataset.traza = movil ? 'lista' : 'tabla';

  const vivos = new Set(movil ? CODIGOS_MOVIL : CODIGOS_ESCRITORIO);
  datos.respuestas = datos.respuestas.filter((r) => vivos.has(r.codigo));
  datos.renglones = datos.renglones.filter((r) => vivos.has(r.codigo));

  /* ---- renglones -------------------------------------------------------- */

  const yDeRenglon = new Map();      // dónde empieza la zona de fichas de cada código
  const yEncabezado = new Map();

  let html = '';
  if (movil) {
    // lista: cada código es un encabezado y sus fichas van debajo
    const porCodigo = new Map();
    for (const r of datos.respuestas) porCodigo.set(r.codigo, (porCodigo.get(r.codigo) ?? 0) + 1);
    const extra = datos.respuestas.some((r) => r.sin_renglon) ? datos.cajon.codigo : null;

    let y = 6;
    for (const r of datos.renglones) {
      const n = (porCodigo.get(r.codigo) ?? 0) + (r.codigo === extra ? 0 : 0);
      yEncabezado.set(r.codigo, y);
      yDeRenglon.set(r.codigo, y + 19);
      html += `<div class="renglon renglon--lista" data-codigo="${r.codigo}" data-resaltado="no"
                    style="top:${y}px">
                 <span class="renglon__codigo">${r.codigo}</span>
                 <span class="renglon__nombre">${r.nombre}</span>
               </div>`;
      y += 19 + Math.max(1, n) * ALTO_RENGLON + 8;
    }
  } else {
    // la tabla se pega arriba y deja abajo una banda para la respuesta suelta
    const margenSuperior = 16;
    datos.renglones.forEach((r, i) => {
      const y = margenSuperior + i * ALTO_RENGLON;
      yDeRenglon.set(r.codigo, y);
      html += `<div class="renglon" data-codigo="${r.codigo}" data-resaltado="no"
                    style="top:${y}px">
                 <span class="renglon__codigo">${r.codigo}</span>
                 <span class="renglon__nombre">${r.nombre}</span>
               </div>`;
    });
  }
  capaRenglones.innerHTML = html;

  /* ---- respuestas ------------------------------------------------------- */

  capaRespuestas.innerHTML = datos.respuestas
    .map(
      (r, i) => `<div class="respuesta" data-i="${i}"
                      data-suelta="${r.sin_renglon ? 'si' : 'no'}">
                   ${svgUso(r.icono)}
                   <span class="respuesta__titulo">${r.titulo}</span>
                 </div>`
    )
    .join('');

  const fichas = [...capaRespuestas.querySelectorAll('.respuesta')].map((el, i) => ({
    el,
    datos: datos.respuestas[i],
    ancho: 0,
    disperso: { x: 0, y: 0 },
    fila: { x: 0, y: 0 },
  }));

  // se miden todas de una vez, después se escriben las posiciones
  for (const f of fichas) {
    f.ancho = f.el.offsetWidth;
    f.alto = f.el.offsetHeight;
  }

  /* Reparto disperso sin choques. La rejilla anterior repetía celda cuando había
     más fichas que huecos, y de ahí venían los recuadros encimados. Ahora cada
     ficha prueba posiciones al azar hasta encontrar una libre; si no la halla,
     se queda con la que menos invade. La zona de la derecha se deja libre porque
     ahí se para la tarjeta de este beat. */
  const rand = conSemilla(3141);
  const MARGEN = 12;
  const anchoUtil = ANCHO;
  /* Zona vetada: el rectángulo donde se para la tarjeta de este beat, a la
     derecha y a media altura. Todo lo demás —incluido lo que queda encima y
     debajo de ella— está disponible. */
  const veto = movil ? null : { x: 652, y: ALTO / 2 - 115, w: ANCHO - 652, h: 230 };
  const puestos = [];

  /* La respuesta que no encuentra renglón tiene sitio propio —en el centro del
     tablero, que es donde se ve— y se reserva antes de repartir el resto: si no,
     el algoritmo colocaba otra ficha justo ahí. Arriba del todo se perdía. */
  const suelta = fichas.find((f) => f.datos.sin_renglon);
  if (suelta) {
    // centrada en el espacio libre: a la derecha se para la tarjeta de este beat
    const libre = veto ? veto.x : anchoUtil;
    suelta.disperso = {
      x: Math.round((libre - suelta.ancho) / 2),
      y: Math.round((ALTO - suelta.alto) / 2),
    };
    /* Cuando aparece la tabla, la suelta se pasa a la banda de abajo: queda
       centrada, a la vista y —lo que importa— claramente fuera de la lista. */
    suelta.fuera = {
      x: Math.round((anchoUtil - suelta.ancho) / 2),
      y: ALTO - suelta.alto - 8,
    };
    suelta.fijo = true;
  }

  const invasion = (a, b) => {
    const dx = Math.min(a.x + a.w + MARGEN, b.x + b.w) - Math.max(a.x - MARGEN, b.x);
    const dy = Math.min(a.y + a.h + MARGEN, b.y + b.h) - Math.max(a.y - MARGEN, b.y);
    return dx > 0 && dy > 0 ? dx * dy : 0;
  };

  for (const f of fichas) {
    if (f.fijo) {
      puestos.push({ x: f.disperso.x, y: f.disperso.y, w: f.ancho, h: f.alto, fijo: true });
      continue;
    }
    const maxX = Math.max(0, anchoUtil - f.ancho);
    const maxY = Math.max(0, ALTO - f.alto - MARGEN);
    let mejor = { x: 0, y: 0 };
    let menorInvasion = Infinity;

    for (let intento = 0; intento < 500; intento++) {
      const cand = { x: rand() * maxX, y: MARGEN + rand() * maxY, w: f.ancho, h: f.alto };
      if (veto && invasion(cand, veto) > 0) continue;
      const total = puestos.reduce((suma, p) => suma + invasion(cand, p), 0);
      if (total === 0) { mejor = cand; menorInvasion = 0; break; }
      if (total < menorInvasion) { menorInvasion = total; mejor = cand; }
    }

    f.disperso = { x: Math.round(mejor.x), y: Math.round(mejor.y) };
    puestos.push({ x: mejor.x, y: mejor.y, w: f.ancho, h: f.alto });
  }

  /* Si tras los intentos aleatorios queda algún par encimado, se separan a
     empujones: unas cuantas pasadas bastan y el resultado sigue viéndose
     disperso, no alineado. */
  for (let pasada = 0; pasada < 80; pasada++) {
    let movio = false;
    for (let i = 0; i < puestos.length; i++) {
      for (let j = i + 1; j < puestos.length; j++) {
        const a = puestos[i];
        const b = puestos[j];
        const solapeX = Math.min(a.x + a.w + MARGEN, b.x + b.w) - Math.max(a.x - MARGEN, b.x);
        const solapeY = Math.min(a.y + a.h + MARGEN, b.y + b.h) - Math.max(a.y - MARGEN, b.y);
        if (solapeX <= 0 || solapeY <= 0) continue;
        movio = true;
        // se separan por el lado que menos cuesta; si una es fija, cede la otra
        const reparto = a.fijo || b.fijo ? 1 : 0.5;
        if (solapeX < solapeY) {
          const paso = solapeX * reparto + 1;
          const izquierda = a.x < b.x ? a : b;
          const derecha = a.x < b.x ? b : a;
          if (!izquierda.fijo) izquierda.x = Math.max(0, izquierda.x - paso);
          if (!derecha.fijo) derecha.x = Math.min(anchoUtil - derecha.w, derecha.x + paso);
        } else {
          const paso = solapeY * reparto + 1;
          const arriba = a.y < b.y ? a : b;
          const abajo = a.y < b.y ? b : a;
          if (!arriba.fijo) arriba.y = Math.max(MARGEN, arriba.y - paso);
          if (!abajo.fijo) abajo.y = Math.min(ALTO - abajo.h - MARGEN, abajo.y + paso);
        }
      }
    }
    if (!movio) break;
  }

  fichas.forEach((f, i) => {
    f.disperso = { x: Math.round(puestos[i].x), y: Math.round(puestos[i].y) };
  });

  // caen desordenadas, no por columnas ni de izquierda a derecha
  const orden = fichas.map((_, i) => i);
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  orden.forEach((indice, puesto) => {
    fichas[indice].retraso = puesto * 65;
    fichas[indice].giro = (rand() * 2 - 1) * 5;
  });
  for (const f of fichas) f.el.style.setProperty('--giro', `${f.giro.toFixed(1)}deg`);

  // posición en su renglón: las fichas del mismo código se acomodan en fila
  const ocupado = new Map();
  for (const f of fichas) {
    const cod = f.datos.codigo;
    if (movil) {
      // en lista, las fichas del mismo código se apilan bajo su encabezado
      const n = ocupado.get(cod) ?? 0;
      f.fila = { x: X_RENGLONES, y: (yDeRenglon.get(cod) ?? ALTO / 2) + n * ALTO_RENGLON };
      ocupado.set(cod, n + 1);
    } else {
      const x = ocupado.get(cod) ?? X_RENGLONES;
      f.fila = { x, y: (yDeRenglon.get(cod) ?? ALTO / 2) + 2 };
      ocupado.set(cod, x + f.ancho + 8);
    }
  }

  /* ---- capa de tiempo ---------------------------------------------------- */

  construirTiempo(capaTiempo, datos);

  /* ---- el remate: el renglón que recibe dos trabajos ---------------------
     Antes esto era un panel centrado que repetía las dos fichas y tapaba media
     tabla. Ahora el segundo tiempo ocurre sobre el propio renglón: la ficha
     suelta vuela hasta él —ese vuelo ya existía y el panel lo escondía—, se
     apaga todo lo demás y el tablero se acerca. El remate va junto al renglón,
     que es donde el lector tiene los ojos cuando la ficha aterriza. */

  const CODIGO_CAJON = datos.cajon.codigo;
  const fichasCajon = fichas.filter((f) => f.datos.codigo === CODIGO_CAJON);

  const marco = fichasCajon.length
    ? (() => {
        const holgura = 7;
        const x = Math.min(...fichasCajon.map((f) => f.fila.x)) - holgura;
        const y = Math.min(...fichasCajon.map((f) => f.fila.y)) - holgura;
        return {
          x,
          y,
          w: Math.max(...fichasCajon.map((f) => f.fila.x + f.ancho)) - x + holgura,
          h: Math.max(...fichasCajon.map((f) => f.fila.y + f.alto)) - y + holgura,
        };
      })()
    : null;

  if (marco) {
    const anchoTexto = movil ? ANCHO - 28 : 430;
    const xTexto = Math.max(movil ? 14 : 0, Math.min(marco.x, ANCHO - anchoTexto));
    capaCierre.innerHTML = `
      <div class="marco-cajon" style="left:${marco.x}px; top:${marco.y}px;
                                      width:${marco.w}px; height:${marco.h}px"></div>
      <div class="remate" style="left:${xTexto}px; top:${marco.y + marco.h + 18}px;
                                 width:${anchoTexto}px">
        <p class="remate__titulo">Dos trabajos, un solo renglón.</p>
        <p class="remate__texto"><b>${datos.cajon.codigo}</b> ${datos.cajon.nombre}. Se cuentan
          juntos: mismo salario promedio, misma proyección, mismas políticas.</p>
      </div>`;
  }

  /* Acercamiento al renglón: se compone con el ajuste de escala --k que ya
     existe, así que se calcula en coordenadas del tablero. */
  const acerque = marco
    ? (() => {
        const k = movil ? 1 : 1.3;
        const px = movil ? ANCHO / 2 : (SANGRIA + marco.x + marco.w) / 2;
        const py = marco.y + marco.h / 2;
        const bajada = movil ? -120 : -24;  // el renglón queda por encima de la tarjeta
        return {
          k,
          x: Math.round(-k * (px - ANCHO / 2)),
          y: Math.round(bajada - k * (py - ALTO / 2)),
        };
      })()
    : { k: 1, x: 0, y: 0 };

  /* ---- colocación por beat ---------------------------------------------- */

  let beatActual = -1;
  let enCajon = false;   // segundo tiempo del último beat: la ficha suelta se archiva

  function colocar(beat) {
    beatActual = beat;
    if (beat !== 4) enCajon = false;
    lienzo.dataset.beat = String(beat);
    lienzo.classList.toggle('apertura--cajon', enCajon);

    // el tablero se corre para dejarle sitio a la tarjeta de este beat
    const [dx, dy] = movil ? [0, 0] : (DESPLAZO[beat] ?? [0, 0]);
    escala.style.setProperty('--dx', `${dx}px`);
    escala.style.setProperty('--dy', `${dy}px`);
    escala.style.setProperty('--zk', enCajon ? acerque.k : 1);
    escala.style.setProperty('--zx', enCajon ? `${acerque.x}px` : '0px');
    escala.style.setProperty('--zy', enCajon ? `${acerque.y}px` : '0px');

    fichas.forEach((f, i) => {
      const enFila = beat >= 2 && (!f.datos.sin_renglon || enCajon);
      /* La suelta baja a la banda mientras se arma la tabla (beats 2 y 3); en el
         beat del cierre vuelve al centro libre, que es de donde tiene que verse
         salir volando hacia su renglón. */
      const destino = enFila
        ? f.fila
        : (f.fuera && beat >= 2 && beat <= 3 ? f.fuera : f.disperso);
      f.el.style.setProperty('--x', `${destino.x}px`);
      f.el.style.setProperty('--y', `${destino.y}px`);
      f.el.style.setProperty('--dd', movimientoReducido() ? '0ms' : `${f.retraso}ms`);
      f.el.classList.toggle('respuesta--visible', beat >= 1);
      f.el.dataset.enfoque = enCajon && f.datos.codigo === CODIGO_CAJON ? 'si' : 'no';
    });

    escena.querySelectorAll('.renglon').forEach((r) => {
      r.dataset.resaltado = enCajon && r.dataset.codigo === datos.cajon.codigo ? 'si' : 'no';
    });
  }

  /* Último beat en dos tiempos: primero se ve la ficha sin renglón latiendo
     sola, después se archiva en el renglón más parecido. */
  let relojCajon = null;
  /* Un golpe de trackpad puede llevarse varios beats por delante. Cuando el
     lector llega así, hacerle esperar el segundo tiempo de una escena que no vio
     empezar sólo le deja el lienzo a medio armar: se resuelve de inmediato.
     `alAsentar` corre ANTES que `alCambiar` en la misma pasada, así que el salto
     se registra al cambiar de beat y se consume cuando la tarjeta se asienta,
     una o dos pasadas después. */
  let salto = false;

  colocar(0);
  observarBeats(beats, {
    raiz,
    alCambiar: (beat, previo) => {
      salto = previo >= 0 && Math.abs(beat - previo) > 1;
      colocar(beat);
    },
    alAsentar: (i) => {
      clearTimeout(relojCajon);
      if (i !== 4) return;
      if (salto) { enCajon = true; colocar(4); return; }
      // el reloj comprueba el beat antes de actuar: si el lector ya siguió de
      // largo, el segundo tiempo no se dispara a destiempo
      relojCajon = setTimeout(() => {
        if (beatActual !== 4) return;
        enCajon = true;
        colocar(4);
      }, movimientoReducido() ? 320 : 1100);
    },
    asiento: 0.9,
  });
  alAparecer(escena, () => colocar(Math.max(0, beatActual)), { raiz });

  /* ---- escala del tablero y barra de progreso ---------------------------- */

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

/* ============================================================================
   Capa de tiempo: dos actualizaciones del catálogo contra el flujo continuo
   de anuncios. El flujo son los datos mensuales reales del corpus.
   ========================================================================= */

/* La línea del tiempo es del catálogo, y de nada más.
   Seis meses de anuncios no son una serie, así que aquí no se dibuja ninguna. Y
   el corpus tampoco aparece: este beat no trata de cómo se captan los anuncios,
   trata del desfase. Sólo dos cosas en el eje: cuándo se actualizó el catálogo
   —eso sí es una serie— y qué pasó en el mundo mientras tanto, con otra grafía
   para que no se lea como una medición nuestra. */
function construirTiempo(contenedor, datos) {
  const W = ANCHO;
  const H = ALTO;
  const yEje = movil ? H * 0.56 : H * 0.52;
  const x0 = movil ? 26 : 78;
  const x1 = W - (movil ? 18 : 78);
  const anioMin = 2009;
  const anioMax = 2027.5;
  const px = (a) => x0 + ((a - anioMin) / (anioMax - anioMin)) * (x1 - x0);

  const versiones = datos.actualizaciones_catalogo;
  const hitos = datos.hitos ?? [];
  const hoy = Number(datos.periodo_anuncios.hasta.slice(0, 4));

  /* ---- versiones del catálogo: marcas bajo el eje ---------------------- */

  const largoMarca = movil ? 16 : 22;
  const marcas = versiones
    .map((u) => {
      const x = px(u.anio);
      return `<g class="hito hito--catalogo">
                <line x1="${x}" y1="${yEje}" x2="${x}" y2="${yEje + largoMarca}"/>
                <text class="tiempo__anio" x="${x}" y="${yEje + largoMarca + 20}" text-anchor="middle">${u.anio}</text>
                <text class="tiempo__nota" x="${x}" y="${yEje + largoMarca + 36}" text-anchor="middle">${u.etiqueta}</text>
              </g>`;
    })
    .join('');

  /* ---- los huecos entre versiones, que son el argumento ---------------- */

  const yHueco = yEje + largoMarca + (movil ? 54 : 62);
  const tramos = [];
  for (let i = 1; i < versiones.length; i++) {
    tramos.push({ a: versiones[i - 1].anio, b: versiones[i].anio, texto: null });
  }
  const ultima = versiones.at(-1).anio;
  tramos.push({ a: ultima, b: hoy, texto: `${hoy - ultima} años sin una nueva versión`, viva: true });

  const huecos = tramos
    .map((t) => {
      const xa = px(t.a);
      const xb = px(t.b);
      const texto = t.texto ?? `${t.b - t.a} años`;
      return `<g class="hueco${t.viva ? ' hueco--vivo' : ''}">
                <path d="M${xa},${yHueco - 5}L${xa},${yHueco}L${xb},${yHueco}L${xb},${yHueco - 5}"/>
                <text x="${(xa + xb) / 2}" y="${yHueco + 17}" text-anchor="middle">${texto}</text>
              </g>`;
    })
    .join('');

  /* ---- acontecimientos del mundo: puntos sobre el eje ------------------ */

  const alturaHito = movil ? 40 : 58;
  const mundo = hitos
    .map((h, i) => {
      const x = px(h.anio);
      const alto = alturaHito + (i % 2) * (movil ? 22 : 30);
      const anchor = movil && i === hitos.length - 1 ? 'end' : 'middle';
      return `<g class="hito hito--mundo">
                <line x1="${x}" y1="${yEje}" x2="${x}" y2="${yEje - alto}"/>
                <circle cx="${x}" cy="${yEje - alto}" r="3.5"/>
                <text class="tiempo__anio" x="${x}" y="${yEje - alto - 20}" text-anchor="${anchor}">${h.anio}</text>
                <text class="tiempo__nota" x="${x}" y="${yEje - alto - 7}" text-anchor="${anchor}">${h.etiqueta}</text>
              </g>`;
    })
    .join('');

  contenedor.innerHTML = `
    <svg class="tiempo__svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <line class="tiempo__eje" x1="${x0}" y1="${yEje}" x2="${x1}" y2="${yEje}"/>
      ${marcas}
      ${huecos}
      ${mundo}
    </svg>`;
}
