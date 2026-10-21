/* ============================================================================
   R2 · Dónde se publican — la lluvia sobre el mapa
   Cada globo cae en la entidad donde se ofrece el trabajo y su cola señala el
   punto. Un globo son varios anuncios: el pie lo dice y la leyenda lo repite.

   Tres honestidades que el módulo tiene que sostener:
   - Las entidades que el corpus de prueba no separa se dibujan rayadas, no
     vacías: «no hay dato» y «no hay anuncios» no son lo mismo.
   - Lo que no cae en ninguna entidad —remoto a todo el país, y el resto
     agrupado— va a una bandeja aparte, no se reparte a ojo sobre el mapa.
   - El mapa es de dónde se PUBLICA, no de dónde se trabaja.

   Geometría: Marco Geoestadístico Nacional del INEGI, podado a estados.
   Proyección cónica conforme de Lambert, que es la que usa el propio INEGI
   para la cartografía nacional.
   ========================================================================= */

import { seguir, alRedimensionar, movimientoReducido, recorta01 } from '../scroll-engine.js';
import { svg } from '../figura-anuncio.js';
import { tramo } from './comun.js';

const POR_GLOBO = 100;         // anuncios que representa cada globo
/* Suelo de globos por entidad. Sin él, veinte de las treinta y dos salían con
   uno solo y el mapa se veía vacío fuera del centro del país. Es un mínimo
   declarado —el pie lo dice— y por tanto una distorsión acotada: en esas
   entidades el número de globos ya no es proporcional, y quien quiera la
   proporción real la tiene en los porcentajes rotulados. */
const MINIMO_POR_ENTIDAD = 3;
/* Cuánto del avance dura el viaje de UN globo. Los retrasos se reparten en
   1 - CAIDA, de modo que el último arranca justo a tiempo de aterrizar en 1.
   El valor se le pasa al CSS como --dur en vez de repetirlo allá: la primera
   versión lo tenía escrito en los dos sitios, se desincronizó, y el último
   globo se quedaba a medio camino para siempre. */
const CAIDA = 0.55;
const SEMILLA = 20260911;

/* Cuánto dura la lluvia completa por muy fuerte que se empuje el scroll, y
   cuánto tarda en deshacerse al subir. Ver el comentario del reloj, más abajo. */
const VUELO_MIN = 3200;
const REGRESO_MIN = 1100;

/* Entidades cuyo porcentaje se rotula, con el desplazamiento de su etiqueta en
   fracción del ancho y del alto del mapa. Rotularlas todas convierte el mapa en
   una tabla mal puesta; dejarlas sobre el centroide las encarama unas en otras,
   porque cuatro de las cinco grandes están en el mismo puño del país. Por eso
   cada una sale con línea guía hacia un hueco distinto.
   La selección busca cubrir el mapa —centro, noreste, occidente, noroeste,
   sureste— y llegar hasta el otro extremo: Michoacán, que no alcanza el 1 %. */
const ROTULADAS = [
  { cve: '09', dx: 0.13, dy: 0.22 },    // Ciudad de México, hacia el Golfo
  { cve: '19', dx: 0.15, dy: -0.10 },   // Nuevo León, hacia el noreste
  { cve: '14', dx: -0.20, dy: -0.03 },  // Jalisco, hacia el Pacífico
  { cve: '02', dx: 0.08, dy: -0.06 },   // Baja California
  { cve: '31', dx: 0.09, dy: -0.14 },   // Yucatán
  { cve: '16', dx: -0.20, dy: 0.13 },   // Michoacán, el extremo bajo
];

