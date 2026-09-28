/**
 * =======================================================================
 * KONFIGURASI FIREBASE - KATALOG OLUMAJANG
 * =======================================================================
 * Salin konfigurasi aplikasi Web dari Firebase Console Anda:
 * 1. Buka https://console.firebase.google.com/
 * 2. Masuk ke Project Settings (Ikon Gear) -> General
 * 3. Di bagian "Your apps", pilih Web App (</>)
 * 4. Salin objek `firebaseConfig` dan tempelkan nilai API Key dsb. di bawah ini:
 */

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export default firebaseConfig;
