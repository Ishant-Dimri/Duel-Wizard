// Peer-to-peer connection (PeerJS / WebRTC). Only tiny messages are sent, never video.
export const net = { conn: null, onMsg: null, onOpen: null, onClose: null };
let peer = null;

export const send = m => { if (net.conn && net.conn.open) net.conn.send(m); };

function setConn(c) {
  net.conn = c;
  c.on('open', () => net.onOpen && net.onOpen());
  c.on('data', m => net.onMsg && net.onMsg(m));
  c.on('close', () => net.onClose && net.onClose());
}
export function host(status) {
  const code = Math.floor(1000 + Math.random() * 9000);
  peer = new Peer('wizduel-' + code);
  peer.on('open', () => status('Room code: ' + code + '. Share it with your opponent and wait here.'));
  peer.on('connection', setConn);
  peer.on('error', e => { if (e.type === 'unavailable-id') host(status); else status('Network error: ' + e.type); });
}
export function join(code, status) {
  status('Connecting…');
  peer = new Peer();
  peer.on('open', () => setConn(peer.connect('wizduel-' + code, { reliable: true })));
  peer.on('error', e => status(e.type === 'peer-unavailable' ? 'No room with that code. Check it and try again.' : 'Network error: ' + e.type));
}
export function disconnect() { if (peer) peer.destroy(); peer = null; net.conn = null; }
