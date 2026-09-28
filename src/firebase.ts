import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
  serverTimestamp
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  FirebaseStorage
} from 'firebase/storage';
import { firebaseConfig as rawFileConfig } from '../firebase-config.js';
import { Warung, FirebaseConfigObject } from './types';
import { compressImage } from './utils/imageCompressor';
import {
  saveWarungsToIndexedDB,
  getWarungsFromIndexedDB,
  clearAllWarungsFromIndexedDB
} from './utils/dbStorage';

export const ADMIN_WA = '6281334274818';
export const ADMIN_PASSCODE = '231288';
export const DEFAULT_ADMIN_EMAIL = 'serba6262@gmail.com';
export const MAX_PHOTOS_PER_WARUNG = 60;

// Resolve Firebase configuration:
// 1. Vite Environment Variables (GitHub Secrets / .env)
// 2. firebase-config.js (File project utama)
// 3. LocalStorage (Konfigurasi tersimpan lokal di browser HP)
export function getStoredFirebaseConfig(): FirebaseConfigObject {
  // 1. Check Vite Environment Variables
  const envMeta = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : undefined;
  const envConfig: FirebaseConfigObject = {
    apiKey: (envMeta?.VITE_FIREBASE_API_KEY as string) || '',
    authDomain: (envMeta?.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
    projectId: (envMeta?.VITE_FIREBASE_PROJECT_ID as string) || '',
    storageBucket: (envMeta?.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
    messagingSenderId: (envMeta?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
    appId: (envMeta?.VITE_FIREBASE_APP_ID as string) || '',
  };

  if (isFirebaseConfigured(envConfig)) {
    return envConfig;
  }

  // 2. Check firebase-config.js
  if (isFirebaseConfigured(rawFileConfig)) {
    return rawFileConfig;
  }

  // 3. Check Local Storage
  if (typeof window !== 'undefined') {
    const localSaved = localStorage.getItem('olumajang_firebase_config');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (isFirebaseConfigured(parsed)) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
  }

  return {
    apiKey: rawFileConfig.apiKey || '',
    authDomain: rawFileConfig.authDomain || '',
    projectId: rawFileConfig.projectId || '',
    storageBucket: rawFileConfig.storageBucket || '',
    messagingSenderId: rawFileConfig.messagingSenderId || '',
    appId: rawFileConfig.appId || '',
  };
}

export function isFirebaseConfigured(config?: FirebaseConfigObject): boolean {
  const cfg = config || getStoredFirebaseConfig();
  return Boolean(
    cfg &&
    cfg.apiKey &&
    typeof cfg.apiKey === 'string' &&
    cfg.apiKey.trim().length > 10 &&
    !cfg.apiKey.includes('YOUR_API_KEY') &&
    cfg.projectId &&
    typeof cfg.projectId === 'string' &&
    cfg.projectId.trim().length > 2 &&
    !cfg.projectId.includes('YOUR_PROJECT_ID')
  );
}

let app: FirebaseApp | null = null;
export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let storage: FirebaseStorage | null = null;

export function initFirebaseServices(): boolean {
  try {
    const currentConfig = getStoredFirebaseConfig();
    if (isFirebaseConfigured(currentConfig)) {
      if (!getApps().length) {
        app = initializeApp(currentConfig);
      } else {
        app = getApps()[0];
      }
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
      console.log('[Firebase] Cloud Firestore & Storage aktif terhubung ke project:', currentConfig.projectId);
      return true;
    } else {
      console.warn('[Firebase] Konfigurasi Firebase belum diisi. Cloud database belum aktif.');
      return false;
    }
  } catch (err: any) {
    console.error('[Firebase] Inisialisasi Firebase gagal:', err);
    return false;
  }
}

// Jalankan inisialisasi awal
initFirebaseServices();

// -------------------------------------------------------------
// CACHE LOKAL (IndexedDB + LocalStorage) MURNI SEBAGAI OFFLINE FALLBACK
// Database Utama Tetap Cloud Firestore
// -------------------------------------------------------------
const LOCAL_STORAGE_KEY = 'katalog_olumajang_warungs_data_v3';
let memoryWarungsCache: Warung[] = [];

type WarungListener = (warungs: Warung[], source: 'firebase' | 'local') => void;
const warungListeners = new Set<WarungListener>();

function notifyWarungListeners(warungs: Warung[], source: 'firebase' | 'local') {
  memoryWarungsCache = warungs;
  warungListeners.forEach((cb) => {
    try {
      cb(warungs, source);
    } catch (err) {
      console.error('Error notifying warung listener:', err);
    }
  });
}

export function getLocalWarungs(): Warung[] {
  if (memoryWarungsCache.length > 0) {
    return memoryWarungsCache;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryWarungsCache = parsed.map((w: Warung) => ({
          ...w,
          nama: (w.nama || '').toUpperCase(),
        }));
        return memoryWarungsCache;
      }
    }
  } catch (e) {
    console.error('Failed reading local cache:', e);
  }

  return memoryWarungsCache;
}

export async function saveLocalWarungs(warungs: Warung[], notify = true): Promise<void> {
  memoryWarungsCache = warungs;

  // 1. Simpan ke IndexedDB (Kapasitas Besar untuk cache offline)
  await saveWarungsToIndexedDB(warungs).catch((err) => {
    console.warn('Gagal menyimpan ke IndexedDB cache:', err);
  });

  // 2. Simpan juga ke LocalStorage sebagai backup cepat
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(warungs));
  } catch {
    // Abaikan jika quota localStorage penuh
  }

  if (notify) {
    notifyWarungListeners(warungs, 'local');
  }
}

