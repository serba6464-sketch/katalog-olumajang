import React from 'react';
import {
  ArrowLeft,
  X,
  MapPin,
  ExternalLink,
  Phone,
  ShieldCheck,
  Image as ImageIcon,
  Share2,
  Upload
} from 'lucide-react';
import { Warung } from '../types';

interface WarungDetailModalProps {
  warung: Warung | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPhoto: (index: number) => void;
  onOrderWarung: () => void;
  onOrderAdmin: () => void;
  isAdmin?: boolean;
  onOpenAdminManage?: (warung: Warung) => void;
}

export const WarungDetailModal: React.FC<WarungDetailModalProps> = ({
  warung,
  isOpen,
  onClose,
  onOpenPhoto,
  onOrderWarung,
  onOrderAdmin,
  isAdmin,
  onOpenAdminManage,
}) => {
  if (!isOpen || !warung) return null;

  const photos = warung.photos || [];
  const capitalizedName = (warung.nama || '').toUpperCase();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: capitalizedName,
        text: `Lihat menu & foto ${capitalizedName} di Katalog Olumajang: ${warung.alamat || 'Lumajang'}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan katalog berhasil disalin!');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto touch-scroll">
      <div className="bg-[#FAF8F5] w-full max-w-xl sm:rounded-3xl min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#E8DFD8] animate-in fade-in zoom-in-95 duration-200">
        {/* Sticky Detail Header with Clear BACK Button */}
        <div className="sticky top-0 z-10 bg-[#FAF8F5]/95 backdrop-blur-md px-3.5 py-3 border-b border-[#E8DFD8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Opsi tombol BACK */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white font-extrabold text-xs hover:bg-red-700 active:scale-95 shadow-xs shadow-red-600/30 transition-all"
              title="Kembali ke Daftar Warung"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>KEMBALI</span>
            </button>

            <span className="text-[11px] font-black uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 truncate max-w-[150px]">
              {warung.kategori || 'KULINER LUMAJANG'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && onOpenAdminManage && (
              <button
                onClick={() => onOpenAdminManage(warung)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold transition-colors"
                title="Kelola warung & foto di panel admin"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kelola Foto</span>
              </button>
            )}

            <button
              onClick={handleShare}
              className="p-2 rounded-xl hover:bg-white text-[#52453D] transition-colors"
              title="Bagikan Warung Ini"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white text-[#52453D] transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 touch-scroll">
          {/* Logo & Title */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white shrink-0 border border-[#E8DFD8] shadow-sm">
              {warung.logoUrl ? (
                <img
                  src={warung.logoUrl}
                  alt={capitalizedName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-50/50">
                  <ImageIcon className="w-7 h-7 stroke-1" />
                  <span className="text-[10px] mt-1 font-bold text-red-600">Logo</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-[#1F1612] leading-tight uppercase">
                {capitalizedName}
              </h2>

              <div className="flex items-start gap-1.5 text-xs text-[#786C65] mt-2">
                <MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{warung.alamat || 'Lumajang, Jawa Timur'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Thema Merah */}
          <div className="space-y-2.5 pt-1">
            {/* 1. WA ORDER WARUNG (Warna Merah Bold) */}
            <button
              onClick={onOrderWarung}
              className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/30 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>WA ORDER WARUNG</span>
            </button>

            {/* 2. KIRIM KE ADMIN (081334274818) (Thema Merah Soft) */}
            <button
              onClick={onOrderAdmin}
              className="w-full py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 active:scale-[0.98] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>KIRIM KE ADMIN (081334274818)</span>
            </button>

            {/* 3. GOOGLE MAPS */}
            {warung.mapsUrl ? (
              <a
                href={warung.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E8DFD8] text-[#52453D] hover:text-red-600 active:scale-[0.98] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>GOOGLE MAPS</span>
              </a>
            ) : (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  capitalizedName + ' ' + (warung.alamat || '') + ' Lumajang'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E8DFD8] text-[#52453D] hover:text-red-600 active:scale-[0.98] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>GOOGLE MAPS</span>
              </a>
            )}
          </div>

          {/* Section: MENU / FOTO KATALOG */}
          <div className="pt-3 border-t border-[#E8DFD8]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-[#1F1612] uppercase tracking-wide">
                  MENU / FOTO KATALOG
                </h3>
                <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {photos.length} Foto
                </span>
              </div>
              <span className="text-[11px] text-[#786C65] font-medium">
                Ketuk foto untuk zoom &amp; swipe
              </span>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {photos.map((photoUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenPhoto(idx)}
                    className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-white border border-[#E8DFD8] cursor-pointer shadow-2xs hover:shadow-md transition-all active:scale-95"
                  >
                    <img
                      src={photoUrl}
                      alt={`Menu ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-[#E8DFD8]">
                <ImageIcon className="w-8 h-8 mx-auto text-[#A89D96] stroke-1 mb-2" />
                <p className="text-xs text-[#786C65] font-medium">
                  Belum ada foto menu untuk warung ini.
                </p>
                {isAdmin && onOpenAdminManage && (
                  <button
                    onClick={() => onOpenAdminManage(warung)}
                    className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl"
                  >
                    + Upload Foto Menu
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Back Button */}
          <div className="pt-2 pb-4">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-white border border-[#E8DFD8] text-red-700 hover:bg-red-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>KEMBALI KE DAFTAR KATALOG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
