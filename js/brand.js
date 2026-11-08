// Marca própria de cada profissional: logo, cores, nome, rodapé e assinatura.
// Fica no perfil (banco) e uma cópia pública mínima fica neste navegador, para
// a tela de login já aparecer com a marca de quem usou por último.
export const DEFAULT_BRAND = {
  org_name: '', logo: '', color: '#134B5F', accent: '#B83D6F', tagline: '', footer: '', signature: '',
};
export const PALETTES = [
  { name: 'Petróleo e amora', color: '#134B5F', accent: '#B83D6F' },
  { name: 'Verde e coral', color: '#1F5C4A', accent: '#D4604A' },
  { name: 'Azul e âmbar', color: '#1E3F6E', accent: '#C27A12' },
  { name: 'Ameixa e verde', color: '#4B2A5E', accent: '#2E8B6A' },
  { name: 'Grafite e turquesa', color: '#2B3640', accent: '#0F8F9D' },
  { name: 'Vinho e dourado', color: '#6B1F3A', accent: '#B8892B' },
];

const CACHE = 'florescer.brand.v1';
const HEX = /^#[0-9a-fA-F]{6}$/;

export const brandOf = (profile) => {
  const b = (profile && profile.branding) || {};
  return {
    ...DEFAULT_BRAND, ...b,
    org_name: b.org_name || (profile && profile.clinic_name) || '',
    color: HEX.test(b.color) ? b.color : DEFAULT_BRAND.color,
    accent: HEX.test(b.accent) ? b.accent : DEFAULT_BRAND.accent,
    slug: (profile && profile.slug) || '',
  };
};

/* ---------- cores ---------- */
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (h, other, t) => { const a = hexToRgb(h), b = hexToRgb(other); return rgbToHex(a.map((v, i) => v + (b[i] - v) * t)); };
export const darken = (h, t = 0.22) => mix(h, '#000000', t);
export const tint = (h, t = 0.88) => mix(h, '#ffffff', t);

export function applyBrand(b) {
  const c = HEX.test(b?.color) ? b.color : DEFAULT_BRAND.color;
  const a = HEX.test(b?.accent) ? b.accent : DEFAULT_BRAND.accent;
  const s = document.documentElement.style;
  s.setProperty('--petrol', c); s.setProperty('--petrol-2', darken(c)); s.setProperty('--petrol-tint', tint(c, 0.9));
  s.setProperty('--bloom', a); s.setProperty('--bloom-2', darken(a, 0.18)); s.setProperty('--bloom-tint', tint(a, 0.9));
  document.title = b?.org_name ? `${b.org_name}` : 'Florescer Relatórios';
}

/* ---------- cópia neste navegador (tela de login) ---------- */
export const rememberBrand = (b) => {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ org_name: b.org_name, logo: b.logo, color: b.color, accent: b.accent, tagline: b.tagline, slug: b.slug }));
  } catch { /* cota cheia: ignora */ }
};
export const cachedBrand = () => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; } };
export const forgetBrand = () => { try { localStorage.removeItem(CACHE); } catch { /* ignora */ } };

/* ---------- imagem enviada pelo profissional ---------- */
/** Reduz a imagem (mantém transparência) e devolve um data URL pequeno. */
export function imageToDataUrl(file, { max = 400, maxBytes = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) return reject(new Error('Envie uma imagem PNG, JPG, WEBP ou SVG.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/png');
      if (out.length > maxBytes) out = c.toDataURL('image/jpeg', 0.85);
      if (out.length > maxBytes * 1.4) return reject(new Error('A imagem ficou grande demais. Use uma logo mais simples ou menor.'));
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir esta imagem.')); };
    img.src = url;
  });
}

export const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