export async function montarMapa(caja, datos, raiz) {
  // ojo: `tramo` a secas es la función importada de comun.js
  const tramoVuelo = caja.closest('[data-tramo-vuelo]') ?? caja;
  const topo = await fetch('data/mapa_entidades.json').then((r) => r.json());
  const entidades = topojson.feature(topo, topo.objects.entidades);

  /* El tamaño sale del CONTENEDOR, no de window.innerWidth: este módulo vive en
     una columna de una rejilla y la ventana no dice cuánto mide esa columna. La
     primera versión leía la ventana y dibujaba el mapa chico dentro de un hueco
     grande. La proporción 0.58 es la de México en cónica conforme. */
  const ANCHO = Math.round(Math.min(940, Math.max(320, caja.clientWidth || 880)));
  const ALTO = Math.round(ANCHO * 0.58);

  const proyeccion = d3.geoConicConformal()
    .parallels([17.5, 29.5])
    .rotate([102, 0])
    .fitExtent([[8, 8], [ANCHO - 8, ALTO - 8]], entidades);
  const ruta = d3.geoPath(proyeccion);

  const porCve = new Map(datos.entidades.map((e) => [e.cve_ent, e]));

  /* ---- azar con semilla: el mismo mapa en cada recarga --------------------- */
  let s = SEMILLA;
  const azar = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

  /* ---- un punto al azar dentro de la entidad ------------------------------ */
  function puntoDentro(feature) {
    const [[x0, y0], [x1, y1]] = ruta.bounds(feature);
    for (let i = 0; i < 400; i++) {
      const x = x0 + azar() * (x1 - x0);
      const y = y0 + azar() * (y1 - y0);
      const lonlat = proyeccion.invert([x, y]);
      if (lonlat && d3.geoContains(feature, lonlat)) return [x, y];
    }
    return ruta.centroid(feature);   // entidades muy delgadas: al centro y ya
  }

  /* ---- cuántos globos por entidad -----------------------------------------
     Las 12 entidades que el corpus de prueba agrupa bajo «Otras» reciben UN
     globo cada una, para que la lluvia cubra el país entero. Ese globo es un
     marcador de posición, no un conteo, y el pie de la gráfica lo dice: cuando
     lleguen los datos reales se sustituye por la cifra que toque. */
  const gotas = [];
  for (const f of entidades.features) {
    const cve = f.properties.cve_ent;
    const e = porCve.get(cve);
    const cuantos = Math.max(MINIMO_POR_ENTIDAD,
      e ? Math.round(e.n / POR_GLOBO) : 0);
    for (let i = 0; i < cuantos; i++) {
      const [x, y] = puntoDentro(f);
      gotas.push({ x, y, cve, nombre: f.properties.nombre, simulado: !e });
    }
  }
  // que no caigan por orden de estado: se vería un barrido, no una lluvia
  for (let i = gotas.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [gotas[i], gotas[j]] = [gotas[j], gotas[i]];
  }
  gotas.forEach((g, i) => { g.retraso = (i / gotas.length) * (1 - CAIDA); });

  /* ---- dibujo -------------------------------------------------------------- */
  /* El relleno se arma en JS con rgba y no con color-mix() ni con rgb(from ...):
     en navegadores anteriores a 2023 esas funciones no devuelven un color sino
     nada, y el mapa sale transparente sin avisar. Ya pasó una vez en este
     proyecto. Se lee el token una sola vez y se interpola a mano. */
  const raizEstilos = getComputedStyle(document.documentElement);
  const aRGB = (hex) => {
    const h = hex.trim().replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  };
  /* Todas las entidades del mismo gris. El mapa es el suelo, no un segundo
     dato: la cantidad la llevan los globos, y teñir además el estado sería
     contar lo mismo dos veces. */
  const [R, G, B] = aRGB(raizEstilos.getPropertyValue('--gris-600') || '#828281');
  const GRIS = `rgba(${R},${G},${B},0.16)`;

  const paises = entidades.features.map((f) => {
    const e = porCve.get(f.properties.cve_ent);
    const titulo = e
      ? `${f.properties.nombre} — ${e.pct}% de los anuncios`
      : `${f.properties.nombre} — sin dato individual en el corpus de prueba`;
    return `<path d="${ruta(f)}" fill="${GRIS}"
      class="ent" data-cve="${f.properties.cve_ent}" data-con-dato="${e ? 'si' : 'no'}"
      ><title>${titulo}</title></path>`;
  }).join('');

  const rotuladas = ROTULADAS
    .map((r) => ({ ...r, f: entidades.features.find((f) => f.properties.cve_ent === r.cve) }))
    .filter((r) => r.f && porCve.has(r.cve))
    .map((r) => {
      const [cx, cy] = ruta.centroid(r.f);
      return { ...r, cx, cy, lx: cx + r.dx * ANCHO, ly: cy + r.dy * ALTO,
               e: porCve.get(r.cve), nombre: r.f.properties.nombre };
    });

  const guias = rotuladas.map((r) => `
    <line class="guia" x1="${r.cx.toFixed(1)}" y1="${r.cy.toFixed(1)}"
          x2="${r.lx.toFixed(1)}" y2="${r.ly.toFixed(1)}"/>
    <circle class="guia__punto" cx="${r.cx.toFixed(1)}" cy="${r.cy.toFixed(1)}" r="2.4"/>`).join('');

  const marcas = rotuladas.map((r) =>
    `<div class="marca-mapa" style="left:${r.lx.toFixed(1)}px; top:${r.ly.toFixed(1)}px">
       <b>${r.e.pct}%</b><span>${r.nombre}</span>
     </div>`).join('');

  const lluvia = gotas.map((g) =>
    `<span class="gota" style="--x:${g.x.toFixed(1)}px; --y:${g.y.toFixed(1)}px; --d:${g.retraso.toFixed(3)}"
     >${svg('neutro', 13, { solido: true, color: 'currentColor' })}</span>`).join('');

  /* «Resto del país» ya no va aquí: sus entidades reciben su globo sobre el
     mapa. Dejarlo en los dos sitios sería contarlo dos veces. */
  const bandeja = datos.aparte.filter((a) => a.clave === 'sin_sede').map((a) => {
    const cuantos = Math.max(1, Math.round(a.n / POR_GLOBO));
    return `<div class="bandeja__grupo">
      <div class="bandeja__globos">${
        Array.from({ length: cuantos }, (_, i) =>
          `<span class="gota gota--fuera" style="--d:${(0.5 + i * 0.02).toFixed(3)}"
           >${svg(a.clave === 'sin_sede' ? 'remoto' : 'neutro', 12,
                  { solido: true, color: 'currentColor' })}</span>`).join('')}</div>
      <p class="bandeja__rotulo"><b>${a.pct}%</b> ${a.nombre}</p>
      <p class="bandeja__nota">${a.explica}</p>
    </div>`;
  }).join('');

  caja.innerHTML = `
    <div class="mapa__escala" data-escala>
      <svg class="mapa__svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO}" height="${ALTO}"
           role="img" aria-label="Mapa de México con el reparto de los anuncios por entidad federativa">
        ${paises}
      </svg>
      <div class="mapa__lluvia" data-lluvia aria-hidden="true">${lluvia}</div>
      <svg class="mapa__guias" data-guias viewBox="0 0 ${ANCHO} ${ALTO}"
           width="${ANCHO}" height="${ALTO}" aria-hidden="true">${guias}</svg>
      <div class="mapa__marcas" data-marcas aria-hidden="true">${marcas}</div>
    </div>

    <div class="bandeja" data-bandeja>
      <p class="bandeja__titulo">No cae en ninguna entidad</p>
      ${bandeja}
    </div>

    <p class="lienzo__pie">
      Cada globo son ${POR_GLOBO} anuncios del <b>corpus de prueba</b> (${datos.corpus.total.toLocaleString('es-MX')}
      en total), no del acervo real. Cada entidad lleva <b>un mínimo de ${MINIMO_POR_ENTIDAD}
      globos</b> para que ninguna desaparezca del mapa: donde se aplica ese mínimo el número ya
      no es proporcional, y la proporción real es la de los porcentajes rotulados. En las
      ${datos.entidades_sin_dato.length} entidades que el corpus agrupa bajo «otras» la lluvia
      está <b>simulada</b> y no representa ningún conteo.
      Geometría: Marco Geoestadístico Nacional, INEGI.
    </p>`;

  /* ---- nota de la columna de texto, calculada, no escrita a mano ----------- */
  const nota = document.querySelector('[data-nota-mapa]');
  if (nota) {
    const cuatro = datos.entidades.slice(0, 4);
    const suma = cuatro.reduce((a, e) => a + e.pct, 0).toFixed(1);
    nota.innerHTML = `${cuatro.map((e) => e.nombre).join(', ')} suman <b>${suma}%</b>. `
      + `El corpus de prueba sólo separa ${datos.entidades.length} entidades; las otras `
      + `${datos.entidades_sin_dato.length} vienen agrupadas.`;
  }

  /* ---- el vuelo desde el contador ------------------------------------------
     Cada globo del mapa no cae del cielo: sale de un globo del contador de R1 y
     viaja hasta su entidad. El origen se guarda como un desplazamiento respecto
     del punto de llegada, en unidades del mapa —la capa entera va escalada por
     --k, así que la diferencia medida en pantalla se divide entre k—. Se mide
     la diferencia entre dos rectángulos tomados en el mismo instante, que es
     invariante al scroll porque los dos elementos se desplazan juntos. */
  const escala = caja.querySelector('[data-escala]');
  const capaLluvia = caja.querySelector('[data-lluvia]');
  const capaMarcas = caja.querySelector('[data-marcas]');
  const capaGuias = caja.querySelector('[data-guias]');
  const bandejaEl = caja.querySelector('[data-bandeja]');
  const piezas = [...capaLluvia.children];

  function enlazarOrigenes() {
    const salida = [...document.querySelectorAll('.acervo__campo .globo')];
    if (!salida.length) return;
    const k = Number(escala.style.getPropertyValue('--k')) || 1;
    const cajaEscala = escala.getBoundingClientRect();
    // se reparten los globos de salida a lo largo de toda la retícula, para que
    // el envío se vea salir del montón entero y no de una esquina
    const paso = salida.length / piezas.length;
    piezas.forEach((el, i) => {
      const origen = salida[Math.min(salida.length - 1, Math.floor(i * paso))]
        .getBoundingClientRect();
      const destinoX = cajaEscala.left + gotas[i].x * k;
      const destinoY = cajaEscala.top + gotas[i].y * k;
      el.style.setProperty('--ox', `${((origen.left + origen.width / 2) - destinoX) / k}px`);
      el.style.setProperty('--oy', `${((origen.top + origen.height / 2) - destinoY) / k}px`);
    });
  }

  /* El tramo del vuelo ABRE la sección, así que al llegar ya está en lo alto de
     la pantalla: su avance no vale cero en reposo. Con una ventana fija, el
     viaje aparecía empezado —unos globos ya se asomaban sobre el contador antes
     de que el contador contara— y terminaba con el mapa medio salido por
     arriba. Los dos extremos se calculan de la geometría real:

       inicio → el avance que tiene el tramo con el scroll en cero
       fin    → el avance en el momento en que el mapa queda centrado

     Así nada se mueve hasta que el lector empuja, y todo ha terminado mientras
     el mapa se ve entero. Se recalcula al redimensionar. */
  let pInicio = 0;
  let pFin = 1;

  function calcularVentana() {
    const raizCaja = (raiz ?? document.documentElement).getBoundingClientRect();
    const alturaRaiz = raiz ? raiz.clientHeight : window.innerHeight;
    const tramoCaja = tramoVuelo.getBoundingClientRect();
    const escalaCaja = escala.getBoundingClientRect();
    const A = tramoCaja.height || 1;
    const desplazamiento = raiz ? raiz.scrollTop : window.scrollY;
    const tramoDesdeArriba = tramoCaja.top - raizCaja.top + desplazamiento;
    const yMapa = escalaCaja.top - tramoCaja.top;

    const avanceDe = (relativo) => recorta01((alturaRaiz - relativo) / (A + alturaRaiz));
    pInicio = avanceDe(tramoDesdeArriba);
    // el final no es «mapa centrado» sino «mapa arriba pero entero»: da más
    // recorrido al vuelo sin que el mapa llegue a cortarse por arriba
    pFin = avanceDe(0.16 * alturaRaiz - yMapa);
    if (pFin - pInicio < 0.08) pFin = pInicio + 0.08;   // páginas muy cortas
  }

  capaLluvia.style.setProperty('--dur-vuelo', String(CAIDA));

  /* ---- el vuelo tiene reloj propio ----------------------------------------
     El scroll decide HASTA DÓNDE llega la lluvia; cuánto tarda en llegar lo
     decide un reloj. Atado sólo al scroll, un golpe de trackpad entregaba de
     golpe todo el tramo y los ciento y pico de globos aterrizaban en un cuadro:
     el lector llegaba al mapa con la lluvia ya terminada sin haberla visto.

     Es la misma excepción que ya se hizo con el marco del cierre de la
     introducción, y por la misma razón: **el scroll gobierna lo que el lector
     recorre, no cuánto dura un gesto que ya empezó**. Aquí además importa que
     valga con el cursor parado en el sitio final: el objetivo se fija de una
     vez y el reloj lo alcanza a su paso.

     Subir es más rápido que bajar (REGRESO_MIN): deshacer un gesto no es un
     gesto, y hacerle esperar al lector que se arrepiente sería castigarlo. */
  let objetivo = 0;
  let mostrado = 0;
  let ultimoCuadro = 0;
  let corriendo = false;

  function escribir(v) {
    // el viaje ocupa casi todo el trayecto disponible: es lo que lo hace lento
    const viaje = tramo(v, 0.02, 0.88).toFixed(3);
    capaLluvia.style.setProperty('--p', viaje);
    bandejaEl.style.setProperty('--p', viaje);
    // los porcentajes cierran con el mapa todavía entero en pantalla
    const m = tramo(v, 0.84, 1).toFixed(3);
    capaMarcas.style.setProperty('--m', m);
    capaGuias.style.setProperty('--m', m);
  }

  function cuadro(ahora) {
    // una pestaña que vuelve de segundo plano trae un salto enorme: se acota
    const dt = Math.min(64, Math.max(0, ahora - ultimoCuadro));
    ultimoCuadro = ahora;
    const falta = objetivo - mostrado;
    const paso = dt / (falta > 0 ? VUELO_MIN : REGRESO_MIN);
    mostrado = Math.abs(falta) <= paso ? objetivo : mostrado + Math.sign(falta) * paso;
    escribir(mostrado);
    if (mostrado !== objetivo) requestAnimationFrame(cuadro);
    else corriendo = false;
  }

  function pintar(p) {
    objetivo = tramo(p, pInicio, pFin);
    if (corriendo || objetivo === mostrado) return;
    corriendo = true;
    ultimoCuadro = performance.now();
    requestAnimationFrame(cuadro);
  }

  if (movimientoReducido()) {
    capaLluvia.style.setProperty('--p', '1');
    capaMarcas.style.setProperty('--m', '1');
    capaGuias.style.setProperty('--m', '1');
    bandejaEl.style.setProperty('--p', '1');
  } else {
    seguir(tramoVuelo, { raiz, pasos: 320, modo: 'travesia', alAvanzar: pintar });
  }

  /* ---- escala ------------------------------------------------------------- */
  /* Al redimensionar sólo se escala: volver a proyectar obligaría a recolocar
     todas las gotas y a registrar de nuevo el seguidor de scroll. El tope de
     1.2 evita que un mapa dibujado angosto se estire hasta verse blando. */
  function ajustar() {
    const ancho = caja.clientWidth || ANCHO;
    const k = Math.min(1.2, (ancho - 8) / ANCHO);
    escala.style.setProperty('--k', k.toFixed(3));
    escala.style.height = `${Math.round(ALTO * k)}px`;
    // los orígenes y los extremos del viaje dependen de dónde queden las dos
    // retículas y de cuánto mide la ventana: los dos se recalculan
    enlazarOrigenes();
    calcularVentana();
  }
  ajustar();
  alRedimensionar(ajustar);
}
