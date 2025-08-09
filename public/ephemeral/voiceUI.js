(function () {
  const overlay = document.createElement('div'); overlay.className = 'overlay';
  const bar = document.createElement('div'); bar.className = 'bar';
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/ephemeral/ephemeral.css';
  document.head.appendChild(link);
  document.body.appendChild(overlay);
  document.body.appendChild(bar);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = SR ? new SR() : null;
  if (recognition) { recognition.interimResults = false; recognition.lang = 'en-US'; recognition.maxAlternatives = 1; }

  let audioCtx, analyser, micSource, raf;
  async function startAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 256;
    micSource = audioCtx.createMediaStreamSource(stream); micSource.connect(analyser);
    visualize();
  }
  function stopAudio() { cancelAnimationFrame(raf); try { audioCtx && audioCtx.close(); } catch {} }
  function visualize() {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => { analyser.getByteFrequencyData(data); let s=0; for (let i=0;i<24;i++) s+=data[i]; const amp=s/24/255; bar.style.transform=`scaleY(${1+amp*2.0})`; raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
  }

  function start() {
    overlay.classList.add('show'); bar.classList.add('live');
    startAudio().catch(()=>{});
    if (!recognition) { console.warn('[Ephemeral] SpeechRecognition not available'); return; }
    try { recognition.abort(); } catch {}
    recognition.onresult = (e) => { const t = e.results[0][0].transcript; console.log('[Ephemeral] voice:', t); };
    recognition.onerror = (e) => { console.warn('[Ephemeral] mic error', e); };
    recognition.start();
  }
  function stop() {
    overlay.classList.remove('show'); bar.classList.remove('live'); stopAudio(); try { recognition && recognition.stop(); } catch {}
  }

  const isEditable = el => { const tag=(el.tagName||'').toLowerCase(); return tag==='input'||tag==='textarea'||el.isContentEditable||tag==='select'; };
  let pressed=false;
  window.addEventListener('keydown', (e) => { if (pressed) return; if (e.code==='Space' && !isEditable(e.target)) { e.preventDefault(); pressed=true; start(); } }, { capture: true });
  window.addEventListener('keyup', (e) => { if (!pressed) return; if (e.code==='Space') { e.preventDefault(); pressed=false; stop(); } }, { capture: true });
})();


