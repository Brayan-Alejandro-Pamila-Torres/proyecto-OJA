/* ============================================================================
   Patrón de portada — la constante gráfica del Sistema Visual
   Montañas y gráficas de línea: polilíneas en zigzag con un punto en el vértice.
   Cada trazo lleva pathLength 100, así que se dibuja con una sola variable.
   ========================================================================= */

/** Generador pseudoaleatorio con semilla, para que la rejilla sea reproducible. */
export function conSemilla(semilla) {
  let a = semilla >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NS = 'http://www.w3.org/2000/svg';

function svgEl(nombre, atributos) {
  const el = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

/**
 * Patrón de fondo: la constante gráfica a escala grande, para dibujarla con el
 * scroll. Cada polilínea lleva pathLength 100, así que el avance se controla
 * con una sola variable CSS.
 */
export function crearPatron(contenedor, { lineas = 9, semilla = 21 } = {}) {
  const rand = conSemilla(semilla);
  const svg = svgEl('svg', {
    class: 'patron__svg',
    viewBox: '0 0 1200 800',
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  for (let l = 0; l < lineas; l++) {
    const grupo = svgEl('g', { class: 'patron__linea', style: `--n:${l}` });
    grupo.dataset.tono = l % 3 === 0 ? 'anuncio' : 'catalogo';

    const tramos = 7 + Math.floor(rand() * 4);
    const paso = 1400 / tramos;
    const yBase = -120 + (l * 880) / lineas;
    const puntos = [];
    let arriba = rand() < 0.5;
    for (let i = 0; i <= tramos; i++) {
      const x = -100 + i * paso;
      const y = yBase + (arriba ? -1 : 1) * (46 + rand() * 34) + i * 22;
      puntos.push([+x.toFixed(0), +y.toFixed(0)]);
      arriba = !arriba;
    }

    grupo.appendChild(
      svgEl('polyline', {
        class: 'patron__trazo',
        pathLength: '100',
        points: puntos.map((p) => p.join(',')).join(' '),
      })
    );

    const cima = puntos.reduce((a, b) => (b[1] < a[1] ? b : a));
    grupo.appendChild(svgEl('circle', { class: 'patron__punto', cx: cima[0], cy: cima[1], r: 7 }));
    svg.appendChild(grupo);
  }

  contenedor.textContent = '';
  contenedor.appendChild(svg);
  return svg;
}
