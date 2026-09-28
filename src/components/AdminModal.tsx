import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Image as ImageIcon,
  Lock,
  LogOut,
  AlertCircle,
  Loader2,
  RefreshCw,
  MapPin,
  Phone,
  ArrowLeft,
  Search,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { Warung } from '../types';
import {
  loginAdmin,
  logoutAdmin,
  createWarung,
  updateWarung,
  removeWarung,
  resetCatalogToZero,
  uploadWarungLogo,
  uploadWarungPhotos,
  replaceWarungPhoto,
  deleteWarungPhoto,
  MAX_PHOTOS_PER_WARUNG,
  isFirebaseConfigured,
  getStoredFirebaseConfig,
} from '../firebase';
import { FirebaseConfigModal } from './FirebaseConfigModal';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onAdminAuthChange: (state: boolean) => void;
  warungs: Warung[];
  initialWarungToManage?: Warung | null;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onAdminAuthChange,
  warungs,
  initialWarungToManage,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [view, setView] = useState<'list' | 'add' | 'edit' | 'manage_photos'>(
    initialWarungToManage ? 'manage_photos' : 'list'
  );
  const [selectedWarung, setSelectedWarung] = useState<Warung | null>(
    initialWarungToManage || null
  );

  // Search inside admin panel
  const [adminSearch, setAdminSearch] = useState('');

  // Form fields
  const [formNama, setFormNama] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formMapsUrl, setFormMapsUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Selected files inside "Tambah Warung" form (Sekalian dimasukkan jadi tidak kerja 2x)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const formLogoInputRef = useRef<HTMLInputElement>(null);
  const formPhotosInputRef = useRef<HTMLInputElement>(null);
  const manageLogoInputRef = useRef<HTMLInputElement>(null);
  const managePhotosInputRef = useRef<HTMLInputElement>(null);
  const editSinglePhotoInputRef = useRef<HTMLInputElement>(null);

  // Active warung synchronized with warungs
  const activeWarung = useMemo(() => {
    if (!selectedWarung) return null;
    return warungs.find((w) => w.id === selectedWarung.id) || selectedWarung;
  }, [warungs, selectedWarung]);

  // Filter warungs in admin list
  const filteredAdminWarungs = useMemo(() => {
    let list = [...warungs];
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase().trim();
      list = list.filter(
        (w) =>
          (w.nama || '').toLowerCase().includes(q) ||
          (w.alamat || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    return list;
  }, [warungs, adminSearch]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await loginAdmin(passwordInput.trim());
      if (res.success) {
        onAdminAuthChange(true);
        setView('list');
        setPasswordInput('');
      } else {
        setLoginError('Password tidak sesuai. Silakan coba lagi.');
      }
    } catch {
      setLoginError('Terjadi kendala saat login. Silakan coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onAdminAuthChange(false);
    setView('list');
    setSelectedWarung(null);
  };

  const handleOpenAdd = () => {
    setFormNama('');
    setFormWhatsapp('');
    setFormAlamat('');
    setFormMapsUrl('');
    setFormError('');
    setSelectedLogoFile(null);
    setLogoPreviewUrl('');
    setSelectedPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setSelectedWarung(null);
    setUploadProgress(null);
    setUploadSuccessMessage('');
    setView('add');
  };

  const handleOpenEdit = (warung: Warung) => {
    setSelectedWarung(warung);
    setFormNama(warung.nama);
    setFormWhatsapp(warung.whatsapp || '');
    setFormAlamat(warung.alamat || '');
    setFormMapsUrl(warung.mapsUrl || '');
    setFormError('');
    setSelectedLogoFile(null);
    setLogoPreviewUrl('');
    setSelectedPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setView('edit');
  };

  const handleOpenManagePhotos = (warung: Warung) => {
    setSelectedWarung(warung);
    setUploadError('');
    setUploadSuccessMessage('');
    setUploadProgress(null);
    setView('manage_photos');
  };

  // Handlers for file selection inside the "Tambah Warung" form
  const handleSelectFormLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedLogoFile(file);
    const preview = URL.createObjectURL(file);
    setLogoPreviewUrl(preview);
  };

  const handleRemoveFormLogo = () => {
    setSelectedLogoFile(null);
    setLogoPreviewUrl('');
    if (formLogoInputRef.current) formLogoInputRef.current.value = '';
  };

  const handleSelectFormPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const combinedFiles = [...selectedPhotoFiles, ...newFiles];

    if (combinedFiles.length > MAX_PHOTOS_PER_WARUNG) {
      setFormError(`Maksimal 60 foto per warung. Hanya ${MAX_PHOTOS_PER_WARUNG} foto yang dapat disimpan.`);
      const sliced = combinedFiles.slice(0, MAX_PHOTOS_PER_WARUNG);
      setSelectedPhotoFiles(sliced);
      const previews = sliced.map((f) => URL.createObjectURL(f));
      setPhotoPreviewUrls(previews);
      return;
    }

    setFormError('');
    setSelectedPhotoFiles(combinedFiles);
    const previews = combinedFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls(previews);
  };

  const handleRemoveFormPhotoAt = (idx: number) => {
    const updatedFiles = selectedPhotoFiles.filter((_, i) => i !== idx);
    setSelectedPhotoFiles(updatedFiles);
    const updatedPreviews = photoPreviewUrls.filter((_, i) => i !== idx);
    setPhotoPreviewUrls(updatedPreviews);
  };

  // Simpan Warung Sekaligus dengan Foto & Logo (TIDAK KERJA 2x)
  const handleSaveWarung = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    setUploadProgress(10);
    setUploadStatusText('Menyiapkan data warung...');

    try {
      const finalName = formNama.trim() ? formNama.trim().toUpperCase() : 'WARUNG LUMAJANG';

      if (view === 'add') {
        // 1. Buat warung
        setUploadStatusText('Menyimpan data warung...');
        const newId = await createWarung({
          nama: finalName,
          alamat: formAlamat.trim() || 'Lumajang',
          kategori: 'Kuliner Lumajang',
          whatsapp: formWhatsapp.trim() || '6281334274818',
          mapsUrl: formMapsUrl.trim() || '',
          logoUrl: '',
          photos: [],
        });

        // 2. Upload Logo jika ada
        if (selectedLogoFile) {
          setUploadStatusText('Mengompres dan mengunggah logo...');
          setUploadProgress(30);
          await uploadWarungLogo(newId, selectedLogoFile);
        }

        // 3. Upload Foto-foto Menu jika ada
        if (selectedPhotoFiles.length > 0) {
          setUploadStatusText(`Mengompres & mengunggah ${selectedPhotoFiles.length} foto menu...`);
          await uploadWarungPhotos(
            newId,
            [],
            selectedPhotoFiles,
            (percent, cur, total) => {
              setUploadProgress(40 + Math.round((percent * 0.55)));
              setUploadStatusText(`Mengompres & mengunggah foto ${cur}/${total} (${percent}%)...`);
            }
          );
        }

        setUploadProgress(100);
        setUploadStatusText('Warung dan seluruh foto berhasil disimpan!');
        setTimeout(() => {
          setIsSaving(false);
          setUploadProgress(null);
          setView('list');
          alert(`Warung "${finalName}" berhasil disimpan beserta logo dan foto menu!`);
        }, 800);
      } else if (view === 'edit' && selectedWarung) {
        await updateWarung(selectedWarung.id, {
          nama: finalName,
          alamat: formAlamat.trim() || 'Lumajang',
          whatsapp: formWhatsapp.trim(),
          mapsUrl: formMapsUrl.trim(),
        });
        setIsSaving(false);
        setUploadProgress(null);
        setView('list');
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data warung.');
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  // Hapus Warung Permanen
  const handleDeleteWarung = async (warung: Warung) => {
    const confirmDelete = window.confirm(
      `Hapus permanen warung "${warung.nama}" beserta semua foto menunya?\n\nData yang dihapus TIDAK AKAN KEMBALI lagi.`
    );
    if (!confirmDelete) return;

    try {
      await removeWarung(warung.id, warung);
      if (selectedWarung?.id === warung.id) {
        setSelectedWarung(null);
      }
      setView('list');
    } catch (err: any) {
      alert('Gagal menghapus warung: ' + err.message);
    }
  };

  // Reset Seluruh Katalog ke Nol
  const handleResetAllToZero = async () => {
    const confirmReset = window.confirm(
      'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA DATA WARUNG dan memulai katalog dari NOL?\n\nSemua warung dan foto menu akan dihapus secara permanen.'
    );
    if (!confirmReset) return;

    try {
      await resetCatalogToZero();
      setSelectedWarung(null);
      setView('list');
      alert('Katalog berhasil direset ke NOL. Semua riwayat lama telah dibersihkan.');
    } catch (err: any) {
      alert('Gagal mereset katalog: ' + err.message);
    }
  };

  // Upload Logo dalam mode kelola foto
  const handleManageLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeWarung) return;

    const file = files[0];
    setUploadError('');
    setUploadSuccessMessage('');
    setUploadProgress(15);
    setUploadStatusText('Mengompres dan mengunggah logo...');

    try {
      const newLogoUrl = await uploadWarungLogo(activeWarung.id, file, (percent) => {
        setUploadProgress(percent);
      });
      setSelectedWarung((prev) => (prev ? { ...prev, logoUrl: newLogoUrl } : null));
      setUploadStatusText('Logo berhasil diperbarui!');
      setUploadSuccessMessage('Logo berhasil disimpan secara permanen!');
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStatusText('');
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengunggah logo.');
      setUploadProgress(null);
    }
  };

  // Hapus Logo
  const handleDeleteLogo = async () => {
    if (!activeWarung || !activeWarung.logoUrl) return;
    const confirmDelete = window.confirm('Hapus logo warung ini secara permanen?');
    if (!confirmDelete) return;

    try {
      await updateWarung(activeWarung.id, { logoUrl: '' });
      setSelectedWarung((prev) => (prev ? { ...prev, logoUrl: '' } : null));
      setUploadSuccessMessage('Logo berhasil dihapus permanen.');
    } catch (err: any) {
      alert('Gagal menghapus logo: ' + err.message);
    }
  };

  // Upload Multiple Photos dalam mode kelola foto
  const handleManagePhotosFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeWarung) return;

    const currentPhotos = activeWarung.photos || [];
    const fileArray = Array.from(files);

    if (currentPhotos.length + fileArray.length > MAX_PHOTOS_PER_WARUNG) {
      setUploadError('Warung sudah memiliki 60 foto.');
      if (managePhotosInputRef.current) managePhotosInputRef.current.value = '';
      return;
    }

    setUploadError('');
    setUploadSuccessMessage('');
    setUploadProgress(10);
    setUploadStatusText(`Mengompres & mengunggah 1/${fileArray.length} foto...`);

    try {
      const updatedPhotos = await uploadWarungPhotos(
        activeWarung.id,
        currentPhotos,
        fileArray,
        (percent, currentIdx, total) => {
          setUploadProgress(percent);
          setUploadStatusText(`Mengompres & mengunggah foto ke-${currentIdx}/${total} (${percent}%)...`);
        }
      );

      setSelectedWarung((prev) =>
        prev ? { ...prev, photos: updatedPhotos, photoCount: updatedPhotos.length } : null
      );
      setUploadStatusText('Foto berhasil diunggah & disimpan permanen!');
      setUploadSuccessMessage(`${fileArray.length} foto berhasil ditambahkan & disimpan!`);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStatusText('');
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengunggah foto.');
      setUploadProgress(null);
    } finally {
      if (managePhotosInputRef.current) managePhotosInputRef.current.value = '';
    }
  };

  // Trigger Edit / Ganti Foto
  const handleTriggerEditPhoto = (idx: number) => {
    setEditingPhotoIndex(idx);
    editSinglePhotoInputRef.current?.click();
  };

  const handleEditSinglePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeWarung || editingPhotoIndex === null) return;

    const file = files[0];
    const targetIdx = editingPhotoIndex;
    setUploadError('');
    setUploadSuccessMessage('');
    setUploadProgress(20);
    setUploadStatusText(`Mengompres & mengganti foto #${targetIdx + 1}...`);

    try {
      const updatedPhotos = await replaceWarungPhoto(
        activeWarung.id,
        activeWarung.photos || [],
        targetIdx,
        file,
        (percent) => setUploadProgress(percent)
      );

      setSelectedWarung((prev) =>
        prev ? { ...prev, photos: updatedPhotos, photoCount: updatedPhotos.length } : null
      );
      setUploadStatusText('Foto berhasil diganti & langsung diperbarui permanen!');
      setUploadSuccessMessage(`Foto #${targetIdx + 1} berhasil diperbarui.`);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadStatusText('');
        setEditingPhotoIndex(null);
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengganti foto.');
      setUploadProgress(null);
    } finally {
      if (editSinglePhotoInputRef.current) editSinglePhotoInputRef.current.value = '';
    }
  };

  // Hapus Individual Photo Permanen
  const handleDeletePhoto = async (photoUrl: string) => {
    if (!activeWarung) return;
    const confirmDelete = window.confirm(
      'Hapus foto menu ini secara permanen? Data tidak akan kembali.'
    );
    if (!confirmDelete) return;

    try {
      const updated = await deleteWarungPhoto(
        activeWarung.id,
        activeWarung.photos || [],
        photoUrl
      );
      setSelectedWarung((prev) =>
        prev ? { ...prev, photos: updated, photoCount: updated.length } : null
      );
      setUploadSuccessMessage('Foto menu berhasil dihapus permanen!');
      setTimeout(() => setUploadSuccessMessage(''), 2500);
    } catch (err: any) {
      alert('Gagal menghapus foto: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto touch-scroll">
      <div className="bg-[#FAF8F5] w-full max-w-2xl rounded-3xl shadow-2xl border border-[#E8DFD8] overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Thema Merah */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-red-200 tracking-widest uppercase">
                PANEL KHUSUS ADMINISTRATOR
              </span>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                {isAdmin ? 'PANEL ADMIN KATALOG' : 'LOGIN ADMIN'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-black/30 text-white text-xs font-bold transition-all"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/15 text-white transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          accept="image/*"
          ref={editSinglePhotoInputRef}
          onChange={handleEditSinglePhotoFileChange}
          className="hidden"
        />

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 touch-scroll">
          {!isAdmin ? (
            /* Login Form - Hanya admin yang bisa menambahkan warung */
            <div className="max-w-sm mx-auto py-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-black text-[#1F1612]">
                  Masuk Panel Admin
                </h3>
                <p className="text-xs text-[#786C65] mt-1">
                  Hanya administrator yang memiliki akses untuk menambah warung baru, mengedit data, dan mengunggah foto menu.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#1F1612] mb-1">
                    Password Administrator
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password admin..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <span>MASUK PANEL ADMIN</span>
                  )}
                </button>
              </form>
            </div>
          ) : view === 'list' ? (
            /* List of Warungs */
            <div className="space-y-4">
              {/* Cloud Sync Status Indicator (Khusus Admin - Menjamin Multi-HP Sinkron) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-white border border-[#E8DFD8] shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      isFirebaseConfigured()
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                        : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-black text-[#1F1612] block">
                      {isFirebaseConfigured()
                        ? `Cloud Firestore Terhubung: ${getStoredFirebaseConfig().projectId}`
                        : 'Cloud Firestore Belum Terhubung'}
                    </span>
                    <p className="text-[11px] text-[#786C65]">
                      {isFirebaseConfigured()
                        ? 'Data warung dan foto otomatis sinkron real-time ke HP B dan semua perangkat.'
                        : 'Data saat ini masih di cache HP ini. Klik tombol di kanan agar muncul di HP B.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(true)}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl border transition-all shrink-0 ${
                    isFirebaseConfigured()
                      ? 'bg-gray-50 hover:bg-gray-100 text-[#1F1612] border-gray-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  }`}
                >
                  {isFirebaseConfigured() ? '⚙️ Cek Cloud' : '⚡ Hubungkan Cloud Firebase'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-[#1F1612]">
                    Daftar Warung ({warungs.length})
                  </h3>
                  <p className="text-xs text-[#786C65]">
                    Terurut A-Z otomatis dengan nama kapital
                  </p>
                </div>
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md shadow-red-600/25 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ TAMBAH WARUNG &amp; FOTO</span>
                </button>
              </div>

              {/* Search Warung in Admin */}
              {warungs.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-[#948982] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Cari warung di panel admin..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-[#E8DFD8] rounded-xl text-xs text-[#1F1612] focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  {adminSearch && (
                    <button
                      onClick={() => setAdminSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {warungs.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E8DFD8] space-y-3">
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-[#1F1612]">
                    Katalog Masih Kosong (Mulai Dari Nol)
                  </h4>
                  <p className="text-xs text-[#786C65] max-w-xs mx-auto">
                    Belum ada warung terdaftar. Tambahkan warung pertama sekalian dengan foto-fotonya!
                  </p>
                  <button
                    onClick={handleOpenAdd}
                    className="mt-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-md shadow-red-600/25"
                  >
                    Tambah Warung Pertama
                  </button>
                </div>
              ) : filteredAdminWarungs.length === 0 ? (
                <div className="p-6 text-center bg-white rounded-2xl border border-[#E8DFD8]">
                  <p className="text-xs text-[#786C65]">
                    Tidak ditemukan warung dengan kata kunci &quot;{adminSearch}&quot;.
                  </p>
                  <button
                    onClick={() => setAdminSearch('')}
                    className="mt-2 text-xs font-bold text-red-600 hover:underline"
                  >
                    Reset Pencarian
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E8DFD8] border border-[#E8DFD8] rounded-2xl overflow-hidden bg-white shadow-xs">
                  {filteredAdminWarungs.map((w) => (
                    <div
                      key={w.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] overflow-hidden shrink-0 border border-[#E8DFD8] flex items-center justify-center">
                          {w.logoUrl ? (
                            <img
                              src={w.logoUrl}
                              alt={w.nama}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-red-300 stroke-1" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-[#1F1612] truncate uppercase">
                            {w.nama}
                          </h4>
                          <p className="text-xs text-[#786C65] truncate">{w.alamat || 'Lumajang'}</p>
                          <span className="text-[11px] font-extrabold text-red-600">
                            Foto: {w.photos?.length || 0}/60
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenManagePhotos(w)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition-colors flex items-center gap-1"
                          title="Kelola & Edit Foto Menu"
                        >
                          <Upload className="w-3.5 h-3.5 text-red-600" />
                          <span>Foto ({w.photos?.length || 0})</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                          title="Edit Warung"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWarung(w)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                          title="Hapus Warung Permanen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tombol Mulai dari Nol / Reset Semua Warung */}
              {warungs.length > 0 && (
                <div className="pt-4 border-t border-[#E8DFD8] flex justify-end">
                  <button
                    onClick={handleResetAllToZero}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-rose-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hapus Semua Warung &amp; Mulai dari Nol</span>
                  </button>
                </div>
              )}
            </div>
          ) : view === 'add' ? (
            /* Tambah Warung SEKILAS LENGKAP dengan Logo & Foto Menu (TIDAK KERJA 2x) */
            <form onSubmit={handleSaveWarung} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
                <div>
                  <h3 className="text-base font-black text-[#1F1612]">
                    Tambah Warung &amp; Foto Sekaligus
                  </h3>
                  <p className="text-[11px] text-[#786C65]">
                    Masukkan data warung dan foto-foto menu dalam satu halaman (tidak kerja 2x)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-3 py-1 rounded-xl bg-red-50 text-red-700 font-bold text-xs hover:bg-red-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali</span>
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Progress Bar saat simpan & upload */}
              {uploadProgress !== null && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 animate-in fade-in">
                  <div className="flex justify-between text-xs font-bold text-red-800">
                    <span>{uploadStatusText}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-red-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 1. NAMA WARUNG */}
              <div>
                <label className="block text-xs font-bold text-[#1F1612] mb-1">
                  Nama Warung (Otomatis Huruf Kapital)
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: WARUNG RAWON GAJAH MADA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFD8] bg-white text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* 2. NO WHATSAPP & ALAMAT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F1612] mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-red-600" />
                    Nomor WhatsApp Warung
                  </label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="628xxxxxxxxxx (Opsional)"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F1612] mb-1">
                    Google Maps URL
                  </label>
                  <input
                    type="url"
                    value={formMapsUrl}
                    onChange={(e) => setFormMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/... (Opsional)"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1612] mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  Alamat Warung di Lumajang
                </label>
                <textarea
                  rows={2}
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  placeholder="Jl. Alun-Alun Lumajang (Opsional)"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
                />
              </div>

              {/* 3. LOGO WARUNG LANGSUNG DI FORM INI */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#1F1612] uppercase tracking-wide">
                    Logo Warung (Opsional)
                  </label>
                  <span className="text-[10px] text-gray-500 font-bold">Auto-kompres ringan</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD8] overflow-hidden shrink-0 flex items-center justify-center">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt="Preview Logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-red-300 stroke-1" />
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    ref={formLogoInputRef}
                    onChange={handleSelectFormLogo}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => formLogoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5 text-red-600" />
                      <span>{selectedLogoFile ? 'Ganti Logo' : 'Pilih Logo dari HP'}</span>
                    </button>
                    {selectedLogoFile && (
                      <button
                        type="button"
                        onClick={handleRemoveFormLogo}
                        className="p-1.5 rounded-xl bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-600 transition-colors text-xs font-bold"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. FOTO-FOTO MENU SEKALIAN DIMASUKKAN (TIDAK KERJA 2x) */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-[#1F1612] uppercase tracking-wide">
                      Foto-Foto Menu Warung (Sekalian Dimasukkan)
                    </label>
                    <p className="text-[11px] font-extrabold text-red-600">
                      {selectedPhotoFiles.length}/60 Foto Dipilih
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={formPhotosInputRef}
                    onChange={handleSelectFormPhotos}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={selectedPhotoFiles.length >= MAX_PHOTOS_PER_WARUNG || isSaving}
                    onClick={() => formPhotosInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm shadow-red-600/25 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pilih Foto dari Galeri</span>
                  </button>
                </div>

                {/* Previews Grid */}
                {photoPreviewUrls.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1 max-h-56 overflow-y-auto p-1">
                    {photoPreviewUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-xl overflow-hidden border border-[#E8DFD8] bg-[#FAF8F5] group"
                      >
                        <img src={url} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1 rounded">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFormPhotoAt(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 shadow-md"
                          title="Hapus foto ini dari antrean"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => formPhotosInputRef.current?.click()}
                    className="p-5 text-center border border-dashed border-[#E8DFD8] rounded-xl cursor-pointer hover:bg-[#FAF8F5] transition-colors"
                  >
                    <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1 stroke-1" />
                    <p className="text-xs text-[#786C65] font-medium">
                      Ketuk di sini untuk memilih foto-foto menu langsung dari HP (bisa pilih banyak).
                    </p>
                  </div>
                )}
              </div>

              {/* 5. TOMBOL SIMPAN SEKILAS SELESAI */}
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Warung &amp; Foto...</span>
                    </>
                  ) : (
                    <span>SIMPAN WARUNG &amp; FOTO (SELESAI)</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-3 rounded-2xl bg-white border border-[#E8DFD8] text-[#52453D] text-sm font-bold"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : view === 'edit' ? (
            /* Edit Warung Form */
            <form onSubmit={handleSaveWarung} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
                <div>
                  <h3 className="text-base font-black text-[#1F1612]">
                    Edit Warung: {selectedWarung?.nama}
                  </h3>
                  <p className="text-[11px] text-[#786C65]">
                    Perbarui informasi nama, alamat, atau nomor WhatsApp
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-3 py-1 rounded-xl bg-red-50 text-red-700 font-bold text-xs hover:bg-red-100 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali</span>
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1F1612] mb-1">
                  Nama Warung (Otomatis Huruf Kapital)
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: WARUNG RAWON GAJAH MADA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFD8] bg-white text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F1612] mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-red-600" />
                    Nomor WhatsApp Warung
                  </label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="628xxxxxxxxxx (Opsional)"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F1612] mb-1">
                    Google Maps URL
                  </label>
                  <input
                    type="url"
                    value={formMapsUrl}
                    onChange={(e) => setFormMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/... (Opsional)"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1612] mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  Alamat Warung di Lumajang
                </label>
                <textarea
                  rows={2}
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  placeholder="Jl. Alun-Alun Lumajang (Opsional)"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFD8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>SIMPAN PERUBAHAN</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-3 rounded-2xl bg-white border border-[#E8DFD8] text-[#52453D] text-sm font-bold"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : (
            /* Manage Photos (Edit, Replace, Delete individual photos) */
            activeWarung && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
                  <div>
                    <h3 className="text-base font-black text-[#1F1612]">
                      Kelola, Edit &amp; Hapus Foto Menu
                    </h3>
                    <p className="text-xs text-[#786C65] uppercase font-bold">{activeWarung.nama}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-bold text-xs hover:bg-red-100 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Daftar</span>
                  </button>
                </div>

                {uploadProgress !== null && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 animate-in fade-in">
                    <div className="flex justify-between text-xs font-bold text-red-800">
                      <span>{uploadStatusText}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-red-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-red-600 h-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadSuccessMessage && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                    <span>{uploadSuccessMessage}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* LOGO */}
                <div className="p-4 bg-white rounded-2xl border border-[#E8DFD8]">
                  <h4 className="text-xs font-black uppercase text-[#1F1612] tracking-wider mb-2">
                    [UPLOAD / GANTI LOGO]
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD8] overflow-hidden shrink-0 flex items-center justify-center">
                      {activeWarung.logoUrl ? (
                        <img
                          src={activeWarung.logoUrl}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-red-300" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="file"
                        accept="image/*"
                        ref={manageLogoInputRef}
                        onChange={handleManageLogoFileChange}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => manageLogoInputRef.current?.click()}
                          className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-red-600" />
                          <span>Pilih Logo dari HP</span>
                        </button>
                        {activeWarung.logoUrl && (
                          <button
                            type="button"
                            onClick={handleDeleteLogo}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Hapus Logo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-[#786C65]">
                        Otomatis dikompres jernih &amp; hemat memori
                      </p>
                    </div>
                  </div>
                </div>

                {/* FOTO MENU */}
                <div className="p-4 bg-white rounded-2xl border border-[#E8DFD8]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#1F1612] tracking-wider">
                        [FOTO MENU KATALOG]
                      </h4>
                      <p className="text-xs font-extrabold text-red-600">
                        Foto: {activeWarung.photos?.length || 0}/{MAX_PHOTOS_PER_WARUNG}
                      </p>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={managePhotosInputRef}
                      onChange={handleManagePhotosFileChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      disabled={
                        (activeWarung.photos?.length || 0) >= MAX_PHOTOS_PER_WARUNG ||
                        uploadProgress !== null
                      }
                      onClick={() => managePhotosInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-red-600/25"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Tambah Foto Menu</span>
                    </button>
                  </div>

                  {(activeWarung.photos?.length || 0) >= MAX_PHOTOS_PER_WARUNG && (
                    <div className="p-2.5 mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Warung sudah memiliki 60 foto.</span>
                    </div>
                  )}

                  {activeWarung.photos && activeWarung.photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      {activeWarung.photos.map((photoUrl, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-4/3 rounded-2xl overflow-hidden bg-[#FAF8F5] border border-[#E8DFD8] group shadow-xs"
                        >
                          <img
                            src={photoUrl}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            #{idx + 1}
                          </span>

                          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleTriggerEditPhoto(idx)}
                              className="p-1.5 bg-black/75 hover:bg-black text-white rounded-lg transition-all shadow-md"
                              title="Edit / Ganti Foto Ini"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photoUrl)}
                              className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md"
                              title="Hapus Foto Ini Secara Permanen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E8DFD8]">
                      <ImageIcon className="w-8 h-8 text-[#A89D96] mx-auto mb-1 stroke-1" />
                      <p className="text-xs text-[#786C65] font-medium">
                        Belum ada foto menu diunggah. Ketuk tombol &quot;+ Tambah Foto Menu&quot; di atas.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md shadow-red-600/25 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Selesai &amp; Kembali ke Daftar Warung</span>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal Pengaturan Cloud Database Firebase (Khusus Admin) */}
      <FirebaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfigSaved={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
};
