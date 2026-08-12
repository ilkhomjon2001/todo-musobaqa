# Musobaqa ToDo

Robbit Akademiyasi robototexnika musobaqasi va bitiruv marosimi uchun
umumiy (shared) checkbox ro'yxati — havolasi bor har kim belgilay oladi va
o'zgarish hammaga ko'rinadi.

## Tuzilishi

```
index.html      — butun sahifa (HTML + CSS + JS, build kerak emas)
api/state.js    — Vercel serverless funksiya (GET/POST), Supabase'ga yozadi
test/e2e.js     — soxta Supabase bilan uchdan-uchiga test (node test/e2e.js)
```

## Sozlash

### 1. Supabase'ni loyihaga ulash

Vercel → **Storage** → Supabase → **Connect to Project**.
Shundan keyin Vercel `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` kabi env
o'zgaruvchilarni avtomatik qo'shadi. Kod ularni o'zi topadi.

> Service role kaliti **faqat serverda** ishlatiladi — brauzerga ham,
> repo'ga ham tushmaydi.

### 2. Jadval yaratish

Supabase → **SQL Editor** → shuni ishga tushiring:

```sql
create table if not exists todo_state (
  id         text primary key,
  done       boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RLS yoqilgan, hech qanday policy yo'q:
-- faqat service_role (ya'ni bizning serverless funksiyamiz) kira oladi.
alter table todo_state enable row level security;
```

### 3. Redeploy

Env o'zgaruvchilar qo'shilgach bir marta qayta deploy qiling — aks holda
funksiya ularni ko'rmaydi.

### Tekshirish

`https://<sayt>/api/state` ochilsin:

| Javob | Ma'nosi |
|---|---|
| `{"items":{}}` | hammasi tayyor |
| `storage_not_configured` | 1-qadam yoki redeploy qilinmagan |
| `table_missing` | 2-qadam bajarilmagan |

## Bepul limit

Supabase Free Plan bu yuk uchun juda katta zaxira beradi. Sahifa har 8
soniyada bir so'rov yuboradi va **tab ko'rinmayotganda umuman so'ramaydi**.
Bitta ochiq tab soatiga ~450 so'rov; musobaqa kuni 20 kishi 10 soat ochiq
tutsa ~90K — muammo emas.

## Backend bo'lmasa

`/api/state` javob bermasa (lokal fayl, oflayn, Supabase ulanmagan) sahifa
`localStorage`ga tushadi: belgilar yo'qolmaydi, lekin faqat shu qurilmada
saqlanadi. Pastdagi nuqta to'q sariq rangga o'tib buni ko'rsatadi.

## Ma'lumot qanday saqlanadi

Har bir band — alohida qator (`id` = `s1-0`, `done` = true/false).
Saqlashda faqat **o'zgargan** bandlar yuboriladi (`on_conflict=id` upsert),
shuning uchun ikki kishi bir vaqtda turli bandlarni belgilaganda biri
ikkinchisining belgisini o'chirmaydi.

## Test

```
node test/e2e.js
```

Supabase'ni soxtalashtiradi va ikki brauzer nusxasini simulyatsiya qiladi:
sinxronizatsiya, parallel belgilash, uncheck, poll paytidagi bosish,
jadval yo'q holati, yaroqsiz ma'lumotni rad etish.
