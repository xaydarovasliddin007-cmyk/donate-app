# UZDONATE — Google Cloud Console & Google Sign-In Setup Guide

Ushbu qo'llanma Google Cloud Console'da UZDONATE ilovasi uchun Google Sign-In (Google orqali kirish) tizimini to'liq sozlash va Production (ommaviy) holatiga keltirish bo'yicha aniq ma'lumotlarni o'z ichiga oladi.

---

## 1. Joriy Konfiguratsiya

- **Administrator hisobi:** faqat `xaydarovasliddin007@gmail.com`.
- **Loyiha nomi:** `uzdonate` (Google Cloud Platform)
- **Web Client ID (Backend tekshiruvi va Server Client ID uchun):**
  ```text
  223785346997-vphv1k7i131r72orkhj05dnvvhocd9br.apps.googleusercontent.com
  ```
  *(Render `GOOGLE_CLIENT_ID` va Android `googleServerClientId` shu web mijozdan foydalanadi.)*
- **Authorized JavaScript origins:** `https://uzdonate.uz`, `https://donate-app-5vhs.onrender.com`.
- **Publishing status:** 2026-10-15 kuni **In production** holati Google Cloud Audience sahifasida tasdiqlandi.
- **Scope'lar:** `openid`, `userinfo.email`, `userinfo.profile`; sensitive yoki restricted scope qo'shilmagan.
- **Branding:** UZDONATE; bosh sahifa `https://uzdonate.uz/`, maxfiylik `https://uzdonate.uz/privacy.html`, shartlar `https://uzdonate.uz/terms.html`.
- `/webapp/` javobida Google oynasi uchun `Cross-Origin-Opener-Policy: same-origin-allow-popups` va `Referrer-Policy: strict-origin-when-cross-origin` qo'yilgan. API/admin alohida xavfsizlik sozlamalarini saqlaydi.

---

## 2. Google Cloud Console'da Android Client ID larni Sozlash

