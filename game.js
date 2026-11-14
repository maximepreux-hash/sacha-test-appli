(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);

  // ---------- Réglages du jeu ----------
  const STORE_KEY = 'tapetete.v1';
  const ROUND_MS = 45000;
  const BALL_CHANCE = 0.12;
  const BRICK_COLORS = ['#d62828', '#f7c600', '#2a9d3f', '#1e6fd9', '#f77f00', '#d62828', '#2a9d3f', '#1e6fd9', '#f7c600'];
  const LEVELS = [
    { name: 'Facile', up: 1700, gapStart: 1100, gapEnd: 700, max: 2, stars: [15, 30, 45] },
    { name: 'Moyen', up: 1250, gapStart: 850, gapEnd: 520, max: 3, stars: [20, 40, 58] },
    { name: 'Rapide', up: 900, gapStart: 650, gapEnd: 380, max: 3, stars: [25, 50, 75] },
  ];
  const DEFAULT_CHARS = [
    { name: 'Sacha', color: '#f7c600', photo: null },
    { name: 'Papa', color: '#1e6fd9', photo: null },
    { name: 'Мама', color: '#d62828', photo: null },
  ];

  // ---------- Sauvegarde (sur l'appareil uniquement) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  const saved = load() || {};
  const state = {
    chars: DEFAULT_CHARS.map((c, i) => Object.assign({}, c, (saved.chars || [])[i] || {})),
    best: Array.isArray(saved.best) ? saved.best : [0, 0, 0],
    level: Number.isInteger(saved.level) ? saved.level : 0,
    muted: !!saved.muted,
  };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- Visages par défaut (dessinés) ----------
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function drawDefaultAvatar(i, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 300, 300);
    const hair = ['#8a5a2b', '#3b2a1a', '#c0782f'][i];
    if (i === 2) { g.fillStyle = hair; roundRect(g, 48, 70, 204, 215, 70); g.fill(); }
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.ellipse(150, 170, 88, 92, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair;
    g.beginPath(); g.ellipse(150, 118, 92, 58, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(58, 112, 184, 14);
    if (i === 0) { // mèche
      g.beginPath(); g.moveTo(150, 70); g.lineTo(200, 128); g.lineTo(120, 120); g.fill();
    }
    g.fillStyle = '#1b2440';
    g.beginPath(); g.arc(118, 168, 11, 0, Math.PI * 2); g.arc(182, 168, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(122, 164, 4, 0, Math.PI * 2); g.arc(186, 164, 4, 0, Math.PI * 2); g.fill();
    if (i === 1) { // lunettes
      g.strokeStyle = '#1b2440'; g.lineWidth = 6;
      g.beginPath(); g.arc(118, 168, 24, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(182, 168, 24, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(142, 166); g.lineTo(158, 166); g.stroke();
    }
    g.fillStyle = 'rgba(255,120,120,.55)';
    g.beginPath(); g.arc(95, 205, 13, 0, Math.PI * 2); g.arc(205, 205, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b2440'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(150, 192, 38, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
    return c.toDataURL('image/png');
  }
  const defaultAvatars = state.chars.map((c, i) => drawDefaultAvatar(i, c.color));
  const avatarOf = (i) => state.chars[i].photo || defaultAvatars[i];

  function applyColors() {
    state.chars.forEach((c, i) => document.documentElement.style.setProperty('--c' + i, c.color));
  }

  // ---------- Écrans ----------
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  }

  // ---------- Menu ----------
  function renderMenu() {
    const box = $('#menu-faces');
    box.innerHTML = '';
    state.chars.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'menu-face';
      d.style.setProperty('--cc', c.color);
      const img = new Image(); img.src = avatarOf(i); img.alt = '';
      const n = document.createElement('span'); n.textContent = c.name;
      d.append(img, n);
      box.appendChild(d);
    });
    document.querySelectorAll('.level').forEach((b) => b.classList.toggle('selected', +b.dataset.level === state.level));
    const best = state.best[state.level];
    $('#menu-best').textContent = best ? '🏆 Record : ' + best + ' points' : '';
    $('#btn-sound').textContent = state.muted ? '🔇' : '🔊';
  }

  // ---------- Plateau ----------
  const board = $('#board');
  const holes = [];
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('div');
    el.className = 'hole';
    el.style.setProperty('--brick', BRICK_COLORS[i]);
    el.innerHTML =
      '<div class="win"><div class="pit"></div><div class="mole">' +
      '<div class="face"><img class="c0" alt=""><img class="c1" alt=""><img class="c2" alt=""></div>' +
      '<div class="pball"></div></div></div>' +
      '<div class="brick"><span class="tag"></span></div>';
    board.appendChild(el);
    const h = { el, mole: el.querySelector('.mole'), tag: el.querySelector('.tag'), imgs: el.querySelectorAll('.face img'), state: 'empty', kind: null, until: 0, freeAt: 0 };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); onHoleTap(h); });
    holes.push(h);
  }
  function refreshHoleImages() {
    holes.forEach((h) => h.imgs.forEach((img, i) => { img.src = avatarOf(i); }));
  }
  function resetHole(h) {
    h.state = 'empty';
    h.el.classList.remove('up', 'hit', 'leaving');
  }

  // ---------- Partie ----------
  let game = null;
  const fill = $('#timebar-fill');
  const scoreEl = $('#score');

  function startGame() {
    holes.forEach(resetHole);
    game = {
      t: 0, last: 0, running: false, score: 0, nextSpawn: 400,
      L: LEVELS[state.level], hits: [0, 0, 0], balls: 0, lastHole: -1, lastKind: null, token: {},
    };
    scoreEl.textContent = '0';
    fill.style.transform = 'scaleX(1)';
    showScreen('game');
    countdown(game.token, () => {
      game.running = true;
      game.last = performance.now();
      requestAnimationFrame(loop);
    });
  }

  function countdown(token, done) {
    const cd = $('#countdown');
    const seq = ['3', '2', '1', 'Go !'];
    let i = 0;
    const next = () => {
      if (!game || game.token !== token) { cd.innerHTML = ''; return; }
      if (i >= seq.length) { cd.innerHTML = ''; done(); return; }
      cd.classList.remove('pop');
      cd.innerHTML = '<span>' + seq[i] + '</span>';
      void cd.offsetWidth;
      cd.classList.add('pop');
      Sound.beep(i === seq.length - 1);
      i++;
      setTimeout(next, i === seq.length ? 450 : 700);
    };
    next();
  }

  function loop(now) {
    if (!game || !game.running) return;
    const dt = Math.min(100, now - game.last);
    game.last = now;
    game.t += dt;
    const p = Math.min(1, game.t / ROUND_MS);
    const L = game.L;

    if (game.t >= game.nextSpawn) {
      spawn(p);
      const gap = L.gapStart + (L.gapEnd - L.gapStart) * p;
      game.nextSpawn = game.t + gap * (0.75 + Math.random() * 0.5);
    }
    for (const h of holes) {
      if (h.state === 'up' && game.t >= h.until) hide(h);
      else if (h.state === 'leaving' && game.t >= h.freeAt) resetHole(h);
    }
    fill.style.transform = 'scaleX(' + (1 - p) + ')';

    if (game.t >= ROUND_MS) { endGame(); return; }
    requestAnimationFrame(loop);
  }

  function spawn(p) {
    const L = game.L;
    const upCount = holes.filter((h) => h.state === 'up').length;
    if (upCount >= L.max) return;
    const free = holes.map((h, i) => i).filter((i) => holes[i].state === 'empty' && i !== game.lastHole);
    if (!free.length) return;
    const idx = free[Math.floor(Math.random() * free.length)];
    const h = holes[idx];
    let kind;
    if (Math.random() < BALL_CHANCE) kind = 'ball';
    else {
      do { kind = Math.floor(Math.random() * 3); } while (kind === game.lastKind && Math.random() < 0.6);
    }
    game.lastHole = idx;
    game.lastKind = kind;
    h.kind = kind;
    h.mole.dataset.kind = String(kind);
    h.tag.textContent = kind === 'ball' ? '+3 !' : state.chars[kind].name;
    h.state = 'up';
    h.until = game.t + L.up * (1 - 0.25 * p) * (kind === 'ball' ? 0.8 : 1);
    h.el.classList.remove('hit', 'leaving');
    h.el.classList.add('up');
    Sound.popUp();
  }

  function hide(h) {
    h.state = 'leaving';
    h.freeAt = game.t + 260;
    h.el.classList.add('leaving');
    h.el.classList.remove('up');
  }

  function onHoleTap(h) {
    if (!game || !game.running) return;
    if (h.state !== 'up') { Sound.miss(); return; }
    const isBall = h.kind === 'ball';
    const pts = isBall ? 3 : 1;
    game.score += pts;
    if (isBall) game.balls++; else game.hits[h.kind]++;
    scoreEl.textContent = String(game.score);
    Sound.hit(h.kind);
    floatText(h, isBall ? 'Smash ! +3' : '+1', isBall);
    h.state = 'leaving';
    h.freeAt = game.t + 450;
    h.el.classList.add('hit');
    const token = game.token;
    setTimeout(() => {
      if (game && game.token === token && h.state === 'leaving') {
        h.el.classList.add('leaving');
        h.el.classList.remove('up');
      }
    }, 200);
  }

  function floatText(h, text, big) {
    const f = document.createElement('div');
    f.className = 'float' + (big ? ' big' : '');
    f.textContent = text;
    h.el.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function stopGame() {
    if (game) { game.running = false; game.token = null; }
    holes.forEach(resetHole);
    $('#countdown').innerHTML = '';
  }

  function endGame() {
    const g = game;
    stopGame();
    const L = g.L;
    const stars = L.stars.filter((s) => g.score >= s).length;
    const prevBest = state.best[state.level] || 0;
    const isRecord = g.score > prevBest;
    if (isRecord) { state.best[state.level] = g.score; save(); }

    const name = state.chars[0].name;
    $('#end-title').textContent = stars === 3 ? 'Champion ' + name + ' !' : stars >= 1 ? 'Bravo ' + name + ' !' : 'Bien joué ' + name + ' !';
    $('#end-score').textContent = String(g.score);
    $('#end-record').textContent = isRecord && g.score > 0 ? '🏆 Nouveau record !' : prevBest ? 'Record : ' + prevBest : '';
    document.querySelectorAll('#end-stars span').forEach((s, i) => s.classList.toggle('on', i < stars));

    const stats = $('#end-stats');
    stats.innerHTML = '';
    state.chars.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'stat';
      d.style.setProperty('--cc', c.color);
      const img = new Image(); img.src = avatarOf(i); img.alt = '';
      const n = document.createElement('span'); n.textContent = '× ' + g.hits[i];
      d.append(img, n);
      stats.appendChild(d);
    });
    const b = document.createElement('div');
    b.className = 'stat';
    b.innerHTML = '<div class="mini-ball"></div><span>× ' + g.balls + '</span>';
    stats.appendChild(b);

    showScreen('end');
    Sound.fanfare();
    confetti();
    say($('#end-title').textContent);
  }

  function say(text) {
    try {
      if (state.muted || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = 1;
      u.pitch = 1.2;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* pas de voix, tant pis */ }
  }

  // ---------- Raquette qui suit le doigt ----------
  const paddle = $('#paddle');
  $('#screen-game').addEventListener('pointerdown', (e) => {
    paddle.style.left = e.clientX + 'px';
    paddle.style.top = e.clientY + 'px';
    paddle.classList.remove('swing');
    void paddle.offsetWidth;
    paddle.classList.add('swing');
  }, true);

  // ---------- Confettis ----------
  const cv = $('#confetti');
  const cg = cv.getContext('2d');
  let confettiRun = 0;
  function confetti() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr;
    const H = cv.height = innerHeight * dpr;
    const colors = ['#d62828', '#f7c600', '#2a9d3f', '#1e6fd9', '#f77f00', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => ({
      x: Math.random() * W, y: -Math.random() * H * 0.6,
      w: (8 + Math.random() * 10) * dpr, h: (6 + Math.random() * 6) * dpr,
      vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const run = ++confettiRun;
    const t0 = performance.now();
    const frame = (now) => {
      if (run !== confettiRun) return;
      cg.clearRect(0, 0, W, H);
      const age = now - t0;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.04 * dpr;
        cg.save();
        cg.translate(p.x, p.y); cg.rotate(p.r);
        cg.globalAlpha = Math.max(0, 1 - Math.max(0, age - 2500) / 1000);
        cg.fillStyle = p.c;
        cg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cg.restore();
      }
      if (age < 3500) requestAnimationFrame(frame);
      else cg.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  }

  // ---------- Réglages (prénoms + photos) ----------
  const fileInput = $('#file-input');
  let pickFor = -1;

  function renderSettings() {
    const list = $('#settings-list');
    list.innerHTML = '';
    state.chars.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'set-row';
      row.style.setProperty('--cc', c.color);
      const img = new Image(); img.className = 'set-avatar'; img.src = avatarOf(i); img.alt = '';
      const fields = document.createElement('div'); fields.className = 'set-fields';
      const label = document.createElement('label'); label.textContent = 'Prénom';
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 12; input.value = c.name; input.autocomplete = 'off';
      input.addEventListener('input', () => { c.name = input.value.trim() || DEFAULT_CHARS[i].name; save(); });
      label.appendChild(input);
      const btns = document.createElement('div'); btns.className = 'row';
      const pick = document.createElement('button'); pick.className = 'small-btn'; pick.textContent = '📷 Photo';
      pick.addEventListener('click', () => { pickFor = i; fileInput.value = ''; fileInput.click(); });
      btns.appendChild(pick);
      if (c.photo) {
        const del = document.createElement('button'); del.className = 'small-btn danger'; del.textContent = 'Retirer';
        del.addEventListener('click', () => { c.photo = null; save(); renderSettings(); });
        btns.appendChild(del);
      }
      fields.append(label, btns);
      row.append(img, fields);
      list.appendChild(row);
    });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || pickFor < 0) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => openCrop(img, url);
    img.onerror = () => { URL.revokeObjectURL(url); alert("Impossible d'ouvrir cette photo. Essaie une autre image."); };
    img.src = url;
  });

  // Recadrage : glisser pour déplacer, pincer ou curseur pour zoomer
  const cropModal = $('#crop-modal');
  const cropCanvas = $('#crop-canvas');
  const cropG = cropCanvas.getContext('2d');
  const zoomInput = $('#crop-zoom');
  const crop = { img: null, url: null, zoom: 1, ox: 0, oy: 0, pointers: new Map(), pinchDist: 0, pinchZoom: 1 };
  const CS = 600;

  function cropScale() {
    const { img } = crop;
    return Math.max(CS / img.naturalWidth, CS / img.naturalHeight) * crop.zoom;
  }
  function clampCrop() {
    const s = cropScale();
    const mx = Math.max(0, (crop.img.naturalWidth * s - CS) / 2);
    const my = Math.max(0, (crop.img.naturalHeight * s - CS) / 2);
    crop.ox = Math.max(-mx, Math.min(mx, crop.ox));
    crop.oy = Math.max(-my, Math.min(my, crop.oy));
  }
  function drawCrop(g, size) {
    const k = size / CS;
    const s = cropScale() * k;
    const w = crop.img.naturalWidth * s, h = crop.img.naturalHeight * s;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, size, size);
    g.drawImage(crop.img, size / 2 - w / 2 + crop.ox * k, size / 2 - h / 2 + crop.oy * k, w, h);
  }
  function openCrop(img, url) {
    crop.img = img; crop.url = url; crop.zoom = 1; crop.ox = 0; crop.oy = 0;
    // les visages sont souvent dans le haut de la photo
    const s = cropScale();
    crop.oy = Math.max(0, (img.naturalHeight * s - CS) / 2) * 0.4;
    clampCrop();
    zoomInput.value = '1';
    cropModal.hidden = false;
    drawCrop(cropG, CS);
  }
  function closeCrop() {
    cropModal.hidden = true;
    if (crop.url) URL.revokeObjectURL(crop.url);
    crop.img = null; crop.url = null; crop.pointers.clear();
  }

  const cropArea = $('#crop-area');
  cropArea.addEventListener('pointerdown', (e) => {
    cropArea.setPointerCapture(e.pointerId);
    crop.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (crop.pointers.size === 2) {
      const [a, b] = [...crop.pointers.values()];
      crop.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      crop.pinchZoom = crop.zoom;
    }
  });
  cropArea.addEventListener('pointermove', (e) => {
    const prev = crop.pointers.get(e.pointerId);
    if (!prev || !crop.img) return;
    const k = CS / cropArea.getBoundingClientRect().width;
    const cur = { x: e.clientX, y: e.clientY };
    crop.pointers.set(e.pointerId, cur);
    if (crop.pointers.size >= 2) {
      const [a, b] = [...crop.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (crop.pinchDist > 0) crop.zoom = Math.max(1, Math.min(5, crop.pinchZoom * d / crop.pinchDist));
      zoomInput.value = String(crop.zoom);
    } else {
      crop.ox += (cur.x - prev.x) * k;
      crop.oy += (cur.y - prev.y) * k;
    }
    clampCrop();
    drawCrop(cropG, CS);
  });
  const endPointer = (e) => { crop.pointers.delete(e.pointerId); };
  cropArea.addEventListener('pointerup', endPointer);
  cropArea.addEventListener('pointercancel', endPointer);
  zoomInput.addEventListener('input', () => {
    if (!crop.img) return;
    crop.zoom = +zoomInput.value;
    clampCrop();
    drawCrop(cropG, CS);
  });
  $('#crop-cancel').addEventListener('click', closeCrop);
  $('#crop-ok').addEventListener('click', () => {
    if (!crop.img || pickFor < 0) return closeCrop();
    const out = document.createElement('canvas');
    out.width = out.height = 320;
    drawCrop(out.getContext('2d'), 320);
    const prevPhoto = state.chars[pickFor].photo;
    state.chars[pickFor].photo = out.toDataURL('image/jpeg', 0.85);
    if (!save()) {
      state.chars[pickFor].photo = prevPhoto;
      alert("Pas assez de place pour enregistrer la photo sur cet appareil.");
    }
    closeCrop();
    renderSettings();
  });

  // ---------- Boutons ----------

  document.querySelectorAll('.level').forEach((b) => b.addEventListener('click', () => {
    state.level = +b.dataset.level; save(); renderMenu();
  }));
  $('#btn-play').addEventListener('click', () => { Sound.unlock(); startGame(); });
  $('#btn-again').addEventListener('click', startGame);
  $('#btn-menu').addEventListener('click', () => { renderMenu(); showScreen('menu'); });
  $('#btn-quit').addEventListener('click', () => { stopGame(); renderMenu(); showScreen('menu'); });
  $('#btn-sound').addEventListener('click', () => {
    state.muted = !state.muted; save();
    Sound.setMuted(state.muted);
    if (state.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    renderMenu();
  });
  $('#btn-settings').addEventListener('click', () => { renderSettings(); showScreen('settings'); });
  $('#btn-sound-test').addEventListener('click', () => {
    const msg = $('#sound-help');
    if (state.muted) { state.muted = false; save(); Sound.setMuted(false); renderMenu(); }
    Sound.test();
    msg.hidden = false;
  });
  $('#btn-settings-done').addEventListener('click', () => {
    refreshHoleImages(); renderMenu(); showScreen('menu');
  });

  // Empêche le zoom par double-tap / pincement sur iPhone
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ---------- Démarrage ----------
  applyColors();
  refreshHoleImages();
  renderMenu();
  Sound.setMuted(state.muted);
  Sound.startMusic();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
