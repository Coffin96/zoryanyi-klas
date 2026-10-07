const V = 'KR1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const URL_CARD = /#\/p\/([0-9a-f-]{36})\/?$/;

export const encodeP = uuid => `${V}|P|${uuid}`;
export const encodeR = (uuid, id, item, qty, ymd) => `${V}|R|${uuid}|${id}|${item}.${qty}|${ymd}`;

export function decode(text) {
  const t = String(text).trim();
  const m = t.match(URL_CARD);
  if (m && UUID.test(m[1])) return { type: 'card', uuid: m[1] };
  const [v, kind, uuid, id, body, ymd] = t.split('|');
  if (v !== V || !UUID.test(uuid ?? '')) throw new Error('bad-qr');
  if (kind === 'P') return { type: 'card', uuid };
  if (kind === 'R') {
    const [item, qty] = (body ?? '').split('.');
    const q = Number(qty);
    if (!/^[a-z0-9_]{2,24}$/.test(item ?? '') || !Number.isInteger(q) || q < 1 || q > 10 || !/^\d{6}$/.test(ymd ?? ''))
      throw new Error('bad-qr');
    return { type: 'order', uuid, id, item, qty: q, ymd };
  }
  throw new Error('bad-qr');
}