// -------------------------------------------------------------
// REALTIME SYNC ANTAR PERANGKAT (Cloud Firestore Listener)
// URUTAN: FIRESTORE -> DATA KATALOG -> CACHE LOKAL
// HP BARU (HP B) TANPA CACHE LANGSUNG MEMBACA DARI FIRESTORE
// -------------------------------------------------------------

export function subscribeToWarungs(callback: (warungs: Warung[], source: 'firebase' | 'local') => void) {
  warungListeners.add(callback);

  let hasReceivedFirestoreData = false;

  // 1. Berikan cache lokal sebagai tampilan awal jika ada, agar tidak kedap-kedip
  const initial = getLocalWarungs();
  if (initial.length > 0) {
    initial.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    callback(initial, 'local');
  }

  // Baca IndexedDB HANYA jika Firestore belum merespons
  getWarungsFromIndexedDB().then((idbWarungs) => {
    if (!hasReceivedFirestoreData && Array.isArray(idbWarungs) && idbWarungs.length > 0 && memoryWarungsCache.length === 0) {
      idbWarungs.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
      memoryWarungsCache = idbWarungs;
      callback(idbWarungs, 'local');
    }
  }).catch(() => {});

  let unsubFirestore = () => {};

  // 2. KONEKSI UTAMA KE CLOUD FIRESTORE
  if (db && isFirebaseConfigured()) {
    try {
      const colRef = collection(db, 'warungs');

      // Realtime listener
      unsubFirestore = onSnapshot(
        colRef,
        (snapshot) => {
          hasReceivedFirestoreData = true;
          const list: Warung[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              nama: (data.nama || 'WARUNG LUMAJANG').toUpperCase(),
              logoUrl: data.logoUrl || '',
              alamat: data.alamat || 'Lumajang',
              mapsUrl: data.mapsUrl || '',
              kategori: data.kategori || 'Kuliner Lumajang',
              whatsapp: data.whatsapp || ADMIN_WA,
              photos: Array.isArray(data.photos) ? data.photos : [],
              photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
              createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
              updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
            };
          });

          // Urutkan alfabet nama warung A-Z
          list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

          // URUTAN: FIRESTORE -> DATA KATALOG -> CACHE LOKAL
          memoryWarungsCache = list;
          saveLocalWarungs(list, false);
          notifyWarungListeners(list, 'firebase');
        },
        (error: any) => {
          console.error('[Firestore onSnapshot Error]', error);
          if (error.code === 'permission-denied') {
            console.error('[Firestore] Izin baca ditolak! Periksa aturan firestore.rules agar mengizinkan get, list untuk umum.');
          }
        }
      );

      // Explicit getDocs() untuk memastikan HP baru yang baru buka langsung menarik data tanpa jeda
      getDocs(colRef).then((snapshot) => {
        if (!hasReceivedFirestoreData && !snapshot.empty) {
          hasReceivedFirestoreData = true;
          const list: Warung[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              nama: (data.nama || 'WARUNG LUMAJANG').toUpperCase(),
              logoUrl: data.logoUrl || '',
              alamat: data.alamat || 'Lumajang',
              mapsUrl: data.mapsUrl || '',
              kategori: data.kategori || 'Kuliner Lumajang',
              whatsapp: data.whatsapp || ADMIN_WA,
              photos: Array.isArray(data.photos) ? data.photos : [],
              photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
              createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
              updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
            };
          });
          list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
          memoryWarungsCache = list;
          saveLocalWarungs(list, false);
          notifyWarungListeners(list, 'firebase');
        }
      }).catch((e) => {
        console.error('[Firestore getDocs Error]', e);
      });
    } catch (e) {
      console.error('[Firestore] Error inisialisasi onSnapshot:', e);
    }
  }

  return () => {
    warungListeners.delete(callback);
    unsubFirestore();
  };
}

