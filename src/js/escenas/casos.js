/* ============================================================================
   Escena 4 — «Ocupaciones que apenas nombramos»
   Cierra la introducción con lo que los anuncios permiten ver: tres ocupaciones
   que puntúan alto en el índice, de mundos que no se parecen, presentadas como
   la entrada de catálogo que todavía no tienen.

   El peso está en su descripción de puesto —qué tareas y qué saberes pide— y en
   por qué el índice las señala. El sueldo va como un dato más: no forma parte
   del índice, así que no puede ser el argumento.
   ========================================================================= */

import { seguir, observarBeats, alAparecer, recorta01, movimientoReducido } from '../scroll-engine.js';

let movil = false;
let ANCHO = 980;
let ALTO = 430;

const SPRITE = 'src/assets/iconos.svg';
// en pantallas grandes el tablero crece en vez de dejar hueco alrededor
const TOPE_ESCALA = 1.28;
const ETIQUETA_CORTA = {
  novedad_tareas: 'tareas nuevas',
  novedad_habilidades: 'saberes nuevos',
  ajuste_sinco: 'no encaja',
  crecimiento_reciente: 'no es aislada',
  dispersion_sectorial: 'muchos sectores',
};
// en pantalla angosta el perfil va en fila: las etiquetas se abrevian a una palabra
const ETIQUETA_MOVIL = {
  novedad_tareas: 'tareas',
  novedad_habilidades: 'saberes',
  ajuste_sinco: 'encaje',
  crecimiento_reciente: 'volumen',
  dispersion_sectorial: 'sectores',
};
const pesos = (n) => n.toLocaleString('es-MX');
// el beat 0 ya no lleva tarjeta, así que su bloque puede ir centrado
const DESPLAZO_Y = { 0: 0, 1: 0 };   // ningún beat lleva tarjeta: los dos van centrados

/* El cierre no llega de fuera de la página: la página se detiene y lo enmarca.
   Con `modo: 'travesia'`, el avance vale 0.5 justo cuando el beat llega a su
   línea de lectura, así que el marco se termina de trazar en el momento en que
   el lector llega. `desde`/`hasta` son ese tramo, y se calibran aquí. */
/* El cierre ocupaba 0.16 de la travesía del beat —unos 305 px de scroll— y la
   cortina sólo 0.28 de eso: 85 px. Con un trackpad, un instante; por eso la
   llegada se sentía «de repente». Ahora ocupa 0.52 de la travesía, cerca de
   1 000 px, y la cortina sola unos 420. El comienzo se quedó donde estaba —la
   cortina no debe empezar a tapar las señales antes de que se lean—: lo que se
   alargó es el final. */
const CIERRE = { desde: 0.34, hasta: 0.86 };

/* Las cinco señales también van atadas al scroll: `desde`/`hasta` es el tramo de
   travesía del beat en el que entran, `paso` lo que se separan entre sí y
   `ventana` lo que tarda cada una en completarse. */
const SENALES = { desde: 0.26, hasta: 0.62, paso: 0.16, ventana: 0.34 };

