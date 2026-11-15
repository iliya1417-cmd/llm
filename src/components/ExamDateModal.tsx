import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, X } from 'lucide-react';
import { int } from '../utils/dateAndFormat';

interface ExamDateModalProps {
  open: boolean;
  exam: [number, number, number];
  onClose: () => void;
  onSave: (exam: [number, number, number]) => void;
}

export function ExamDateModal({ open, exam, onClose, onSave }: ExamDateModalProps) {
  const [y, setY] = useState(String(exam[0]));
  const [m, setM] = useState(String(exam[1]));
  const [d, setD] = useState(String(exam[2]));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setY(String(exam[0]));
      setM(String(exam[1]));
      setD(String(exam[2]));
      setError('');
    }
  }, [open, exam]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yn = int(y);
    const mn = int(m);
    const dn = int(d);
    if (yn < 1400 || yn > 1425 || mn < 1 || mn > 12 || dn < 1 || dn > 31) {
      setError('تاریخ معتبر نیست. مثال: ۱۴۰۶ / ۴ / ۱۱');
      return;
    }
    onSave([yn, mn, dn]);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-modal-title"
            className="w-full max-w-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 id="exam-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  تنظیم تاریخ کنکور
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن پنجره تاریخ کنکور"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              پیش‌فرض ۱۱ تیر ۱۴۰۶ است؛ هر زمان تاریخ رسمی اعلام شد می‌توانید اینجا تغییر دهید.
            </p>

            <div className="grid grid-cols-3 gap-2" dir="ltr">
              <div>
                <label htmlFor="exam-year" className="block text-[11px] text-slate-500 dark:text-slate-400 text-center mb-1">
                  سال
                </label>
                <input
                  id="exam-year"
                  type="text"
                  inputMode="numeric"
                  value={y}
                  onChange={(e) => setY(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label htmlFor="exam-month" className="block text-[11px] text-slate-500 dark:text-slate-400 text-center mb-1">
                  ماه
                </label>
                <input
                  id="exam-month"
                  type="text"
                  inputMode="numeric"
                  value={m}
                  onChange={(e) => setM(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label htmlFor="exam-day" className="block text-[11px] text-slate-500 dark:text-slate-400 text-center mb-1">
                  روز
                </label>
                <input
                  id="exam-day"
                  type="text"
                  inputMode="numeric"
                  value={d}
                  onChange={(e) => setD(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                ذخیره تاریخ
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
