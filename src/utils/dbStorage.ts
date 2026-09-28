import { Warung } from '../types';

const DB_NAME = 'KatalogOlumajangDB';
const DB_VERSION = 1;
const STORE_NAME = 'warungs';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Simpan seluruh daftar warung ke IndexedDB (Kapasitas ratusan MB, aman untuk banyak foto & logo)
 */
export async function saveWarungsToIndexedDB(warungs: Warung[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Bersihkan data lama di store untuk menjaga konsistensi
      store.clear();

      for (const w of warungs) {
        store.put(w);
      }

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error('Transaction error saving warungs'));
      };
    });
  } catch (err) {
    console.warn('Gagal menyimpan ke IndexedDB:', err);
  }
}

/**
 * Ambil seluruh daftar warung dari IndexedDB
 */
export async function getWarungsFromIndexedDB(): Promise<Warung[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        resolve(
          results.map((w: Warung) => ({
            ...w,
            nama: (w.nama || '').toUpperCase(),
          }))
        );
      };

      request.onerror = () => {
        reject(request.error || new Error('Error reading from IndexedDB'));
      };
    });
  } catch (err) {
    console.warn('Gagal membaca dari IndexedDB:', err);
    return [];
  }
}

/**
 * Hapus seluruh warung dari IndexedDB (Reset katalog ke nol)
 */
export async function clearAllWarungsFromIndexedDB(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to clear IndexedDB'));
      };
    });
  } catch (err) {
    console.warn('Gagal membersihkan IndexedDB:', err);
  }
}
