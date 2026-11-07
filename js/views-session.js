import * as api from './api.js';
import * as ai from './ai.js';
import { createCapture, canRecord, canLiveTranscribe, fmtClock } from './capture.js';
import { state } from './state.js';
import { getPrefs, titleFromPattern } from './prefs.js';
import {
  $, $$, esc, todayISO, toast, busy, autosize, wordCount, callout, shell, loading, pageHeader, icon,
} from './ui.js';

const goto = (h) => { location.hash = h; };

export async function renderNewSession(params) {
  const main = shell('nova'); loading(main);
  const [patients, templates] = await Promise.all([api.listPatients(), api.listTemplates()]);
  const prefs = getPrefs();
  const sessionTpls = templates.filter((t) => t.kind === 'sessao');
  const tplById = Object.fromEntries(sessionTpls.map((t) => [t.id, t]));
  const defTpl = tplById[prefs.defaultTemplateId] || sessionTpls.find((t) => t.specialty === state.profile.specialty) || sessionTpls[0];
  const pre = params.get('paciente');

  if (!patients.length) {
    main.innerHTML = pageHeader('Nova sessão') + `<div class="empty"><b>Cadastre um paciente primeiro</b>
      Você precisa de ao menos um paciente para registrar uma sessão.<br><br><a class="btn" href="#/pacientes">Cadastrar paciente</a></div>`;
    return;
  }

  main.innerHTML = pageHeader('Nova sessão', 'Três passos: escolher, captar e gerar o esboço.') + `
    <div class="steps">
      <section class="step" id="s1">
        <span class="num">1</span><h2>Paciente e modelo</h2>
        <div class="grid2">
          <label class="field">Paciente<select id="patient"><option value="">Selecione…</option>
            ${patients.map((p) => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label class="field">Modelo de relatório<select id="tpl">
            ${sessionTpls.map((t) => `<option value="${t.id}" ${t === defTpl ? 'selected' : ''}>${esc(t.name)}${t.specialty ? ' (' + esc(t.specialty) + ')' : ''}</option>`).join('')}</select></label>
          <label class="field">Data da sessão<input type="date" id="date" value="${todayISO()}"></label>
          <label class="field">Título<input id="title" value="${esc(titleFromPattern(prefs.titlePattern, todayISO()))}"></label>
        </div>
        <p class="tpl-preview" id="tpl-preview"></p>
      </section>

      <section class="step" id="s2">
        <span class="num">2</span><h2>Captar a sessão</h2>
        <div id="gate"></div>
        <div class="rec-row">
          <button class="rec-btn" id="rec" ${canRecord() ? '' : 'disabled'}><span class="dot"></span><span id="rec-label">Gravar sessão</span></button>
          <span class="rec-clock" id="clock"></span>
          <label class="btn quiet" id="file-label">${icon('download')}Enviar áudio gravado<input type="file" id="file" accept="audio/*" hidden></label>
        </div>
        <p class="muted small" style="margin-top:10px">O áudio fica só na memória do navegador e é descartado depois de transcrito. Só o texto é guardado, para você conferir o que a IA escreveu.${ai.hasWhisperKey() ? '' : ' Sem a chave Whisper, a gravação usa a transcrição ao vivo do navegador (Chrome ou Edge) e o envio de arquivos fica indisponível.'}</p>
        <div id="live" class="livetext hide"></div>
        <label class="field" style="margin-top:14px">Transcrição
          <small>Você pode digitar, colar ou corrigir o texto antes de gerar o esboço.</small>
          <textarea id="transcript" rows="9" placeholder="A transcrição aparece aqui."></textarea></label>
        <div class="row between small muted"><span id="wc">0 palavras</span><button class="link" id="clear">Limpar transcrição</button></div>
      </section>

      <section class="step" id="s3">
        <span class="num">3</span><h2>Gerar o relatório</h2>
        <div class="grid2">
          <label class="field">Nível de detalhe
            <select id="detail">${[['resumido', 'Resumido (2 a 3 frases por seção)'], ['padrao', 'Padrão (2 a 5 frases)'], ['detalhado', 'Detalhado (até um parágrafo)']]
              .map(([v, l]) => `<option value="${v}" ${v === prefs.detail ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="check" style="margin-top:26px"><input type="checkbox" id="flag" ${prefs.flagUncertain ? 'checked' : ''}>Marcar trechos duvidosos com [verificar]</label>
        </div>
        <label class="field">Instruções extras para esta sessão (opcional)
          <textarea id="extra" rows="2" placeholder="Ex.: destacar o relato sobre sono; usar linguagem acessível para a família."></textarea></label>
        <div id="ai-warn"></div>
        <div class="row">
          <button class="btn bloom lg" id="gen">${icon('sparkle')}Gerar esboço e abrir</button>
          <button class="btn quiet" id="blank">Criar em branco</button>
        </div>
        <p class="muted small" id="why" style="margin-top:8px"></p>
      </section>
    </div>`;

  const cap = createCapture({
    onTick: (s) => ($('#clock').textContent = fmtClock(s)),
    onLive: (t) => { const l = $('#live'); l.classList.remove('hide'); l.textContent = 'Ao vivo: ' + t.slice(-300); },
  });
  let consentOk = false;

  const showTpl = () => {
    const t = tplById[$('#tpl').value];
    $('#tpl-preview').textContent = t ? 'Seções: ' + t.sections.map((s) => s.title).join(', ') : '';
  };
  const refresh = () => {
    const pid = $('#patient').value;
    const hasText = $('#transcript').value.trim().length > 0;
    const hasKey = ai.hasClaudeKey();
    $('#s1').classList.toggle('done', Boolean(pid));
    $('#s2').classList.toggle('done', hasText);
    $('#s1').classList.toggle('now-on', !pid);
    $('#s2').classList.toggle('now-on', Boolean(pid) && !hasText);
    $('#s3').classList.toggle('now-on', hasText);

    // bloqueio de gravação sem consentimento
    let msg = '';
    if (!pid) msg = 'Escolha o paciente no passo 1 para liberar a gravação.';
    else if (!consentOk) msg = 'Este paciente ainda não tem consentimento registrado. A gravação e o envio de áudio ficam bloqueados, mas você pode digitar ou colar o texto.';
    $('#gate').innerHTML = msg ? callout(`<p>${esc(msg)}</p>`, 'warn', pid && !consentOk ? `<a class="btn sm" href="#/pacientes/${pid}">Registrar consentimento</a>` : '') : '';
    const rec = cap.recording;
    $('#rec').disabled = !canRecord() || Boolean(msg) && !rec;
    $('#file-label').classList.toggle('disabled', Boolean(msg) || rec || !ai.hasWhisperKey());
    $('#file').disabled = Boolean(msg) || rec || !ai.hasWhisperKey();

    $('#ai-warn').innerHTML = hasKey ? '' : callout('<p>Cadastre a chave da Anthropic para gerar o esboço com IA.</p>', '', '<a class="btn sm quiet" href="#/config?aba=chaves">Cadastrar chave</a>');
    $('#gen').disabled = !pid || !hasText || !hasKey;
    $('#blank').disabled = !pid;
    $('#why').textContent = !pid ? 'Escolha o paciente para continuar.' : !hasText ? 'Falta a transcrição para gerar o esboço. Você também pode criar o relatório em branco.' : '';
    $('#wc').textContent = `${wordCount($('#transcript').value)} palavras`;
  };

  $('#patient').onchange = async () => {
    const pid = $('#patient').value;
    consentOk = pid ? api.hasActiveConsent(await api.listConsents(pid)) : false;
    refresh();
  };
  $('#tpl').onchange = showTpl;
  $('#date').onchange = () => { $('#title').value = titleFromPattern(prefs.titlePattern, $('#date').value || todayISO()); };
  $('#transcript').oninput = (e) => { autosize(e.target); refresh(); };
  $('#clear').onclick = () => { $('#transcript').value = ''; refresh(); };
  showTpl();
  if (pre) await $('#patient').onchange(); else refresh();

  const appendText = (t) => {
    const ta = $('#transcript');
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + t;
    autosize(ta); refresh();
  };

  $('#rec').onclick = async () => {
    if (cap.recording) {
      const { blob, live } = await cap.stop();
      $('#rec').classList.remove('live'); $('#rec-label').textContent = 'Gravar sessão';
      $('#live').classList.add('hide'); $('#clock').textContent = '';
      if (ai.hasWhisperKey()) {
        const lab = $('#rec-label'); lab.textContent = 'Transcrevendo…'; $('#rec').disabled = true;
        try { appendText(await ai.transcribeAudio(blob)); toast('Transcrição concluída. O áudio foi descartado.'); }
        catch (err) { toast(err.message, 'err'); }
        lab.textContent = 'Gravar sessão';
      } else if (live) { appendText(live); toast('Transcrição ao vivo adicionada. O áudio foi descartado.'); }
      else toast('Nada foi transcrito. Cadastre a chave Whisper em Configurações ou digite o texto.', 'err');
      refresh();
      return;
    }
    try {
      await cap.start({ liveText: !ai.hasWhisperKey() && canLiveTranscribe });
      $('#rec').classList.add('live'); $('#rec-label').textContent = 'Parar e transcrever';
      refresh();
    } catch { toast('Não foi possível acessar o microfone. Verifique a permissão do navegador.', 'err'); }
  };
  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#file-label').classList.add('disabled');
    try { toast('Transcrevendo áudio…'); appendText(await ai.transcribeAudio(f)); toast('Transcrição concluída. O arquivo não foi guardado.'); }
    catch (err) { toast(err.message, 'err'); }
    e.target.value = ''; refresh();
  };

  const create = async (withAI, btn) => {
    const patient_id = $('#patient').value;
    const tpl = tplById[$('#tpl').value];
    const transcript = $('#transcript').value.trim();
    await busy(btn, withAI ? 'Gerando esboço…' : 'Criando…', async () => {
      const vis = prefs.sectionsVisibleToPatient;
      let sections = tpl.sections.map((s) => ({ title: s.title, text: '', patient_visible: vis }));
      if (withAI) {
        const out = await ai.generateSessionSections({
          template: tpl.sections, transcript,
          options: { detail: $('#detail').value, flagUncertain: $('#flag').checked, instructions: prefs.instructions, extra: $('#extra').value },
        });
        sections = out.map((s) => ({ ...s, patient_visible: vis }));
      }
      const rep = await api.createReport({
        patient_id, template_id: tpl.id, kind: 'sessao',
        title: $('#title').value.trim() || 'Sessão', session_date: $('#date').value || todayISO(),
        transcript: transcript || null, sections, ai_generated: withAI,
      });
      goto(`#/relatorio/${rep.id}`);
    });
  };
  $('#gen').onclick = (e) => create(true, e.target);
  $('#blank').onclick = (e) => create(false, e.target);
  window.__cleanup = () => cap.cancel();
}
