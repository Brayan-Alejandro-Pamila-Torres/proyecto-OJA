/* ============================================================================
   Sección de Resultados — exploración
   Se monta la primera vez que la sección se abre, no al cargar la página: son
   133 KB de fichas que sólo hacen falta si el lector llega hasta aquí.
   ========================================================================= */

import { seguir } from './scroll-engine.js';
import { montarAcervo } from './resultados/acervo.js';
import { montarMapa } from './resultados/mapa.js';
import { montarTablero } from './resultados/tablero.js';

const SPRITE = 'src/assets/iconos.svg';
const pesos = (n) => n.toLocaleString('es-MX');
const ETIQUETA_CORTA = {
  novedad_tareas: 'tareas nuevas',
  novedad_habilidades: 'saberes nuevos',
  ajuste_sinco: 'no encaja',
  crecimiento_reciente: 'no es aislada',
  dispersion_sectorial: 'muchos sectores',
};

let montada = false;

export async function montarResultados(raiz) {
  if (montada) return;
  montada = true;

  const cont = document.querySelector('[data-resultados]');
  if (!cont) return;

  const [datos, panorama] = await Promise.all([
    fetch('data/resultados.json').then((r) => r.json()),
    fetch('data/panorama.json').then((r) => r.json()),
  ]);
  const ocupaciones = datos.ocupaciones;

  /* La portada de la sección se quitó —se entra directo al contador—, así que
     estos dos rótulos pueden no existir. La advertencia de «datos de prueba» no
     se pierde: la repite el pie de cada módulo y el pie de la sección. */
  const aviso = cont.querySelector('[data-aviso]');
  if (aviso) {
    aviso.textContent =
      `${pesos(datos.total_anuncios)} anuncios sintéticos · ${ocupaciones.length} familias `
      + `ocupacionales · datos de prueba, no oficiales.`;
  }
  const nOcup = cont.querySelector('[data-n-ocupaciones]');
  if (nOcup) nOcup.textContent = ocupaciones.length;

  /* Los tres módulos de panorama van primero en la página y se montan en ese
     orden: contador, mapa y tablero por entidad. El mapa es el único asíncrono
     —trae la geometría— y por eso no se espera: si tarda, los otros dos ya
     están puestos. */
  montarAcervo(cont.querySelector('[data-acervo]'), panorama, raiz);
  montarMapa(cont.querySelector('[data-mapa]'), panorama, raiz)
    .catch((e) => console.error('mapa:', e));
  montarTablero(cont.querySelector('[data-tablero]'), panorama, raiz);

  montarExplorador(cont, datos);

  const envoltorio = cont.querySelector('[data-progreso]');
  const relleno = envoltorio?.querySelector('[data-progreso-relleno]');
  if (envoltorio && relleno) {
    seguir(cont, {
      raiz,
      pasos: 400,
      modo: 'salida',
      alAvanzar: (p) => { relleno.style.transform = `scaleX(${p})`; },
    });
  }
}

/* ---- explorador ---------------------------------------------------------- */

function montarExplorador(cont, datos) {
  const ocupaciones = datos.ocupaciones;
  const lista = cont.querySelector('[data-lista]');
  const conteo = cont.querySelector('[data-conteo-lista]');
  const panel = cont.querySelector('[data-ficha-detalle]');
  const buscar = cont.querySelector('[data-buscar]');

  const maxIndice = Math.max(...ocupaciones.map((o) => o.indice));
  let elegida = ocupaciones[0].familia;

  const normaliza = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* Sólo queda el buscador. El filtro por gran grupo del catálogo se retiró: con
     treinta familias, escribir tres letras llega antes que abrir un menú de
     nueve opciones, y el gran grupo de cada una se lee igual en su ficha. */
  function visibles() {
    const q = normaliza(buscar.value.trim());
    if (!q) return ocupaciones;
    return ocupaciones.filter((o) =>
      normaliza(o.familia).includes(q) || normaliza(o.titulo).includes(q));
  }

  function pintarLista() {
    const items = visibles();
    conteo.textContent = items.length === ocupaciones.length
      ? `${items.length} ocupaciones`
      : `${items.length} de ${ocupaciones.length} ocupaciones`;

    lista.innerHTML = items.map((o) => `
      <li><button class="fila" data-familia="${o.familia}"
                  aria-current="${o.familia === elegida ? 'true' : 'false'}">
        <svg aria-hidden="true"><use href="${SPRITE}#i-${o.icono}"></use></svg>
        <span class="fila__nombre">${o.familia}</span>
        <span class="fila__indice">${o.indice.toFixed(2)}</span>
        <span class="fila__barra">
          <span class="fila__relleno" style="transform:scaleX(${(o.indice / maxIndice).toFixed(3)})"></span>
        </span>
      </button></li>`).join('');

    if (items.length && !items.some((o) => o.familia === elegida)) elegir(items[0].familia);
  }

  function elegir(familia) {
    elegida = familia;
    lista.querySelectorAll('.fila').forEach((b) =>
      b.setAttribute('aria-current', String(b.dataset.familia === familia)));
    pintarFicha(panel, ocupaciones.find((o) => o.familia === familia), datos);
  }

  lista.addEventListener('click', (e) => {
    const b = e.target.closest('.fila');
    if (b) elegir(b.dataset.familia);
  });
  buscar.addEventListener('input', pintarLista);

  pintarLista();
  elegir(elegida);
}