// -------------------------------------------------------------
// OPERASI WARUNG: WAJIB TERSIMPAN DI CLOUD FIRESTORE TERLEBIH DAHULU
// TIDAK ADA SILENT FALLBACK KE MEMORI HP
// -------------------------------------------------------------

export async function createWarung(data: Partial<Warung>): Promise<string> {
  const cleanId = 'warung-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const capitalizedName = (data.nama?.trim() || 'WARUNG BARU LUMAJANG').toUpperCase();

  const newWarung: Warung = {
    id: cleanId,
    nama: capitalizedName,
    alamat: data.alamat?.trim() || 'Lumajang',
    kategori: data.kategori?.trim() || 'Kuliner Lumajang',
    whatsapp: data.whatsapp?.trim() || ADMIN_WA,
    mapsUrl: data.mapsUrl?.trim() || '',
    logoUrl: data.logoUrl?.trim() || '',
    photos: Array.isArray(data.photos) ? data.photos : [],
    photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Validasi data
  if (!newWarung.nama) {
    throw new Error('Nama warung tidak boleh kosong.');
  }

  // 1. Validasi Koneksi Cloud Firestore (Database Utama)
  if (!db || !isFirebaseConfigured()) {
    throw new Error(
      'Koneksi Cloud Firestore belum terhubung! ' +
      'Data warung TIDAK DAPAT disimpan hanya di memori HP ini karena tidak akan muncul di HP lain. ' +
      'Silakan hubungkan Firebase di Panel Admin (atau perbarui firebase-config.js) terlebih dahulu.'
    );
  }

  // 2. Simpan dokumen ke Cloud Firestore (Wajib berhasil ke Cloud)
  try {
    const docRef = doc(db, 'warungs', cleanId);
    await setDoc(docRef, {
      nama: newWarung.nama,
      logoUrl: newWarung.logoUrl || '',
      alamat: newWarung.alamat,
      mapsUrl: newWarung.mapsUrl,
      kategori: newWarung.kategori,
      whatsapp: newWarung.whatsapp,
      status: 'buka',
      photos: newWarung.photos,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('[Firestore] Warung BERHASIL ditulis ke Firestore collection "warungs":', cleanId);
  } catch (err: any) {
    console.error('[Firestore Error] Gagal simpan ke Firestore:', err);
    let msg = err.message || 'Kesalahan jaringan atau database.';
    if (err.code === 'permission-denied') {
      msg = 'Akses ditolak (permission-denied). Pastikan Anda telah login admin dan aturan firestore.rules mengizinkan write.';
    } else if (err.code === 'unavailable') {
      msg = 'Jaringan tidak tersedia atau koneksi Firestore offline.';
    }
    throw new Error('Gagal menyimpan warung ke Cloud Firestore: ' + msg);
  }

  // 3. Update cache lokal HANYA SETELAH Firestore berhasil
  const localList = [...getLocalWarungs().filter((w) => w.id !== cleanId)];
  localList.push(newWarung);
  localList.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  await saveLocalWarungs(localList, true);

  return cleanId;
}

export async function updateWarung(id: string, updates: Partial<Warung>): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error(
      'Cloud Firestore belum terhubung! Perubahan tidak dapat disimpan ke cloud server.'
    );
  }

  const payload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.nama !== undefined) payload.nama = updates.nama.trim().toUpperCase();
  if (updates.alamat !== undefined) payload.alamat = updates.alamat.trim();
  if (updates.kategori !== undefined) payload.kategori = updates.kategori.trim();
  if (updates.whatsapp !== undefined) payload.whatsapp = updates.whatsapp.trim();
  if (updates.mapsUrl !== undefined) payload.mapsUrl = updates.mapsUrl.trim();
  if (updates.logoUrl !== undefined) payload.logoUrl = updates.logoUrl;
  if (updates.photos !== undefined) payload.photos = updates.photos;
  payload.status = 'buka';

  // 1. Update ke Cloud Firestore (Wajib berhasil ke Cloud)
  try {
    const docRef = doc(db, 'warungs', id);
    await updateDoc(docRef, payload);
    console.log('[Firestore] Warung BERHASIL diupdate di Firestore:', id);
  } catch (err: any) {
    console.error('[Firestore Error] Gagal update dokumen di Firestore:', err);
    let msg = err.message || 'Kesalahan jaringan atau database.';
    if (err.code === 'permission-denied') {
      msg = 'Akses ditolak (permission-denied). Periksa izin admin.';
    }
    throw new Error('Gagal update ke Cloud Firestore: ' + msg);
  }

  // 2. Update cache lokal HANYA SETELAH Firestore berhasil
  const localList = [...getLocalWarungs()];
  const index = localList.findIndex((w) => w.id === id);
  if (index !== -1) {
    localList[index] = {
      ...localList[index],
      ...updates,
      nama: updates.nama ? updates.nama.trim().toUpperCase() : localList[index].nama,
      updatedAt: new Date().toISOString(),
    };
    localList.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    await saveLocalWarungs(localList, true);
  }
}

