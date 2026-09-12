# UZDONATE — Google Firebase (FCM, Crashlytics, Analytics) Setup Guide

Ushbu qo'llanma UZDONATE mobil ilovasi va backend tizimiga Google Firebase xizmatlarini (Push-bildirishnomalar, Crashlytics xatolar monitoringi va Google Analytics) ulash bo'yicha to'liq bosqichma-bosqich ko'rsatmani taqdim etadi.

---

## 1. Firebase Konsolida Yangi Loyiha Ochish

1. [Firebase Console](https://console.firebase.google.com/) ga kiring.
2. **"Add project"** (Loyiha qo'shish) ni bosing va loyiha nomini kiriting: `uzdonate`.
3. **Google Analytics** ni yoqish (tavsiya etiladi — foydalanuvchilar oqimi va xaridlar tahlili uchun).

---

## 2. Android Ilovani Firebase'ga Qo'shish

Firebase boshqaruv panelida Android belgisini bosing:

1. **Android package name (Paket nomi):**
   ```text
   uz.uzdonate.app
   ```
2. **App nickname (Ilova taxallusi):**
   ```text
   UZDONATE
   ```
3. **Debug signing certificate SHA-1 (va Release SHA-1):**
   - **Release SHA-1 (`upload-keystore.jks`):**
     ```text
     94:5B:EA:7B:55:47:B1:AF:FB:9A:07:70:EE:33:58:31:C8:62:21:69
     ```
   - **Debug SHA-1:**
     ```text
     3B:8B:0E:8B:FE:0B:CA:DB:8E:9B:1C:A9:B4:82:12:09:2B:B8:FC:0E
     ```
4. **`google-services.json` faylini yuklab oling** va uni quyidagi manzilga joylashtiring:
   ```text
   mobile/android/app/google-services.json
   ```

---

## 3. Flutter (Mobil) Sozlamalari

`google-services.json` fayli joylashtirilgach:

### A. Gradle konfiguratsiyasi:
`mobile/android/settings.gradle.kts` da:
```kotlin
plugins {
    // ...
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
}
```

`mobile/android/app/build.gradle.kts` da:
```kotlin
plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}
```

### B. Flutter Paketlari (`mobile/pubspec.yaml`):
```yaml
dependencies:
  firebase_core: ^3.12.0
  firebase_messaging: ^15.2.0
  firebase_crashlytics: ^4.3.0
  firebase_analytics: ^11.4.0
```

---

## 4. Backend Push-Xabarlar (FCM) Sozlamasi

Backend'da avtomatik to'lovlar (Humo transferlari) yoki buyurtmalar yakunlanganda mijozga darhol Push-xabar yuborish uchun:

1. Firebase Console &rarr; **Project settings** (Tishli g'ildirakcha belgisi) &rarr; **Service accounts**.
2. **"Generate new private key"** tugmasini bosing va JSON faylni yuklab oling.
3. `backend/.env` fayliga quyidagi o'zgaruvchini qo'shing:
   ```env
   # JSON fayl tarkibini bitta qatorda kiritishingiz yoki fayl yo'lini berishingiz mumkin:
   FIREBASE_PROJECT_ID=uzdonate
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"uzdonate",...}
   ```
4. Agar ushbu kalit kiritilmasa, backend o'z arxitektura qoidasiga ko'ra ("wired but inert") xatoliksiz ishlaydi va bildirishnomalarni faqat ichki DB da saqlaydi. Kalit kiritilishi bilan avtomatik FCM orqali qurilmaga ham Push yuboriladi.