[Google Cloud Credentials sahifasiga](https://console.cloud.google.com/apis/credentials) o'ting va quyidagi 2 ta Android OAuth mijozini qo'shing:

**2026-10-15 natijasi:** dastlab mijoz sahifalari agentda ham, loyiha egasida ham `Failed to load` qaytardi. Keyin yaratish sahifasi tiklandi va `UZDONATE Android Release` mijozi quyidagi APK'dan tekshirilgan package/SHA-1 bilan yaratildi. Google Console `OAuth client created` deb tasdiqladi. Client ID: `223785346997-o6b0mjuidj10usqn2cq0i6vu4jsrpcn9.apps.googleusercontent.com`. Mavjud Android mijoz saqlandi. Yangi mijoz yaratishni qayta takrorlamang; Google tomonida sozlamalar tarqalishi vaqt olishi mumkin. Haqiqiy Android qurilmasidagi login hali tekshirilishi kerak.

### A. Production Android Client (Play Store & Reliz uchun):
1. **Create Credentials** -> **OAuth Client ID** ni bosing.
2. Application type: **Android**
3. Name: `UZDONATE Android Release`
4. Package name:
   ```text
   uz.uzdonate.app
   ```
5. SHA-1 certificate fingerprint (Upload Keystore):
   ```text
   94:5B:EA:7B:55:47:B1:AF:FB:9A:07:70:EE:33:58:31:C8:62:21:69
   ```
6. SHA-256 (ixtiyoriy, tavsiya etiladi):
   ```text
   42:8B:30:F4:15:9B:ED:7C:C4:4B:1A:B2:A8:58:1B:52:4B:3A:E6:C5:09:5B:09:24:20:53:BE:23:94:BE:AF:F8
   ```

*(Eslatma: Ilova Google Play'ga yuklangach, Google Play App Signing bo'limida yangi SHA-1 hosil bo'lsa, uni ham 3-mijoz sifatida qo'shib qo'yish kerak).*

### B. Debug Android Client (Lokal testlash uchun):
1. **Create Credentials** -> **OAuth Client ID**
2. Application type: **Android**
3. Name: `UZDONATE Android Debug`
4. Package name:
   ```text
   uz.uzdonate.app
   ```
5. SHA-1 certificate fingerprint (Debug Keystore):
   ```text
   3B:8B:0E:8B:FE:0B:CA:DB:8E:9B:1C:A9:B4:82:12:09:2B:B8:FC:0E
   ```

---

## 3. OAuth Consent Screen (Rozilik oynasi) ni Production ga O'tkazish

**Bajarildi:** Audience sahifasi **In production** ko'rsatmoqda; test foydalanuvchilar ro'yxati bilan cheklash olib tashlandi. Kelajakdagi qayta sozlash uchun:

1. [OAuth consent screen sahifasiga](https://console.cloud.google.com/apis/credentials/consent) o'ting.
2. **Publishing status:** "Testing" dan **"Publish App"** (Production) tugmasini bosing.
3. Kerakli maydonlarni to'ldiring:
   - **App name:** `UZDONATE`
   - **User support email:** `xaydarovasliddin007@gmail.com`
   - **App domain:**
     - Application home page: `https://uzdonate.uz/`
     - Application privacy policy link: `https://uzdonate.uz/privacy.html`
     - Application terms of service link: `https://uzdonate.uz/terms.html`
   - **Developer contact information:** Emailingiz
4. **Scopes:** Faqat standart ochiq scope'lar talab etiladi:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   *(Bu oddiy identifikatsiya scope'lari. Production holati haqiqiy qurilmada login tekshiruvi o'rnini bosmaydi.)*

---

## 4. Tekshirish

Backend ishga tushganda `POST /api/v1/auth/google` so'rovi Google ID tokenni Google'ning rasmiy ochiq kalitlari (JWKS) orqali tekshiradi va foydalanuvchini ro'yxatdan o'tkazadi yoki mavjud akkauntga ulaydi.

2026-10-15 kuni `uzdonate.uz/webapp/` va Render manzilida Asliddin Google tugmasidan haqiqiy kirish bajarildi: ikkala sayt profili bir xil `UZD-8WSFBK56` ID ko'rsatdi. Android 0.2.2 (versionCode 2004) APK imzosi va APK/AAB yig'ilishi tekshirildi. Telefon va Telegram mini-ilovasidagi yakuniy sinovlar qolgan; Android `serverClientId` uchun yuqoridagi **web** client ID saqlanadi.

## 5. Yagona UZDONATE hisobi

Sayt, Telegram mini-ilovasi va Android bir xil backend foydalanuvchi ID, hamyon va buyurtmalaridan foydalanadi. Profil/xavfsizlik bo'limidan Google yoki Telegramni joriy hisobga ulang. Boshqa UZDONATE hisobiga bog'langan identifikator avtomatik birlashtirilmaydi: server `409` qaytaradi va balanslarni saqlaydi.

- Oddiy brauzer: Google tugmasi; Telegram uchun bot orqali 8 xonali tasdiqlash kodi.
- Telegram mini-ilovasi: Telegram imzolagan `initData`; Google tashqi brauzerda tasdiqlanadi, kod mini-ilovaga kiritiladi.
- Android: mahalliy Google SDK; qo'shimcha Google brauzer yo'li va Telegram bot kodi. Android SDK konfiguratsiyasi uchun yuqoridagi package/SHA-1 mosligi talab qilinadi.
- `POST /api/v1/auth/requests` kirish so'rovini yaratadi. `POST /api/v1/auth/requests/link` autentifikatsiyadan o'tgan hisobga bog'laydi. Google dalili `/auth/requests/:id/google`, tasdiqlangan Telegram dalili faqat maxfiy webhook orqali qabul qilinadi. Kod `/auth/requests/:id/exchange` orqali almashtiriladi.
- So'rov maxfiy qismi 256 bit, URLga qo'shilmaydi; DBda faqat xeshi saqlanadi. Kod 8 raqam, 5 daqiqagacha, bir martalik; 5 noto'g'ri urinishdan so'ng bekor bo'ladi. Endpointlarda tezlik chegarasi va `Cache-Control: no-store` bor.
- Browser Google sahifasi hech qachon o'zidan mehmon hisobi yaratmaydi. Google tokenlari DBga saqlanmaydi.

Yakuniy tekshiruvda sayt/mini-ilova/Androidda Google va Telegram bilan kirib, profilning bir xil UZDONATE ID ko'rsatishini tasdiqlang. Foydalanuvchi roziligi oynasi va haqiqiy Android qurilmasi sinovi bajarilmaguncha natijani to'liq ishlayapti deb belgilamang. Joriy dalillar: `artifacts/auth/google-signin-status.json`.
