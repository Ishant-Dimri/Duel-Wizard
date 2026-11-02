// Game rules, main loop and menu wiring.
import { G } from './state.js';
import { draw, resize } from './render.js';
import { initCam, readHands, mouseInput, resetHands } from './hands.js';
import { net, send, host, join, disconnect } from './net.js';
import { init as audioInit, sfx, toggleMute } from './audio.js';

const $ = id => document.getElementById(id);
const status = t => $('st').textContent = t;
let sid = 0, cd = 0, sendT = 0, botT = 2, botX = .5, lastCount = 0, wasReady = false, wasShield = false, wasCharge = false;

/* ---------- helpers ---------- */
const shotT = k => k === 'u' ? 1.9 : 1.3;
const burst = (x, y, c, n) => G.fx.push({ x, y, c, t: 0, n });
function launch(k, x) {
  const s = { id: ++sid, x, p: 0, T: shotT(k), k, mine: 1 };
  G.shots.push(s); send({ t: 'f', id: s.id, x, k });
  k === 'u' ? sfx.ult() : sfx.fire();
}
function hurt(n) {
  G.me.hp = Math.max(0, G.me.hp - n); G.flash = .35; G.shake = .25; sfx.hit();
  if (G.me.hp <= 0) { send({ t: 'd' }); end(false, 'Your wards have fallen.'); }
}

/* ---------- flow ---------- */
function begin() {
  Object.assign(G.me, { hp: 100, mana: 100, ult: 0 });
  Object.assign(G.op, { hp: 100, on: false, sx: .5, sy: .3, ax: .5 });
  G.shots = []; G.fx = []; G.parts = []; resetHands();
  G.mode = 'count'; G.count = 3; lastCount = 4; wasReady = false;
  $('menu').hidden = true; $('over').hidden = true;
}
function end(win, note) {
  G.mode = 'over'; sfx.shield(false); sfx.charge(false);
  win ? sfx.win() : sfx.lose();
  $('result').textContent = win ? 'Victory' : 'Defeat'; $('note').textContent = note || '';
  $('over').hidden = false;
}
function toMenu() {
  disconnect(); G.mode = 'menu'; G.bot = false;
  $('over').hidden = true; $('menu').hidden = false; status('');
}

/* ---------- network messages ---------- */
net.onOpen = begin;
net.onClose = () => { if (G.mode === 'play' || G.mode === 'count') end(true, 'Your opponent left the arena.'); };
net.onMsg = m => {
  if (m.t === 'f') { G.shots.push({ id: m.id, x: 1 - m.x, p: 0, T: shotT(m.k), k: m.k, mine: 0 }); sfx.incoming(); }
  else if (m.t === 'r') {
    const i = G.shots.findIndex(q => q.mine && q.id === m.id);
    if (i >= 0) {
      const s = G.shots[i];
      burst(s.x * G.W, (1 - Math.min(1, s.p)) * G.H, m.b ? '#5ee7ff' : '#ff8a3d', s.k === 'u' ? 2 : 1);
      m.b ? sfx.block() : (sfx.hit(), G.me.ult = Math.min(100, G.me.ult + 12));
      G.shots.splice(i, 1);
    }
  }
  else if (m.t === 'p') Object.assign(G.op, { sx: 1 - m.sx, sy: 1 - m.sy, on: m.on, ax: 1 - m.ax, hp: m.hp });
  else if (m.t === 'd') end(true, 'Their wards have fallen.');
  else if (m.t === 'rm') begin();
};

