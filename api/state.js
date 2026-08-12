// Umumiy ToDo holati — Upstash Redis (Vercel Marketplace) REST API orqali.
// Kalitlar server tomonda, env o'zgaruvchilarida turadi — repo'ga tushmaydi.

const REST_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const HASH_KEY = "musobaqa-todo-state";

// Suiiste'molga qarshi oddiy chegaralar
const MAX_FIELDS = 500;
const MAX_ID_LEN = 32;
const ID_RE = /^[a-z0-9-]+$/i;

async function redis(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error("upstash " + res.status + " " + (await res.text()));
  }
  const json = await res.json();
  if (json.error) throw new Error("upstash: " + json.error);
  return json.result;
}

// HGETALL Upstash'da tekis massiv qaytaradi: [field, value, field, value, ...]
function toItems(flat) {
  const items = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      items[flat[i]] = flat[i + 1] === "1";
    }
  } else if (flat && typeof flat === "object") {
    for (const k of Object.keys(flat)) items[k] = flat[k] === "1";
  }
  return items;
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

  if (!REST_URL || !REST_TOKEN) {
    return res.status(503).json({
      error: "storage_not_configured",
      hint: "Vercel > Storage > Upstash Redis ni loyihaga ulang",
    });
  }

  try {
    if (req.method === "GET") {
      const items = toItems(await redis(["HGETALL", HASH_KEY]));
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const patch = readPatch(req);
      if (!patch) return res.status(400).json({ error: "bad_patch" });

      // Bitta HSET bilan — faqat o'zgargan bandlar yoziladi, shuning uchun
      // ikki kishi bir vaqtda belgilaganda biri ikkinchisini o'chirmaydi.
      const args = ["HSET", HASH_KEY];
      for (const id of Object.keys(patch)) args.push(id, patch[id] ? "1" : "0");
      await redis(args);

      const items = toItems(await redis(["HGETALL", HASH_KEY]));
      return res.status(200).json({ items });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    console.error("state api error:", e);
    return res.status(502).json({ error: "storage_unavailable" });
  }
};