function pintarFicha(panel, o, datos) {
  if (!o) { panel.innerHTML = ''; return; }
  const maxSerie = Math.max(...o.serie.map((d) => d.n));
  const cre = o.crecimiento;

  const barrita = (etiqueta, valor, max, tono, texto) => `
    <div class="barrita" data-tono="${tono}">
      <span>${etiqueta}</span>
      <span class="barrita__val">${texto}</span>
      <span class="barrita__pista">
        <span class="barrita__relleno" style="transform:scaleX(${Math.max(0, Math.min(1, valor / max)).toFixed(3)})"></span>
      </span>
    </div>`;

  panel.innerHTML = `
    <article class="detalle">
      <div class="detalle__cabeza">
        <svg aria-hidden="true"><use href="${SPRITE}#i-${o.icono}"></use></svg>
        <div>
          <h4 class="detalle__titulo">${o.familia}</h4>
          <p class="detalle__sub">
            Se clasifica en <b>${o.sinco.codigo_4d}</b> · ${o.sinco.nombre_4d}${
              o.sinco.comparte_con.length
                ? ` — comparte renglón con ${o.sinco.comparte_con.join(' y ').toLowerCase()}`
                : ''}
          </p>
        </div>
      </div>

      <div class="detalle__cifras">
        <div><div class="cifra__n">${o.indice.toFixed(2)}</div><div class="cifra__et">índice</div></div>
        <div><div class="cifra__n">${pesos(o.n_anuncios)}</div><div class="cifra__et">anuncios</div></div>
        <div><div class="cifra__n">${cre.multiplicador ? `×${cre.multiplicador}` : '—'}</div>
             <div class="cifra__et">de ${cre.primer_anio} a ${cre.ultimo_anio}</div></div>
        <div><div class="cifra__n">${o.n_tareas_nuevas}</div><div class="cifra__et">tareas nuevas de ${o.n_tareas_distintas}</div></div>
        <div><div class="cifra__n">${o.n_habilidades_nuevas}</div><div class="cifra__et">saberes nuevos de ${o.n_habilidades_distintas}</div></div>
      </div>

      <div class="detalle__rejilla">
        <div>
          <p class="bloque__rotulo">Lo que piden hacer</p>
          <ul class="lista-simple">
            ${o.tareas.slice(0, 6).map((t) => `
              <li data-nueva="${t.nueva ? 'si' : 'no'}"><span>${t.texto}</span>
              <span class="pct">${t.pct}%</span></li>`).join('')}
          </ul>
        </div>
        <div>
          <p class="bloque__rotulo">Lo que hay que saber · ESCO</p>
          <ul class="lista-simple">
            ${o.habilidades.slice(0, 6).map((h) => `
              <li data-nueva="${h.nueva ? 'si' : 'no'}" title="${h.nombre_grupo}">
              <span>${h.label} <b class="esco">${h.grupo}</b></span>
              <span class="pct">${h.pct}%</span></li>`).join('')}
          </ul>
        </div>

        <div>
          <p class="bloque__rotulo">Por qué el índice la señala</p>
          <div class="barritas">
            ${datos.senales.map((s) => barrita(
              ETIQUETA_CORTA[s.clave], o.senales[s.clave], 1, 'senal',
              o.senales[s.clave].toFixed(2))).join('')}
          </div>
        </div>

        <div>
          <p class="bloque__rotulo">Desde dónde se trabaja</p>
          <div class="barritas">
            ${datos.modalidades.map((m) => barrita(
              m.nombre, o.modalidad[m.clave], 100, m.clave, `${o.modalidad[m.clave]}%`)).join('')}
          </div>

          <p class="bloque__rotulo" style="margin-top:var(--e5)">Anuncios por año</p>
          <div class="serie-anual">
            ${o.serie.map((d) => `
              <div class="serie-anual__col" title="${d.n} anuncios en ${d.anio}">
                <span class="serie-anual__barra" style="height:${Math.round(100 * d.n / maxSerie)}%"></span>
                <span class="serie-anual__et">${String(d.anio).slice(2)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <p class="detalle__nota">
        ${o.salario.p50
          ? `Sueldo mediano ofertado: $${pesos(o.salario.p50)} al mes (de $${pesos(o.salario.p25)} a $${pesos(o.salario.p75)} entre el primer y el tercer cuartil). Lo declara ${o.salario.declara_pct}% de los anuncios.`
          : 'Ningún anuncio de esta ocupación declara sueldo.'}
      </p>
    </article>`;
}