export async function removeWarung(id: string, currentWarung?: Warung): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Cloud Firestore belum terhubung! Warung tidak dapat dihapus dari server cloud.');
  }

  // 1. Hapus dari Cloud Firestore & Firebase Storage
  try {
    if (storage && currentWarung) {
      if (currentWarung.logoUrl && currentWarung.logoUrl.includes('firebasestorage')) {
        try {
          const logoRef = ref(storage, currentWarung.logoUrl);
          await deleteObject(logoRef).catch(() => {});
        } catch {
          // ignore
        }
      }
      if (currentWarung.photos && currentWarung.photos.length > 0) {
        for (const pUrl of currentWarung.photos) {
          if (pUrl.includes('firebasestorage')) {
            try {
              const pRef = ref(storage, pUrl);
              await deleteObject(pRef).catch(() => {});
            } catch {
              // ignore
            }
          }
        }
      }
    }

    const docRef = doc(db, 'warungs', id);
    await deleteDoc(docRef);
    console.log('[Firestore] Warung BERHASIL dihapus dari Firestore:', id);
  } catch (err: any) {
    console.error('[Firestore Error] Gagal menghapus dokumen di Firestore:', err);
    throw new Error('Gagal menghapus dari Cloud Firestore: ' + (err.message || 'Periksa koneksi.'));
  }

  // 2. Hapus dari cache lokal HANYA SETELAH Firestore berhasil
  const localList = getLocalWarungs().filter((w) => w.id !== id);
  await saveLocalWarungs(localList, true);
}

