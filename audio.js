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
    return ctx;
  }

  // À appeler depuis un geste de l'utilisateur (obligatoire sur iPhone/iPad).
  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'running') {
      if (musicWanted && !timer) startScheduler();
      return;
    }
    c.resume();
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    if (musicWanted && !timer) startScheduler();
  }

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
    const base = [620, 420, 520][kind] || 500;
    tone(base, t, 0.16, 'square', 0.22, sfxBus, base * 2.2);
    tone(base * 1.5, t + 0.05, 0.12, 'triangle', 0.3);
    noise(t, 0.08, 0.35, sfxBus, 2000);
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
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  return { unlock, startMusic, stopMusic, hit, miss, popUp, beep, fanfare, setMuted };
})();
