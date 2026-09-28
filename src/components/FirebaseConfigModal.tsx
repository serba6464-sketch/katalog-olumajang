import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertTriangle, KeyRound, Copy, Check } from 'lucide-react';
import {
  getStoredFirebaseConfig,
  isFirebaseConfigured,
  initFirebaseServices,
  syncLocalWarungsToFirestore
} from '../firebase';
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
  const [copiedJs, setCopiedJs] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredFirebaseConfig();
      setConfig(stored);
      setJsonInput(JSON.stringify(stored, null, 2));
      setSavedSuccess(false);
      setSyncStatus('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = isFirebaseConfigured(config);

  const handleSaveJson = async (e: React.FormEvent) => {
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
      setSyncStatus('Menghubungkan ke Cloud Firestore...');

      initFirebaseServices();
      const syncedCount = await syncLocalWarungsToFirestore();
      if (syncedCount > 0) {
        setSyncStatus(`${syncedCount} warung berhasil disinkronkan ke Cloud Firestore!`);
      }

      setTimeout(() => {
        setSavedSuccess(false);
        onConfigSaved();
        onClose();
        window.location.reload();
      }, 1200);
    } catch {
      alert('Format JSON tidak valid. Pastikan format JSON benar.');
    }
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('olumajang_firebase_config');
    window.location.reload();
  };

  const handleCopyCodeSnippet = () => {
    const codeSnippet = `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\nexport default firebaseConfig;\n`;
    navigator.clipboard.writeText(codeSnippet);
    setCopiedJs(true);
    setTimeout(() => setCopiedJs(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A120B]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF7F2] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8DFD8] overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/15">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-red-200 tracking-widest uppercase">
                PANEL ADMIN
              </span>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                Koneksi Cloud Firestore &amp; Storage
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
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {isConfigured ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm">
                {isConfigured ? 'Cloud Firestore Terhubung & Aktif' : 'Konfigurasi Cloud Belum Lengkap'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90 leading-tight">
                {isConfigured
                  ? `Project ID: ${config.projectId}. Sinkronisasi otomatis antar HP A dan HP B aktif.`
                  : 'Data masih tersimpan di cache lokal HP ini. Tempelkan firebaseConfig agar tersinkronisasi ke seluruh HP lain.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveJson} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#1F1612] mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-red-600" />
                  Tempel Objek firebaseConfig (JSON)
                </span>
                <span className="text-[10px] text-[#786C65]">firebase-config.js</span>
              </label>
              <textarea
                rows={6}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{\n  "apiKey": "AIzaSy...",\n  "projectId": "katalog-olumajang",\n  "storageBucket": "katalog-olumajang.appspot.com"\n}'
                className="w-full font-mono text-xs p-3 rounded-2xl border border-[#E8DFD8] bg-white focus:outline-none focus:ring-2 focus:ring-red-600 text-[#1F1612]"
              />
            </div>

            {savedSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{syncStatus || 'Konfigurasi berhasil disimpan!'}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all"
              >
                SIMPAN &amp; SINKRONKAN KE CLOUD
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2.5 rounded-2xl bg-white border border-[#E8DFD8] hover:bg-[#FAF7F2] text-[#1F1612] text-xs font-bold transition-all"
              >
                Reset
              </button>
            </div>
          </form>

          {/* GitHub Pages Helper */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DFD8] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="font-extrabold text-[#1F1612] uppercase tracking-wider text-[11px]">
                🚀 Untuk GitHub Pages (Multi-HP Otomatis):
              </h5>
              {isConfigured && (
                <button
                  type="button"
                  onClick={handleCopyCodeSnippet}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700"
                >
                  {copiedJs ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJs ? 'Tersalin!' : 'Salin Snippet'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-[#786C65] leading-relaxed">
              Agar HP B dan seluruh pengunjung langsung terhubung otomatis ke Cloud Firestore tanpa perlu login admin, salin nilai di atas ke file <code>firebase-config.js</code> di repository GitHub Anda, lalu jalankan workflow GitHub Actions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
