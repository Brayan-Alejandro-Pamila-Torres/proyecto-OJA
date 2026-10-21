/* ============================================================================
   La figura del anuncio — el globo
   Un anuncio no es una persona ni un empleo: es algo que alguien dijo. Por eso
   la marca de toda la sección es un globo de diálogo.

   Dos decisiones que hay que respetar en cualquier gráfica que la use:

   1. La punta de la cola es el origen (0,0) y el cuerpo queda ARRIBA, en
      y negativa. Así, colocar un globo sobre un punto del mapa es una
      traslación y nada más: la cola señala el lugar sin cálculos extra.

   2. La modalidad va en el LARGO DE LA COLA, no sólo en el color:
      presencial, cola larga —el trabajo tiene un sitio—; híbrido, cola corta;
      remoto, sin cola —no sale de ningún lugar—. La silueta sola ya distingue
      las tres, de modo que la gráfica se sigue leyendo en blanco y negro y
      para quien no separa el verde del ámbar.
   ========================================================================= */

export const MODALIDADES = ['presencial', 'hibrido', 'remoto'];

/* «neutro» es el globo sin modalidad: el anuncio a secas. Se usa donde la
   gráfica habla de cuántos o de dónde, y la cola sólo sirve para señalar el
   sitio. La modalidad —el largo de la cola— se introduce después, con su
   leyenda, y sólo en las gráficas que la miden. Un gesto, un significado. */

export const NOMBRE_MODALIDAD = {
  neutro: 'Anuncio',
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const COLOR_MODALIDAD = {
  neutro: 'var(--c-anuncio)',
  presencial: 'var(--c-presencial)',
  hibrido: 'var(--c-hibrido)',
  remoto: 'var(--c-remoto)',
};

/* el cuerpo mide siempre lo mismo; lo que cambia es cuánto cuelga */
export const CUERPO = { ancho: 26, alto: 20, radio: 5 };
export const COLA = { neutro: 10, presencial: 10, hibrido: 5, remoto: 0 };

/** Alto total de la figura, cuerpo más cola, en unidades de la ruta. */
export const alto = (modalidad) => CUERPO.alto + (COLA[modalidad] ?? 0);

/**
 * La ruta SVG del globo, con la punta de la cola en (0,0).
 * El cuerpo ocupa x de -13 a 13 e y de -alto a -cola.
 */
export function ruta(modalidad = 'presencial') {
  const c = COLA[modalidad] ?? 0;
  const r = CUERPO.radio;
  const x = CUERPO.ancho / 2;
  const arriba = -(CUERPO.alto + c);
  const abajo = -c;

  const esquinas = (haciaAbajo) => `
    M${-x + r},${arriba}
    H${x - r} A${r},${r} 0 0 1 ${x},${arriba + r}
    V${abajo - r} A${r},${r} 0 0 1 ${x - r},${abajo}
    ${haciaAbajo}
    H${-x + r} A${r},${r} 0 0 1 ${-x},${abajo - r}
    V${arriba + r} A${r},${r} 0 0 1 ${-x + r},${arriba} Z`;

  // sin cola el borde inferior es recto; con cola baja en pico hasta el origen
  const pico = c === 0 ? '' : `H3 L0,0 L-4.5,${abajo}`;
  return esquinas(pico).replace(/\s+/g, ' ').trim();
}

/**
 * Un globo completo como cadena SVG.
 * @param {string} modalidad
 * @param {number} px  alto en píxeles del cuerpo más la cola
 * @param {object} [op]
 * @param {boolean} [op.solido]  relleno macizo, para tamaños chicos
 * @param {string}  [op.color]   sobrescribe el color de la modalidad
 * @param {number}  [op.opacidad]
 */
export function svg(modalidad, px, op = {}) {
  const h = alto(modalidad);
  const k = px / h;
  const w = Math.round(CUERPO.ancho * k);
  const color = op.color ?? COLOR_MODALIDAD[modalidad];
  const d = ruta(modalidad);
  const caja = `${-CUERPO.ancho / 2} ${-h} ${CUERPO.ancho} ${h}`;
  const op1 = op.opacidad != null ? ` opacity="${op.opacidad}"` : '';

  if (op.solido || px < 22) {
    return `<svg width="${w}" height="${Math.round(px)}" viewBox="${caja}"${op1}
      aria-hidden="true"><path d="${d}" fill="${color}"/></svg>`;
  }

  // a tamaño grande el globo se abre y enseña de qué está hecho:
  // una línea gruesa —el título— y dos finas —lo que pide—
  const yt = -(CUERPO.alto + (COLA[modalidad] ?? 0)) + 6;
  return `<svg width="${w}" height="${Math.round(px)}" viewBox="${caja}"${op1} aria-hidden="true">
    <path d="${d}" fill="${color}" fill-opacity=".16" stroke="${color}"
          stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-8,${yt} H2" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-8,${yt + 5} H8 M-8,${yt + 9} H4" stroke="${color}" stroke-width="1.2"
          stroke-linecap="round" opacity=".55"/>
  </svg>`;
}

/**
 * Reparto determinista de n figuras entre las modalidades, a partir de
 * porcentajes. Sin azar: la misma entrada da siempre el mismo resultado, que es
 * lo que hace comparables dos retículas puestas una al lado de la otra.
 */
export function repartir(n, pct) {
  const cuentas = MODALIDADES.map((m) => Math.floor((n * (pct[m] ?? 0)) / 100));
  let faltan = n - cuentas.reduce((a, b) => a + b, 0);
  // los que sobran por el redondeo van a las modalidades con mayor residuo
  const residuos = MODALIDADES
    .map((m, i) => [i, (n * (pct[m] ?? 0)) / 100 - cuentas[i]])
    .sort((a, b) => b[1] - a[1]);
  for (let i = 0; faltan > 0; i++, faltan--) cuentas[residuos[i % 3][0]]++;
  return MODALIDADES.flatMap((m, i) => Array(cuentas[i]).fill(m));
}

/**
 * Baraja con semilla: misma semilla, mismo orden. Se usa para que la lluvia
 * y las retículas no cambien de aspecto entre recargas.
 */
export function barajar(lista, semilla = 7) {
  const copia = [...lista];
  let s = semilla;
  const azar = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
