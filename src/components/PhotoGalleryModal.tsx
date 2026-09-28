import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PhotoGalleryModalProps {
  photos: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  photos,
  initialIndex,
  isOpen,
  onClose,
  title = 'Menu / Foto',
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const startScaleRef = useRef(1);

  // Clamp position so image NEVER drifts or flies off screen ("tidak lari-lari ke mana-mana")
  const clampPosition = useCallback((newX: number, newY: number, targetScale: number) => {
    if (targetScale <= 1) {
      return { x: 0, y: 0 };
    }
    const container = containerRef.current;
    if (!container) return { x: newX, y: newY };

    const rect = container.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * (targetScale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (targetScale - 1)) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, newX)),
      y: Math.min(maxY, Math.max(-maxY, newY)),
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), photos.length - 1));
      resetZoom();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex, photos.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetZoom();
    }
  }, [currentIndex, resetZoom]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetZoom();
    }
  }, [currentIndex, photos.length, resetZoom]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, resetZoom]);

  const zoomIn = () => {
    setScale((prev) => {
      const nextScale = Math.min(prev + 0.5, 3.5);
      setPosition((pos) => clampPosition(pos.x, pos.y, nextScale));
      return nextScale;
    });
  };

  const zoomOut = () => {
    setScale((prev) => {
      const nextScale = Math.max(prev - 0.5, 1);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      } else {
        setPosition((pos) => clampPosition(pos.x, pos.y, nextScale));
      }
      return nextScale;
    });
  };

  const handleDoubleTap = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.2);
      setPosition({ x: 0, y: 0 });
    }
  };

  const getPinchDist = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = getPinchDist(e.touches[0], e.touches[1]);
      startScaleRef.current = scale;
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dist = getPinchDist(e.touches[0], e.touches[1]);
      const ratio = dist / pinchStartDistRef.current;
      const targetScale = Math.min(Math.max(startScaleRef.current * ratio, 1), 3.5);
      setScale(targetScale);
      setPosition((pos) => clampPosition(pos.x, pos.y, targetScale));
    } else if (e.touches.length === 1 && scale > 1 && isDragging) {
      const touch = e.touches[0];
      const rawX = touch.clientX - dragStartRef.current.x;
      const rawY = touch.clientY - dragStartRef.current.y;
      const clamped = clampPosition(rawX, rawY, scale);
      setPosition(clamped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);

      if (scale <= 1.05 && touchStartRef.current) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;

        if (Math.abs(dx) > 45 && Math.abs(dy) < 70 && dt < 350) {
          if (dx < 0) {
            handleNext();
          } else {
            handlePrev();
          }
        }
      }
      touchStartRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const rawX = e.clientX - dragStartRef.current.x;
      const rawY = e.clientY - dragStartRef.current.y;
      const clamped = clampPosition(rawX, rawY, scale);
      setPosition(clamped);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none touch-none animate-in fade-in duration-200">
      {/* Top Header Bar with Explicit BACK Button */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 text-white z-20 bg-gradient-to-b from-black/85 to-transparent">
        <div className="flex items-center gap-2">
          {/* Tombol Back yang Jelas */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black shadow-md shadow-red-600/40 transition-all"
            title="Kembali ke Halaman"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>KEMBALI</span>
          </button>

          <span className="text-xs sm:text-sm font-extrabold tracking-wide bg-white/20 text-white px-3 py-1 rounded-full border border-white/20">
            {currentIndex + 1} / {photos.length}
          </span>
          <span className="text-xs text-gray-300 font-bold truncate max-w-[130px] sm:max-w-xs uppercase hidden sm:inline">
            {title}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={zoomIn}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all"
            title="Perbesar (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all"
            title="Perkecil (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          {scale > 1 && (
            <button
              onClick={resetZoom}
              className="p-2 rounded-xl bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all"
              title="Kembalikan Normal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20 hover:bg-red-600 text-white active:scale-95 transition-all ml-1"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleTap}
      >
        <img
          src={photos[currentIndex]}
          alt={`Foto ${currentIndex + 1}`}
          draggable={false}
          className="max-h-[80vh] max-w-[95vw] object-contain rounded-xl shadow-2xl pointer-events-none transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          }}
        />

        {/* Previous Arrow */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-lg active:scale-95 transition-all z-10"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Arrow */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-lg active:scale-95 transition-all z-10"
            title="Foto Selanjutnya"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Info & Thumbnails */}
      <div className="p-3 bg-gradient-to-t from-black/95 to-transparent z-20">
        <div className="flex justify-between items-center max-w-lg mx-auto mb-2 px-2">
          <span className="text-[11px] text-gray-300 font-medium">
            💡 Cubit / ketuk 2x untuk zoom • Geser foto untuk menu lain
          </span>
          <button
            onClick={onClose}
            className="text-[11px] font-bold text-red-400 hover:text-red-300 underline"
          >
            Kembali
          </button>
        </div>

        {/* Thumbnail carousel */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-lg mx-auto py-1 px-2 touch-scroll">
          {photos.map((url, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                resetZoom();
              }}
              className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                currentIndex === idx
                  ? 'border-red-500 scale-105 opacity-100 shadow-md shadow-red-500/50'
                  : 'border-white/20 opacity-50 hover:opacity-80'
              }`}
            >
              <img
                src={url}
                alt={`Thumb ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
