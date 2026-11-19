#!/usr/bin/env python3
"""Gera js/marca-svg.js a partir dos SVGs oficiais de assets/brand/.
Os SVGs são colocados no HTML (inline) para o nome "Potira" usar a fonte Bricolage da página
(dentro de <img> o navegador não carrega a fonte). Os desenhos não são alterados: só saem
width/height/title/role (o tamanho vem do CSS) e os ids dos degradês ganham um prefixo único.
Rode depois de mudar qualquer SVG da marca: python3 tools/gerar-marca.py"""
import json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'assets', 'brand')
NOMES = {
    'logoHClaro': 'potira-logo-horizontal-claro.svg', 'logoHEscuro': 'potira-logo-horizontal-escuro.svg', 'logoMenu': 'potira-logo-menu.svg', 'logoClaro': 'potira-logo-claro.svg', 'logoEscuro': 'potira-logo-escuro.svg', 'logoNegativo': 'potira-logo-negativo.svg',
    'simboloColorido': 'potira-simbolo-colorido.svg', 'simboloNegativo': 'potira-simbolo-negativo.svg',
    'simboloMono': 'potira-simbolo-monocromatico.svg',
}
out = {}
for chave, arq in NOMES.items():
    s = open(os.path.join(src, arq), encoding='utf-8').read().strip()
    s = re.sub(r'<title[^>]*>.*?</title>', '', s, flags=re.S)
    # só no elemento <svg> raiz
    raiz = re.match(r'<svg[^>]*>', s).group(0)
    nova = re.sub(r'\s(width|height|role|aria-labelledby)="[^"]*"', '', raiz)
    nova = nova[:-1] + ' aria-hidden="true" focusable="false" class="potira-svg">'
    s = nova + s[len(raiz):]
    pref = 'pt-' + chave + '-'
    for i in set(re.findall(r'id="([^"]+)"', s)):
        s = s.replace(f'id="{i}"', f'id="{pref}{i}"').replace(f'url(#{i})', f'url(#{pref}{i})').replace(f'href="#{i}"', f'href="#{pref}{i}"')
    out[chave] = s
with open(os.path.join(root, 'js', 'marca-svg.js'), 'w', encoding='utf-8') as f:
    f.write('// GERADO por tools/gerar-marca.py a partir de assets/brand/*.svg. Não edite à mão.\n')
    f.write('export const MARCA_SVG = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
print('marca-svg.js gerado:', ', '.join(out))