/* ---------- per-frame update ---------- */
function update(dt) {
  const { me, op, inp, S, W, H } = G;
  G.clock += dt;
  if (G.camOk) readHands(); else mouseInput();

  // sound for held states
  const shieldOn = !!inp.sh && me.mana > 0;
  if (shieldOn !== wasShield) { sfx.shield(shieldOn); wasShield = shieldOn; }
  const charging = !!inp.orb && G.chargeT > .1;
  if (charging !== wasCharge) { sfx.charge(charging, 0); wasCharge = charging; }
  if (charging) sfx.charge(true, Math.min(1, G.chargeT / .6));

  if (G.mode === 'count') {
    inp.fire = inp.ult = false; G.count -= dt;
    const c = Math.ceil(G.count);
    if (c !== lastCount) { lastCount = c; if (c > 0) sfx.beep(false); else sfx.beep(true); }
    if (G.count <= -.6) G.mode = 'play';
    return;
  }

  // casting
  cd -= dt;
  if (inp.fire && cd <= 0 && me.mana >= 12) { me.mana -= 12; cd = .45; launch('f', inp.ax); }
  inp.fire = false;
  if (inp.ult && me.ult >= 100) { me.ult = 0; G.chargeT = 0; resetHands(); launch('u', inp.orb ? inp.orb.x : inp.ax); }
  inp.ult = false;
  if (shieldOn) me.mana = Math.max(0, me.mana - 10 * dt); else me.mana = Math.min(100, me.mana + 9 * dt);
  me.ult = Math.min(100, me.ult + 3 * dt);
  if (me.ult >= 100 && !wasReady) { sfx.ready(); wasReady = true; } else if (me.ult < 100) wasReady = false;
  const sh = shieldOn ? inp.sh : null;

  // projectiles
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.p += dt / s.T;
    const sx = s.x * W, sy = (s.mine ? 1 - s.p : s.p) * H;
    if (G.parts.length < 400) for (let k = 0; k < 2; k++)
      G.parts.push({ x: sx + (Math.random() - .5) * 8, y: sy, r: 2 + Math.random() * 3, life: .45, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, c: s.k === 'u' ? '#5ee7ff' : (s.mine ? '#ff8a3d' : '#d946ef') });
    if (!s.mine) {
      const R = s.k === 'u' ? .15 * S : .035 * S;
      if (sh && Math.hypot(sx - sh.x * W, sy - sh.y * H) < sh.r + R * (s.k === 'u' ? .5 : 1)) {
        burst(sx, sy, '#5ee7ff', s.k === 'u' ? 2 : 1); send({ t: 'r', id: s.id, b: 1 }); G.shots.splice(i, 1);
        sfx.block(); if (s.k === 'u') hurt(17);
      } else if (s.p >= 1) {
        burst(sx, H, '#ff3b6b', s.k === 'u' ? 2 : 1); send({ t: 'r', id: s.id, b: 0 }); G.shots.splice(i, 1);
        hurt(s.k === 'u' ? 35 : 10);
      }
      if (G.mode !== 'play') return;
    } else if (G.bot && s.p >= 1) {
      const blocked = op.on && Math.abs(s.x - op.sx) * W < .1 * S;
      burst(s.x * W, 0, blocked ? '#5ee7ff' : '#ff8a3d', s.k === 'u' ? 2 : 1);
      if (blocked) sfx.block(); else { sfx.hit(); op.hp = Math.max(0, op.hp - (s.k === 'u' ? 35 : 10)); me.ult = Math.min(100, me.ult + 12); }
      G.shots.splice(i, 1);
      if (op.hp <= 0) { end(true, 'The bot is toast.'); return; }
    } else if (s.p > 1.2) G.shots.splice(i, 1);
  }

  // practice bot
  if (G.bot) {
    op.on = Math.sin(G.clock * .7) > -.3; op.sx = .5 + .3 * Math.sin(G.clock * .9);
    op.ax += (botX - op.ax) * Math.min(1, dt * 3); botT -= dt;
    if (botT <= 0) {
      const k = Math.random() < .15 ? 'u' : 'f';
      G.shots.push({ id: ++sid, x: op.ax, p: 0, T: shotT(k), k, mine: 0 }); sfx.incoming();
      botT = 1.4 + Math.random() * 1.6; botX = .12 + Math.random() * .76;
    }
  }

  sendT += dt;
  if (sendT > .05) { sendT = 0; send({ t: 'p', sx: inp.sh ? inp.sh.x : .5, sy: inp.sh ? inp.sh.y : .8, on: shieldOn, ax: inp.ax, hp: me.hp }); }
}

function tick(dt) {
  G.flash = Math.max(0, G.flash - dt); G.shake = Math.max(0, G.shake - dt);
  for (const f of G.fx) f.t += dt * 2.2; G.fx = G.fx.filter(f => f.t < 1);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } G.parts = G.parts.filter(p => p.life > 0);
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  if (G.mode === 'play' || G.mode === 'count') update(dt);
  tick(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- input + menu ---------- */
addEventListener('mousemove', e => { G.mouse.x = e.clientX / G.W; G.mouse.y = e.clientY / G.H; });
addEventListener('mousedown', e => { if (G.mode === 'play' && e.target.id === 'c') G.inp.fire = true; });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); G.keys[k] = 1;
  if (k === 'u') G.inp.ult = true; if (k === ' ') G.inp.fire = true; if (k === 'm') $('mute').click();
});
addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = 0; });
$('mute').onclick = () => { audioInit(); $('mute').textContent = toggleMute() ? 'Sound off' : 'Sound on'; };

async function start(fn) { audioInit(); await initCam(status); fn(); }
$('b1').onclick = () => start(() => host(status));
$('b2').onclick = () => { const c = $('code').value.trim(); if (c.length !== 4) return status('Enter the 4-digit room code.'); start(() => join(c, status)); };
$('b3').onclick = () => start(() => { G.bot = true; begin(); });
$('again').onclick = () => { if (G.bot) begin(); else { send({ t: 'rm' }); begin(); } };
$('leave').onclick = toMenu;
resize();
