import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Printer,
  ShieldCheck,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { AllWeeks, AppSettings, SyllabusData } from '../types/study';
import {
  createBackupEnvelope,
  generateStandaloneHtmlReport,
  generateStudyCsv,
  parseBackupEnvelope,
  type ParsedBackupResult,
} from '../utils/securityAndStorage';
import { fa, keyFromDate } from '../utils/dateAndFormat';

interface BackupSecurityModalProps {
  open: boolean;
  weeks: AllWeeks;
  syllabus: SyllabusData;
  settings: AppSettings;
  onClose: () => void;
  onApplyRestore: (result: ParsedBackupResult, mode: 'merge' | 'replace') => void;
  onToast: (msg: string) => void;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupSecurityModal({
  open,
  weeks,
  syllabus,
  settings,
  onClose,
  onApplyRestore,
  onToast,
}: BackupSecurityModalProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [useEncryption, setUseEncryption] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const [pendingRawFile, setPendingRawFile] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [needPassphrase, setNeedPassphrase] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedBackupResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const resetRestoreState = () => {
    setPendingRawFile(null);
    setRestorePassphrase('');
    setNeedPassphrase(false);
    setRestoreError('');
    setParsedPreview(null);
  };

  const handleExportJson = async () => {
    if (useEncryption && passphrase.trim().length < 4) {
      onToast('برای رمزنگاری، رمز عبوری حداقل ۴ کاراکتری وارد کنید.');
      return;
    }
    setExportBusy(true);
    try {
      const envelope = await createBackupEnvelope(
        { weeks, syllabus, settings },
        useEncryption ? passphrase : undefined,
      );
      const dateStr = keyFromDate(new Date());
      const suffix = useEncryption ? '-encrypted' : '';
      downloadBlob(
        JSON.stringify(envelope, null, 2),
        `study-backup${suffix}-${dateStr}.json`,
        'application/json',
      );
      onToast(
        useEncryption
          ? 'فایل پشتیبان رمزنگاری‌شده با موفقیت دانلود شد.'
          : 'فایل پشتیبان با امضای سلامت SHA-256 دانلود شد.',
      );
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportCsv = () => {
    const csv = generateStudyCsv(weeks);
    downloadBlob(csv, `study-report-${keyFromDate(new Date())}.csv`, 'text/csv;charset=utf-8');
    onToast('فایل اکسل (CSV) با پشتیبانی کامل فارسی دانلود شد.');
  };

  const handleExportHtml = () => {
    const html = generateStandaloneHtmlReport(weeks, syllabus);
    downloadBlob(html, `study-report-${keyFromDate(new Date())}.html`, 'text/html;charset=utf-8');
    onToast('گزارش مستقل HTML رایگان دانلود شد.');
  };

  const tryParseFile = async (rawText: string, pass?: string) => {
    setRestoreError('');
    try {
      const result = await parseBackupEnvelope(rawText, pass);
      setParsedPreview(result);
      setNeedPassphrase(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PASSPHRASE_REQUIRED') {
        setNeedPassphrase(true);
        setRestoreError('');
      } else if (msg === 'WRONG_PASSPHRASE') {
        setNeedPassphrase(true);
        setRestoreError('رمز عبور نادرست است. دوباره تلاش کنید.');
      } else {
        setRestoreError('ساختار فایل پشتیبان معتبر نیست.');
      }
    }
  };

  const handleFilePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setRestoreError('حجم فایل نباید بیشتر از ۱۵ مگابایت باشد.');
      ev.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setPendingRawFile(text);
      setRestorePassphrase('');
      setParsedPreview(null);
      void tryParseFile(text);
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const weekCount = Object.keys(weeks).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="backup-modal-title"
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-2xl space-y-5"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="backup-modal-title" className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                    خروجی رایگان و امنیت داده‌ها
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تمامی داده‌ها ۱۰۰٪ روی دستگاه شما ذخیره می‌شوند و خروجی‌ها کاملاً رایگان و آفلاین هستند
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پنجره خروجی و امنیت"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Free Multi-Format Exports */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                خروجی‌های رایگان ({fa(weekCount)} هفته ثبت‌شده)
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-3.5 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Lock className="h-4 w-4 text-indigo-500" />
                    <span>رمزنگاری فایل پشتیبان (AES-256-GCM)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useEncryption}
                    onChange={(e) => setUseEncryption(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>

                {useEncryption && (
                  <div>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="رمز عبور دلخواه برای قفل فایل پشتیبان..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={exportBusy}
                    onClick={handleExportJson}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-colors whitespace-nowrap"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>{useEncryption ? 'دانلود پشتیبان رمزدار (JSON)' : 'دانلود پشتیبان کامل (JSON)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>خروجی اکسل (CSV فارسی)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportHtml}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span>گزارش مستقل آفلاین (HTML)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setTimeout(() => window.print(), 200);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <Printer className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>چاپ / ذخیره PDF رایگان</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Secure Restore */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  بازیابی امن از فایل پشتیبان
                </span>
                {parsedPreview && (
                  <button
                    type="button"
                    onClick={resetRestoreState}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    انتخاب فایل دیگر
                  </button>
                )}
              </div>

              {!parsedPreview && (
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/30 p-5 cursor-pointer hover:border-emerald-500 transition-colors">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    انتخاب فایل پشتیبان (.json) — سازگار با نسخه‌های قبل و رمزنگاری‌شده
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFilePick}
                    className="hidden"
                  />
                </label>
              )}

              {needPassphrase && pendingRawFile && !parsedPreview && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 space-y-2.5">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    این فایل پشتیبان رمزنگاری شده است
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      placeholder="رمز عبور فایل را وارد کنید..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void tryParseFile(pendingRawFile, restorePassphrase)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white whitespace-nowrap"
                    >
                      بازگشایی
                    </button>
                  </div>
                </div>
              )}

              {restoreError && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {restoreError}
                </div>
              )}

              {parsedPreview && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {fa(Object.keys(parsedPreview.weeks).length)} هفته آماده بازیابی
                        {parsedPreview.syllabus ? ' · به‌همراه مباحث و مرورها' : ''}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {parsedPreview.integrityStatus === 'verified'
                        ? '✓ امضای SHA-256 معتبر'
                        : parsedPreview.integrityStatus === 'mismatch'
                        ? '⚠️ فایل خارج از برنامه ویرایش شده'
                        : 'فرمت استاندارد قدیمی'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="accent-emerald-600"
                      />
                      <span>ادغام با داده‌های فعلی (هفته‌های موجود حفظ شوند)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="accent-emerald-600"
                      />
                      <span>جایگزینی کامل</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetRestoreState}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyRestore(parsedPreview, restoreMode);
                        resetRestoreState();
                        onClose();
                      }}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                    >
                      اعمال بازیابی
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Always-Offline PWA Card */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <WifiOff className="h-4 w-4 shrink-0" />
                  <span>استفاده همیشگی بدون اینترنت (PWA آفلاین)</span>
                </div>
                {isInstalled ? (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    ✓ نصب‌شده روی دستگاه
                  </span>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white"
                  >
                    نصب مستقیم روی دستگاه
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                {isIOS
                  ? 'در آیفون/آیپد با دکمه Share و گزینه Add to Home Screen برنامه را نصب کنید تا بدون نیاز به اینترنت همیشه روی دستگاه اجرا شود.'
                  : 'با نصب برنامه از آیکون کنار نوار آدرس Chrome/Edge (یا دکمه «نصب آفلاین» در بالای صفحه)، تمام فایل‌های برنامه روی دستگاه شما کش می‌شوند و همیشه حتی در حالت قطع کامل اینترنت کار می‌کند.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
