// Marca institucional Potira (SVGs oficiais de assets/brand/, em js/marca-svg.js).
// A troca claro/escuro é feita só pelo CSS (css/marca.css), com os mesmos seletores do tema
// (data-theme manual e modo automático), então a logo nunca destoa do resto da tela.
import { MARCA_SVG as S } from './marca-svg.js';

/** Logo no menu lateral: versão negativa no tema claro e versão escura no tema escuro. Cada versão leva o próprio fundo oficial. */
export const logoMenu = () =>
  `<span class="logo-tile" role="img" aria-label="Potira"><span class="mq-l">${S.logoNegativo}</span><span class="mq-d">${S.logoEscuro}</span></span>`;

/** Logo em páginas claras ou escuras (apresentação, entrada, portal): sem fundo no claro; com fundo oficial no escuro. */
export const logoPagina = () =>
  `<span class="logo-page" role="img" aria-label="Potira"><span class="mq-l">${S.logoClaro}</span><span class="mq-d">${S.logoEscuro}</span></span>`;

/** Só o desenho do símbolo colorido (para colocar dentro de um .mark.potira). */
export const simboloColorido = () => S.simboloColorido;

/** Símbolo colorido num quadrado branco, para pequenos espaços (celular, nome do consultório). */
export const simboloTile = () => `<span class="mark potira">${S.simboloColorido}</span>`;

/** Símbolo de uma cor só, que segue a cor do texto (currentColor). */
export const simboloMono = () => `<span class="simbolo-mono">${S.simboloMono}</span>`;
