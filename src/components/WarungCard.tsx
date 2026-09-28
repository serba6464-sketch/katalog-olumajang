import React from 'react';
import { MapPin, Image as ImageIcon, ChevronRight, Phone } from 'lucide-react';
import { Warung } from '../types';

interface WarungCardProps {
  warung: Warung;
  onClick: () => void;
  onQuickOrderWarung: (e: React.MouseEvent) => void;
}

export const WarungCard: React.FC<WarungCardProps> = ({
  warung,
  onClick,
  onQuickOrderWarung,
}) => {
  const photoCount = warung.photos?.length || 0;
  const displayImage = warung.logoUrl || (warung.photos && warung.photos[0]) || '';
  const capitalizedName = (warung.nama || '').toUpperCase();

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-3xl border border-[#E8DFD8] shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.99] flex flex-col group"
    >
      <div className="flex p-3.5 sm:p-4 gap-3.5 items-center">
        {/* Logo / Thumbnail */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-[#FAF8F5] shrink-0 border border-[#E8DFD8] shadow-2xs">
          {displayImage ? (
            <img
              src={displayImage}
              alt={capitalizedName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#8D6E63] bg-[#FAF8F5]">
              <ImageIcon className="w-6 h-6 stroke-1 text-red-400" />
              <span className="text-[10px] mt-1 font-bold text-[#786C65]">Foto</span>
            </div>
          )}

          {/* Photo count pill */}
          {photoCount > 0 && (
            <div className="absolute bottom-1 right-1 bg-black/75 backdrop-blur-xs text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <ImageIcon className="w-2.5 h-2.5 text-red-300" />
              <span>{photoCount}</span>
            </div>
          )}
        </div>

        {/* Info Warung: Fokus Nama Warung & Alamat */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
          <div>
            {/* Nama Warung (HURUF KAPITAL SEMUA) */}
            <h3 className="text-sm sm:text-base font-black text-[#1F1612] leading-tight line-clamp-2 uppercase">
              {capitalizedName}
            </h3>

            {/* Alamat */}
            <div className="flex items-start gap-1 text-xs text-[#786C65] line-clamp-2 mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{warung.alamat || 'Lumajang, Jawa Timur'}</span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-2 border-t border-[#F2ECE7] mt-2">
            <span className="text-[11px] font-extrabold text-red-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Lihat Menu &amp; Foto <ChevronRight className="w-3 h-3" />
            </span>

            <button
              type="button"
              onClick={onQuickOrderWarung}
              className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-2xs"
              title="Pesan via WhatsApp Warung"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
