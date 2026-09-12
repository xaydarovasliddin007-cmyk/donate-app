# UZDONATE — Google Cloud Console & Google Sign-In Setup Guide

Ushbu qo'llanma Google Cloud Console'da UZDONATE ilovasi uchun Google Sign-In (Google orqali kirish) tizimini to'liq sozlash va Production (ommaviy) holatiga keltirish bo'yicha aniq ma'lumotlarni o'z ichiga oladi.

---

## 1. Joriy Konfiguratsiya

- **Loyiha nomi:** `uzdonate` (Google Cloud Platform)
- **Web Client ID (Backend tekshiruvi va Server Client ID uchun):**
  ```text
  223785346997-vphv1k7i131r72orkhj05dnvvhocd9br.apps.googleusercontent.com
  ```
  *(Bu ID `backend/.env` da `GOOGLE_CLIENT_ID` va `mobile/lib/core/config/app_config.dart` da kiritilgan)*

---

## 2. Google Cloud Console'da Android Client ID larni Sozlash

[Google Cloud Credentials sahifasiga](https://console.cloud.google.com/apis/credentials) o'ting va quyidagi 2 ta Android OAuth mijozini qo'shing:

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

Hozirgi holatda tizim faqat "Test users" ro'yxatidagi foydalanuvchilar kirishiga ruxsat beradi. Barcha foydalanuvchilar kira olishi uchun:

1. [OAuth consent screen sahifasiga](https://console.cloud.google.com/apis/credentials/consent) o'ting.
2. **Publishing status:** "Testing" dan **"Publish App"** (Production) tugmasini bosing.
3. Kerakli maydonlarni to'ldiring:
   - **App name:** `UZDONATE`
   - **User support email:** O'zingizning emailingiz
   - **App domain:**
     - Application home page: `https://uzdonate.uz` (yoki veb sahifangiz)
     - Application privacy policy link: `https://uzdonate.uz/privacy`
     - Application terms of service link: `https://uzdonate.uz/terms`
   - **Developer contact information:** Emailingiz
4. **Scopes:** Faqat standart ochiq scope'lar talab etiladi:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   *(Ushbu scope'lar nozik/sensitiv bo'lmagani uchun Google tomonidan uzoq davom etuvchi rasmiy verifikatsiyani talab qilmaydi — darhol ishga tushadi).*

---

## 4. Tekshirish

Backend ishga tushganda `POST /api/v1/auth/google` so'rovi Google ID tokenni Google'ning rasmiy ochiq kalitlari (JWKS) orqali tekshiradi va foydalanuvchini ro'yxatdan o'tkazadi yoki mavjud akkauntga ulaydi.
