const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PARTS = ['students', 'att', 'sp', 'mp', 'tasks', 'done', 'price'];

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || String(r.status));
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pin = process.env.APP_PIN;
  if (pin && req.headers['x-pin'] !== pin) return res.status(401).json({ error: 'pin' });
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'storage not configured' });
  try {
    if (req.method === 'GET') {
      const vals = await redis(['MGET', ...PARTS.map(p => 'abjad:' + p)]);
      const data = {};
      PARTS.forEach((p, i) => { data[p] = vals[i] ? JSON.parse(vals[i]) : null; });
      return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
      const { part, value } = req.body || {};
      if (!PARTS.includes(part) || value === undefined) return res.status(400).json({ error: 'bad request' });
      const str = JSON.stringify(value);
      if (str.length > 900000) return res.status(413).json({ error: 'too large' });
      await redis(['SET', 'abjad:' + part, str]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
