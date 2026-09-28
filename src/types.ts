export interface Warung {
  id: string;
  nama: string;
  logoUrl?: string;
  alamat?: string;
  mapsUrl?: string;
  kategori?: string;
  whatsapp?: string;
  status?: 'buka' | 'tutup';
  photos: string[];
  photoCount?: number;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
}

export type PaymentMethod = 'Cash' | 'QRIS';

export interface OrderItem {
  id: string;
  namaMenu: string;
  jumlah: string;
  catatanKhusus?: string;
}

export interface OrderPayload {
  warungNama: string;
  items: OrderItem[];
  pesananManual?: string;
  namaPemesan?: string;
  noHp?: string;
  alamat?: string;
  catatan?: string;
  metodePembayaran: PaymentMethod;
}

export type OrderTarget = 'warung' | 'admin';

export interface FirebaseConfigObject {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
