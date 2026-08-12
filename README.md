# Musobaqa ToDo

Robbit Akademiyasi robototexnika musobaqasi va bitiruv marosimi uchun
checkbox ro'yxati.

## Saqlash

Sahifa `window.storage` (umumiy saqlash) mavjud bo'lsa o'shandan foydalanadi,
aks holda `localStorage`ga tushadi. Oddiy hosting'da (Vercel, GitHub Pages)
`window.storage` **yo'q**, shuning uchun holat har bir qurilmada alohida
saqlanadi. Haqiqiy umumiy (barcha foydalanuvchilar uchun bir xil) ro'yxat
kerak bo'lsa, backend qo'shish zarur — masalan Vercel KV yoki Supabase.

## Deploy (Vercel)

Bu statik `index.html` fayl — Vercel'da alohida build sozlamasi kerak emas:
"Framework Preset: Other" tanlab deploy qiling.
