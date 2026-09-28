import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
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

// Resolve Firebase configuration
export function getStoredFirebaseConfig(): FirebaseConfigObject {
  if (typeof window !== 'undefined') {
    const localSaved = localStorage.getItem('olumajang_firebase_config');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed.apiKey && parsed.projectId) {
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
    cfg.apiKey &&
    !cfg.apiKey.includes('YOUR_API_KEY') &&
    cfg.projectId &&
    !cfg.projectId.includes('YOUR_PROJECT_ID')
  );
}

let app: FirebaseApp | null = null;
export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let storage: FirebaseStorage | null = null;

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
  }
} catch (err) {
  console.warn('Firebase initialization warning:', err);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// -------------------------------------------------------------
// HYBRID PERSISTENT STORAGE (IndexedDB + LocalStorage)
// Data & Foto Permanen, Tidak Hilang Saat Di-refresh
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
    console.error('Failed reading local warungs:', e);
  }

  return memoryWarungsCache;
}

export async function saveLocalWarungs(warungs: Warung[], notify = true): Promise<void> {
  memoryWarungsCache = warungs;

  // 1. Simpan ke IndexedDB (Kapasitas Besar - Foto & data permanen)
  await saveWarungsToIndexedDB(warungs).catch((err) => {
    console.warn('Gagal menyimpan ke IndexedDB:', err);
  });

  // 2. Simpan juga ke LocalStorage sebagai backup (dengan proteksi quota)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(warungs));
  } catch {
    // Jika localStorage penuh karena base64 foto besar, IndexedDB tetap menyimpan semua data utuh
  }

  if (notify) {
    notifyWarungListeners(warungs, 'local');
  }
}

// -------------------------------------------------------------
// WARUNG OPERATIONS
// -------------------------------------------------------------

export function subscribeToWarungs(callback: (warungs: Warung[], source: 'firebase' | 'local') => void) {
  warungListeners.add(callback);

  // 1. Kirim state awal dari cache sinkron
  const initial = getLocalWarungs();
  initial.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  callback(initial, 'local');

  // 2. Muat data permanen dari IndexedDB untuk memastikan foto tidak hilang saat refresh
  getWarungsFromIndexedDB().then((idbWarungs) => {
    if (Array.isArray(idbWarungs) && idbWarungs.length > 0) {
      idbWarungs.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
      memoryWarungsCache = idbWarungs;
      callback(idbWarungs, 'local');
    }
  }).catch(() => {});

  let unsubFirestore = () => {};

  if (db && isFirebaseConfigured()) {
    try {
      const colRef = collection(db, 'warungs');
      unsubFirestore = onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Warung[] = snapshot.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                nama: (data.nama || 'WARUNG LUMAJANG').toUpperCase(),
                logoUrl: data.logoUrl || '',
                alamat: data.alamat || 'Lumajang',
                mapsUrl: data.mapsUrl || '',
                kategori: data.kategori || 'Makanan Berat',
                whatsapp: data.whatsapp || ADMIN_WA,
                photos: Array.isArray(data.photos) ? data.photos : [],
                photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
            });
            list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
            saveLocalWarungs(list, false);
            notifyWarungListeners(list, 'firebase');
          } else {
            saveLocalWarungs([], false);
            notifyWarungListeners([], 'firebase');
          }
        },
        (error) => {
          console.warn('Firestore subscription fallback to local:', error);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription error:', e);
    }
  }

  return () => {
    warungListeners.delete(callback);
    unsubFirestore();
  };
}

// Buat Warung Baru (Semua field fleksibel / tidak wajib lengkap)
export async function createWarung(data: Partial<Warung>): Promise<string> {
  const cleanId = 'warung-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const capitalizedName = (data.nama?.trim() || 'WARUNG BARU LUMAJANG').toUpperCase();

  const newWarung: Warung = {
    id: cleanId,
    nama: capitalizedName,
    alamat: data.alamat?.trim() || 'Lumajang',
    kategori: data.kategori?.trim() || 'Makanan Berat',
    whatsapp: data.whatsapp?.trim() || ADMIN_WA,
    mapsUrl: data.mapsUrl?.trim() || '',
    logoUrl: data.logoUrl?.trim() || '',
    photos: Array.isArray(data.photos) ? data.photos : [],
    photoCount: Array.isArray(data.photos) ? data.photos.length : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = doc(db, 'warungs', cleanId);
      await setDoc(docRef, {
        nama: newWarung.nama,
        logoUrl: newWarung.logoUrl,
        alamat: newWarung.alamat,
        mapsUrl: newWarung.mapsUrl,
        kategori: newWarung.kategori,
        whatsapp: newWarung.whatsapp,
        photos: newWarung.photos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore write warning:', err);
    }
  }

  const localList = [...getLocalWarungs()];
  localList.push(newWarung);
  localList.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  await saveLocalWarungs(localList, true);

  return cleanId;
}

export async function updateWarung(id: string, updates: Partial<Warung>): Promise<void> {
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

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = doc(db, 'warungs', id);
      await updateDoc(docRef, payload);
    } catch (err) {
      console.warn('Firestore update warning:', err);
    }
  }

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

