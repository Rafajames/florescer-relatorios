// Gravação de áudio no navegador. O áudio fica só em memória e é descartado
// depois da transcrição — nada é enviado ao banco de dados.
//
// Cadeia de áudio: microfone (e, opcionalmente, o áudio da aba) → ganho
// ajustável → compressor (evita estourar) → gravador. O medidor de volume lê
// o sinal já amplificado, para o profissional ver o que realmente é gravado.
export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canLiveTranscribe = Boolean(SR);
export const canCaptureTab = () => Boolean(navigator.mediaDevices?.getDisplayMedia);

const MIC_KEY = 'florescer.mic.v1';
const GAIN_KEY = 'florescer.gain.v1';
export const getSavedMic = () => { try { return localStorage.getItem(MIC_KEY) || ''; } catch { return ''; } };
export const setSavedMic = (id) => { try { localStorage.setItem(MIC_KEY, id || ''); } catch { /* ignora */ } };
export const getSavedGain = () => { try { return Number(localStorage.getItem(GAIN_KEY)) || 3; } catch { return 3; } };
export const setSavedGain = (g) => { try { localStorage.setItem(GAIN_KEY, String(g)); } catch { /* ignora */ } };

export async function listMics() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'audioinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Microfone ${i + 1}` }));
}

const micConstraints = (deviceId) => ({
  audio: {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    channelCount: 1,
  },
});

// Níveis: 0..1 (RMS). Abaixo de LOW o áudio tende a sair ruim na transcrição.
export const LEVEL_LOW = 0.04;

export function createCapture({ onTick, onLive, onLevel } = {}) {
  let rec, stream, tabStream, ctx, gainNode, analyser, dest, chunks = [], timer, startedAt, recog, wantLive = false, live = '', raf, peak = 0, sum = 0, n = 0;

  async function openGraph({ deviceId, gain, withTab }) {
    stream = await navigator.mediaDevices.getUserMedia(micConstraints(deviceId));
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    gainNode = ctx.createGain(); gainNode.gain.value = gain;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 24; comp.ratio.value = 6; comp.attack.value = 0.005; comp.release.value = 0.25;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(stream).connect(gainNode);
    if (withTab) {
      try {
        tabStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (tabStream.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(tabStream.getAudioTracks())).connect(gainNode);
        tabStream.getVideoTracks().forEach((t) => t.stop());
      } catch { tabStream = null; /* usuário cancelou: segue só com o microfone */ }
    }
    gainNode.connect(comp); comp.connect(analyser); comp.connect(dest);
    const buf = new Float32Array(analyser.fftSize);
    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length);
      peak = Math.max(peak, rms); sum += rms; n++;
      onLevel && onLevel(rms);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function closeGraph() {
    cancelAnimationFrame(raf);
    [stream, tabStream].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    stream = tabStream = ctx = null;
  }

  const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));

  return {
    get recording() { return rec && rec.state === 'recording'; },
    setGain(g) { if (gainNode) gainNode.gain.value = g; },
    get stats() { return { peak, avg: n ? sum / n : 0 }; },

    // Só abre o microfone para medir o volume (usado no "Testar microfone").
    async monitor({ deviceId, gain = 3 } = {}) { await openGraph({ deviceId, gain }); },
    stopMonitor() { closeGraph(); },

    async start({ liveText = false, deviceId, gain = 3, withTab = false } = {}) {
      if (!ctx) await openGraph({ deviceId, gain, withTab });
      chunks = []; live = ''; peak = 0; sum = 0; n = 0; wantLive = liveText && Boolean(SR);
      const mimeType = pickMime();
      // 40 kbps ≈ 18 MB por hora, abaixo do limite de 25 MB do Whisper
      rec = new MediaRecorder(dest.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 40000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(1000);

      if (wantLive) {
        recog = new SR();
        recog.lang = 'pt-BR'; recog.continuous = true; recog.interimResults = false;
        recog.onresult = (ev) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) { live += ev.results[i][0].transcript + ' '; onLive && onLive(live); }
          }
        };
        recog.onend = () => { if (wantLive && rec && rec.state === 'recording') { try { recog.start(); } catch { /* já iniciado */ } } };
        try { recog.start(); } catch { /* ignora */ }
      }
      startedAt = Date.now();
      timer = setInterval(() => onTick && onTick(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    },

    stop() {
      return new Promise((resolve) => {
        wantLive = false;
        if (recog) { try { recog.stop(); } catch { /* ignora */ } }
        rec.onstop = () => {
          clearInterval(timer);
          const stats = { peak, avg: n ? sum / n : 0 };
          closeGraph();
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          chunks = [];
          resolve({ blob, live: live.trim(), stats });
        };
        rec.stop();
      });
    },

    cancel() {
      wantLive = false;
      if (recog) { try { recog.stop(); } catch { /* ignora */ } }
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
      clearInterval(timer); chunks = []; closeGraph();
    },
  };
}

export const fmtClock = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
