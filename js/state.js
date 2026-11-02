// Shared game state. Every module reads and writes this one object.
export const G = {
  W: 0, H: 0, S: 0,
  mode: 'menu',            // menu | count | play | over
  bot: false, count: 0, clock: 0,
  me: { hp: 100, mana: 100, ult: 0 },
  op: { hp: 100, sx: .5, sy: .3, on: false, ax: .5 },
  shots: [], fx: [], parts: [], hands: [],
  flash: 0, shake: 0, chargeT: 0, tracked: 0, noHandT: 0,
  camOk: false,
  inp: { sh: null, ax: .5, ay: .7, fire: false, ult: false, orb: null },
  mouse: { x: .5, y: .7 }, keys: {}
};
