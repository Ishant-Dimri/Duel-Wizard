// Everything drawn on the canvas.
import { G } from './state.js';
import { vid } from './hands.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
export function resize() { G.W = cv.width = innerWidth; G.H = cv.height = innerHeight; G.S = Math.min(G.W, G.H); }
addEventListener('resize', resize); resize();

function glow(x, y, r, c1, c2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fff'); g.addColorStop(.25, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function ring(x, y, r, c) {
  ctx.fillStyle = c + '33'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
}
function bar(x, y, w, h, v, c) {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, v) / 100, h);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
}

export function draw() {
  const { W, H, S, me, op, inp, mode } = G;
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - .5) * 40 * G.shake, (Math.random() - .5) * 40 * G.shake);
  ctx.fillStyle = '#0d0a1f'; ctx.fillRect(0, 0, W, H);
  if (G.camOk) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.globalAlpha = .5; ctx.drawImage(vid, 0, 0, W, H); ctx.restore(); }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(120,30,160,.45)'); g.addColorStop(.5, 'rgba(13,10,31,.2)'); g.addColorStop(1, 'rgba(20,50,140,.3)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (mode === 'play' || mode === 'count') {
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);

    // opponent wizard follows their aim; the line telegraphs their firing lane
    ctx.font = (S * .11) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧙', op.ax * W, .1 * H);
    ctx.strokeStyle = 'rgba(217,70,239,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(op.ax * W, .16 * H); ctx.lineTo(op.ax * W, .22 * H); ctx.stroke();
    if (op.on) ring(op.sx * W, op.sy * H, .1 * S, '#d946ef');
    if (inp.sh && me.mana > 0) ring(inp.sh.x * W, inp.sh.y * H, inp.sh.r, '#5ee7ff');

    // hand dots
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (const l of G.hands) for (const p of l) { ctx.beginPath(); ctx.arc((1 - p.x) * W, p.y * H, 3, 0, 7); ctx.fill(); }

    // charging orb
    if (inp.orb && G.chargeT > .1) {
      const k = Math.min(1, G.chargeT / .4);
      glow(inp.orb.x * W, inp.orb.y * H, S * (.03 + .07 * k) * (1 + .1 * Math.sin(G.clock * 20)), me.ult >= 100 ? '#5ee7ff' : '#9a8fb8', 'rgba(94,231,255,0)');
    }
    // trail particles
    for (const p of G.parts) { ctx.globalAlpha = Math.max(0, p.life / .45); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // shots
    for (const s of G.shots) {
      const x = s.x * W, y = (s.mine ? 1 - s.p : s.p) * H, u = s.k === 'u', r = u ? .15 * S : .035 * S;
      if (u) glow(x, y, r, s.mine ? '#5ee7ff' : '#ff3b6b', 'rgba(94,231,255,0)');
      else glow(x, y, r * 1.6, s.mine ? '#ff8a3d' : '#d946ef', 'rgba(255,138,61,0)');
    }
    // reticle
    const ax = inp.ax * W, ay = inp.ay * H;
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.arc(ax, ay, 14, 0, 7); ctx.moveTo(ax - 20, ay); ctx.lineTo(ax + 20, ay); ctx.moveTo(ax, ay - 20); ctx.lineTo(ax, ay + 20); ctx.stroke();
    // impacts
    for (const f of G.fx) { ctx.strokeStyle = f.c; ctx.globalAlpha = 1 - f.t; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y, f.t * S * .2 * f.n, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }

    // HUD
    const bw = Math.min(W * .4, 320);
    ctx.fillStyle = '#f3ecff'; ctx.font = 'bold 14px Georgia'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('OPPONENT', 12, 16); bar(12, 26, bw, 14, op.hp, '#d946ef');
    ctx.fillText('YOU', 12, H - 86); bar(12, H - 76, bw, 14, me.hp, '#ff3b6b');
    ctx.fillText('MANA', 12, H - 52); bar(12, H - 44, bw, 10, me.mana, '#5ee7ff');
    bar(12, H - 28, bw, 10, me.ult, me.ult >= 100 ? '#ffd34d' : '#ff8a3d');
    ctx.fillText(me.ult >= 100 ? 'ULT READY: join hands, then thrust' : 'ULT', bw + 20, H - 20);
    if (G.camOk && G.noHandT > 1) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34d'; ctx.fillText('No hands detected. Step back and show both hands.', W / 2, H * .5 + 30); }
    if (mode === 'count') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (S * .3) + 'px Georgia';
      ctx.fillText(G.count > 0 ? Math.ceil(G.count) : 'DUEL!', W / 2, H / 2);
    }
  }
  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,40,80,' + G.flash * .9 + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
