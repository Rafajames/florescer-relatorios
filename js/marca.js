// Marca institucional Potira (SVGs oficiais de assets/brand/, em js/marca-svg.js).
// A troca claro/escuro é feita só pelo CSS (css/marca.css), com os mesmos seletores do tema
// (data-theme manual e modo automático), então a logo nunca destoa do resto da tela.
import { MARCA_SVG } from './marca-svg.js';

// Cada cópia do desenho na página recebe ids próprios (degradês e recortes). Com ids repetidos, o navegador
// usa a primeira cópia; se ela estiver escondida (ex.: menu lateral no celular), as outras perdem as cores.
let n = 0;
export const unico = (svg) => { n += 1; return svg.replace(/pt-(\w+)-/g, `pt${n}-$1-`); };
const S = new Proxy(MARCA_SVG, { get: (o, k) => unico(o[k]) });

/** Logo no menu lateral, direto sobre a cor do menu: nome branco em menu escuro; nome petróleo quando a cor da marca é clara (data-rail-light). */
export const logoMenu = () =>
  `<span class="logo-menu" role="img" aria-label="Potira"><span class="lm-esc">${S.logoMenu}</span><span class="lm-cla">${S.logoClaro}</span></span>`;

/** Logo horizontal em páginas claras ou escuras (apresentação, entrada, portal): sem fundo no claro; com fundo oficial no escuro. */
export const logoPagina = () =>
  `<span class="logo-page" role="img" aria-label="Potira"><span class="mq-l">${S.logoHClaro}</span><span class="mq-d">${S.logoHEscuro}</span></span>`;

/** Só o desenho do símbolo colorido (para colocar dentro de um .mark.potira). */
export const simboloColorido = () => S.simboloColorido;

/** Símbolo colorido num quadrado branco, para pequenos espaços (celular, nome do consultório). */
export const simboloTile = () => `<span class="mark potira">${S.simboloColorido}</span>`;

/** Símbolo de uma cor só, que segue a cor do texto (currentColor). */
export const simboloMono = () => `<span class="simbolo-mono">${S.simboloMono}</span>`;
