import { state } from './state.js';
import { fmtDate } from './ui.js';

// Preferências do profissional (salvas no perfil, acompanham a conta em qualquer computador)
export const DEFAULT_PREFS = {
  detail: 'padrao',            // resumido | padrao | detalhado
  instructions: '',            // instruções fixas para a IA
  flagUncertain: true,         // marcar trechos duvidosos com [verificar]
  autosave: true,              // salvar rascunhos automaticamente
  defaultTemplateId: '',       // modelo padrão de sessão
  titlePattern: 'Sessão de {data}',
  sectionsVisibleToPatient: true, // novas seções já nascem visíveis ao paciente
};

export const getPrefs = () => ({ ...DEFAULT_PREFS, ...((state.profile && state.profile.preferences) || {}) });
export const titleFromPattern = (pattern, dateISO) => String(pattern || DEFAULT_PREFS.titlePattern).split('{data}').join(fmtDate(dateISO));