export async function montarCasos(raiz) {
  const escena = document.querySelector('[data-escena="casos"]');
  if (!escena) return;

  const lienzo = escena.querySelector('[data-lienzo]');
  const escala = escena.querySelector('[data-escala]');
  const beats = [...escena.querySelectorAll('.beat')];
  const envoltorio = escena.closest('[data-progreso]');
  const relleno = envoltorio?.querySelector('[data-progreso-relleno]');

  const datos = await fetch('data/casos.json').then((r) => r.json());

  movil = window.innerWidth < 760;
  ANCHO = movil ? 348 : 980;
  ALTO = movil ? 560 : 720;   // las señales y la ficha del cierre piden altura
  escala.style.width = `${ANCHO}px`;
  escala.style.height = `${ALTO}px`;

  const nTareas = movil ? 2 : 3;
  const nSaberes = movil ? 3 : 4;

  /* ---- beat 0: las cinco señales ----------------------------------------- */

  // en dos columnas, dos ejemplos por señal caben sin que nada se parta
  const nEjemplos = movil ? 1 : 2;

  escena.querySelector('[data-senales]').innerHTML = `
    <div class="senales" data-bloque-senales>
      <h2 class="senales__pregunta">¿Cómo se reconoce una ocupación que apenas está naciendo?</h2>
      <p class="senales__bajada">No por su nombre. Por cinco señales que se pueden leer en los
        anuncios, y que juntas forman un índice.</p>
      <ol class="senales__lista">
        ${datos.senales
          .map((s, i) => {
            const ejs = (s.ejemplos ?? [s.ejemplo]).slice(0, nEjemplos);
            return `<li class="senal" style="--i:${i}">
                      <span class="senal__n">${i + 1}</span>
                      <div class="senal__cuerpo">
                        <p class="senal__txt">${s.nombre}</p>
                        <ul class="senal__ejemplos">
                          ${ejs.map((e, k) => `
                            <li class="ejemplo" style="--k:${k}">
                              <span class="ejemplo__txt">${e.texto}</span>
                              <span class="ejemplo__fuente">${e.fuente}</span>
                            </li>`).join('')}
                        </ul>
                      </div>
                    </li>`;
          })
          .join('')}
      </ol>
    </div>`;

  /* ---- beat 1: la galería ------------------------------------------------ */

  const galeria = datos.galeria ?? [];
  escena.querySelector('[data-panorama]').innerHTML = `
    <span class="cortina" aria-hidden="true"></span>
    <div class="galeria">
      <div class="galeria__entrada">
        <h2 class="galeria__titulo">Esto es lo que permiten ver los anuncios.</h2>
        <p class="galeria__invitacion">Conoce cómo la información extraída de diversos anuncios
          de empleo puede ayudar a mejorar la <b>identificación</b> y <b>clasificación</b> de
          nuevas ocupaciones. No sustituyen al catálogo: le dan con qué actualizarse.</p>
      </div>
      <p class="galeria__marca"><b>Aquí tienes algunos ejemplos</b></p>
      <!-- el paso de una ficha a otra va arriba a la izquierda, donde estaban las
           píldoras: se lee antes de la ficha, que es cuando hace falta saber que
           hay más de una. El mundo de cada ejemplo lo dice la propia ficha. -->
      <div class="galeria__nav">
        <button class="gnav" data-paso="-1" aria-label="Ocupación anterior">‹</button>
        <span class="galeria__cuenta" data-galeria-cuenta></span>
        <button class="gnav" data-paso="1" aria-label="Ocupación siguiente">›</button>
      </div>
      <div class="galeria__marco">
        <span class="marco__lado marco__lado--arriba"></span>
        <span class="marco__lado marco__lado--derecha"></span>
        <span class="marco__lado marco__lado--abajo"></span>
        <span class="marco__lado marco__lado--izquierda"></span>
        <div class="galeria__ficha" data-galeria-ficha></div>
      </div>
    </div>`;

  const fichaGaleria = escena.querySelector('[data-galeria-ficha]');
  const cuenta = escena.querySelector('[data-galeria-cuenta]');
  let enGaleria = 0;

  const MOD = { remoto: 'remoto', hibrido: 'híbrido', presencial: 'presencial' };

  function pintarGaleria(i) {
    enGaleria = (i + galeria.length) % galeria.length;
    const g = galeria[enGaleria];
    cuenta.textContent = `${enGaleria + 1} / ${galeria.length}`;

    // la modalidad deja de ser una nota al pie: es una barra con su reparto
    const reparto = Object.entries(g.modalidad)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const dominante = reparto[0];

    fichaGaleria.innerHTML = `
      <div class="gficha">
        <div class="gficha__cabeza" style="--b:0">
          <svg aria-hidden="true"><use href="${SPRITE}#i-${g.icono}"></use></svg>
          <div class="gficha__nombre">
            <h3 class="gficha__titulo">${g.titulo}</h3>
            <p class="gficha__donde">Hoy se cuenta en <b>${g.sinco.codigo_4d}</b> ${g.sinco.nombre_4d}${
              g.sinco.comparte_con.length ? `, junto con ${g.sinco.comparte_con[0].toLowerCase()}` : ''}</p>
          </div>
          <span class="gficha__mundo">${g.mundo}</span>
        </div>

        <div class="gficha__cols" style="--b:1">
          <section>
            <p class="gficha__rot">Tareas que antes no existían</p>
            <ul class="gficha__lista">
              ${g.tareas_nuevas.map((t) => `<li>${t}</li>`).join('')}
            </ul>
          </section>
          <section>
            <p class="gficha__rot">Saberes que antes no se pedían</p>
            <ul class="gficha__lista gficha__lista--saberes">
              ${g.habilidades_nuevas.map((h) => `<li>${h.label}<span class="gsaber__grupo">${h.grupo}</span></li>`).join('')}
            </ul>
          </section>
          <!-- La tercera columna es lo que NO es nuevo: el oficio ya existente
               sobre el que se monta la ocupación. Sin ella la ficha parece decir
               que todo en ella es inédito, y no lo es: lo que la vuelve difícil
               de clasificar es la mezcla. Va con el porcentaje de sus anuncios
               que la piden, que es lo que la hace un requisito y no un adorno. -->
          <section>
            <p class="gficha__rot">Habilidades requeridas</p>
            <ul class="gficha__lista gficha__lista--pedidas">
              ${(g.habilidades_pedidas ?? []).map((h) => `<li>${h.label}<span class="gsaber__grupo">${h.pct}%</span></li>`).join('')}
            </ul>
          </section>
        </div>

        <section class="gficha__modalidad" style="--b:2">
          <p class="gficha__rot">Cómo se trabaja</p>
          <div class="gmod">
            ${reparto.map(([k, v], n) => `
              <span class="gmod__tramo" data-clave="${k}" data-primera="${n === 0 ? 'si' : 'no'}"
                    style="--peso:${v}">
                <b>${Math.round(v)}%</b> ${MOD[k] ?? k}
              </span>`).join('')}
          </div>
          <p class="gficha__modnota">Sobre todo <b>${MOD[dominante[0]]}</b>: ${
            Math.round(dominante[1])} de cada 100 anuncios de esta ocupación.</p>
        </section>

        <p class="gficha__pie" style="--b:3">
          <span><b>${g.n_anuncios}</b> anuncios</span>
          <span>índice <b>${g.indice.toFixed(2)}</b></span>
          ${g.salario_mediano ? `<span>sueldo mediano <b>$${pesos(g.salario_mediano)}</b></span>` : ''}
        </p>
      </div>`;
  }

  escena.querySelector('.galeria__nav').addEventListener('click', (e) => {
    const b = e.target.closest('.gnav');
    if (b) pintarGaleria(enGaleria + Number(b.dataset.paso));
  });
  pintarGaleria(0);

  /* ---- colocación por beat ------------------------------------------------ */

  function colocar(beat) {
    lienzo.dataset.beat = String(beat);
    if (!movil) escala.style.setProperty('--dy', `${DESPLAZO_Y[beat] ?? -70}px`);
  }

  /* ---- la lámina del cierre ----------------------------------------------
     El último beat no se revelaba: se disolvía en 600 ms sobre las señales, sin
     dirección y sin seguir el scroll, y a media transición se leían los dos
     bloques encimados. Ahora entra como una lámina: sube desde abajo **ladeada**,
     y se endereza al llegar a su sitio mientras las señales retroceden.
     Va atada al scroll, así que se detiene donde el lector se detiene.
     El giro, el radio y el tramo están arriba en LAMINA para poder calibrarlos. */

  /* ---- las señales, tramo a tramo ---------------------------------------
     Antes entraban con un reloj: `alAsentar` disparaba y el CSS escalonaba con
     retrasos fijos. Ahora el avance lo manda el scroll, así que si el lector se
     detiene a la mitad, la lista se queda a la mitad. */

  const senales = [...escena.querySelectorAll('.senal')];

  seguir(beats[0], {
    raiz,
    modo: 'travesia',
    pasos: 320,
    alAvanzar: (p) => {
      const quieto = movimientoReducido();
      const a = recorta01((p - SENALES.desde) / (SENALES.hasta - SENALES.desde));
      senales.forEach((el, i) => {
        const s = quieto
          ? (a > i * SENALES.paso ? 1 : 0)
          : recorta01((a - i * SENALES.paso) / SENALES.ventana);
        el.style.setProperty('--s', s.toFixed(3));
        // el resaltador barre en la primera mitad del tramo y se va en la segunda
        el.style.setProperty('--sr', recorta01(s * 2.1).toFixed(3));
        el.style.setProperty('--sro', quieto ? '0' : recorta01((0.62 - s) * 3).toFixed(3));
        // los ejemplos caen detrás del enunciado
        el.style.setProperty('--se', recorta01((s - 0.42) / 0.45).toFixed(3));
      });
    },
  });

  seguir(beats[1], {
    raiz,
    modo: 'travesia',
    pasos: 260,
    alAvanzar: (p) => {
      const a = movimientoReducido()
        ? (p > CIERRE.desde ? 1 : 0)
        : recorta01((p - CIERRE.desde) / (CIERRE.hasta - CIERRE.desde));
      /* Del mismo avance salen los tiempos, que NO se encabalgan: primero se
         van las señales, después entra el cierre y al final se traza el marco.
         Encimarlos era lo que ensuciaba la transición anterior. */
      const tramo = (desde, hasta) => recorta01((a - desde) / (hasta - desde));
      lienzo.style.setProperty('--a-cierre', a.toFixed(3));
      const mPanorama = tramo(0.12, 0.54);
      lienzo.style.setProperty('--m-panorama', mPanorama.toFixed(3));
      /* Garantía: mientras la llegada no ha empezado, la pieza no está oculta
         «por estar lejos» sino porque no se pinta. Calcular dónde aparcarla
         depende de un instante de maquetación —la escala del tablero, el hueco
         bajo él— y basta con que esa medida llegue tarde una vez para que la
         lámina asome por abajo durante el beat anterior. Esto no puede fallar. */
      lienzo.classList.toggle('casos--llegando', mPanorama > 0);
      /* El marco ya no se traza con el scroll: se dispara cuando la lámina
         termina de llegar y se dibuja entero en un segundo, con el reloj. El
         scroll decide CUÁNDO empieza; la duración es fija. Al volver atrás la
         clase se quita y el gesto se rearma. */
      lienzo.classList.toggle('casos--marco', mPanorama >= 1);
    },
  });

  colocar(0);

  const bloqueGaleria = escena.querySelector('.galeria');

  /* La ficha no aparece de golpe: dentro del marco ya trazado se van componiendo
     sus bloques —cabecera, tareas y saberes, modalidad, totales—. Sólo al llegar
     al beat: al cambiar de pestaña el contenido se releva de inmediato, porque
     una galería que se recompone en tres cuartos de segundo cada vez que tocas
     una pestaña se siente lenta, no cuidada. */
  function componerFicha() {
    if (!bloqueGaleria) return;
    bloqueGaleria.classList.remove('galeria--compuesta');
    void bloqueGaleria.offsetWidth;
    bloqueGaleria.classList.add('galeria--compuesta');
  }

  observarBeats(beats, {
    raiz,
    alCambiar: (beat) => {
      colocar(beat);
      if (beat !== 1) bloqueGaleria?.classList.remove('galeria--compuesta');
    },
    alAsentar: (i) => { if (i === 1) componerFicha(); },
    asiento: 0.88,
  });
  alAparecer(escena, () => colocar(Number(lienzo.dataset.beat) || 0), { raiz });

  /* ---- escala y progreso --------------------------------------------------- */

  function ajustarEscala() {
    const caja = escena.querySelector('.scrolly__fijo').getBoundingClientRect();
    const margen = movil ? 16 : 40;
    const k = Math.min(TOPE_ESCALA, (caja.width - margen) / ANCHO, (caja.height - (movil ? 40 : 96)) / ALTO);
    escala.style.setProperty('--k', Math.max(0.4, k).toFixed(3));
    escala.style.setProperty('--dy', movil ? '0px' : `${DESPLAZO_Y[lienzo.dataset.beat] ?? -70}px`);
    medirParqueo();
  }

  /* Dónde espera la cortina mientras el lector sigue en el beat 0.
     Tiene que quedar justo por debajo del borde inferior del escenario, y ese
     borde no está a una distancia fija del tablero: en escritorio el tablero va
     centrado y en angosto va pegado arriba, así que el hueco de abajo cambia. Un
     valor fijo dejaba asomar la lámina en móvil. Se mide, no se supone.
     La medida va en unidades del tablero —dividida entre `--k`— porque la
     traslación ocurre dentro de la capa escalada. */
  function medirParqueo() {
    const fijo = escena.querySelector('.scrolly__fijo').getBoundingClientRect();
    const caja = escala.getBoundingClientRect();
    const k = Number(escala.style.getPropertyValue('--k')) || 1;
    // 64 px de holgura: con 24 el margen quedaba en 26 px reales y cualquier
    // redondeo o barra del sistema lo comía
    const px = Math.max(ALTO, (fijo.bottom - caja.top) / k + 64);
    lienzo.style.setProperty('--parqueo', `${Math.round(px)}px`);
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
