import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { getStoredFirebaseConfig, isFirebaseConfigured } from '../firebase';
import { FirebaseConfigObject } from '../types';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<FirebaseConfigObject>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });
  const [jsonInput, setJsonInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredFirebaseConfig();
      setConfig(stored);
      setJsonInput(JSON.stringify(stored, null, 2));
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = isFirebaseConfigured(config);

  const handleSaveJson = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.apiKey || !parsed.projectId) {
        alert('Konfigurasi tidak lengkap. Pastikan apiKey dan projectId terisi.');
        return;
      }
      localStorage.setItem('olumajang_firebase_config', JSON.stringify(parsed));
      setConfig(parsed);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onConfigSaved();
        onClose();
        window.location.reload();
      }, 1000);
    } catch {
      alert('Format JSON tidak valid. Pastikan format JSON benar.');
    }
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('olumajang_firebase_config');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A120B]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF7F2] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8DFD8] overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Coffee Mocca */}
        <div className="bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#6F4E37] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#D7B99B] border border-white/15">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-[#D7B99B] tracking-widest uppercase">
                STATUS BACKEND
              </span>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                Koneksi Firebase
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-sm">
          {/* Status Indicator */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
              isConfigured
                ? 'bg-[#EFEBE9] border-[#D7CCC8] text-[#3E2723]'
                : 'bg-[#FFF8E1] border-[#FFE082] text-[#5D4037]'
            }`}
          >
            {isConfigured ? (
              <CheckCircle2 className="w-6 h-6 text-[#6F4E37] shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-[#8D6E63] shrink-0" />
            )}
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm">
                {isConfigured ? 'Firebase Aktif & Siap Digunakan' : 'Mode Demo / Siap Dihubungkan'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90 leading-tight">
                {isConfigured
                  ? `Project ID: ${config.projectId}. Data tersimpan permanen di Cloud Firestore & Storage.`
                  : 'Katalog berjalan dengan cache lokal. Anda bisa menempelkan konfigurasi dari Firebase Console di bawah ini.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveJson} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#4A2E1B] mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#6F4E37]" />
                  Tempel firebaseConfig (JSON) dari Firebase Console
                </span>
                <span className="text-[10px] text-[#8D6E63]">firebase-config.js</span>
              </label>
              <textarea
                rows={6}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{\n  "apiKey": "AIzaSy...",\n  "projectId": "..."\n}'
                className="w-full font-mono text-xs p-3 rounded-2xl border border-[#E8DFD8] bg-white focus:outline-none focus:ring-2 focus:ring-[#6F4E37] text-[#271C16]"
              />
            </div>

            {savedSuccess && (
              <div className="p-2.5 bg-[#EFEBE9] text-[#3E2723] text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#6F4E37]" />
                Konfigurasi disimpan! Memuat ulang aplikasi...
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-2xl bg-[#6F4E37] hover:bg-[#5D4037] text-white font-bold text-xs shadow-md shadow-[#6F4E37]/20 transition-all"
              >
                SIMPAN &amp; HUBUNGKAN KE FIREBASE
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2.5 rounded-2xl bg-white border border-[#E8DFD8] hover:bg-[#FAF7F2] text-[#4A2E1B] text-xs font-bold transition-all"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Panduan Android */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] text-xs space-y-2">
            <h5 className="font-extrabold text-[#3E2723] uppercase tracking-wider text-[11px]">
              📱 Panduan Cepat dari HP Android:
            </h5>
            <ol className="list-decimal pl-4 space-y-1 text-[#8D6E63]">
              <li>Buka <strong>console.firebase.google.com</strong> di browser Android.</li>
              <li>Buat Proyek baru (misal: <code>katalog-olumajang</code>).</li>
              <li>Di Project Settings &rarr; Tambah aplikasi Web (<code>&lt;/&gt;</code>).</li>
              <li>Salin nilai <code>firebaseConfig</code> dan tempel pada kotak di atas.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
