/* ============================================================================
   Escena 3 — «De dónde salen los anuncios»
   Tres momentos: la lluvia de ofertas, el paso de texto libre a campos
   comparables y la advertencia sobre qué parte del mercado alcanzan a ver.
   ========================================================================= */

import { seguir, observarBeats, alAparecer, movimientoReducido } from '../scroll-engine.js';
import { conSemilla } from '../patron.js';

let movil = false;
let ANCHO = 980;
let ALTO = 470;

const SPRITE = 'src/assets/iconos.svg';
// en pantallas grandes el tablero crece en vez de dejar hueco alrededor
const TOPE_ESCALA = 1.28;
const DESPLAZO = { 0: [0, -60], 1: [0, -60], 2: [0, -130] };

/* Los oficios del muestrario del beat 2, en dos grupos. Se eligen por lo que se
   reconoce de un vistazo —un estetoscopio es salud, una bicicleta es reparto—,
   no por ninguna clasificación.

   Los que se rellenan de morado NO se sortean: son ocupaciones que de verdad se
   anuncian en internet, las que cualquiera ha visto en una bolsa de trabajo. Si
   el morado cayera al azar podía tocarle al campo o al trabajo del hogar, y el
   dibujo diría lo contrario de lo que quiere decir. */
const EN_ANUNCIO = [
  'laptop-datos',   // desarrollo y análisis de datos
  'red',            // redes y sistemas
  'candado',        // seguridad informática
  'telefono',       // centro de atención telefónica
  'chat',           // atención a clientes en línea
  'calculadora',    // contabilidad
  'portapapeles',   // administración y recursos humanos
  'megafono',       // mercadotecnia y ventas
  'estetoscopio',   // enfermería y otras ocupaciones de la salud
  'monitor',        // diseño y soporte técnico
];

/* Los que se quedan en gris. Hay de todo —campo, hogar, cuidados, oficios que
   se contratan en el lugar, trabajo por cuenta propia— y también trabajo de
   oficina: tampoco toda vacante de escritorio pasa por una bolsa en internet.
   Lo que el grupo dice es «el resto del trabajo», no una categoría. */
const FUERA = [
  'planta', 'montanas', 'casa', 'familia', 'comida', 'bicicleta',
  'auto', 'avion', 'hospital', 'escuela', 'birrete', 'libro',
  'escritorio', 'archivero', 'contrato', 'correo', 'formulario', 'documento',
  'dinero', 'lupa', 'nube', 'controles', 'rompecabezas', 'reloj',
  'lapiz', 'movil',
];

/** Baraja una copia de la lista con el generador que se le pase. */
function barajar(lista, rand) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}
const MODALIDAD = { remoto: 'Trabajo remoto', hibrido: 'Trabajo híbrido', presencial: 'Presencial' };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const enLetra = (mes) => {
  const [a, m] = mes.split('-');
  return `${MESES[+m - 1]} de ${a}`;
};

