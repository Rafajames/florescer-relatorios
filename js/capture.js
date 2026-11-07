// Gravação de áudio no navegador. O áudio fica só em memória e é descartado
// depois da transcrição — nada é enviado ao banco de dados.
export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canLiveTranscribe = Boolean(SR);

export function createCapture({ onTick, onLive }) {
  let rec, stream, chunks = [], timer, startedAt, recog, wantLive = false, live = '';

  return {
    get recording() { return rec && rec.state === 'recording'; },

    async start({ liveText = false } = {}) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; live = ''; wantLive = liveText && Boolean(SR);
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
      // 32 kbps ≈ 14 MB por hora, abaixo do limite de 25 MB do Whisper
      rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
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
          stream.getTracks().forEach((t) => t.stop());
          clearInterval(timer);
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          chunks = [];
          resolve({ blob, live: live.trim() });
        };
        rec.stop();
      });
    },

    cancel() {
      wantLive = false;
      if (recog) { try { recog.stop(); } catch { /* ignora */ } }
      if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer); chunks = [];
    },
  };
}

export const fmtClock = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
