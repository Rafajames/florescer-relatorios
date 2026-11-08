// Aparência por aparelho: tema (automático/claro/escuro), tamanho da letra e contraste.
const KEY = 'florescer.look.v1';
export const DEFAULT_LOOK = { theme: 'auto', size: 'normal', contrast: 'normal' };

export function getLook() {
  try { return { ...DEFAULT_LOOK, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULT_LOOK }; }
}
export function applyLook(look = getLook()) {
  const h = document.documentElement;
  if (look.theme === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', look.theme);
  if (look.size === 'normal') h.removeAttribute('data-fs'); else h.setAttribute('data-fs', look.size === 'xl' ? 'xl' : 'lg');
  if (look.contrast === 'high') h.setAttribute('data-contrast', 'high'); else h.removeAttribute('data-contrast');
}
export function setLook(patch) {
  const next = { ...getLook(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sem armazenamento */ }
  applyLook(next);
  return next;
}
