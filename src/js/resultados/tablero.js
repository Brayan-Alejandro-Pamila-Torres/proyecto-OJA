/* ============================================================================
   R3 · Tablero por entidad federativa
   Las 32 abreviaturas del INEGI arriba; debajo, la ficha de la que se elija,
   con la misma forma que la del cierre de la introducción: cabecera, tres
   columnas, barra de modalidad y pie.

   Nació como R2b para no renumerar la gráfica de modalidad, que era R3. Al
   retirarse aquélla, la clave quedó libre y este módulo la ocupa: ahora la
   sección es R1 · R2 · R3 · R4, sin huecos. Es además la segunda mitad del
   argumento del mapa —dónde se publica—, así que sigue donde tiene que estar.

   Tres decisiones que el módulo sostiene:
   - **Sólo abreviaturas en el selector.** El nombre completo vive en la
     cabecera de la ficha, que es donde el lector confirma que acertó. Para
     quien navega con lector de pantalla el nombre va en el `aria-label`: eso
     no es «nombre completo en pantalla», es que la pieza se pueda usar.
   - **El orden es el del INEGI**, que es el alfabético oficial: basta con
     ordenar por clave, porque la clave ya está asignada en ese orden («Ch»
     después de «Co», como manda el alfabeto tradicional).
   - **Las 12 entidades que el corpus de prueba agrupa salen apagadas** y no se
     pueden elegir. Enseñarlas encendidas con la ficha vacía sería prometer un
     dato que no hay; esconderlas sería peor: el lector contaría 20 y creería
     que México tiene veinte estados. Que no haya dato es también un resultado,
     y el pie dice por qué.
   ========================================================================= */

const MOD = { presencial: 'presencial', hibrido: 'híbrido', remoto: 'remoto' };
const pesos = (n) => n.toLocaleString('es-MX');

export function montarTablero(caja, datos, raiz) {
  const fichas = datos.tablero ?? [];
  if (!fichas.length) return;

  const conDato = fichas.filter((f) => !f.sin_dato);
  const sinDato = fichas.filter((f) => f.sin_dato);
  if (!conDato.length) return;

  caja.innerHTML = `
    <div class="tablero">
      <div class="tablero__selector" role="group"
           aria-label="Entidad federativa, abreviaturas del INEGI">
        ${fichas.map((f) => `
          <button class="ent-ficha" type="button" data-cve="${f.cve_ent}"
                  data-dato="${f.sin_dato ? 'no' : 'si'}"
                  aria-label="${f.nombre}"
                  ${f.sin_dato ? 'disabled aria-disabled="true"' : ''}
            >${f.abrev}</button>`).join('')}
      </div>
      <div class="tablero__panel" data-panel aria-live="polite"></div>
    </div>

    <p class="lienzo__pie">
      ${sinDato.length} entidades salen <b>apagadas</b>: el corpus de prueba las agrupa bajo
      «otras» y no las separa, así que de ellas no hay nada que enseñar. No quiere decir que
      ahí no se publiquen vacantes. Los porcentajes de cada columna son sobre los anuncios de
      esa entidad, no del país.
    </p>`;

  const panel = caja.querySelector('[data-panel]');
  const botones = [...caja.querySelectorAll('.ent-ficha[data-dato="si"]')];

  /* Una columna de la ficha. `unidad` explica de qué es el porcentaje, que aquí
     no es evidente: 8.5 % de los anuncios de la CDMX, no del país. */
  const columna = (rotulo, lista, clase) => `
    <section>
      <p class="gficha__rot">${rotulo}</p>
      <ul class="gficha__lista ${clase}">
        ${lista.map((x) => `<li>${x.nombre}<span class="gsaber__grupo">${x.pct}%</span></li>`).join('')}
      </ul>
    </section>`;

  function pintar(cve) {
    const f = conDato.find((x) => x.cve_ent === cve) ?? conDato[0];
    botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cve === f.cve_ent)));

    const reparto = Object.entries(f.modalidad.pct)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    panel.innerHTML = `
      <div class="gficha">
        <div class="gficha__cabeza">
          <span class="ent-sello" aria-hidden="true">${f.abrev}</span>
          <div class="gficha__nombre">
            <h3 class="gficha__titulo">${f.nombre}</h3>
            <p class="gficha__donde"><b>${f.pct}%</b> de los anuncios del corpus de prueba
              se publican aquí</p>
          </div>
          <span class="gficha__mundo">${f.grupos[0]?.nombre ?? ''}</span>
        </div>

        <div class="gficha__cols">
          ${columna('Ocupaciones que más se anuncian', f.ocupaciones, '')}
          ${columna('Habilidades más pedidas', f.habilidades, 'gficha__lista--saberes')}
          ${columna('Grandes grupos del catálogo', f.grupos, 'gficha__lista--catalogo')}
        </div>

        <section class="gficha__modalidad">
          <p class="gficha__rot">Cómo se trabaja</p>
          <div class="gmod">
            ${reparto.map(([k, v], n) => `
              <span class="gmod__tramo" data-clave="${k}" data-primera="${n === 0 ? 'si' : 'no'}"
                    style="--peso:${v}"><b>${Math.round(v)}%</b> ${MOD[k] ?? k}</span>`).join('')}
          </div>
        </section>

        <p class="gficha__pie">
          <span><b>${pesos(f.n)}</b> anuncios</span>
          ${f.salario_mediano ? `<span>sueldo mediano <b>$${pesos(f.salario_mediano)}</b></span>` : ''}
          ${f.fiable ? '' : '<span class="gficha__flojo">pocos anuncios: léase con reserva</span>'}
        </p>
      </div>`;
  }

  caja.querySelector('.tablero__selector').addEventListener('click', (e) => {
    const b = e.target.closest('.ent-ficha[data-dato="si"]');
    if (b) pintar(b.dataset.cve);
  });

  /* Abre con la entidad que más anuncios tiene: un tablero que abre vacío
     obliga a adivinar qué hace antes de poder usarlo. */
  pintar(conDato.reduce((a, b) => (b.n > a.n ? b : a)).cve_ent);
}