export async function resetCatalogToZero(): Promise<void> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Cloud Firestore belum terhubung.');
  }

  try {
    const snapshot = await getDocs(collection(db, 'warungs'));
    for (const d of snapshot.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }
  } catch (e: any) {
    console.warn('Error resetting Firestore:', e);
    throw new Error('Gagal mereset Firestore: ' + e.message);
  }

  await clearAllWarungsFromIndexedDB();
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
  memoryWarungsCache = [];
  notifyWarungListeners([], 'local');
}

// -------------------------------------------------------------
// PENYIMPANAN FOTO: KOMPRES -> FIREBASE STORAGE -> SIMPAN URL KE FIRESTORE
// TIDAK BOLEH HANYA DISIMPAN DI MEMORI HP
// -------------------------------------------------------------

export async function uploadWarungLogo(
  warungId: string,
  rawFile: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!storage || !isFirebaseConfigured()) {
    throw new Error(
      'Firebase Storage belum terhubung! ' +
      'Logo warung wajib disimpan di Firebase Storage agar dapat dilihat di HP lain.'
    );
  }

  // 1. Kompres logo ke maksimal 800px
  const file = await compressImage(rawFile, { maxWidth: 800, maxHeight: 800, quality: 0.88 });

  // 2. Upload ke Firebase Storage
  const cleanFileName = `logo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storageRef = ref(storage, `warungs/${warungId}/logo/${cleanFileName}`);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'image/jpeg',
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(progress));
      },
      (error: any) => {
        console.error('[Firebase Storage Error]', error);
        let msg = error.message || 'Gagal mengunggah logo ke Firebase Storage.';
        if (error.code === 'storage/unauthorized') {
          msg = 'Akses upload storage ditolak (unauthorized). Pastikan aturan storage.rules sudah diizinkan.';
        }
        reject(new Error(msg));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await updateWarung(warungId, { logoUrl: downloadUrl });
          resolve(downloadUrl);
        } catch (e: any) {
          reject(new Error('Gagal mengambil URL download logo: ' + e.message));
        }
      }
    );
  });
}

export async function uploadWarungPhotos(
  warungId: string,
  currentPhotos: string[],
  rawFiles: File[],
  onProgress?: (totalPercent: number, currentFileIdx: number, totalFiles: number) => void
): Promise<string[]> {
  if (!storage || !isFirebaseConfigured()) {
    throw new Error(
      'Firebase Storage belum terhubung! ' +
      'Foto menu wajib diunggah ke Firebase Storage agar muncul di HP lain. ' +
      'Foto TIDAK BOLEH hanya disimpan di memori HP admin.'
    );
  }

  // Batas maksimal 60 foto per warung
  if (currentPhotos.length + rawFiles.length > MAX_PHOTOS_PER_WARUNG) {
    throw new Error(`Warung sudah mencapai batas maksimal ${MAX_PHOTOS_PER_WARUNG} foto.`);
  }

  const uploadedUrls: string[] = [];

  for (let i = 0; i < rawFiles.length; i++) {
    // 1. Kompres foto ke maksimal 1200px dengan Canvas API
    const file = await compressImage(rawFiles[i], {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.88
    });

    const cleanFileName = `photo_${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, `warungs/${warungId}/photos/${cleanFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const overallProgress = Math.round(((i + fileProgress / 100) / rawFiles.length) * 100);
          if (onProgress) onProgress(overallProgress, i + 1, rawFiles.length);
        },
        (error: any) => {
          console.error('[Firebase Storage Upload Error]', error);
          let msg = error.message || 'Gagal upload foto ke Firebase Storage.';
          if (error.code === 'storage/unauthorized') {
            msg = 'Akses storage ditolak (unauthorized). Pastikan aturan storage.rules mengizinkan admin.';
          } else if (error.code === 'storage/quota-exceeded') {
            msg = 'Quota Firebase Storage telah habis.';
          }
          reject(new Error(msg));
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            uploadedUrls.push(url);
            resolve();
          } catch (e: any) {
            reject(new Error('Gagal mendapatkan download URL foto: ' + e.message));
          }
        }
      );
    });
  }

  // 4. Simpan seluruh URL foto permanen ke dokumen warung di Firestore
  const newPhotoList = [...currentPhotos, ...uploadedUrls];
  await updateWarung(warungId, { photos: newPhotoList });
  return newPhotoList;
}

export async function replaceWarungPhoto(
  warungId: string,
  currentPhotos: string[],
  photoIndex: number,
  newRawFile: File,
  onProgress?: (percent: number) => void
): Promise<string[]> {
  if (!storage || !isFirebaseConfigured()) {
    throw new Error('Firebase Storage belum terhubung.');
  }

  const file = await compressImage(newRawFile, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.88,
  });

  const oldUrl = currentPhotos[photoIndex];
  if (oldUrl && oldUrl.includes('firebasestorage')) {
    try {
      const oldRef = ref(storage, oldUrl);
      await deleteObject(oldRef).catch(() => {});
    } catch {
      // ignore
    }
  }

  const cleanFileName = `photo_edit_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storageRef = ref(storage, `warungs/${warungId}/photos/${cleanFileName}`);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'image/jpeg',
  });

  const newUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(progress));
      },
      (error: any) => reject(new Error('Gagal mengganti foto: ' + error.message)),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (e: any) {
          reject(new Error('Gagal mengambil URL foto baru: ' + e.message));
        }
      }
    );
  });

  const updatedPhotos = [...currentPhotos];
  updatedPhotos[photoIndex] = newUrl;
  await updateWarung(warungId, { photos: updatedPhotos });
  return updatedPhotos;
}

