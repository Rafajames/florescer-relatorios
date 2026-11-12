import * as api from './api.js';
import * as ai from './ai.js';
import {
  createCapture, canRecord, canLiveTranscribe, canCaptureTab, fmtClock, listMics,
  getSavedMic, setSavedMic, getSavedGain, setSavedGain, LEVEL_LOW,
} from './capture.js';
import { state } from './state.js';
import { getPrefs, titleFromPattern } from './prefs.js';
import {
  $, $$, esc, todayISO, toast, busy, autosize, wordCount, callout, shell, loading, pageHeader, icon, dropzone, bindDrops, emptyState,
} from './ui.js';

const goto = (h) => { location.hash = h; };
const KIND = {
  sessao: { name: 'Nova evolução', noun: 'evolução', pattern: null, tplKind: 'sessao', sub: 'Três passos: escolher, captar e gerar o relatório. Você pode abrir o relatório e editar a qualquer momento.' },
  anamnese: { name: 'Nova anamnese', noun: 'anamnese', pattern: 'Anamnese de {data}', tplKind: 'anamnese', sub: 'Entrevista inicial: escolha o modelo, capte a conversa e gere o registro. Você pode abrir e editar a qualquer momento.' },
};

export async function renderNewSession(params) {
  const kind = params.get('tipo') === 'anamnese' ? 'anamnese' : 'sessao';
  const K = KIND[kind];
  const main = shell('nova'); loading(main);
  const [patients, templates] = await Promise.all([api.listPatients(), api.listTemplates()]);
  const prefs = getPrefs();
  const tpls = api.templatesForMe(templates, state.profile).filter((t) => t.kind === K.tplKind);
  const tplById = Object.fromEntries(tpls.map((t) => [t.id, t]));
  const defTpl = tplById[kind === 'sessao' ? prefs.defaultTemplateId : prefs.defaultAnamneseTemplateId]
    || tpls.find((t) => t.specialty === state.profile.specialty) || tpls.find((t) => t.specialty === 'Geral') || tpls[0];
  const pre = params.get('paciente');
  const titleFor = (date) => (K.pattern ? K.pattern.split('{data}').join(new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')) : titleFromPattern(prefs.titlePattern, date));

  if (!patients.length) {
    main.innerHTML = pageHeader(K.name) + `<div class="empty"><b>Cadastre um paciente primeiro</b>
      Você precisa de ao menos um paciente para registrar uma ${K.noun}.<br><br><a class="btn" href="#/pacientes">Cadastrar paciente</a></div>`;
    return;
  }
  if (!tpls.length) {
    main.innerHTML = pageHeader(K.name) + `<div class="empty"><b>Nenhum modelo de ${K.noun} disponível</b>
      Atualize o banco (rode o schema.sql de novo) ou crie um modelo em Modelos.<br><br><a class="btn" href="#/modelos">Ir para Modelos</a></div>`;
    return;
  }

  main.innerHTML = pageHeader(K.name, K.sub) + `
    <div class="steps">
      <section class="step" id="s1">
        <span class="num">1</span><h2>Paciente e modelo</h2>
        <div class="grid2">
          <label class="field">Paciente<select id="patient"><option value="">Selecione…</option>
            ${patients.map((p) => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label class="field">Modelo<select id="tpl">
            ${tpls.map((t) => `<option value="${t.id}" ${t === defTpl ? 'selected' : ''}>${esc(t.name)}${t.specialty ? ' (' + esc(t.specialty) + ')' : ''}</option>`).join('')}</select></label>
          <label class="field">Data<input type="date" id="date" value="${todayISO()}"></label>
          <label class="field">Título<input id="title" value="${esc(titleFor(todayISO()))}"></label>
        </div>
        <p class="tpl-preview" id="tpl-preview"></p>
      </section>

      <section class="step" id="s2">
        <span class="num">2</span><h2>Captar a conversa</h2>
        <div id="gate"></div>

        <details class="mic-box" id="mic-box">
          <summary>Microfone e volume</summary>
          <div class="grid2">
            <label class="field">Microfone<select id="mic"><option value="">Padrão do computador</option></select></label>
            <label class="field">Volume da gravação <span class="muted small" id="gain-l"></span>
              <input type="range" id="gain" min="1" max="8" step="0.5" style="padding:0;min-height:0"></label>
          </div>
          <div class="row">
            <button type="button" class="btn quiet sm" id="mic-test">Testar microfone (5 s)</button>
            <span class="muted small" id="mic-res"></span>
          </div>
          <p class="muted small" style="margin-top:8px">Dica: fale a cerca de 30 cm do microfone. No Mac, em Ajustes do Sistema → Som → Entrada, deixe o volume de entrada no máximo. Em sala grande, um microfone externo ajuda muito.</p>
        </details>

        <div class="rec-row rec-fixed">
          <button class="rec-btn" id="rec" ${canRecord() ? '' : 'disabled'}><span class="dot"></span><span id="rec-label">Gravar</span></button>
          <span class="rec-clock" id="clock"></span>
          <div class="meter" id="meter-wrap" aria-hidden="true"><i id="meter"></i></div>
          ${dropzone({ id: 'file', accept: 'audio/*', title: 'Enviar áudio já gravado', hint: 'Arraste o arquivo para cá ou clique.' }).replace('class="drop"', 'class="drop" id="file-label"')}
        </div>
        ${canCaptureTab() ? '<label class="check small" style="margin-top:8px"><input type="checkbox" id="tabaudio">Teleconsulta: captar também o áudio da aba da chamada (escolha a aba e marque “compartilhar áudio”)</label>' : ''}
        <p class="warn-low hide" id="low">${icon('info')}<span>Volume baixo. Aproxime o microfone ou aumente o volume da gravação acima.</span></p>
        <p class="muted small" style="margin-top:10px">O áudio fica só na memória do navegador e é descartado depois de transcrito. Só o texto é guardado, para você conferir o relatório.${ai.hasTranscribeAI() ? '' : ' Sem IA de transcrição, a gravação usa a transcrição ao vivo do navegador (Chrome ou Edge, grátis). Você também pode só digitar o que quiser abaixo.'}</p>
        <div id="live" class="livetext hide"></div>

        <label class="field" style="margin-top:14px">Anotações da sessão
          <small>Escreva à vontade durante a sessão. Entram no relatório junto com a transcrição.</small>
          <textarea id="notes" rows="4" placeholder="Anotações livres."></textarea></label>
        <label class="field">Transcrição
          <small>Você pode digitar, colar ou corrigir o texto a qualquer momento.</small>
          <textarea id="transcript" rows="8" placeholder="A transcrição aparece aqui."></textarea></label>
        <div class="row between small muted"><span id="wc">0 palavras</span><button class="link" id="clear">Limpar transcrição</button></div>
      </section>

      <section class="step" id="s3">
        <span class="num">3</span><h2>Abrir o relatório</h2>
        <p class="muted small" style="margin-top:-6px">O relatório pode ser aberto e editado a qualquer momento, mesmo no meio da sessão. O que já foi captado fica salvo nele.</p>
        <div id="ai-box"></div>
        <div class="row">
          <button class="btn bloom lg" id="gen">${icon('sparkle')}Gerar esboço com IA e abrir</button>
          <button class="btn ${ai.hasTextAI() ? 'quiet' : 'bloom lg'}" id="blank">Abrir o relatório para eu escrever</button>
        </div>
        <p class="muted small" id="why" style="margin-top:8px"></p>
      </section>
    </div>`;

  const cap = createCapture({
    onTick: (s) => { $('#clock').textContent = fmtClock(s); if (s === 12 && lowNow) $('#low').classList.remove('hide'); },
    onLive: (t) => { const l = $('#live'); l.classList.remove('hide'); l.textContent = 'Ao vivo: ' + t.slice(-300); },
    onLevel: (v) => { lastLevel = v; avg = avg * 0.97 + v * 0.03; lowNow = avg < LEVEL_LOW; $('#meter').style.width = Math.min(100, Math.sqrt(v) * 160) + '%'; },
  });
  let lastLevel = 0, avg = 0, lowNow = false, consentOk = false;
  void lastLevel;

  /* ---------- microfone ---------- */
  const fillMics = async () => {
    const list = await listMics().catch(() => []);
    const cur = getSavedMic();
    $('#mic').innerHTML = '<option value="">Padrão do computador</option>' + list.filter((m) => m.id && m.id !== 'default').map((m) => `<option value="${esc(m.id)}" ${m.id === cur ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  };
  fillMics();
  $('#mic').onchange = (e) => setSavedMic(e.target.value);
  const gainEl = $('#gain');
  gainEl.value = getSavedGain();
  const gainLabel = () => { $('#gain-l').textContent = `${gainEl.value}x`; };
  gainLabel();
  gainEl.oninput = () => { setSavedGain(+gainEl.value); gainLabel(); cap.setGain(+gainEl.value); };

  $('#mic-test').onclick = async (e) => {
    if (cap.recording) return toast('Pare a gravação antes de testar.', 'err');
    const btn = e.currentTarget; btn.disabled = true; avg = 0; $('#mic-res').textContent = 'Fale normalmente por 5 segundos…';
    try {
      await cap.start({ deviceId: $('#mic').value || undefined, gain: +gainEl.value });
      await new Promise((r) => setTimeout(r, 5000));
      const { blob, stats } = await cap.stop();
      await fillMics();
      const url = URL.createObjectURL(blob); const a = new Audio(url); a.onended = () => URL.revokeObjectURL(url); a.play().catch(() => {});
      $('#mic-res').textContent = stats.avg < LEVEL_LOW ? 'Volume baixo. Aumente o volume da gravação ou aproxime o microfone. Ouça o teste agora.' : stats.avg > 0.25 ? 'Volume alto: reduza um pouco o volume da gravação.' : 'Volume bom. Ouça o teste agora para conferir a qualidade.';
    } catch { $('#mic-res').textContent = 'Não foi possível acessar o microfone. Verifique a permissão do navegador.'; }
    $('#meter').style.width = '0'; btn.disabled = false;
  };

  /* ---------- tela ---------- */
  const showTpl = () => {
    const t = tplById[$('#tpl').value];
    $('#tpl-preview').textContent = t ? 'Campos: ' + t.sections.map((s) => s.title).join(', ') : '';
  };
  const hasText = () => Boolean($('#transcript').value.trim() || $('#notes').value.trim());
  const refresh = () => {
    const pid = $('#patient').value;
    const has = hasText();
    const hasAI = ai.hasTextAI();
    $('#s1').classList.toggle('done', Boolean(pid));
    $('#s2').classList.toggle('done', has);
    $('#s1').classList.toggle('now-on', !pid);
    $('#s2').classList.toggle('now-on', Boolean(pid) && !has);
    $('#s3').classList.toggle('now-on', has);

    let msg = '';
    if (!pid) msg = 'Escolha o paciente no passo 1 para liberar a gravação.';
    else if (!consentOk) msg = 'Este paciente ainda não tem consentimento registrado. A gravação e o envio de áudio ficam bloqueados, mas você pode digitar ou colar o texto.';
    $('#gate').innerHTML = msg ? callout(`<p>${esc(msg)}</p>`, 'warn', pid && !consentOk ? `<a class="btn sm" href="#/pacientes/${pid}">Registrar consentimento</a>` : '') : '';
    const rec = cap.recording;
    $('#rec').disabled = !canRecord() || Boolean(msg) && !rec;
    const canUpload = !msg && !rec && ai.hasTranscribeAI();
    $('#file-label').classList.toggle('disabled', !canUpload);
    $('#file').disabled = !canUpload;
    $('#file-label').title = ai.hasTranscribeAI() ? '' : 'Para transcrever arquivos, conecte Groq (grátis) ou OpenAI em Configurações → Chaves de IA.';

    $('#ai-box').innerHTML = hasAI ? `
      <div class="grid2">
        <label class="field">Nível de detalhe
          <select id="detail">${[['resumido', 'Resumido (2 a 3 frases por campo)'], ['padrao', 'Padrão (2 a 5 frases)'], ['detalhado', 'Detalhado (até um parágrafo)']]
            .map(([v, l]) => `<option value="${v}" ${v === ($('#detail')?.value || prefs.detail) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check" style="margin-top:26px"><input type="checkbox" id="flag" ${($('#flag') ? $('#flag').checked : prefs.flagUncertain) ? 'checked' : ''}>Marcar trechos duvidosos com [verificar]</label>
      </div>
      <label class="field">Instruções extras para esta ${K.noun} (opcional)
        <textarea id="extra" rows="2" placeholder="Ex.: destacar o relato sobre sono.">${esc($('#extra')?.value || '')}</textarea></label>`
      : callout('<p>Sem IA conectada, você escreve o relatório no editor. Quer o rascunho automático? Há opções gratuitas.</p>', '', '<a class="btn sm quiet" href="#/config?aba=chaves">Conectar IA</a>');
    $('#gen').classList.toggle('hide', !hasAI);
    $('#gen').disabled = !pid || !has;
    $('#blank').disabled = !pid;
    $('#why').textContent = !pid ? 'Escolha o paciente para continuar.' : hasAI && !has ? 'Para gerar o esboço, falta a transcrição ou alguma anotação.' : '';
    $('#wc').textContent = `${wordCount($('#transcript').value)} palavras`;
  };

  $('#patient').onchange = async () => {
    const pid = $('#patient').value;
    consentOk = pid ? api.hasActiveConsent(await api.listConsents(pid)) : false;
    refresh();
  };
  $('#tpl').onchange = showTpl;
  $('#date').onchange = () => { $('#title').value = titleFor($('#date').value || todayISO()); };
  $('#transcript').oninput = (e) => { autosize(e.target); refresh(); };
  $('#notes').oninput = (e) => { autosize(e.target); refresh(); };
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
      const { blob, live, stats } = await cap.stop();
      $('#rec').classList.remove('live'); $('#rec-label').textContent = 'Gravar';
      $('#live').classList.add('hide'); $('#clock').textContent = ''; $('#meter').style.width = '0'; $('#low').classList.add('hide');
      if (stats.avg < LEVEL_LOW) toast('A gravação ficou com volume baixo e a transcrição pode falhar. Confira o texto.', 'err');
      if (ai.hasTranscribeAI()) {
        const lab = $('#rec-label'); lab.textContent = 'Transcrevendo…'; $('#rec').disabled = true;
        try { appendText(await ai.transcribeAudio(blob)); toast('Transcrição concluída. O áudio foi descartado.'); }
        catch (err) { toast(err.message, 'err'); if (live) appendText(live); }
        lab.textContent = 'Gravar';
      } else if (live) { appendText(live); toast('Transcrição ao vivo adicionada. O áudio foi descartado.'); }
      else toast('Nada foi transcrito. Digite o texto ou conecte uma IA de transcrição em Configurações.', 'err');
      refresh();
      return;
    }
    try {
      avg = 0; lowNow = false;
      await cap.start({
        liveText: !ai.hasTranscribeAI() && canLiveTranscribe,
        deviceId: $('#mic').value || undefined, gain: +gainEl.value, withTab: Boolean($('#tabaudio')?.checked),
      });
      await fillMics();
      $('#rec').classList.add('live'); $('#rec-label').textContent = 'Parar e transcrever';
      refresh();
    } catch { toast('Não foi possível acessar o microfone. Verifique a permissão do navegador.', 'err'); }
  };
  bindDrops(main, null, { preview: false });
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
    const notes = $('#notes').value.trim();
    await busy(btn, withAI ? 'Gerando esboço…' : 'Abrindo…', async () => {
      const vis = prefs.sectionsVisibleToPatient;
      const keep = (s) => ({ title: s.title, ...(s.hint ? { hint: s.hint } : {}), ...(s.type && s.type !== 'longo' ? { type: s.type } : {}), ...(s.options ? { options: s.options } : {}) });
      let sections = tpl.sections.map((s) => ({ ...keep(s), text: '', patient_visible: vis }));
      if (withAI) {
        const out = await ai.generateSessionSections({
          template: tpl.sections, transcript, notes, kind,
          options: { detail: $('#detail').value, flagUncertain: $('#flag').checked, instructions: prefs.instructions, extra: $('#extra').value },
        });
        sections = out.map((s) => ({ ...s, patient_visible: vis }));
      }
      const rep = await api.createReport({
        patient_id, template_id: tpl.id, kind,
        title: $('#title').value.trim() || (kind === 'anamnese' ? 'Anamnese' : 'Evolução'), session_date: $('#date').value || todayISO(),
        transcript: transcript || null, notes: notes || null, sections, ai_generated: withAI,
      });
      if (kind === 'sessao') {
        try { const marcada = await api.markSessionRealized(patient_id, rep.session_date); if (marcada) toast('Sessão marcada como realizada e liberada para cobrança.'); }
        catch (err) { console.warn('Não foi possível marcar a sessão como realizada:', err); }
      }
      goto(`#/relatorio/${rep.id}`);
    });
  };
  $('#gen').onclick = (e) => create(true, e.currentTarget);
  $('#blank').onclick = (e) => create(false, e.currentTarget);
  window.__cleanup = () => cap.cancel();
}
