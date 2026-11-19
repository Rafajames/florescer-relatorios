#!/usr/bin/env python3
"""Gera os SVGs da marca Potira em assets/brand/ (logo, símbolo e ícones).
Redesenho vetorial feito a partir da imagem da marca enviada pelo James (flor de lótus com a figura no centro).
O nome "Potira" está em tools/marca-nome.path (contorno vetorizado da imagem). Depois: python3 tools/gerar-marca.py"""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'assets', 'brand')
NOME = open(os.path.join(root, 'tools', 'marca-nome.path')).read().strip()
CX = 768.3  # eixo de simetria (coordenadas da imagem original)
OUTER = "M547 221 C570 211 600 209 625 220 C680 245 730 285 758 317 C735 323 705 328 672 327 C625 324 585 295 560 262 C553 248 549 235 547 221Z"
BIG = "M617.3 137.3 C660 138 705 160 730 205 C748 240 755 285 757.7 316.7 C700 313 650 295 625 245 C612 215 612 170 617.3 137.3Z"
TOP = "M768.3 62.7 C748 78 722 105 702.7 143.3 C725 160 748 185 768.3 231.7 C788 185 811 160 833.9 143.3 C814 105 788.5 78 768.3 62.7Z M768.3 137.3 a20.7 20.7 0 1 0 .01 0Z"
PETROLEO, PETROLEO_ESC = '#134B5F', '#092F3B'
COR = dict(top0='#D24F80', top1='#9B2559', big0='#C93F74', big1='#7A1B4A', out0='#FF84B2', out1='#DD5E8D', lens='#4A0828')

def simbolo(p, modo='cor', cor='#fff'):
    """modo: 'cor' (degradês), 'um' (uma cor só; pétalas de fora mais claras)."""
    if modo == 'cor':
        d = (f'<defs><linearGradient id="{p}top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{COR["top0"]}"/><stop offset="1" stop-color="{COR["top1"]}"/></linearGradient>'
             f'<linearGradient id="{p}big" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{COR["big0"]}"/><stop offset="1" stop-color="{COR["big1"]}"/></linearGradient>'
             f'<linearGradient id="{p}out" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{COR["out0"]}"/><stop offset="1" stop-color="{COR["out1"]}"/></linearGradient>'
             f'<clipPath id="{p}clip"><path d="{BIG}"/></clipPath></defs>')
        lado = (f'<path d="{OUTER}" fill="url(#{p}out)"/><path d="{BIG}" fill="url(#{p}big)"/>'
                f'<g clip-path="url(#{p}clip)"><path d="{OUTER}" fill="{COR["lens"]}" opacity=".5"/></g>')
        topo = f'url(#{p}top)'
    else:
        d = ''
        lado = f'<path d="{OUTER}" fill="{cor}" opacity=".62"/><path d="{BIG}" fill="{cor}"/>'
        topo = cor
    return (d + f'<g id="{p}L">{lado}</g><use href="#{p}L" transform="translate({2*CX} 0) scale(-1 1)"/>'
            f'<path d="{TOP}" fill="{topo}" fill-rule="evenodd"/>')

def svg(vb, w, h, corpo, titulo):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}" role="img" aria-labelledby="title"><title id="title">{titulo}</title>{corpo}</svg>\n'
def nome(cor): return f'<path d="{NOME}" fill="{cor}" fill-rule="evenodd"/>'
def escreve(arq, s): open(os.path.join(out, arq), 'w', encoding='utf-8').write(s)

# --- logo empilhada (símbolo sobre o nome), como na imagem da marca
VB = (452, 52, 630, 475)
def empilhada(fundo, sim, cor_nome, titulo='Potira'):
    r = f'<rect x="{VB[0]}" y="{VB[1]}" width="{VB[2]}" height="{VB[3]}" fill="{fundo}"/>' if fundo else ''
    return svg(' '.join(map(str, VB)), 630, 475, r + sim + nome(cor_nome), titulo)
escreve('potira-logo-claro.svg', empilhada(None, simbolo('c'), '#074459'))
escreve('potira-logo-escuro.svg', empilhada(PETROLEO_ESC, simbolo('e'), '#FFFFFF'))
escreve('potira-logo-menu.svg', empilhada(None, simbolo('m'), '#FFFFFF'))  # menu escuro, sem fundo
escreve('potira-logo-negativo.svg', empilhada(PETROLEO, simbolo('n', 'um', '#FFFFFF'), '#FFFFFF'))

# --- logo horizontal (símbolo à esquerda, nome à direita): para barras de topo
def horizontal(fundo, sim, cor_nome):
    k = .62; sw, sh = 444 * k, 268 * k; nw, nh = 610, 170
    H = 190; W = sw + 36 + nw + 24
    g = (f'<g transform="translate({12 - 546 * k:.2f} {(H - sh) / 2 - 62 * k:.2f}) scale({k})">{sim}</g>'
         f'<g transform="translate({12 + sw + 36 - 462:.2f} {(H - nh) / 2 - 347:.2f})">{nome(cor_nome)}</g>')
    r = f'<rect width="{W:.0f}" height="{H}" rx="18" fill="{fundo}"/>' if fundo else ''
    return svg(f'0 0 {W:.0f} {H}', f'{W:.0f}', H, r + g, 'Potira')
escreve('potira-logo-horizontal-claro.svg', horizontal(None, simbolo('hc'), '#074459'))
escreve('potira-logo-horizontal-escuro.svg', horizontal(PETROLEO_ESC, simbolo('he'), '#FFFFFF'))

# --- símbolo isolado
SVB = '536 52 464 288'
def isolado(fundo, sim, titulo='Símbolo Potira'):
    r = f'<rect x="536" y="52" width="464" height="288" fill="{fundo}"/>' if fundo else ''
    return svg(SVB, 464, 288, r + sim, titulo)
escreve('potira-simbolo-colorido.svg', isolado(None, simbolo('sc')))
escreve('potira-simbolo-negativo.svg', isolado(PETROLEO, simbolo('sn', 'um', '#FFFFFF')))
escreve('potira-simbolo-monocromatico.svg', isolado(None, '<g color="currentColor">' + simbolo('sm', 'um', 'currentColor') + '</g>'))

# --- ícones de aplicativo (quadrado arredondado 512)
def icone(fundo, sim):
    k = .86 * 512 / 444 * .78  # símbolo ocupa ~67% da largura
    k = 0.76 * 512 / 444 * .88
    tx = 256 - (768.3 * k); ty = 256 - (196 * k)
    return svg('0 0 512 512', 512, 512, f'<rect width="512" height="512" rx="112" fill="{fundo}"/><g transform="translate({tx:.1f} {ty:.1f}) scale({k:.4f})">{sim}</g>', 'Ícone Potira')
escreve('potira-icone-claro.svg', icone('#F3FAFB', simbolo('ic')))
escreve('potira-icone-escuro.svg', icone(PETROLEO_ESC, simbolo('ie')))
escreve('potira-icone-negativo.svg', icone('#7A1B4A', simbolo('in', 'um', '#FFFFFF')))
print('SVGs da marca gerados em assets/brand/')
