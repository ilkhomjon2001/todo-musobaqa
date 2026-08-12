// index.html client + api/state.js ni soxta Supabase (PostgREST) bilan sinash
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// ---------- soxta Supabase jadvali ----------
const TABLE = {}; // id -> {id, done, updated_at}
let dbCalls = 0;
let lastAuth = null;

global.fetch = async (url, opts) => {
  dbCalls++;
  opts = opts || {};
  lastAuth = opts.headers && opts.headers.Authorization;
  const method = opts.method || "GET";

  if (method === "GET" && url.includes("select=id,done")) {
    const rows = Object.values(TABLE).map(r => ({ id: r.id, done: r.done }));
    return { ok: true, status: 200, json: async () => rows, text: async () => "" };
  }

  if (method === "POST" && url.includes("on_conflict=id")) {
    const prefer = opts.headers.Prefer || "";
    if (!/merge-duplicates/.test(prefer)) throw new Error("upsert Prefer yo'q");
    const rows = JSON.parse(opts.body);
    for (const r of rows) TABLE[r.id] = r; // upsert
    return { ok: true, status: 201, json: async () => [], text: async () => "" };
  }

  throw new Error("kutilmagan so'rov: " + method + " " + url);
};

process.env.SUPABASE_URL = "https://xpfbicaodaombkbcstko.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
const handler = require(path.join(ROOT, "api/state.js"));

async function callApi(method, body) {
  const req = { method, body };
  let status = 200, payload = null;
  const res = {
    setHeader() {},
    status(s) { status = s; return res; },
    json(j) { payload = j; return res; },
  };
  await handler(req, res);
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function makeClient() {
  function el() {
    return { innerHTML: "", textContent: "", style: {},
      classList: { toggle() {}, contains() { return false }, add() {}, remove() {} },
      dataset: {}, querySelectorAll() { return [] }, addEventListener() {},
      closest() { return el() }, getAttribute() { return null } };
  }
  const store = {};
  const sandbox = {
    console: { error() {}, log() {} },
    Math, JSON, Date, Map, Object, Array, Promise, setTimeout, setInterval: () => 0,
    document: { getElementById: () => el(), addEventListener() {}, hidden: false },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v } },
    window: { addEventListener() {} },
    fetch: async (url, opts) => {
      const method = (opts && opts.method) || "GET";
      const body = opts && opts.body ? JSON.parse(opts.body) : undefined;
      return callApi(method, body);
    },
  };
  vm.createContext(sandbox);
  const js = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(js + "\n__api={init:init,toggle:toggle,load:loadState,st:()=>state,shared:()=>SHARED};", sandbox);
  return sandbox.__api;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? "  OK  " : " XATO ") + label + " => " + got + (ok ? "" : " (kutilgan " + want + ")"));
}

(async () => {
  const A = makeClient(); const B = makeClient();
  await A.init(); await B.init();
  check("1) backend ulandi (A)      ", A.shared(), true);
  check("1) backend ulandi (B)      ", B.shared(), true);

  A.toggle("s1-0"); await wait(30);
  check("2) A belgiladi             ", A.st()["s1-0"], true);

  await B.load();
  check("3) B ko'rdi                ", B.st()["s1-0"], true);

  for (let i = 0; i < 5; i++) await A.load();
  check("4) A 5x poll keyin qoldi   ", A.st()["s1-0"], true);

  A.toggle("s2-1"); B.toggle("s4-3"); await wait(50);
  await A.load(); await B.load();
  check("5) parallel: s2-1          ", A.st()["s2-1"], true);
  check("5) parallel: s4-3          ", A.st()["s4-3"], true);
  check("5) parallel: s1-0 buzilmadi", A.st()["s1-0"], true);

  B.toggle("s1-0"); await wait(30); await A.load();
  check("6) B uncheck -> A ko'rdi   ", A.st()["s1-0"], false);

  const slow = A.load(); A.toggle("s5-0"); await slow; await wait(30);
  check("7) poll paytida bosilgan   ", A.st()["s5-0"], true);

  // service_role kaliti ishlatilyaptimi
  check("8) service key yuborildi   ", lastAuth === "Bearer fake-service-key", true);

  // jadval yo'q holati
  const saved = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404,
    text: async () => '{"code":"PGRST205","message":"Could not find the table"}' });
  const r = await callApi("GET");
  const j = await r.json();
  check("9) jadval yo'q -> xabar    ", j.error, "table_missing");
  global.fetch = saved;

  // yaroqsiz patch rad etiladimi
  const bad = await callApi("POST", { patch: { "s1-0": "ha" } });
  check("10) yaroqsiz patch rad     ", bad.status, 400);
  const inj = await callApi("POST", { patch: { "s1-0'; drop table": true } });
  check("10) yomon id rad etildi    ", inj.status, 400);

  console.log("\nDB so'rovlari:", dbCalls, "| jadval:", JSON.stringify(TABLE).slice(0, 160));
  console.log(fails === 0 ? "\nHAMMA TEST O'TDI" : "\n" + fails + " ta test yiqildi");
  process.exit(fails === 0 ? 0 : 1);
})();
