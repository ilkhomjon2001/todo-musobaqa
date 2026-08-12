// Umumiy ToDo holati — Supabase (PostgREST) orqali.
// Service role kaliti faqat server tomonda ishlatiladi: brauzerga ham,
// repo'ga ham tushmaydi. Vercel Supabase integratsiyasi env'ni o'zi ulaydi.

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const TABLE = "todo_state";

// Suiiste'molga qarshi oddiy chegaralar
const MAX_FIELDS = 500;
const MAX_ID_LEN = 32;
const ID_RE = /^[a-z0-9-]+$/i;

function base() {
  return String(SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1/" + TABLE;
}

function headers(extra) {
  return Object.assign(
    {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
    },
    extra || {}
  );
}

async function readAll() {
  const res = await fetch(base() + "?select=id,done", { headers: headers() });
  if (!res.ok) throw new Error("supabase " + res.status + " " + (await res.text()));
  const rows = await res.json();
  const items = {};
  for (const row of rows) items[row.id] = row.done === true;
  return items;
}

async function writePatch(patch) {
  const now = new Date().toISOString();
  const rows = Object.keys(patch).map((id) => ({
    id,
    done: patch[id],
    updated_at: now,
  }));

  // on_conflict=id + merge-duplicates => faqat shu qatorlar yangilanadi.
  // Boshqa bandlarga tegilmaydi, shuning uchun parallel belgilashda
  // biri ikkinchisining belgisini o'chirmaydi.
  const res = await fetch(base() + "?on_conflict=id", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error("supabase " + res.status + " " + (await res.text()));
}

function readPatch(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return null;
    }
  }
  if (!body || typeof body !== "object") return null;
  const patch = body.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;

  const ids = Object.keys(patch);
  if (ids.length === 0 || ids.length > MAX_FIELDS) return null;
  for (const id of ids) {
    if (id.length > MAX_ID_LEN || !ID_RE.test(id)) return null;
    if (typeof patch[id] !== "boolean") return null;
  }
  return patch;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({
      error: "storage_not_configured",
      hint: "Vercel > Storage > Supabase > Connect to Project qiling, keyin redeploy",
    });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ items: await readAll() });
    }

    if (req.method === "POST") {
      const patch = readPatch(req);
      if (!patch) return res.status(400).json({ error: "bad_patch" });
      await writePatch(patch);
      return res.status(200).json({ items: await readAll() });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    const msg = String(e && e.message);
    console.error("state api error:", msg);
    // Jadval hali yaratilmagan bo'lsa — aniq xabar beramiz
    if (/PGRST205|does not exist|Could not find the table/i.test(msg)) {
      return res.status(503).json({
        error: "table_missing",
        hint: "Supabase SQL Editor'da todo_state jadvalini yarating (README'ga qarang)",
      });
    }
    return res.status(502).json({ error: "storage_unavailable" });
  }
};