export async function deleteWarungPhoto(
  warungId: string,
  currentPhotos: string[],
  photoUrlToDelete: string
): Promise<string[]> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Cloud Firestore belum terhubung.');
  }

  if (storage && photoUrlToDelete.includes('firebasestorage')) {
    try {
      const pRef = ref(storage, photoUrlToDelete);
      await deleteObject(pRef).catch(() => {});
    } catch (e) {
      console.warn('Could not delete from storage:', e);
    }
  }

  const filtered = currentPhotos.filter((p) => p !== photoUrlToDelete);
  await updateWarung(warungId, { photos: filtered });
  return filtered;
}

// -------------------------------------------------------------
// AUTENTIKASI ADMIN KE FIREBASE AUTH
// -------------------------------------------------------------

export function subscribeAuth(callback: (user: User | null, isPasscodeAdmin: boolean) => void) {
  const isPasscodeAdmin = typeof window !== 'undefined' && sessionStorage.getItem('olumajang_admin_auth') === 'true';

  if (auth && isFirebaseConfigured()) {
    // Jika admin login sebelumnya dengan passcode, pastikan auth terhubung
    if (isPasscodeAdmin && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      callback(firebaseUser, isPasscodeAdmin);
    });
  }

  callback(null, isPasscodeAdmin);
  return () => {};
}

export async function loginAdmin(emailOrPass: string, passwordInput?: string): Promise<{ success: boolean; message?: string }> {
  const isPasscode = emailOrPass === ADMIN_PASSCODE || passwordInput === ADMIN_PASSCODE;

  if (isPasscode) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('olumajang_admin_auth', 'true');
    }

    // Login ke Firebase Auth agar mendapatkan hak tulis di Firestore & Storage rules
    if (auth && isFirebaseConfigured()) {
      try {
        await signInWithEmailAndPassword(auth, DEFAULT_ADMIN_EMAIL, ADMIN_PASSCODE);
      } catch {
        try {
          await signInAnonymously(auth);
        } catch (anonErr: any) {
          console.warn('[Firebase Auth] Notice Anonymous Auth:', anonErr);
        }
      }
    }
    return { success: true };
  }

  if (auth && isFirebaseConfigured()) {
    try {
      const email = passwordInput ? emailOrPass : DEFAULT_ADMIN_EMAIL;
      const pass = passwordInput || emailOrPass;
      await signInWithEmailAndPassword(auth, email, pass);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('olumajang_admin_auth', 'true');
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gagal login ke Firebase. Pastikan email dan password terdaftar.'
      };
    }
  }

  return {
    success: false,
    message: 'Password salah. Silakan coba lagi.'
  };
}

