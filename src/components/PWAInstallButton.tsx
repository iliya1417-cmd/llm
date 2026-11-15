import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Download, Laptop, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  onOpenBackupModal?: () => void;
}

export function PWAInstallButton({ compact = false, onOpenBackupModal }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen]);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) setGuideOpen(true);
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void handleClick()}
        title="نصب برنامه روی دستگاه برای استفاده همیشگی و آفلاین"
        className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
        }`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>نصب آفلاین</span>
      </motion.button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {guideOpen && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 no-print"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setGuideOpen(false);
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pwa-guide-title"
                  className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4 text-right"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <WifiOff className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 id="pwa-guide-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          استفاده همیشگی و آفلاین روی دستگاه
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          این برنامه به‌صورت کامل روی دستگاه شما کش و نصب می‌شود
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuideOpen(false)}
                      aria-label="بستن راهنمای نصب آفلاین"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {isInstallable && (
                    <button
                      type="button"
                      onClick={() => void install()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>نصب مستقیم برنامه روی دستگاه</span>
                    </button>
                  )}

                  <div className="space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                        <Laptop className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>کامپیوتر و اندروید (Chrome / Edge)</span>
                      </div>
                      <p>
                        {isIOS
                          ? 'در مرورگر Chrome اندروید از منوی سه‌نقطه بالا گزینه «Install app / افزودن به صفحه اصلی» را بزنید.'
                          : 'در نوار آدرس بالا آیکون نصب (صفحه با فلش رو به پایین) یا از منوی سه‌نقطه مرورگر گزینه «Install app / نصب برنامه» را بزنید تا مثل یک نرم‌افزار مستقل بدون نیاز به اینترنت اجرا شود.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                        <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                        <span>آیفون و آیپد (Safari)</span>
                      </div>
                      <p>
                        دکمه <strong>Share</strong> در نوار پایین Safari را بزنید و گزینه{' '}
                        <strong>Add to Home Screen (افزودن به صفحه اصلی)</strong> را انتخاب کنید.
                      </p>
                    </div>

                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        همه اطلاعات در حافظه امن دستگاه خودتان می‌ماند. همچنین از بخش «خروجی رایگان و پشتیبان» می‌توانید فایل گزارش آفلاین (HTML) یا پشتیبان رمزدار (JSON) بگیرید.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {onOpenBackupModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setGuideOpen(false);
                          onOpenBackupModal();
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        باز کردن خروجی رایگان
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGuideOpen(false)}
                      className="rounded-xl bg-slate-900 dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                    >
                      متوجه شدم
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
