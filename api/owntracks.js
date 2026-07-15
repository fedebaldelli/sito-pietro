/* =====================================================================
   Endpoint che riceve la posizione da OwnTracks e la salva su Supabase.
   URL una volta online:  https://TUO-SITO.vercel.app/api/owntracks?secret=XXX

   Variabili d'ambiente da impostare su Vercel (Settings → Environment Variables):
     SUPABASE_URL                = https://il-tuo-progetto.supabase.co
     SUPABASE_SERVICE_ROLE_KEY   = (Supabase → Settings → API → service_role, SEGRETA)
     OWNTRACKS_SECRET            = una parola segreta a piacere (es. bici2026)
   ===================================================================== */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json([]);

  // protezione minima: OwnTracks deve passare ?secret=... o header X-Secret
  const secret = process.env.OWNTRACKS_SECRET;
  if (secret) {
    const provided = req.query.secret || req.headers["x-secret"];
    if (provided !== secret) return res.status(401).json([]);
  }

  const b = req.body || {};
  // OwnTracks manda vari tipi di messaggio; ci interessa solo "location"
  if (b._type !== "location") return res.status(200).json([]);

  const row = {
    lat: b.lat,
    lon: b.lon,
    altitude: b.alt ?? null,
    accuracy: b.acc ?? null,
    battery: b.batt ?? null,
    speed: b.vel ?? null,
    recorded_at: new Date((b.tst ?? Date.now() / 1000) * 1000).toISOString(),
  };

  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!r.ok) {
    const t = await r.text();
    return res.status(500).json({ error: t });
  }

  // OwnTracks si aspetta un array (eventuali posizioni di "amici"): ne restituiamo uno vuoto
  return res.status(200).json([]);
}
