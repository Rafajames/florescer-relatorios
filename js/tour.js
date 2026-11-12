// Tour de primeiro acesso: mostra, em cinco passos, o caminho paciente → agenda → sessão → entrega → cobrança.
// Aparece uma vez por navegador; pode ser revisto pela Ajuda.
import { openModal, esc } from './ui.js';

const KEY = 'potira.tour.v1';
const PASSOS = [
  ['Comece pelos pacientes', 'Cadastre o paciente e registre o consentimento. Sem o consentimento, a gravação da sessão fica bloqueada.', '#/pacientes', 'Abrir Pacientes'],
  ['Monte a agenda', 'Em Administrativo, agende as sessões (dá para repetir toda semana), envie os lembretes de amanhã e veja quem confirmou.', '#/administrativo', 'Abrir a agenda'],
  ['Registre a sessão', 'Em Novo, grave ou digite a sessão e escreva a evolução. A IA é opcional: se estiver conectada, ela só faz o rascunho. Ao registrar, a sessão do dia fica como realizada.', '#/nova', 'Nova sessão'],
  ['Revise e entregue', 'Todo documento nasce como rascunho. Depois de revisar, você exporta em PDF, libera no portal ou envia por link com validade.', '#/relatorios', 'Ver relatórios'],
  ['Cobre e acompanhe', 'Em Financeiro, a sessão realizada vira cobrança: envie com o PIX pronto, registre o pagamento pelo comprovante e controle os gastos.', '#/financeiro', 'Abrir Financeiro'],
];
const visto = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const marcar = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sem armazenamento: o tour só não é lembrado */ } };

export async function startTour() {
  marcar();
  for (let i = 0; i < PASSOS.length; i++) {
    const [t, d, h, l] = PASSOS[i];
    const r = await openModal(`${i + 1} de ${PASSOS.length} · ${t}`, `
      <div class="tour-steps">${PASSOS.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div>
      <p>${esc(d)}</p><p><a class="btn quiet sm" href="${h}" data-tour-go>${esc(l)}</a></p>`,
    { okText: i === PASSOS.length - 1 ? 'Concluir' : 'Próximo', cancelText: 'Pular o tour', onOk: () => true,
      onOpen: (dlg) => dlg.querySelector('[data-tour-go]').addEventListener('click', () => dlg.querySelector('[data-cancel]').click()) });
    if (!r) return;
  }
}
/** Abre o tour só na primeira vez neste navegador. */
export const maybeTour = () => { if (!visto()) startTour(); };
