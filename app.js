/**
 * =======================================================================
 * KATALOG OLUMAJANG - STANDALONE CORE APP (THEMA COFFEE MOCCA)
 * Wilayah: Lumajang, Jawa Timur
 * WhatsApp Admin: 6281334274818 (081334274818)
 * Admin Passcode: 231288
 * Pembayaran: CASH dan QRIS saja
 * Nama Warung: HURUF KAPITAL SEMUA & Terurut Alfabet A-Z
 * =======================================================================
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

export const ADMIN_WA = '6281334274818';
export const ADMIN_PASSCODE = '231288';
export const MAX_PHOTOS_PER_WARUNG = 60;

/**
 * Format Pesanan WhatsApp Admin (081334274818)
 * Pembayaran: Cash / QRIS
 * Semua field tidak wajib diisi
 */
export function formatAdminOrder(warungNama, data, paymentMethod = 'QRIS') {
  const warungUpper = (warungNama || '').toUpperCase();
  return [
    'ORDER KATALOG OLUMAJANG',
    '',
    'Warung:',
    warungUpper,
    '',
    'Metode Pembayaran:',
    paymentMethod.toUpperCase() + (paymentMethod === 'QRIS' ? ' (QRIS)' : ' (Cash / Tunai)'),
    '',
    'Daftar Pesanan Lengkap:',
    data.orderListText || (data.pesanan || '-'),
    '',
    'Nama Pemesan: ' + (data.nama || '-'),
    'No. HP: ' + (data.noHp || '-'),
    'Alamat Kirim: ' + (data.alamat || '-'),
    'Catatan: ' + (data.catatan || '-')
  ].join('\n');
}

/**
 * Format Pesanan WhatsApp Warung
 */
export function formatWarungOrder(warungNama, data, paymentMethod = 'QRIS') {
  const warungUpper = (warungNama || '').toUpperCase();
  return [
    'Halo ' + warungUpper,
    '',
    'Saya mau pesan:',
    '',
    'Metode Pembayaran: ' + paymentMethod.toUpperCase(),
    '',
    'Pesanan:',
    data.orderListText || (data.pesanan || '-'),
    '',
    'Nama: ' + (data.nama || '-'),
    'No. HP: ' + (data.noHp || '-'),
    'Alamat: ' + (data.alamat || '-'),
    'Catatan: ' + (data.catatan || '-')
  ].join('\n');
}

export function sendToWhatsApp(phone, text) {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.substring(1);
  }
  const url = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}
