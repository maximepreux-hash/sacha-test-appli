// Sons et musique générés en direct (aucun fichier audio à télécharger).
const Sound = (() => {
  'use strict';
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false;
  let musicWanted = false, timer = null, step = 0, nextTime = 0;

  const BPM = 124;
  const EIGHTH = 60 / BPM / 2;

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    prepare();
    return ctx;
  }

  // --- iPhone/iPad : jouer le son même quand le bouton « silencieux » est activé ---
  // iOS 17+ : on déclare que le jeu « joue » du son (comme une appli de musique).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignoré */ }

  // Versions plus anciennes d'iOS : un petit son muet en boucle dans une balise <audio>
  // fait passer la page en mode « lecture », ce qui débloque aussi les sons du jeu.
  let keepAlive = null;
  function silentWavUrl() {
    const rate = 8000, n = rate; // 1 seconde de silence
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function startKeepAlive() {
    if (navigator.audioSession) return; // inutile sur iOS 17+
    try {
      if (!keepAlive) {
        keepAlive = document.createElement('audio');
        keepAlive.src = silentWavUrl();
        keepAlive.loop = true;
        keepAlive.setAttribute('playsinline', '');
        keepAlive.setAttribute('x-webkit-airplay', 'deny');
      }
      if (keepAlive.paused && !document.hidden) {
        const pr = keepAlive.play();
        if (pr && pr.catch) pr.catch(() => {});
      }
    } catch (e) { /* ignoré */ }
  }

  // À appeler depuis un geste de l'utilisateur (obligatoire sur iPhone/iPad et Android).
  function unlock() {
    const c = ensure();
    if (!c) return;
    startKeepAlive();
    if (c.state !== 'running') {
      // 'suspended' au démarrage, 'interrupted' après un appel ou un retour d'arrière-plan
      try {
        const pr = c.resume();
        if (pr && pr.then) pr.then(() => { if (musicWanted && !timer) startScheduler(); }).catch(() => {});
      } catch (e) { /* ignoré */ }
      try {
        const b = c.createBuffer(1, 1, 22050);
        const s = c.createBufferSource();
        s.buffer = b;
        s.connect(c.destination);
        s.start(0);
      } catch (e) { /* ignoré */ }
    }
    if (musicWanted && !timer) startScheduler();
  }

  // Les navigateurs n'autorisent le son qu'après certains gestes (souvent quand le doigt se lève),
  // donc on essaie à chacun d'eux.
  ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach((ev) => {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  function tone(freq, start, dur, type, vol, dest, slideTo) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest || sfxBus);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function noise(start, dur, vol, dest, hp) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp || 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(start);
    s.stop(start + dur + 0.02);
  }

  // ---------- Musique : petite boucle joyeuse (Do – Sol – La m – Fa) ----------
  const ROOTS = [48, 43, 45, 41];
  const MELODY = [
    72, 76, 79, 76, 74, 72, 74, 0,
    71, 74, 79, 74, 72, 71, 67, 0,
    72, 76, 81, 79, 76, 74, 72, 0,
    69, 72, 77, 76, 74, 72, 74, 76,
    76, 0, 76, 79, 81, 79, 76, 0,
    74, 0, 74, 79, 83, 79, 74, 0,
    72, 0, 76, 81, 84, 81, 76, 0,
    77, 76, 74, 72, 74, 0, 72, 0,
  ];

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8) % 4;
    const pos = i % 8;
    const root = ROOTS[bar];
    const bass = [root, 0, root + 12, 0, root, root + 7, root + 12, 0][pos];
    if (bass) tone(midi(bass), t, EIGHTH * 0.9, 'sine', 0.9, musicBus);
    const m = MELODY[i % MELODY.length];
    if (m) tone(midi(m), t, EIGHTH * 0.85, 'triangle', 0.55, musicBus);
    if (pos === 0 || pos === 4) tone(140, t, 0.12, 'sine', 0.9, musicBus, 45);
    noise(t, pos % 2 ? 0.03 : 0.05, pos % 2 ? 0.12 : 0.2, musicBus, 7000);
  }

  function startScheduler() {
    if (!ctx || timer) return;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(() => {
      if (ctx.state !== 'running') return;
      if (nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.05;
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime);
        step++;
        nextTime += EIGHTH;
      }
    }, 25);
  }

  function startMusic() {
    musicWanted = true;
    if (ctx) startScheduler();
  }
  function stopMusic() {
    musicWanted = false;
    clearInterval(timer);
    timer = null;
  }

  // ---------- Effets ----------
  const now = () => (ctx ? ctx.currentTime : 0);

  function hit(kind) {
    if (!ctx) return;
    const t = now();
    if (kind === 'ball') {
      // pok… pok.. pok. comme une balle de ping-pong qui rebondit
      [0, 0.16, 0.27, 0.35, 0.4].forEach((d, i) => tone(1500 + i * 120, t + d, 0.05, 'sine', 0.7 - i * 0.12));
      return;
    }
    // petit carillon joyeux « cou-cou ! » (une hauteur différente pour chacun)
    const base = [79, 72, 76][kind] || 76;
    tone(midi(base), t, 0.14, 'triangle', 0.5);
    tone(midi(base - 4), t + 0.13, 0.22, 'triangle', 0.5);
    tone(midi(base + 12), t, 0.25, 'sine', 0.18);
    [0, 0.05, 0.1].forEach((d, i) => tone(midi(base + 7 + i * 5), t + 0.25 + d, 0.12, 'sine', 0.12));
  }
  // ---------- Sons « réalistes » fabriqués échantillon par échantillon ----------
  // (plus naturels que des notes de synthétiseur ; 3 variantes de chaque, tirées au hasard)

  // Résonateur à deux pôles : fait « sonner » une impulsion à une fréquence donnée.
  function resonator(fc, bw, sr) {
    const r = Math.exp(-Math.PI * bw / sr);
    const a1 = 2 * r * Math.cos(2 * Math.PI * fc / sr), a2 = -r * r;
    let y1 = 0, y2 = 0;
    return (x) => { const y = x + a1 * y1 + a2 * y2; y2 = y1; y1 = y; return y; };
  }
  function normalize(d, peak) {
    let m = 0;
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
  }

  // CLAQUE : un « clac » de peau très bref et brillant + un petit choc sourd + l'écho de la pièce
  function makeSlap(sr) {
    const n = Math.floor(sr * 0.22);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const skin = resonator(1100 + Math.random() * 600, 900, sr);
    const crack = resonator(3200 + Math.random() * 800, 2500, sr);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = t < 0.0006 ? t / 0.0006 : Math.exp(-(t - 0.0006) / 0.007);
      const w = Math.random() * 2 - 1;
      const hp = w - prev; prev = w; // enlève les graves du souffle
      const noise = hp * env;
      const body = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t / 0.018) * 0.35;
      d[i] = skin(noise) * 0.3 + crack(noise) * 0.12 + noise * 0.25 + body * 0.7;
    }
    // échos très courts (la pièce)
    const out = new Float32Array(n);
    [[0, 1], [0.009, 0.22], [0.019, 0.13], [0.031, 0.07]].forEach(([dt, g]) => {
      const off = Math.floor(dt * sr);
      for (let i = 0; i + off < n; i++) out[i + off] += d[i] * g;
    });
    d.set(out);
    normalize(d, 0.95);
    return buf;
  }

  // PROUT : une suite d'impulsions graves irrégulières (≈ 70-130 par seconde) qui font
  // résonner des fréquences basses, avec un volume qui « gargouille » et un pfff final.
  function makeFart(sr) {
    const dur = 0.55 + Math.random() * 0.45;
    const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r1 = resonator(170 + Math.random() * 60, 110, sr);
    const r2 = resonator(420 + Math.random() * 120, 220, sr);
    const r3 = resonator(90, 60, sr);
    const startF = 95 + Math.random() * 40, endF = 55 + Math.random() * 15;
    const squeak = Math.random() < 0.4;
    const wob = 6 + Math.random() * 6;
    let nextPulse = 0, nf = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = t / dur;
      let f = startF + (endF - startF) * k;
      if (squeak && k > 0.8) f *= 1 + (k - 0.8) * 4;
      let x = 0;
      if (i >= nextPulse) {
        x = 0.7 + Math.random() * 0.6;
        nextPulse = i + Math.floor(sr / (f * (0.94 + Math.random() * 0.12)));
      }
      const attack = Math.min(1, t / 0.015);
      const release = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
      const gurgle = 0.65 + 0.35 * Math.sin(2 * Math.PI * wob * t + Math.sin(2 * Math.PI * 2.3 * t) * 2);
      const env = attack * release * gurgle;
      nf = nf * 0.97 + (Math.random() * 2 - 1) * 0.03; // souffle grave
      // les résonateurs amplifient beaucoup : on ramène tout à la même échelle
      const v = (r1(x) * 1.0 + r2(x) * 0.5 + r3(x) * 0.5) / 1500 + nf * 0.25 * (0.3 + k);
      d[i] = v * env;
    }
    normalize(d, 1);
    for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * 1.8); // un peu de grain
    normalize(d, 0.95);
    return buf;
  }

  let slapBufs = null, fartBufs = null;
  function prepare() {
    if (slapBufs || !ctx) return;
    const sr = ctx.sampleRate;
    slapBufs = [makeSlap(sr), makeSlap(sr), makeSlap(sr)];
    fartBufs = [makeFart(sr), makeFart(sr), makeFart(sr)];
  }
  function playBuf(buf, at, vol) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g); g.connect(master);
    s.start(at);
  }

  function slap(kind, delay) {
    if (!ctx) return;
    prepare();
    playBuf(slapBufs[Math.floor(Math.random() * slapBufs.length)], now() + (delay || 0), 0.9);
  }

  function fart(delay) {
    if (!ctx) return;
    prepare();
    playBuf(fartBufs[Math.floor(Math.random() * fartBufs.length)], now() + (delay || 0), 1.0);
  }

  function miss() {
    if (!ctx) return;
    tone(320, now(), 0.07, 'sine', 0.25, sfxBus, 200);
  }
  function popUp() {
    if (!ctx) return;
    tone(380, now(), 0.09, 'sine', 0.08, sfxBus, 720);
  }
  function beep(high) {
    if (!ctx) return;
    tone(high ? 990 : 660, now(), high ? 0.35 : 0.15, 'square', 0.18);
  }
  function fanfare() {
    if (!ctx) return;
    const t = now();
    [72, 76, 79, 84].forEach((m, i) => tone(midi(m), t + i * 0.12, 0.2, 'square', 0.18));
    [72, 76, 79, 84].forEach((m) => tone(midi(m), t + 0.5, 0.8, 'triangle', 0.25));
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      ctx.suspend().catch(() => {});
      if (keepAlive) keepAlive.pause();
    } else {
      ctx.resume().catch(() => {});
    }
  });

  // Petit test pour les réglages : une mélodie courte et bien audible.
  function test() {
    unlock();
    if (!ctx) return false;
    const t = now() + 0.05;
    [72, 76, 79, 84].forEach((m, i) => tone(midi(m), t + i * 0.15, 0.3, 'square', 0.25));
    return true;
  }

  const state = () => (ctx ? ctx.state : 'absent');

  return { unlock, startMusic, stopMusic, hit, slap, fart, miss, popUp, beep, fanfare, setMuted, test, state };
})();
