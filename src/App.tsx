import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  Search,
  Sparkles,
  X,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { Warung, OrderTarget } from './types';
import {
  subscribeToWarungs,
  subscribeAuth,
} from './firebase';
import { Header } from './components/Header';
import { WarungCard } from './components/WarungCard';
import { WarungDetailModal } from './components/WarungDetailModal';
import { PhotoGalleryModal } from './components/PhotoGalleryModal';
import { OrderModal } from './components/OrderModal';
import { AdminModal } from './components/AdminModal';

export default function App() {
  const [warungs, setWarungs] = useState<Warung[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [detailWarung, setDetailWarung] = useState<Warung | null>(null);
  const [adminWarungToManage, setAdminWarungToManage] = useState<Warung | null>(null);

  const [galleryState, setGalleryState] = useState<{
    isOpen: boolean;
    photos: string[];
    initialIndex: number;
    title: string;
  }>({
    isOpen: false,
    photos: [],
    initialIndex: 0,
    title: '',
  });

  const [orderState, setOrderState] = useState<{
    isOpen: boolean;
    warung: Warung | null;
    target: OrderTarget;
  }>({
    isOpen: false,
    warung: null,
    target: 'warung',
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Subscribe to Warung data (Reactive store)
  useEffect(() => {
    const unsubscribe = subscribeToWarungs((list) => {
      setWarungs(list);
    });
    return () => unsubscribe();
  }, []);

  // Synchronize detailWarung with latest warungs list
  useEffect(() => {
    if (detailWarung) {
      const updated = warungs.find((w) => w.id === detailWarung.id);
      if (updated) {
        setDetailWarung(updated);
      } else {
        // Warung was deleted, close detail modal
        setDetailWarung(null);
      }
    }
  }, [warungs, detailWarung]);

  // Subscribe to Auth state
  useEffect(() => {
    const unsubAuth = subscribeAuth((user, isPasscodeAdmin) => {
      setIsAdmin(Boolean(user || isPasscodeAdmin));
    });
    return () => unsubAuth();
  }, []);

  // Filtered & Strictly Sorted A-Z with Capital Names (Tanpa filter kategori di beranda)
  const filteredWarungs = useMemo(() => {
    let list = [...warungs];

    // Filter Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => {
        const matchName = (w.nama || '').toLowerCase().includes(q);
        const matchAddr = (w.alamat || '').toLowerCase().includes(q);
        return matchName || matchAddr;
      });
    }

    // Urutkan alfabet warung A-Z
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));

    // Pastikan nama warung huruf kapital semua
    return list.map((w) => ({
      ...w,
      nama: (w.nama || '').toUpperCase(),
    }));
  }, [warungs, searchQuery]);

  // Handlers
  const handleOpenDetail = (warung: Warung) => {
    setDetailWarung(warung);
  };

  const handleOpenPhotoFromDetail = (index: number) => {
    if (!detailWarung || !detailWarung.photos) return;
    setGalleryState({
      isOpen: true,
      photos: detailWarung.photos,
      initialIndex: index,
      title: detailWarung.nama,
    });
  };

  const handleOpenOrder = (warung: Warung | null, target: OrderTarget) => {
    setOrderState({
      isOpen: true,
      warung,
      target,
    });
  };

  const handleOpenAdminManage = (warung: Warung) => {
    setDetailWarung(null);
    setAdminWarungToManage(warung);
    setIsAdminModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#1F1612] flex flex-col font-sans selection:bg-red-600/20 selection:text-red-700">
      {/* Header: Hanya nama warung, search bar, dan tombol masuk admin */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isAdmin={isAdmin}
        onOpenAdmin={() => {
          setAdminWarungToManage(null);
          setIsAdminModalOpen(true);
        }}
        warungCount={filteredWarungs.length}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-3.5 space-y-4">
        {/* Banner Pasar / Market Warung Kuliner Keren */}
        <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#E8DFD8] text-white min-h-[170px] sm:min-h-[200px] flex items-center">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80"
            alt="Suasana Kuliner Warung Market Lumajang"
            className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.78]"
            loading="eager"
          />

          {/* Dark Red Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-red-950/65 backdrop-blur-[0.5px]" />

          <div className="relative z-10 p-5 sm:p-7 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-black mb-2 shadow-xs border border-red-400/40">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>KATALOG RESMI WARUNG LUMAJANG</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight uppercase drop-shadow-md">
              JELAJAHI DAFTAR WARUNG KULINER LUMAJANG
            </h2>
            <p className="text-xs sm:text-sm text-gray-200 mt-1 font-medium leading-relaxed drop-shadow-sm">
              Lihat foto menu jernih, zoom stabil, bayar Cash / QRIS, dan order via WhatsApp.
            </p>
          </div>
        </div>

        {/* Section Title & Search Feedback (Hanya tampil jika ada data warung atau sedang mencari) */}
        {warungs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-1">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-[#1F1612] uppercase tracking-wider">
                {searchQuery
                  ? `HASIL PENCARIAN (${filteredWarungs.length})`
                  : 'DAFTAR NAMA WARUNG LUMAJANG (A-Z)'}
              </h3>
              <p className="text-[11px] text-[#786C65] font-bold">
                {searchQuery
                  ? `Mencari kata kunci "${searchQuery}"`
                  : `${filteredWarungs.length} Warung Terdaftar`}
              </p>
            </div>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full border border-red-200 w-fit transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hapus Pencarian</span>
              </button>
            )}
          </div>
        )}

        {/* Warung List Grid / Tampilan Kosongan di Beranda */}
        {filteredWarungs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredWarungs.map((warung) => (
              <WarungCard
                key={warung.id}
                warung={warung}
                onClick={() => handleOpenDetail(warung)}
                onQuickOrderWarung={(e) => {
                  e.stopPropagation();
                  handleOpenOrder(warung, 'warung');
                }}
              />
            ))}
          </div>
        ) : searchQuery ? (
          /* Search Not Found */
          <div className="bg-white rounded-3xl p-10 text-center border border-[#E8DFD8] shadow-xs space-y-3">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-[#1F1612]">
              WARUNG TIDAK DITEMUKAN
            </h4>
            <p className="text-xs text-[#786C65] max-w-xs mx-auto">
              Tidak ada warung yang sesuai dengan kata kunci &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-red-700 transition-all"
            >
              Tampilkan Semua Warung
            </button>
          </div>
        ) : (
          /* Kosongan di Beranda: Tidak menampilkan tombol tambah warung di depan */
          <div className="py-16 text-center text-[#948982]">
            <p className="text-xs font-medium">Belum ada warung yang terdaftar di katalog.</p>
          </div>
        )}
      </main>

      {/* Floating Action Button: WA ADMIN LANGSUNG TAMPILKAN OPSI TEMPLATE ORDER */}
      <div className="fixed bottom-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => {
            // Ketika klik WA Admin di halaman depan, langsung tampilkan modal template order!
            handleOpenOrder(null, 'admin');
          }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-xl shadow-red-600/40 text-xs font-black transition-all border border-red-400"
          title="Buka Template Order &amp; Kirim ke WA Admin (081334274818)"
        >
          <Phone className="w-4 h-4 fill-white text-white" />
          <span>ORDER WA ADMIN (081334274818)</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[#E8DFD8] bg-white py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#786C65] text-center sm:text-left">
          <div>
            <p className="font-black text-[#1F1612] uppercase tracking-wide">
              KATALOG OLUMAJANG
            </p>
            <p className="text-[11px] text-[#948982]">
              Katalog warung &amp; menu kuliner Lumajang. Ringan, cepat, dan mobile-friendly untuk Android &amp; iOS.
            </p>
          </div>

          <div className="flex items-center gap-3 font-bold text-xs">
            <button
              onClick={() => {
                setAdminWarungToManage(null);
                setIsAdminModalOpen(true);
              }}
              className="text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                  <span>Panel Admin</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-red-600" />
                  <span>Login Admin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <WarungDetailModal
        warung={detailWarung}
        isOpen={Boolean(detailWarung)}
        onClose={() => setDetailWarung(null)}
        onOpenPhoto={handleOpenPhotoFromDetail}
        onOrderWarung={() => {
          if (detailWarung) handleOpenOrder(detailWarung, 'warung');
        }}
        onOrderAdmin={() => {
          handleOpenOrder(detailWarung, 'admin');
        }}
        isAdmin={isAdmin}
        onOpenAdminManage={handleOpenAdminManage}
      />

      <PhotoGalleryModal
        isOpen={galleryState.isOpen}
        photos={galleryState.photos}
        initialIndex={galleryState.initialIndex}
        title={galleryState.title}
        onClose={() => setGalleryState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Order Modal (Mendukung pembukaan dari halaman depan WA Admin dengan template order lengkap) */}
      <OrderModal
        warung={orderState.warung}
        target={orderState.target}
        isOpen={orderState.isOpen}
        onClose={() => setOrderState((prev) => ({ ...prev, isOpen: false }))}
        availableWarungs={warungs}
      />

      {/* Admin Modal (Tombol tambah warung & foto ada di dalam sini) */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setAdminWarungToManage(null);
        }}
        isAdmin={isAdmin}
        onAdminAuthChange={setIsAdmin}
        warungs={warungs}
        initialWarungToManage={adminWarungToManage}
      />
    </div>
  );
}
