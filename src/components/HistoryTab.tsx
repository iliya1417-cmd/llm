import { useMemo } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import type { AllWeeks, WeekStats } from '../types/study';
import { computeWeekStats, hasWeekData, loggedDays } from '../utils/analytics';
import { addDays, dateFromKey, fa, fmtMin, keyFromDate, todayWeekKey, weekRangeLabel } from '../utils/dateAndFormat';

interface HistoryTabProps {
  allWeeks: AllWeeks;
  onOpenWeek: (weekKey: string) => void;
  onOpenBackupModal: () => void;
}

export function HistoryTab({ allWeeks, onOpenWeek, onOpenBackupModal }: HistoryTabProps) {
  const { stats, statsMap, totalMin, totalTests, best, avgWeek, maxMin } = useMemo(() => {
    const keys = Object.keys(allWeeks)
      .filter((k) => hasWeekData(allWeeks[k]))
      .sort();
    const list = keys.map((k) => ({ key: k, st: computeWeekStats(allWeeks[k]) }));
    const map = new Map<string, WeekStats>();
    let tMin = 0;
    let tTests = 0;
    let maxM = 1;
    let top: { key: string; st: WeekStats } | null = null;
    for (const item of list) {
      map.set(item.key, item.st);
      tMin += item.st.totalMin;
      tTests += item.st.tests;
      if (item.st.totalMin > maxM) maxM = item.st.totalMin;
      if (!top || item.st.totalMin > top.st.totalMin) top = item;
    }
    return {
      stats: list,
      statsMap: map,
      totalMin: tMin,
      totalTests: tTests,
      best: top,
      avgWeek: list.length ? tMin / list.length : 0,
      maxMin: maxM,
    };
  }, [allWeeks]);
  const curWeekKey = todayWeekKey();

  const summaryCards = [
    { title: 'تعداد هفته‌های ثبت‌شده', val: `${fa(stats.length)} هفته`, sub: 'از شروع ثبت', clr: 'text-slate-900 dark:text-slate-100' },
    { title: 'مجموع کل مطالعه', val: totalMin ? fmtMin(totalMin, true) : '۰', sub: `${fa(totalTests)} تست در کل`, clr: 'text-emerald-600 dark:text-emerald-400' },
    { title: 'میانگین هر هفته', val: avgWeek ? fmtMin(avgWeek, true) : '۰', sub: 'مطالعه در هفته', clr: 'text-blue-600 dark:text-blue-400' },
    { title: 'بهترین هفته', val: best && best.st.totalMin ? fmtMin(best.st.totalMin, true) : '-', sub: best ? weekRangeLabel(best.key) : '-', clr: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Top Action & Security Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
              آرشیو و مقایسه همه هفته‌ها
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              تمامی داده‌ها با اعتبارسنجی امن روی مرورگر شما نگهداری می‌شوند
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenBackupModal}
            className="no-print inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>خروجی رایگان (JSON / اکسل / HTML) و بازیابی</span>
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/25 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200 no-print">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            برای حفظ کامل اطلاعات هنگام پاک شدن حافظه مرورگر یا انتقال به دستگاه دیگر، هر چند وقت یک‌بار از بخش «خروجی رایگان و پشتیبان» فایل پشتیبان (با امضای SHA-256 یا رمزدار) تهیه کنید.
          </span>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.title}</div>
            <div className={`mt-1 text-base md:text-lg font-black tabular-nums ${c.clr}`}>{c.val}</div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Week-by-Week Trend Bars */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
          روند مطالعه هفته به هفته
        </h3>
        {stats.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">هنوز هیچ هفته‌ای ثبت نشده است.</div>
        ) : (
          <div className="space-y-2.5">
            {stats.map((x, idx) => {
              const w = Math.max(2, Math.round((x.st.totalMin / maxMin) * 100));
              const isCur = x.key === curWeekKey;
              return (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => onOpenWeek(x.key)}
                  className="flex w-full items-center gap-3 text-right group"
                >
                  <span className="w-36 md:w-48 shrink-0 text-xs text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {weekRangeLabel(x.key)}
                    {isCur && <strong className="mr-1 text-emerald-600 dark:text-emerald-400">(جاری)</strong>}
                  </span>
                  <div className="flex-1 h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.4, delay: idx * 0.03 }}
                      className={`h-full rounded-full transition-colors ${
                        isCur
                          ? 'bg-emerald-600 group-hover:bg-emerald-500'
                          : 'bg-emerald-400/80 dark:bg-emerald-500/70 group-hover:bg-emerald-500'
                      }`}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-left text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {fmtMin(x.st.totalMin, true)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Comparison Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">جدول مقایسه هفته‌ها</h3>
          <span className="text-[11px] text-slate-400">روی هر ردیف بزنید تا کارنامه آن هفته باز شود</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-center text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300">
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-bold">هفته</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">مجموع مطالعه</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">تغییر نسبت به هفته قبل</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">میانگین روزانه</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">تست</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">گوشی (کل)</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">میانگین خواب</th>
                <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold">درس اول هفته</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-xs text-slate-400">
                    هنوز هیچ هفته‌ای ثبت نشده است.
                  </td>
                </tr>
              ) : (
                [...stats].reverse().map(({ key, st }) => {
                  const prevKey = keyFromDate(addDays(dateFromKey(key), -7));
                  const prevSt = statsMap.get(prevKey);
                  const diff = prevSt ? st.totalMin - prevSt.totalMin : null;
                  const avgSleep = st.sleepDays ? st.sleep / st.sleepDays : 0;
                  const isCur = key === curWeekKey;

                  return (
                    <tr
                      key={key}
                      onClick={() => onOpenWeek(key)}
                      className={`cursor-pointer transition-colors hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25 ${
                        isCur ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''
                      }`}
                    >
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-bold text-slate-800 dark:text-slate-100">
                        {weekRangeLabel(key)}
                        {isCur && (
                          <span className="mr-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            (جاری)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {fmtMin(st.totalMin, true)}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 tabular-nums">
                        {diff == null ? (
                          <span className="text-slate-400">-</span>
                        ) : diff > 0 ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ▲ {fmtMin(diff, true)}
                          </span>
                        ) : diff < 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            ▼ {fmtMin(-diff, true)}
                          </span>
                        ) : (
                          <span className="text-slate-500">بدون تغییر</span>
                        )}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                        {st.totalMin ? fmtMin(st.totalMin / Math.max(1, loggedDays(allWeeks[key])), true) : '-'}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {st.tests ? fa(st.tests) : '-'}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 tabular-nums">
                        {st.phone ? fmtMin(st.phone * 60, true) : '-'}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {avgSleep ? fmtMin(avgSleep * 60, true) : '-'}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                        {st.topSubject}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