export async function logoutAdmin(): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('olumajang_admin_auth');
  }
  if (auth) {
    await signOut(auth).catch(() => {});
  }
}

// -------------------------------------------------------------
// SINKRONISASI & SELF-DIAGNOSTIC TEST (WRITE & READ CLOUD TEST)
// -------------------------------------------------------------

export async function syncLocalWarungsToFirestore(): Promise<number> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Cloud Firestore belum terhubung. Konfigurasi belum diisi.');
  }

  const localList = getLocalWarungs();
  if (localList.length === 0) return 0;

  let count = 0;
  for (const w of localList) {
    try {
      const docRef = doc(db, 'warungs', w.id);
      await setDoc(
        docRef,
        {
          nama: w.nama,
          logoUrl: w.logoUrl || '',
          alamat: w.alamat || 'Lumajang',
          mapsUrl: w.mapsUrl || '',
          kategori: w.kategori || 'Kuliner Lumajang',
          whatsapp: w.whatsapp || ADMIN_WA,
          status: 'buka',
          photos: Array.isArray(w.photos) ? w.photos : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      count++;
    } catch (e: any) {
      console.warn('Sync warung to firestore error:', e);
      throw new Error(`Gagal menyinkronkan "${w.nama}" ke Firestore: ${e.message}`);
    }
  }
  return count;
}

// Uji Nyata: Test Write, Read, dan Delete langsung ke Firestore
export async function testFirestoreWriteAndRead(): Promise<{
  success: boolean;
  message: string;
  projectId?: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();

  if (!isFirebaseConfigured()) {
    return {
      success: false,
      message: 'Firebase belum terkonfigurasi. Pastikan apiKey dan projectId telah diisi di firebase-config.js atau modal konfigurasi.',
    };
  }

  if (!db) {
    const initialized = initFirebaseServices();
    if (!initialized || !db) {
      return {
        success: false,
        message: 'Inisialisasi Firebase Firestore gagal. Periksa kembali objek konfigurasi Firebase.',
      };
    }
  }

  const testId = `_test_${Date.now()}`;
  const testDocRef = doc(db, 'warungs', testId);

  try {
    // 1. TEST WRITE
    await setDoc(testDocRef, {
      nama: 'TEST KONEKSI CLOUD FIRESTORE',
      alamat: 'Lumajang',
      kategori: 'Kuliner Lumajang',
      whatsapp: ADMIN_WA,
      status: 'buka',
      photos: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. TEST READ
    const snapshot = await getDoc(testDocRef);
    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Dokumen berhasil ditulis ke Firestore tetapi tidak dapat dibaca kembali.',
      };
    }

    // 3. CLEANUP TEST DATA
    await deleteDoc(testDocRef).catch(() => {});

    const latency = Date.now() - startTime;
    const config = getStoredFirebaseConfig();

    return {
      success: true,
      projectId: config.projectId,
      latencyMs: latency,
      message: `Berhasil! Cloud Firestore dapat membaca dan menulis data (Latency: ${latency}ms, Project: ${config.projectId}).`,
    };
  } catch (err: any) {
    console.error('[Firestore Test Error]', err);
    let errorDetail = err.message || String(err);
    if (err.code === 'permission-denied') {
      errorDetail = 'Izin ditolak (permission-denied). Periksa firestore.rules.';
    } else if (err.code === 'unavailable') {
      errorDetail = 'Koneksi ke Firestore terputus atau server offline.';
    }
    return {
      success: false,
      message: `Uji koneksi gagal: ${errorDetail}`,
    };
  }
}