export async function montarAnuncios(raiz) {
  const escena = document.querySelector('[data-escena="anuncios"]');
  if (!escena) return;

  const lienzo = escena.querySelector('[data-lienzo]');
  const escala = escena.querySelector('[data-escala]');
  const beats = [...escena.querySelectorAll('.beat')];
  const envoltorio = escena.closest('[data-progreso]');
  const relleno = envoltorio?.querySelector('[data-progreso-relleno]');

  const datos = await fetch('data/anuncios.json').then((r) => r.json());

  movil = window.innerWidth < 760;
  ANCHO = movil ? 348 : 980;
  ALTO = movil ? 470 : 500;
  escala.style.width = `${ANCHO}px`;
  escala.style.height = `${ALTO}px`;


  /* ---- la lluvia: tarjetas de oferta -------------------------------------
     Antes eran píldoras con el puesto y nada más. Un anuncio real trae dónde,
     en qué modalidad, con qué sueldo y qué pide: eso es lo que el lector tiene
     que haber visto antes de que le contemos que ese texto se vuelve datos
     comparables.
     Fuera quedan la plataforma, la fecha y el sector. Ninguno de los tres se
     usa después —ni en la extracción, ni en el cierre, ni en Resultados— y la
     tarjeta los estaba enseñando como si importaran. El sueldo tampoco va
     resaltado: es un dato, no el argumento. */

  const nOfertas = movil ? 6 : 12;
  const muestra = datos.lluvia.slice(0, nOfertas);
  const capaLluvia = escena.querySelector('[data-lluvia]');

  const pastilla = (t, clase = '') => (t ? `<span class="oferta__pastilla ${clase}">${t}</span>` : '');

  capaLluvia.innerHTML = muestra
    .map((o) => `
      <article class="oferta" data-perfil="${o.perfil}">
        <h3 class="oferta__titulo">
          <svg aria-hidden="true"><use href="${SPRITE}#i-${o.icono}"></use></svg>
          <span>${o.titulo}</span>
        </h3>
        <p class="oferta__quien">${o.entidad}</p>
        <div class="oferta__pastillas">
          ${pastilla(o.modalidad)}
          ${o.sueldo
            ? pastilla(`${o.sueldo} al mes`)
            : pastilla('Sueldo no declarado', 'oferta__pastilla--hueca')}
          ${pastilla(o.escolaridad)}
          ${pastilla(o.experiencia === 0
            ? 'Sin experiencia previa'
            : `${o.experiencia} año${o.experiencia === 1 ? '' : 's'} de experiencia`)}
        </div>
      </article>`)
    .join('');

  const fichas = [...capaLluvia.querySelectorAll('.oferta')].map((el, i) => ({ el, i }));
  for (const f of fichas) f.alto = f.el.offsetHeight;

  // rejilla con desorden: las tarjetas no se alinean, se amontonan como en un tablón
  const rand = conSemilla(808);
  const cols = movil ? 2 : 4;
  const anchoFicha = movil ? 162 : 222;
  const filas = Math.ceil(fichas.length / cols);
  fichas.forEach((f, i) => {
    const c = i % cols;
    const fi = Math.floor(i / cols);
    const anchoCelda = ANCHO / cols;
    const altoCelda = (ALTO - 24) / filas;
    f.disperso = {
      x: Math.min(ANCHO - anchoFicha, c * anchoCelda + rand() * Math.max(0, anchoCelda - anchoFicha)),
      y: fi * altoCelda + rand() * Math.max(0, altoCelda - f.alto),
    };
    f.el.style.setProperty('--giro', `${(rand() * 2 - 1) * 1.6}deg`);
    f.el.style.setProperty('--dd', movimientoReducido() ? `${i * 22}ms` : `${i * 85}ms`);
  });

  /* ---- extracción: dos anuncios, uno tras otro ---------------------------
     Con un solo ejemplo el lector puede pensar que funciona por casualidad, o
     que sólo sirve para el trabajo de escritorio. Se muestran dos de mundos
     distintos —uno de tecnología, otro de oficio— con el mismo barrido y la
     misma extracción. Sólo se extrae lo que está escrito con esas palabras en
     el anuncio: cada campo trae el tramo exacto del texto de donde sale. */

  const ejemplos = datos.ejemplos ?? [datos.ejemplo];
  const capaExtraccion = escena.querySelector('[data-extraccion]');
  const escapa = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* En pantalla angosta no cabe el anuncio completo. Se recorta, pero de forma
     consistente: primero se eligen los campos y después se corta el texto en la
     oración siguiente al último de ellos, para que toda marca tenga su párrafo. */
  function seleccionar(todos) {
    if (!movil) return todos;
    const topes = { tareas: 2, habilidades: 2, condiciones: 2 };
    const cuenta = { tareas: 0, habilidades: 0, condiciones: 0 };
    const elegidos = [];
    for (const c of todos) {
      if (cuenta[c.grupo] >= (topes[c.grupo] ?? 0)) continue;
      cuenta[c.grupo]++;
      elegidos.push(c);
    }
    return elegidos;
  }

  function recortaTexto(desc, elegidos) {
    if (!movil) return { texto: desc, campos: elegidos };
    const primerTramo = Math.min(...elegidos.map((c) => c.tramo[0]));
    const preambulo = desc.lastIndexOf('. ', primerTramo);
    const desplaza = preambulo > 0 ? preambulo + 2 : 0;

    const fin = Math.max(0, ...elegidos.map((c) => c.tramo[1]));
    const corte = desc.indexOf('. ', fin);
    const texto = desc.slice(desplaza, corte < 0 ? undefined : corte + 1);

    return {
      texto,
      campos: elegidos.map((c) => ({ ...c, tramo: [c.tramo[0] - desplaza, c.tramo[1] - desplaza] })),
    };
  }

  /* Estado del ejemplo que está en pantalla: se rehace entero al cambiar. */
  let visible = { campos: [], barrido: null, marcas: [], casillas: [] };
  let cualEjemplo = -1;

  function pintarEjemplo(k) {
    const ej = ejemplos[k];
    const recorte = recortaTexto(ej.descripcion, seleccionar(ej.extraccion.campos));
    const campos = recorte.campos;

    // el texto se marca sólo donde el campo está literalmente escrito; los tramos
    // que se traslapan se descartan para no partir una marca dentro de otra
    const tramos = campos.map((c, i) => ({ i, ...c })).sort((a, b) => a.tramo[0] - b.tramo[0]);
    let html = '';
    let cursor = 0;
    for (const t of tramos) {
      const [ini, fin] = t.tramo;
      if (ini < cursor) continue;
      html += escapa(recorte.texto.slice(cursor, ini));
      html += `<mark class="marca" data-campo="${t.i}" data-grupo="${t.grupo}">`
        + `${escapa(recorte.texto.slice(ini, fin))}</mark>`;
      cursor = fin;
    }
    html += escapa(recorte.texto.slice(cursor));

    capaExtraccion.innerHTML = `
      <div class="crudo">
        <span class="barrido" data-barrido aria-hidden="true"></span>
        <p class="crudo__titulo">${ej.titulo}</p>
        <p class="crudo__texto" data-texto-crudo>${html}</p>
      </div>
      <div class="campos">
        <p class="campos__marca">Lo que se extrae, en el orden en que aparece</p>
        <ul class="extraidos">
          ${campos.map((c, i) => `
            <li class="campo" data-campo="${i}" data-grupo="${c.grupo}">
              <span class="campo__tipo">${c.tipo}</span>
              <span class="campo__valor">${c.texto}${c.etiqueta ? ` <b>${c.etiqueta}</b>` : ''}</span>
            </li>`).join('')}
        </ul>
      </div>
      <svg class="lente" viewBox="0 0 140 116" aria-hidden="true">
        <!-- el haz gris que entra: texto plano, indiferenciado -->
        <path class="lente__haz" d="M0 58 H46"/>
        <!-- la lente: figura curva, sin color propio. El color lo ponen los datos
             que salen, que es donde el color ya significa algo en esta escena -->
        <path class="lente__cuerpo" d="M58 26 C74 40 74 76 58 90 C74 84 86 72 86 58
                                       C86 44 74 32 58 26 Z"/>
        <path class="lente__cara" d="M50 34 C62 44 62 72 50 82"/>
        <!-- las tres bandas enfocadas, con el mismo código de color que las casillas -->
        <path class="lente__rayo" data-grupo="tareas"      d="M86 52 C104 48 122 44 140 40"/>
        <path class="lente__rayo" data-grupo="habilidades" d="M86 60 C104 62 122 64 140 66"/>
        <path class="lente__rayo" data-grupo="condiciones" d="M86 68 C104 76 122 84 140 92"/>
      </svg>

      <!-- el rótulo va pegado a la figura, no a media pantalla de distancia:
           suelto, el lector no lo relacionaba con lo que estaba mirando -->
      <p class="marca-ia">IA + LLM</p>

      <p class="turno" aria-live="polite">Anuncio ${k + 1} de ${ejemplos.length}</p>`;

    visible = {
      campos,
      barrido: capaExtraccion.querySelector('[data-barrido]'),
      marcas: [...capaExtraccion.querySelectorAll('.marca')],
      casillas: [...capaExtraccion.querySelectorAll('.campo')],
    };
    cualEjemplo = k;
  }

  pintarEjemplo(0);

  /* Tiempos de la extracción, todos juntos para poder calibrarlos de un tirón.
     La espera inicial existe porque el beat se activa cuando su tarjeta todavía
     viene entrando: sin ella la secuencia arranca antes de que el lector llegue. */
  const T = {
    espera: 420,        // desde que la tarjeta llega a su sitio hasta el barrido
    barrido: 2500,      // lo que tarda en recorrer el texto del anuncio
    banda: 72,          // alto de la banda que barre
    separacion: 120,    // mínimo entre dos marcas, para que no se enciendan a la vez
    vuelo: 380,         // de encenderse a salir volando
    llegada: 700,       // de salir a posarse en su casilla
    limpieza: 980,      // de salir a desaparecer el volante
    reposo: 1700,       // lo que se queda el resultado antes de dar paso al otro
    relevo: 520,        // el cruce entre un anuncio y el siguiente
    cierre: 1800,       // red de seguridad
  };

  let relojes = [];

  const luego = (ms, fn) => relojes.push(setTimeout(fn, ms));

  function reiniciarExtraccion() {
    relojes.forEach(clearTimeout);
    relojes = [];
    capaExtraccion.classList.remove('capa--relevo');
    if (cualEjemplo !== 0) pintarEjemplo(0);
    visible.barrido?.classList.remove('barrido--corre');
    visible.marcas.forEach((m) => m.classList.remove('marca--viva'));
    visible.casillas.forEach((c) => c.classList.remove('campo--puesto'));
    capaExtraccion.querySelectorAll('.volante').forEach((v) => v.remove());
  }

  function volar(marca) {
    const destino = visible.casillas[Number(marca.dataset.campo)];
    if (!destino) return;
    const k = parseFloat(getComputedStyle(escala).getPropertyValue('--k')) || 1;
    const caja = escala.getBoundingClientRect();
    const a = marca.getBoundingClientRect();
    const b = destino.getBoundingClientRect();

    const volante = document.createElement('span');
    volante.className = 'volante';
    volante.dataset.grupo = marca.dataset.grupo;
    volante.textContent = marca.textContent;
    Object.assign(volante.style, {
      left: `${(a.left - caja.left) / k}px`,
      top: `${(a.top - caja.top) / k}px`,
      width: `${a.width / k}px`,
    });
    capaExtraccion.appendChild(volante);

    requestAnimationFrame(() => {
      volante.style.transform = `translate(${(b.left - a.left) / k}px, ${(b.top - a.top) / k}px)`;
      volante.style.opacity = '0';
    });
    luego(T.llegada, () => destino.classList.add('campo--puesto'));
    luego(T.limpieza, () => volante.remove());
  }

  /* El barrido recorre sólo el bloque de texto —no la tarjeta entera— para que
     las marcas se repartan a lo largo de casi toda su duración. Cada una se
     enciende cuando el centro de la banda pasa por ella. */
  function recorridoDelBarrido() {
    const texto = capaExtraccion.querySelector('[data-texto-crudo]');
    return { inicio: texto.offsetTop - T.banda, fin: texto.offsetTop + texto.offsetHeight };
  }

  function calendarioDeMarcas() {
    const { inicio, fin } = recorridoDelBarrido();
    const tramo = Math.max(1, fin - inicio);
    const tiempos = visible.marcas
      .map((m) => {
        const centro = m.offsetTop + m.offsetHeight / 2;
        const avance = Math.max(0, Math.min(1, (centro - T.banda / 2 - inicio) / tramo));
        return { marca: m, t: avance * T.barrido };
      })
      .sort((a, b) => a.t - b.t);

    // dos marcas en el mismo renglón caerían encima: se separan un mínimo
    for (let i = 1; i < tiempos.length; i++) {
      tiempos[i].t = Math.max(tiempos[i].t, tiempos[i - 1].t + T.separacion);
    }
    return tiempos;
  }

  /* Una pasada sobre el anuncio que esté en pantalla. Devuelve cuánto dura, para
     encadenar el siguiente sin tener que adivinar. */
  function pasada(desfase) {
    const quieto = movimientoReducido();
    if (!quieto) {
      const { inicio, fin } = recorridoDelBarrido();
      visible.barrido.style.setProperty('--inicio', `${inicio}px`);
      visible.barrido.style.setProperty('--fin', `${fin}px`);
      visible.barrido.style.setProperty('--dur-barrido', `${T.barrido}ms`);
      const b = visible.barrido;
      luego(desfase, () => requestAnimationFrame(() => b.classList.add('barrido--corre')));
    }

    const calendario = calendarioDeMarcas();
    const casillas = visible.casillas;
    for (const { marca, t } of calendario) {
      luego(desfase + t, () => marca.classList.add('marca--viva'));
      if (quieto) {
        const destino = casillas[Number(marca.dataset.campo)];
        luego(desfase + t + T.vuelo, () => destino?.classList.add('campo--puesto'));
      } else {
        luego(desfase + t + T.vuelo, () => volar(marca));
      }
    }
    const fin = calendario.length ? calendario.at(-1).t : T.barrido;
    // red de seguridad: pase lo que pase con los vuelos, el estado final se cumple
    luego(desfase + fin + T.vuelo + T.llegada + T.cierre,
      () => casillas.forEach((c) => c.classList.add('campo--puesto')));
    return fin + T.vuelo + T.llegada;
  }

  function animarExtraccion() {
    reiniciarExtraccion();

    /* Con movimiento reducido no se suprime la secuencia, sólo el movimiento:
       las marcas y sus datos siguen apareciendo uno por uno, en orden. */
    const duracion = pasada(T.espera);

    if (ejemplos.length < 2) return;

    // el relevo: el primer anuncio se retira, el segundo entra y se repite todo
    const salida = T.espera + duracion + T.reposo;
    luego(salida, () => capaExtraccion.classList.add('capa--relevo'));
    luego(salida + T.relevo, () => {
      pintarEjemplo(1);
      capaExtraccion.classList.remove('capa--relevo');
      pasada(T.relevo);
    });
  }

  /* ---- qué ocupaciones llegan a un anuncio --------------------------------
     Antes aquí había cien figuras de persona: de cada 100 ocupados del país,
     los anuncios veían a 40. Decía algo cierto —los OJA no cubren todo el
     mercado— pero lo decía con un reparto prestado de la ENOE que todavía no
     tenemos, y ponía el sesgo en las PERSONAS.

     La advertencia que importa aquí es otra y es sobre el catálogo: no todas
     las OCUPACIONES llegan a anunciarse en internet. Por eso ahora hay un
     muestrario de oficios repartidos al azar, y sólo unos cuantos rellenos de
     morado —el morado de esta sección, el del anuncio—. Lo que se lee de un
     vistazo es que la mayoría se queda en gris.

     La proporción del dibujo es ilustrativa y el pie lo dice: cuántas
     ocupaciones alcanza a ver un anuncio es justamente lo que hay que medir, y
     es a lo que entra la siguiente sección. */

  /* La lluvia no puede depender sólo de `beat === 0`: al montar, `colocar(0)` se
     llama con el beat 0 y las tarjetas caían ahí mismo, con la escena a miles de
     píxeles por debajo del pliegue. Para cuando el lector bajaba ya estaban
     puestas —y por eso «bajando no se veía»; sólo reaparecía si se iba al beat
     siguiente y se volvía—. Ahora esperan a que el escenario se fije en pantalla. */
  let escenaALaVista = false;

  const capaOficios = escena.querySelector('[data-composicion]');

  const N_ICONOS = movil ? 22 : 36;
  const N_VISTAS = movil ? 6 : 10;
  const TAM = movil ? { min: 20, max: 40 } : { min: 28, max: 60 };
  const ALTO_CAMPO = movil ? 270 : 280;   // lo que queda entre el enunciado y el pie

  /* Reparto al azar pero parejo: por cada ícono se tiran varios candidatos y se
     queda el que cae más lejos de los ya puestos. Un `Math.random` puro deja
     huecos y amontonamientos que se leen como si significaran algo. La semilla
     lo hace reproducible: el dibujo es el mismo en cada carga. */
  function sembrar(n, ancho, alto, rand) {
    const puestos = [];
    for (let i = 0; i < n; i++) {
      let mejor = null;
      let mejorD = -1;
      for (let k = 0; k < 20; k++) {
        const c = { x: rand() * ancho, y: rand() * alto };
        let d = Infinity;
        for (const q of puestos) d = Math.min(d, (c.x - q.x) ** 2 + (c.y - q.y) ** 2);
        if (d > mejorD) { mejorD = d; mejor = c; }
      }
      puestos.push(mejor);
    }
    return puestos;
  }

  {
    const rand = conSemilla(4172);
    const margen = TAM.max / 2 + 4;
    const ancho = ANCHO - margen * 2;
    const alto = ALTO_CAMPO - margen * 2;
    const puntos = sembrar(N_ICONOS, ancho, alto, rand);

    /* El tamaño sale del hueco que tiene cada uno: nunca más de dos tercios de
       la distancia a su vecino más cercano, así que dos íconos no se encabalgan
       por muy apretados que hayan caído. El factor suelto es lo que les da
       variedad sin romper esa garantía. */
    const tamanos = puntos.map((a, i) => {
      let d = Infinity;
      puntos.forEach((b, j) => {
        if (i !== j) d = Math.min(d, Math.hypot(a.x - b.x, a.y - b.y));
      });
      const cabe = Math.min(TAM.max, Math.max(TAM.min, d * 0.66));
      return Math.round(cabe * (0.72 + rand() * 0.28));
    });

    /* Qué sitios llevan morado. El azar reparte los SITIOS —para que los morados
       queden esparcidos y no se lean como un racimo con significado—, pero los
       íconos que caen en ellos salen de `EN_ANUNCIO`, no del sorteo. */
    const orden = barajar([...puntos.keys()], rand);
    const vistas = new Set();
    for (const i of orden) {
      if (vistas.size >= N_VISTAS) break;
      const lejos = [...vistas].every((j) =>
        Math.hypot(puntos[i].x - puntos[j].x, puntos[i].y - puntos[j].y) > TAM.max * 1.6);
      if (lejos) vistas.add(i);
    }
    // por si la restricción dejó corto el conjunto, se completa con los que sigan
    for (const i of orden) { if (vistas.size >= N_VISTAS) break; vistas.add(i); }

    const dentro = barajar(EN_ANUNCIO, rand);
    const fuera = barajar(FUERA, rand);
    const oficios = puntos.map((_, i) => (vistas.has(i) ? dentro.pop() : fuera.pop()));

    capaOficios.innerHTML = `
      <div class="ocupaciones" data-ocupaciones>
        <p class="ocupaciones__marca">No todas las ocupaciones llegan a un anuncio
          en internet.</p>
        <div class="ocupaciones__campo" style="--alto:${ALTO_CAMPO}px" aria-hidden="true">
          ${puntos.map((q, i) => `
            <span class="oficio" data-visible="${vistas.has(i) ? 'si' : 'no'}"
                  style="--x:${(margen + q.x).toFixed(1)}px; --y:${(margen + q.y).toFixed(1)}px;
                         --t:${tamanos[i]}px; --i:${i}">
              <svg><use href="${SPRITE}#i-${oficios[i]}"></use></svg>
            </span>`).join('')}
        </div>
        <div class="ocupaciones__pie">
          <ul class="clave">
            <li class="clave__caso" data-visible="si">Se anuncia en internet</li>
            <li class="clave__caso" data-visible="no">No llega a un anuncio</li>
          </ul>
          <p class="ocupaciones__nota">
            <span class="ocupaciones__quienes">El trabajo informal, el de cuenta propia,
              el del campo y el que no se paga casi nunca pasan por una vacante
              publicada. </span>La proporción del dibujo es ilustrativa: cuántas
            ocupaciones alcanza a ver un anuncio es justo lo que hay que medir.</p>
        </div>
      </div>`;
  }

  const bloqueOficios = capaOficios.querySelector('[data-ocupaciones]');
  let relojOficios = [];

  /* Primero aparecen todos en gris —el muestrario completo—, después se rellenan
     de morado los que sí se anuncian, y al final llega el pie con la clave. El
     orden ES el argumento: si el morado llegara junto con los íconos, no habría
     un antes contra el que leerlo. */
  function animarOficios(inmediato) {
    relojOficios.forEach(clearTimeout);
    relojOficios = [];
    bloqueOficios?.classList.remove('ocupaciones--encendida', 'ocupaciones--nombrada');
    // de un salto se conserva el orden pero se acorta la espera
    const pausa = (ms) => (inmediato ? Math.min(ms, 120)
      : movimientoReducido() ? Math.min(ms, 280) : ms);
    relojOficios.push(setTimeout(() => bloqueOficios?.classList.add('ocupaciones--encendida'), pausa(900)));
    relojOficios.push(setTimeout(() => bloqueOficios?.classList.add('ocupaciones--nombrada'), pausa(1700)));
  }

  /* ---- textos que salen de los datos -------------------------------------- */

  escena.querySelector('[data-texto-lluvia]').textContent =
    `Empresas de todos los tamaños describen el puesto con sus propias palabras. En este `
    + `corpus hay ${datos.total.toLocaleString('es-MX')} anuncios depurados, publicados entre `
    + `${enLetra(datos.periodo.desde)} y ${enLetra(datos.periodo.hasta)}.`;

  /* ---- colocación por beat ------------------------------------------------ */

  function colocar(beat) {
    lienzo.dataset.beat = String(beat);
    if (beat !== 1) reiniciarExtraccion();
    if (beat !== 2) {
      relojOficios.forEach(clearTimeout);
      bloqueOficios?.classList.remove('ocupaciones--encendida', 'ocupaciones--nombrada');
    }
    const [dx, dy] = movil ? [0, 0] : (DESPLAZO[beat] ?? [0, 0]);
    escala.style.setProperty('--dx', `${dx}px`);
    escala.style.setProperty('--dy', `${dy}px`);

    // el retraso de cada tarjeta se fija al montar y no se toca aquí: escribirlo
    // en cada cambio de beat era lo que aplanaba el escalonado
    for (const f of fichas) {
      f.el.style.setProperty('--x', `${f.disperso.x}px`);
      f.el.style.setProperty('--y', `${f.disperso.y}px`);
      f.el.classList.toggle('oferta--visible', beat === 0 && escenaALaVista);
    }
  }

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
    // la extracción no arranca al activarse el beat sino cuando su tarjeta llega
    // a su sitio: así no depende de a qué velocidad venga scrolleando el lector
    /* La lluvia cae al activarse el beat, no al asentarse la tarjeta: el beat se
       activa cuando la escena todavía viene entrando, que es justo cuando el
       lector tiene que ver caer los anuncios. Atarla a `alAsentar` dejaba el
       escenario vacío media pantalla y, si el lector seguía bajando, la caída se
       cancelaba antes de terminar. Las otras dos sí esperan: son lecturas, no
       entradas. */
    alAsentar: (i) => {
      // la extracción no se acorta aunque se llegue de un salto: es una lectura
      // completa, y resumirla dejaría al lector sin lo único que hay que ver
      if (i === 1) animarExtraccion();
      if (i === 2) animarOficios(salto);
    },
    asiento: 0.92,
  });
  /* El margen recorta el borde inferior de la raíz al 45 % superior: el aviso
     llega cuando la cabecera de la escena va por media pantalla, todavía
     subiendo. Así la lluvia cae mientras el tablero entra, que es cuando el
     lector la está mirando. Con el margen por omisión saltaba una pantalla
     antes —sin nada a la vista— y pegado al tope llegaba ya con el tablero
     quieto. */
  alAparecer(escena, () => {
    escenaALaVista = true;
    colocar(Number(lienzo.dataset.beat) || 0);
  }, { raiz, margen: '0px 0px -55% 0px' });

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
