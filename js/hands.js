// Camera + MediaPipe hand tracking -> game inputs (shield, aim, fire, ultimate).
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { G } from './state.js';

export const vid = document.getElementById('v');
let hl = null, tried = false, lastVT = -1, lastT = performance.now(), prevPinch = false, sizeH = [];

export async function initCam(status) {
  if (tried) return; tried = true;
  status('Loading hand tracking…');
  try {
    const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    for (const d of ['GPU', 'CPU']) {
      try {
        hl = await HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: d },
          runningMode: 'VIDEO', numHands: 2
        }); break;
      } catch (e) { if (d === 'CPU') throw e; }
    }
    vid.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    await vid.play(); G.camOk = true;
  } catch (e) {
    status('Camera or hand tracking unavailable (' + (e.message || e) + '). Mouse mode: move to aim, click to fire, hold S for shield, U for ultimate.');
  }
}

const dd = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sz = l => dd(l[0], l[9]);
const open = l => [8, 12, 16, 20].every(t => dd(l[t], l[0]) > dd(l[t - 2], l[0]) * 1.1);
const lerp = (a, b, k) => a + (b - a) * k;

export function mouseInput() {
  const { inp, mouse, keys, S } = G;
  inp.ax = mouse.x; inp.ay = mouse.y; inp.orb = null;
  inp.sh = keys.s ? { x: mouse.x, y: mouse.y, r: .12 * S } : null;
}

export function readHands() {
  if (vid.currentTime === lastVT) return; lastVT = vid.currentTime;
  const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  const { W, H, S, inp } = G;
  let r; try { r = hl.detectForVideo(vid, now); } catch (e) { return; }
  const hs = r.landmarks.map(l => ({ l }));
  G.hands = hs.map(h => h.l); G.tracked = hs.length;
  G.noHandT = hs.length ? 0 : G.noHandT + dt;

  let L = null, R = null;
  if (hs.length === 2) { hs.sort((a, b) => b.l[9].x - a.l[9].x); L = hs[0]; R = hs[1]; } // unmirrored video: larger x = your left
  else if (hs.length === 1) { open(hs[0].l) ? L = hs[0] : R = hs[0]; }

  // shield (left palm), smoothed
  if (L && open(L.l)) {
    const p = L.l[9], x = 1 - p.x, y = p.y, rad = Math.max(.07 * S, Math.min(.17 * S, sz(L.l) * W * .8));
    inp.sh = inp.sh ? { x: lerp(inp.sh.x, x, .6), y: lerp(inp.sh.y, y, .6), r: lerp(inp.sh.r, rad, .4) } : { x, y, r: rad };
  } else inp.sh = null;

  // aim + pinch (right hand), smoothed
  if (R) {
    const t = R.l[8];
    inp.ax = lerp(inp.ax, 1 - t.x, .6); inp.ay = lerp(inp.ay, t.y, .6);
    const pin = dd(R.l[4], R.l[8]) < sz(R.l) * .4;
    if (pin && !prevPinch) inp.fire = true; prevPinch = pin;
  } else prevPinch = false;

  // ultimate: hands together (charge) then grow in frame (thrust)
  inp.orb = null;
  if (L && R) {
    const a = L.l[9], b = R.l[9];
    const near = Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) < .3 * S;
    G.chargeT = near ? G.chargeT + dt : Math.max(0, G.chargeT - 2 * dt);
    inp.orb = { x: 1 - (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const avg = (sz(L.l) + sz(R.l)) / 2;
    sizeH.push({ t: now, s: avg }); while (sizeH.length && now - sizeH[0].t > 500) sizeH.shift();
    const mn = Math.min(...sizeH.map(q => q.s));
    if (G.chargeT > .4 && G.me.ult >= 100 && avg > mn * 1.35) inp.ult = true;
  } else { G.chargeT = Math.max(0, G.chargeT - 2 * dt); sizeH = []; }
}
export const resetHands = () => { sizeH = []; G.chargeT = 0; };
