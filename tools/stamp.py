#!/usr/bin/env python3
"""Carimba a versão nos arquivos para o navegador nunca carregar uma versão antiga.
Rode antes de cada commit: python3 tools/stamp.py"""
import glob, hashlib, json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted(glob.glob(os.path.join(root, 'js', '*.js')))
h = hashlib.sha1()
for f in files + [os.path.join(root, 'css', 'app.css')]:
    h.update(open(f, 'rb').read())
v = h.hexdigest()[:10]
imap = {'imports': {f'./js/{os.path.basename(f)}': f'./js/{os.path.basename(f)}?v={v}' for f in files}}
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
s = re.sub(r'<script type="importmap">.*?</script>\n?', '', s, flags=re.S)
s = re.sub(r'<link rel="stylesheet" href="css/app\.css[^"]*">', f'<link rel="stylesheet" href="css/app.css?v={v}">', s)
s = re.sub(r'<script type="module" src="js/main\.js[^"]*"></script>', f'<script type="importmap">{json.dumps(imap)}</script>\n<script type="module" src="js/main.js?v={v}"></script>', s)
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(s)
print('versão', v)
