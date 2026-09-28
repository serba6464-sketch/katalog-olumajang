import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Store,
  ShieldCheck,
  Phone,
  User,
  MapPin,
  FileText,
  ShoppingBag,
  CreditCard,
  Banknote,
  Plus,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { Warung, OrderTarget, PaymentMethod } from '../types';
import { ADMIN_WA } from '../firebase';

interface OrderModalProps {
  warung: Warung | null;
  target: OrderTarget;
  isOpen: boolean;
  onClose: () => void;
  availableWarungs?: Warung[];
}

interface QuickOrderItem {
  id: string;
  nama: string;
  porsi: string;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  warung,
  target,
  isOpen,
  onClose,
  availableWarungs = [],
}) => {
  const [selectedWarungId, setSelectedWarungId] = useState<string>(warung?.id || '');
  const [manualWarungNama, setManualWarungNama] = useState<string>(warung?.nama || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [nama, setNama] = useState('');
  const [noHp, setNoHp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [catatan, setCatatan] = useState('');

  // Dynamic order items list
  const [items, setItems] = useState<QuickOrderItem[]>([
    { id: '1', nama: '', porsi: '1' },
  ]);
  const [catatanPesananManual, setCatatanPesananManual] = useState('');

  // Sync state whenever warung prop changes
  useEffect(() => {
    if (warung) {
      setSelectedWarungId(warung.id);
      setManualWarungNama((warung.nama || '').toUpperCase());
    } else if (availableWarungs.length > 0) {
      setSelectedWarungId(availableWarungs[0].id);
      setManualWarungNama((availableWarungs[0].nama || '').toUpperCase());
    } else {
      setSelectedWarungId('');
      setManualWarungNama('');
    }
  }, [warung, availableWarungs, isOpen]);

  if (!isOpen) return null;

  const isAdminTarget = target === 'admin';

  // Resolve current active warung name & phone
  const activeWarung =
    warung ||
    availableWarungs.find((w) => w.id === selectedWarungId) ||
    null;

  const resolvedWarungNama = (
    manualWarungNama ||
    activeWarung?.nama ||
    'WARUNG LUMAJANG'
  ).toUpperCase();

  const destinationPhone = isAdminTarget
    ? ADMIN_WA
    : (activeWarung?.whatsapp || ADMIN_WA).replace(/[^0-9]/g, '');

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), nama: '', porsi: '1' },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setItems([{ id: '1', nama: '', porsi: '1' }]);
    }
  };

  const handleItemChange = (id: string, field: 'nama' | 'porsi', value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Kirim WhatsApp (Semua field TIDAK WAJIB DIISI)
  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((it) => it.nama.trim().length > 0);
    let orderListText = '';

    if (validItems.length > 0) {
      orderListText = validItems
        .map((it, idx) => `${idx + 1}. ${it.nama.trim()} (${it.porsi.trim() || '1'} porsi)`)
        .join('\n');
    }

    if (catatanPesananManual.trim()) {
      orderListText += (orderListText ? '\n' : '') + catatanPesananManual.trim();
    }

    if (!orderListText) {
      orderListText = '- (Pesanan akan dikonfirmasi lewat chat)';
    }

    let messageText = '';

    if (isAdminTarget) {
      messageText = [
        'ORDER KATALOG OLUMAJANG',
        '',
        'Warung:',
        resolvedWarungNama,
        '',
        'Metode Pembayaran:',
        paymentMethod.toUpperCase() + (paymentMethod === 'QRIS' ? ' (QRIS)' : ' (CASH / TUNAI)'),
        '',
        'Pesanan:',
        orderListText,
        '',
        'Nama: ' + (nama.trim() || '-'),
        'No. HP: ' + (noHp.trim() || '-'),
        'Alamat: ' + (alamat.trim() || '-'),
        'Catatan: ' + (catatan.trim() || '-'),
      ].join('\n');
    } else {
      messageText = [
        'Halo ' + resolvedWarungNama,
        '',
        'Saya mau pesan:',
        '',
        'Metode Pembayaran: ' + paymentMethod.toUpperCase(),
        '',
        'Pesanan:',
        orderListText,
        '',
        'Nama: ' + (nama.trim() || '-'),
        'No. HP: ' + (noHp.trim() || '-'),
        'Alamat: ' + (alamat.trim() || '-'),
        'Catatan: ' + (catatan.trim() || '-'),
      ].join('\n');
    }

    let finalPhone = destinationPhone;
    if (finalPhone.startsWith('08')) {
      finalPhone = '628' + finalPhone.slice(2);
    } else if (finalPhone.startsWith('8')) {
      finalPhone = '628' + finalPhone.slice(1);
    }

    const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto touch-scroll">
      <div className="bg-[#FAF8F5] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8DFD8] overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Thema Merah */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              {isAdminTarget ? <ShieldCheck className="w-5 h-5" /> : <Store className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-red-200 tracking-wider uppercase">
                {isAdminTarget ? 'ADMIN OLUMAJANG (081334274818)' : 'PESAN KE WARUNG'}
              </span>
              <h2 className="text-sm sm:text-base font-black truncate max-w-[230px] sm:max-w-xs uppercase">
                TEMPLATE ORDER KATALOG
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 text-white transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSendWhatsApp} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 touch-scroll">
          {/* Info Banner: Semua field fleksibel / tidak wajib lengkap */}
          <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl flex items-center justify-between text-xs text-red-900">
            <span className="font-bold">Semua data pesanan di bawah tidak wajib diisi lengkap.</span>
            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black">
              Fleksibel
            </span>
          </div>

          {/* PILIH / KETIK WARUNG TUJUAN */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-2">
            <label className="block text-xs font-black text-[#1F1612] uppercase tracking-wide">
              Nama Warung Tujuan
            </label>

            {availableWarungs.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedWarungId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedWarungId(id);
                    const found = availableWarungs.find((w) => w.id === id);
                    if (found) {
                      setManualWarungNama(found.nama.toUpperCase());
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] text-xs sm:text-sm font-black uppercase text-[#1F1612] focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {availableWarungs.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nama.toUpperCase()}
                    </option>
                  ))}
                  <option value="custom">-- KETIK NAMA WARUNG LAIN --</option>
                </select>

                {selectedWarungId === 'custom' && (
                  <input
                    type="text"
                    value={manualWarungNama}
                    onChange={(e) => setManualWarungNama(e.target.value)}
                    placeholder="Ketik nama warung..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-xs sm:text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={manualWarungNama}
                onChange={(e) => setManualWarungNama(e.target.value)}
                placeholder="Contoh: RAWON GAJAH MADA LUMAJANG"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] text-xs sm:text-sm font-black uppercase text-[#1F1612] focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            )}
          </div>

          {/* METODE PEMBAYARAN: HANYA CASH & QRIS */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#1F1612] uppercase tracking-wide">
                Pilih Metode Pembayaran
              </label>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                Hanya Cash &amp; QRIS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Option QRIS */}
              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all text-xs font-black ${
                  paymentMethod === 'QRIS'
                    ? 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30 ring-2 ring-red-600/20'
                    : 'border-[#E8DFD8] bg-[#FAF8F5] text-[#52453D] hover:bg-red-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>QRIS (Scan Barcode)</span>
              </button>

              {/* Option Cash */}
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all text-xs font-black ${
                  paymentMethod === 'Cash'
                    ? 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30 ring-2 ring-red-600/20'
                    : 'border-[#E8DFD8] bg-[#FAF8F5] text-[#52453D] hover:bg-red-50'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>CASH / TUNAI</span>
              </button>
            </div>
          </div>

          {/* LIST ORDER PESANAN LENGKAP */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#1F1612] uppercase tracking-wide flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600" />
                Daftar Menu Pesanan
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-[11px] font-extrabold text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-1 rounded-xl border border-red-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah Baris Menu</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-4 text-center">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={item.nama}
                    onChange={(e) => handleItemChange(item.id, 'nama', e.target.value)}
                    placeholder="Nama menu (misal: Rawon Daging)..."
                    className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <div className="flex items-center gap-1 w-20">
                    <input
                      type="text"
                      value={item.porsi}
                      onChange={(e) => handleItemChange(item.id, 'porsi', e.target.value)}
                      placeholder="1"
                      className="w-10 px-2 py-2 text-xs sm:text-sm text-center font-bold rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <span className="text-[10px] text-gray-500 font-bold">porsi</span>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Opsi catatan pesanan manual bebas */}
            <div>
              <input
                type="text"
                value={catatanPesananManual}
                onChange={(e) => setCatatanPesananManual(e.target.value)}
                placeholder="Atau tulis pesanan langsung di sini..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-dashed border-[#E8DFD8] bg-[#FAF8F5] text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          {/* INFORMASI PEMESAN (OPSIONAL) */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-2.5">
            <h4 className="text-xs font-black text-[#1F1612] uppercase tracking-wide">
              Data Pengiriman (Opsional)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-red-600" />
                  Nama Pemesan
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama Anda (opsional)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-red-600" />
                  Nomor HP
                </label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="08xxxxxxxxxx (opsional)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-600" />
                Alamat Kirim di Lumajang
              </label>
              <textarea
                rows={2}
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Alamat lengkap tujuan pengantaran (opsional)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-red-600" />
                Catatan Khusus
              </label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Jangan terlalu pedas, bungkus terpisah (opsional)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8DFD8] bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          {/* Tombol Kirim WhatsApp */}
          <div className="pt-1 pb-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all border border-red-400"
            >
              <Send className="w-4 h-4" />
              <span>
                {isAdminTarget
                  ? 'KIRIM KE WA ADMIN (081334274818)'
                  : `KIRIM KE WHATSAPP ${resolvedWarungNama}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
