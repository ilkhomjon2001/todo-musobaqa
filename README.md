# Musobaqa ToDo

Robbit Akademiyasi robototexnika musobaqasi va bitiruv marosimi uchun
umumiy (shared) checkbox ro'yxati — havolasi bor har kim belgilay oladi va
o'zgarish hammaga ko'rinadi.

## Tuzilishi

```
index.html      — butun sahifa (HTML + CSS + JS, build kerak emas)
api/state.js    — Vercel serverless funksiya (GET/POST), Upstash Redis'ga yozadi
```

## Vercel'da sozlash

1. **Deploy.** Vercel → Add New → Project → shu repo. Framework Preset: **Other**.
   Build buyrug'i kerak emas.

2. **Upstash Redis'ni ulash (bepul).**
   Vercel loyihasi → **Storage** → **Upstash — Serverless DB (Redis)** →
   Create → loyihaga **Connect** qiling.

   Vercel `KV_REST_API_URL` va `KV_REST_API_TOKEN` env o'zgaruvchilarini
   avtomatik qo'shadi. Kod ularni o'zi topadi — qo'lda hech narsa yozish
   shart emas. (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   nomlari ham qo'llab-quvvatlanadi.)

3. **Redeploy.** Env o'zgaruvchilar qo'shilgach bir marta qayta deploy qiling —
   aks holda funksiya ularni ko'rmaydi.

Tekshirish: `https://<sayt>/api/state` ochilganda `{"items":{...}}` chiqishi kerak.
Agar `storage_not_configured` chiqsa — 2-qadam bajarilmagan yoki redeploy qilinmagan.

## Bepul limit

Upstash bepul tarifi ~500K buyruq/oy. Sahifa har 8 soniyada bir marta so'rov
yuboradi va **tab ko'rinmayotganda so'rov yubormaydi**. Ya'ni bitta ochiq tab
soatiga ~450 buyruq. Musobaqa kuni 20 kishi 10 soat ochiq tutsa ham ~90K —
limitga yetmaydi.

## Backend bo'lmasa

`/api/state` javob bermasa (lokal fayl, oflayn, Upstash ulanmagan) sahifa
`localStorage`ga tushadi: belgilar yo'qolmaydi, lekin faqat shu qurilmada
saqlanadi. Pastdagi nuqta to'q sariq rangga o'tib buni ko'rsatadi.

## Ma'lumot qayerda

Redis'da bitta hash: `musobaqa-todo-state`, har band `s1-0` ko'rinishidagi
field, qiymati `"1"` yoki `"0"`. Saqlashda faqat **o'zgargan** bandlar
yuboriladi, shuning uchun ikki kishi bir vaqtda belgilaganda biri
ikkinchisining belgisini o'chirmaydi.