// Hapus Warung Secara Permanen (Permanently Delete)
export async function removeWarung(id: string, currentWarung?: Warung): Promise<void> {
  if (db && isFirebaseConfigured()) {
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
    } catch (err) {
      console.warn('Firestore delete warning:', err);
    }
  }

  // Remove permanently from IndexedDB & local storage
  const localList = getLocalWarungs().filter((w) => w.id !== id);
  await saveLocalWarungs(localList, true);
}

// Reset Seluruh Katalog ke Nol (Delete All Warungs Permanently)
export async function resetCatalogToZero(): Promise<void> {
  if (db && isFirebaseConfigured()) {
    try {
      const snapshot = await getDocs(collection(db, 'warungs'));
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    } catch (e) {
      console.warn('Error resetting Firestore:', e);
    }
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
// STORAGE UPLOADS WITH AUTO-COMPRESSION
// -------------------------------------------------------------

export async function uploadWarungLogo(
  warungId: string,
  rawFile: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Auto-compress image before upload
  const file = await compressImage(rawFile, { maxWidth: 800, maxHeight: 800, quality: 0.85 });

  if (storage && isFirebaseConfigured()) {
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
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await updateWarung(warungId, { logoUrl: downloadUrl });
          resolve(downloadUrl);
        }
      );
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (onProgress) onProgress(100);
      await updateWarung(warungId, { logoUrl: dataUrl });
      resolve(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadWarungPhotos(
  warungId: string,
  currentPhotos: string[],
  rawFiles: File[],
  onProgress?: (totalPercent: number, currentFileIdx: number, totalFiles: number) => void
): Promise<string[]> {
  // CRITICAL: Maksimal 60 FOTO PER WARUNG
  if (currentPhotos.length + rawFiles.length > MAX_PHOTOS_PER_WARUNG) {
    throw new Error('Warung sudah memiliki 60 foto.');
  }

  const uploadedUrls: string[] = [];

  for (let i = 0; i < rawFiles.length; i++) {
    // Auto-compress each photo to max width 1200px before uploading to Firebase Storage
    const file = await compressImage(rawFiles[i], {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.85
    });

    if (storage && isFirebaseConfigured()) {
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
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            uploadedUrls.push(url);
            resolve();
          }
        );
      });
    } else {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedUrls.push(e.target?.result as string);
          if (onProgress) onProgress(Math.round(((i + 1) / rawFiles.length) * 100), i + 1, rawFiles.length);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  const newPhotoList = [...currentPhotos, ...uploadedUrls];
  await updateWarung(warungId, { photos: newPhotoList });
  return newPhotoList;
}

// Edit / Ganti Foto yang Sudah Disimpan (Replace Photo)
export async function replaceWarungPhoto(
  warungId: string,
  currentPhotos: string[],
  photoIndex: number,
  newRawFile: File,
  onProgress?: (percent: number) => void
): Promise<string[]> {
  const file = await compressImage(newRawFile, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
  });

  let newUrl = '';

  if (storage && isFirebaseConfigured()) {
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

    newUrl = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(progress));
        },
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });
  } else {
    newUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (onProgress) onProgress(100);
        resolve(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  const updatedPhotos = [...currentPhotos];
  updatedPhotos[photoIndex] = newUrl;
  await updateWarung(warungId, { photos: updatedPhotos });
  return updatedPhotos;
}

// Hapus Foto Menu Secara Permanen (Permanently Delete Photo)
export async function deleteWarungPhoto(
  warungId: string,
  currentPhotos: string[],
  photoUrlToDelete: string
): Promise<string[]> {
  if (storage && isFirebaseConfigured() && photoUrlToDelete.includes('firebasestorage')) {
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
// AUTHENTICATION
// -------------------------------------------------------------

export function subscribeAuth(callback: (user: User | null, isPasscodeAdmin: boolean) => void) {
  const isPasscodeAdmin = typeof window !== 'undefined' && sessionStorage.getItem('olumajang_admin_auth') === 'true';

  if (auth && isFirebaseConfigured()) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      callback(firebaseUser, isPasscodeAdmin);
    });
  }

  callback(null, isPasscodeAdmin);
  return () => {};
}

export async function loginAdmin(emailOrPass: string, passwordInput?: string): Promise<{ success: boolean; message?: string }> {
  if (emailOrPass === ADMIN_PASSCODE || passwordInput === ADMIN_PASSCODE) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('olumajang_admin_auth', 'true');
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
