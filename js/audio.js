// Sound effects synthesized with the Web Audio API. No audio files needed.
let ac, master, nb, muted = false, hum = null, chg = null;

export function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ac.destination);
  nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : .5; return muted; }

function tone(f, f2, t, type, v, when = 0) {
  const T = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, T);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, T + t);
  g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(.001, T + t);
  o.connect(g).connect(master); o.start(T); o.stop(T + t);
}
function noise(t, v, f, f2, type = 'bandpass', when = 0) {
  const T = ac.currentTime + when, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nb; s.loop = true; fl.type = type; fl.Q.value = 2;
  fl.frequency.setValueAtTime(f, T); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, T + t);
  g.gain.setValueAtTime(v, T); g.gain.exponentialRampToValueAtTime(.001, T + t);
  s.connect(fl).connect(g).connect(master); s.start(T); s.stop(T + t);
}
function loopTone(type, f, v) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; g.gain.value = 0;
  g.gain.setTargetAtTime(v, ac.currentTime, .1);
  o.connect(g).connect(master); o.start(); return { o, g };
}
function stopLoop(l) { l.g.gain.setTargetAtTime(0, ac.currentTime, .08); l.o.stop(ac.currentTime + .4); }

export const sfx = {
  fire()     { if (!ac) return; noise(.35, .35, 500, 2600); tone(300, 900, .3, 'sawtooth', .12); },
  incoming() { if (!ac) return; noise(.5, .12, 1800, 300); },
  block()    { if (!ac) return; tone(880, 440, .18, 'square', .15); noise(.15, .2, 4000, 2000, 'highpass'); },
  hit()      { if (!ac) return; tone(220, 45, .35, 'sawtooth', .35); noise(.3, .35, 900, 120, 'lowpass'); },
  ult()      { if (!ac) return; tone(70, 500, 1.2, 'sawtooth', .3); noise(1.2, .4, 200, 3000); tone(140, 1000, 1, 'square', .1); },
  ready()    { if (!ac) return; [523, 659, 784].forEach((f, i) => tone(f, 0, .25, 'triangle', .2, i * .09)); },
  beep(go)   { if (!ac) return; tone(go ? 880 : 440, 0, go ? .5 : .15, 'square', .15); },
  win()      { if (!ac) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, .4, 'triangle', .25, i * .15)); },
  lose()     { if (!ac) return; [440, 370, 311, 220].forEach((f, i) => tone(f, 0, .5, 'sawtooth', .18, i * .2)); },
  shield(on) {
    if (!ac) return;
    if (on && !hum) hum = loopTone('triangle', 130, .07);
    if (!on && hum) { stopLoop(hum); hum = null; }
  },
  charge(on, k = 0) {
    if (!ac) return;
    if (on && !chg) chg = loopTone('sawtooth', 90, .08);
    if (on && chg) chg.o.frequency.setTargetAtTime(90 + 500 * k, ac.currentTime, .1);
    if (!on && chg) { stopLoop(chg); chg = null; }
  }
};
