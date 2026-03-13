import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'agriroute_app_popup_closed';
const DISMISS_DAYS = 30;
const SHOW_DELAY_MS = 3000;

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.agriroute.connect';
const APP_STORE_URL = 'https://apps.apple.com/app/id6755402445';

type MobilePlatform = 'android' | 'ios' | null;

// ── FRT-064: popup NUNCA deve aparecer em app nativo ou PWA standalone ──
function isInstalledAppContext(): boolean {
  // 1. Capacitor native (Android/iOS app)
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch { /* ignore */ }

  // 2. Fallback: window.Capacitor global or capacitor:// protocol
  if (typeof window !== 'undefined') {
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    if (window.location?.protocol === 'capacitor:') return true;
  }

  // 3. PWA standalone (installed via browser)
  if (typeof window !== 'undefined') {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return true;
  }

  return false;
}

function detectMobilePlatform(): MobilePlatform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;

  // ── FRT-064: Block in installed contexts ──
  if (isInstalledAppContext()) return null;

  const ua = navigator.userAgent.toLowerCase();

  // iOS: iPhone, iPad, iPod — including new iPads that report as MacIntel with touch
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) return 'ios';

  // Android
  if (/android/.test(ua)) return 'android';

  return null; // desktop or unknown — show nothing
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const expiry = Number(raw);
    if (isNaN(expiry)) return false;
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

function persistDismissal() {
  try {
    const expiry = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(expiry));
  } catch {
    // silent
  }
}

export function MobileAppDownloadPopup() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<MobilePlatform>(null);

  useEffect(() => {
    const detected = detectMobilePlatform();
    if (!detected || isDismissed()) return;

    setPlatform(detected);

    const timer = setTimeout(() => {
      setVisible(true);
      document.body.style.overflow = 'hidden';
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    persistDismissal();
    document.body.style.overflow = '';
  }, []);

  // Nothing for desktop
  if (!platform || !visible) return null;

  const isAndroid = platform === 'android';
  const storeUrl = isAndroid ? PLAY_STORE_URL : APP_STORE_URL;
  const description = isAndroid
    ? 'Instale o app da AgriRoute no seu Android e tenha acesso mais rápido à plataforma.'
    : 'Instale o app da AgriRoute no seu iPhone e acesse tudo com mais praticidade.';
  const buttonLabel = isAndroid ? 'Baixar na Play Store' : 'Baixar na App Store';

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Baixar app AgriRoute"
    >
      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-white p-6 text-center shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Badge */}
        <span className="mb-3 inline-block rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          APP OFICIAL AGRIROUTE
        </span>

        {/* Title */}
        <h3 className="mb-2 text-2xl font-bold text-slate-900">
          Baixe agora
        </h3>

        {/* Description */}
        <p className="mb-5 text-[15px] leading-relaxed text-slate-500">
          {description}
        </p>

        {/* CTA */}
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0"
        >
          {buttonLabel}
        </a>

        {/* Note */}
        <p className="mt-3 text-xs text-slate-400">
          Você será direcionado automaticamente para a loja correta.
        </p>
      </div>
    </div>
  );
}
