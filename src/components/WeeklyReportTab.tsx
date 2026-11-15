import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Brain,
  Inbox,
  Printer,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { DAYS, NORM, SPECIAL, WK_DEF, WK_HIDE_DEF, WK_SECS } from '../constants/studyData';
import type { AllWeeks, AppSettings, DayStats, SyllabusData, WeekData, WeeklyTableSettings } from '../types/study';
import { buildAdvisorInsights, computeWeekStats, loggedDays, statusOf } from '../utils/analytics';
import { dayDate, fa, fmtMin, int, keyFromDate, num, shamsi, toEnDigits, weekRangeLabel } from '../utils/dateAndFormat';

interface WeeklyReportTabProps {
  currentWeekKey: string;
  allWeeks: AllWeeks;
  weekData: WeekData;
  syllabus: SyllabusData;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onInlineUpdateDayField: (dayName: string, field: 'sleep' | 'phone' | 'rest', hours: number) => void;
  onGoToDay: (dayName: string) => void;
  onRequestDeleteWeek: () => void;
}

type CfgKey = 'days' | 'cols' | 'rows';

const EDITABLE_DAY_COLS = new Set(['sleep', 'phone', 'rest']);

export function WeeklyReportTab({
  currentWeekKey,
  allWeeks,
  weekData,
  syllabus,
  settings,
  onUpdateSettings,
  onInlineUpdateDayField,
  onGoToDay,
  onRequestDeleteWeek,
}: WeeklyReportTabProps) {
  const [openCfg, setOpenCfg] = useState<'days' | 'sub' | null>(null);
  const [editingCell, setEditingCell] = useState<{ day: string; field: 'sleep' | 'phone' | 'rest'; value: string } | null>(null);

  const st = useMemo(() => computeWeekStats(weekData), [weekData]);
  const logged = useMemo(() => loggedDays(weekData), [weekData]);
  const ed = Math.max(1, logged);
  const hasData = logged > 0;
  const totalH = st.totalMin / 60;

  const getWkCfg = (n: CfgKey) => {
    const existing = settings.wk?.[n];
    const baseOrder = existing?.order ? [...existing.order] : WK_DEF[n].map((x) => x.k);
    WK_DEF[n].forEach((x) => {
      if (!baseOrder.includes(x.k)) baseOrder.push(x.k);
    });
    const hidden = existing?.hidden ? [...existing.hidden] : [...WK_HIDE_DEF[n]];
    return { order: baseOrder, hidden };
  };

  const updateWk = (patch: Partial<WeeklyTableSettings>) => {
    onUpdateSettings({
      ...settings,
      wk: {
        ...(settings.wk || {}),
        ...patch,
      },
    });
  };

  const getItems = (n: CfgKey) => {
    const cfg = getWkCfg(n);
    return cfg.order.map((k) => WK_DEF[n].find((x) => x.k === k)).filter((x): x is { k: string; l: string } => Boolean(x));
  };

  const getVisible = (n: CfgKey) => {
    const cfg = getWkCfg(n);
    return getItems(n).filter((x) => !cfg.hidden.includes(x.k));
  };

  const moveItem = (n: CfgKey, k: string, dir: -1 | 1) => {
    const cfg = getWkCfg(n);
    const idx = cfg.order.indexOf(k);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= cfg.order.length) return;
    const nextOrder = [...cfg.order];
    [nextOrder[idx], nextOrder[target]] = [nextOrder[target], nextOrder[idx]];
    updateWk({ [n]: { ...cfg, order: nextOrder } });
  };

  const toggleItem = (n: CfgKey, k: string) => {
    const cfg = getWkCfg(n);
    const hidden = cfg.hidden.includes(k) ? cfg.hidden.filter((x) => x !== k) : [...cfg.hidden, k];
    updateWk({ [n]: { ...cfg, hidden } });
  };

  const resetCfg = (n: CfgKey) => {
    const nextWk = { ...(settings.wk || {}) };
    delete nextWk[n];
    onUpdateSettings({ ...settings, wk: nextWk });
  };

  const hiddenSecs = settings.wk?.hideSec || [];
  const hideSec = (sec: string) => {
    if (hiddenSecs.includes(sec)) return;
    updateWk({ hideSec: [...hiddenSecs, sec] });
  };
  const showSec = (sec: string) => {
    updateWk({ hideSec: hiddenSecs.filter((x) => x !== sec) });
  };

  const renderCfgPanel = (n: CfgKey, title: string) => {
    const cfg = getWkCfg(n);
    const items = getItems(n);
    return (
      <div className="flex-1 min-w-[220px]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{title}</span>
          <button
            type="button"
            onClick={() => resetCfg(n)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <RotateCcw className="h-3 w-3" />
            <span>پیش‌فرض</span>
          </button>
        </div>
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {items.map((x, i) => {
            const isHidden = cfg.hidden.includes(x.k);
            return (
              <div
                key={x.k}
                className={`flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900 ${
                  isHidden ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleItem(n, x.k)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                <span className={`flex-1 text-xs ${isHidden ? 'line-through' : ''}`}>{x.l}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveItem(n, x.k, -1)}
                  aria-label={`انتقال ${x.l} به بالا`}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={i === items.length - 1}
                  onClick={() => moveItem(n, x.k, 1)}
                  aria-label={`انتقال ${x.l} به پایین`}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const commitInlineEdit = () => {
    if (!editingCell) return;
    const raw = toEnDigits(editingCell.value).trim();
    let hours = 0;
    if (raw.includes(':')) {
      const [a, b] = raw.split(':');
      const hPart = Math.max(0, Math.min(24, int(a)));
      const mPart = Math.max(0, Math.min(59, int(b)));
      hours = hPart + mPart / 60;
    } else {
      hours = num(raw);
    }
    hours = Number.isFinite(hours) ? Math.max(0, Math.min(24, hours)) : 0;
    onInlineUpdateDayField(editingCell.day, editingCell.field, +hours.toFixed(3));
    setEditingCell(null);
  };

  const filmShare = st.totalMin ? (st.filmMin / st.totalMin) * 100 : 0;
  const practiceH = st.practiceMin / 60;
  const testPace = practiceH > 0 ? +((st.solo + st.exam) / practiceH).toFixed(1) : 0;
  const avgSleep = st.sleepDays ? st.sleep / st.sleepDays : 0;

  const insights = useMemo(
    () => (hasData ? buildAdvisorInsights(allWeeks, syllabus, currentWeekKey) : []),
    [hasData, allWeeks, syllabus, currentWeekKey],
  );

  const splitRows = Object.entries(NORM.split).map(([s, target]) => {
    const share = st.specialMin ? ((st.subjects[s]?.minutes || 0) / st.specialMin) * 100 : 0;
    const tol = Math.max(3, target * 0.2);
    return {
      s,
      share,
      target,
      stt: st.specialMin ? statusOf(share, target - tol, target + tol) : ('none' as const),
    };
  });

  const dayColumns = getVisible('days');
  const todayStr = keyFromDate(new Date());

  const dayGetters: Record<string, { val: (x: DayStats) => number; fmt: (v: number) => string; cls: string }> = {
    study: { val: (x) => x.sess + x.cardFilm, fmt: (v) => fmtMin(v, true), cls: 'font-bold text-emerald-700 dark:text-emerald-400' },
    film: { val: (x) => x.sessFilm + x.cardFilm, fmt: (v) => fmtMin(v, true), cls: 'font-semibold text-violet-600 dark:text-violet-400' },
    practice: { val: (x) => x.practice, fmt: (v) => fmtMin(v, true), cls: 'font-semibold text-sky-700 dark:text-sky-400' },
    tests: { val: (x) => x.tests, fmt: (v) => fa(v), cls: 'font-black text-blue-600 dark:text-blue-400' },
    sleep: { val: (x) => x.sleep, fmt: (v) => fmtMin(v * 60, true), cls: 'text-slate-600 dark:text-slate-300' },
    phone: { val: (x) => x.phone, fmt: (v) => fmtMin(v * 60, true), cls: 'text-rose-600 dark:text-rose-400' },
    rest: { val: (x) => x.rest, fmt: (v) => fmtMin(v * 60, true), cls: 'text-slate-500 dark:text-slate-400' },
  };

  const maxDayStudy = Math.max(NORM.day[1] * 60, ...DAYS.map((d) => dayGetters.study.val(st.days[d])));
  const daySums: Record<string, number> = {};
  DAYS.forEach((d) => {
    dayColumns.forEach((c) => {
      daySums[c.k] = (daySums[c.k] || 0) + dayGetters[c.k].val(st.days[d]);
    });
  });

  const subCols = getVisible('cols');
  const subRows = getVisible('rows');

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
              کارنامه هفته {weekRangeLabel(currentWeekKey)}
            </h2>
            {hasData && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {fa(logged)} روز از ۷ روز ثبت شده · میانگین‌ها بر اساس روزهای ثبت‌شده محاسبه می‌شوند
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 no-print">
            {hasData && (
              <button
                type="button"
                onClick={onRequestDeleteWeek}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/70 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف این هفته</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>چاپ / PDF</span>
            </button>
          </div>
        </div>

        {hasData && hiddenSecs.length > 0 && (
          <div className="no-print flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs text-slate-500 dark:text-slate-400">
            <span>بخش‌های پنهان:</span>
            {hiddenSecs.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => showSec(sec)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                {WK_SECS[sec] || sec} +
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!hasData && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
            هنوز برای این هفته اطلاعاتی ثبت نشده است
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            پس از ثبت اولین روز در بخش ثبت روزانه، کارنامه کامل هفته اینجا نمایش داده می‌شود.
          </p>
          <button
            type="button"
            onClick={() => onGoToDay('شنبه')}
            className="no-print mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white transition-colors"
          >
            رفتن به ثبت روزانه
          </button>
        </div>
      )}

      {/* Main Weekly Body */}
      {hasData && (
        <div className="space-y-4">
          {/* 5 KPI Cards */}
          {!hiddenSecs.includes('stats') && (
            <div className="relative print-card">
              <button
                type="button"
                onClick={() => hideSec('stats')}
                aria-label="پنهان کردن کارت‌های آمار"
                className="no-print absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-600 shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">مطالعه کل</div>
                  <div className="mt-1 text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {st.totalMin ? fmtMin(st.totalMin, true) : '۰'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {st.totalMin ? `میانگین: ${fmtMin(st.totalMin / ed, true)}` : 'ثبت نشده'}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">آموزش و فیلم</div>
                  <div className="mt-1 text-lg md:text-xl font-black text-violet-600 dark:text-violet-400 tabular-nums">
                    {st.filmMin ? fmtMin(st.filmMin, true) : '۰'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {st.filmMin
                      ? `آموزش ${fa(Math.round(filmShare))}٪ · تمرین ${fa(100 - Math.round(filmShare))}٪`
                      : 'ثبت نشده'}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">تعداد تست</div>
                  <div className="mt-1 text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    {fa(st.tests)} تست
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {st.tests
                      ? (st.solo + st.exam) && practiceH
                        ? `${fa(testPace)} تست در ساعت تمرین`
                        : `${fa(st.tests)} تست ثبت‌شده`
                      : 'تستی ثبت نشده'}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">گوشی و مجازی</div>
                  <div className="mt-1 text-lg md:text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {st.phone ? fmtMin(st.phone * 60, true) : '۰'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {st.phone ? `میانگین: ${fmtMin((st.phone / ed) * 60, true)}` : 'ثبت نشده'}
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">میانگین خواب</div>
                  <div className="mt-1 text-lg md:text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {avgSleep ? fmtMin(avgSleep * 60, true) : '-'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {!st.sleepDays
                      ? 'ثبت نشده'
                      : statusOf(avgSleep, ...NORM.sleep) === 'ok'
                      ? 'در بازه سالم ۶ تا ۸ ساعت'
                      : 'خارج از بازه ۶ تا ۸ ساعت'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advisor Insights */}
          {!hiddenSecs.includes('insights') && (
            <section className="print-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">تحلیل مشاوره‌ای هفته</h3>
                </div>
                <button
                  type="button"
                  onClick={() => hideSec('insights')}
                  aria-label="پنهان کردن تحلیل هفته"
                  className="no-print rounded-lg p-1 text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {insights.map((item, idx) => {
                  const toneCls =
                    item.tone === 'positive'
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                      : item.tone === 'warning'
                      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
                      : item.tone === 'danger'
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200';
                  return (
                    <motion.div
                      key={`${item.title}-${idx}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${toneCls}`}
                    >
                      <span className="font-bold">{item.title}: </span>
                      <span>{item.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Day-by-Day Table */}
          {!hiddenSecs.includes('days') && (
            <section className="print-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">گزارش روز به روز</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400 no-print">
                    کلیک روی نام روز برای باز کردن ثبت روزانه · کلیک روی خواب، گوشی یا استراحت برای ویرایش سریع
                  </p>
                </div>
                <div className="flex items-center gap-1.5 no-print">
                  <button
                    type="button"
                    onClick={() => setOpenCfg(openCfg === 'days' ? null : 'days')}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>ستون‌ها</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => hideSec('days')}
                    aria-label="پنهان کردن جدول روز به روز"
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {openCfg === 'days' && (
                <div className="no-print mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 flex flex-wrap gap-3">
                  {renderCfgPanel('days', 'ستون‌های جدول روزانه (تیک = نمایش)')}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-center text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-2 text-right font-bold">روز</th>
                      {dayColumns.map((c) => (
                        <th key={c.k} className={`py-2.5 px-2 font-bold ${c.k === 'study' ? 'w-[30%]' : ''}`}>
                          {c.l}
                          {EDITABLE_DAY_COLS.has(c.k) && (
                            <span className="no-print mr-1 text-[10px] font-normal text-slate-400">(ویرایش)</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {dayColumns.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-xs text-slate-400">
                          همه ستون‌ها پنهان شده‌اند؛ از دکمه ستون‌ها برگردانید.
                        </td>
                      </tr>
                    ) : (
                      DAYS.map((d, idx) => {
                        const x = st.days[d];
                        const dt = dayDate(currentWeekKey, idx);
                        const isToday = keyFromDate(dt) === todayStr;

                        return (
                          <tr
                            key={d}
                            className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                              isToday ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onGoToDay(d)}
                                className="text-right hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              >
                                <span className="font-bold text-slate-800 dark:text-slate-100">{d}</span>
                                <span className="mr-1.5 text-[11px] text-slate-400">
                                  {shamsi(dt, { day: 'numeric', month: 'long' })}
                                </span>
                                {isToday && (
                                  <span className="mr-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    · امروز
                                  </span>
                                )}
                              </button>
                            </td>

                            {dayColumns.map((c) => {
                              const g = dayGetters[c.k];
                              const v = g.val(x);
                              const isEditable = EDITABLE_DAY_COLS.has(c.k);
                              const isEditing =
                                editingCell?.day === d && editingCell?.field === c.k;

                              if (isEditable && isEditing) {
                                return (
                                  <td key={c.k} className="py-1.5 px-2">
                                    <input
                                      autoFocus
                                      dir="ltr"
                                      value={editingCell.value}
                                      onChange={(e) =>
                                        setEditingCell({ ...editingCell, value: e.target.value })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitInlineEdit();
                                        if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                      onBlur={commitInlineEdit}
                                      placeholder="7:30"
                                      className="w-16 rounded-lg border border-emerald-500 bg-white dark:bg-slate-950 px-1.5 py-1 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
                                    />
                                  </td>
                                );
                              }

                              if (c.k === 'study') {
                                const widthPct = v > 0 ? Math.max(3, Math.round((v / maxDayStudy) * 100)) : 0;
                                const okDay = v / 60 >= NORM.day[0];
                                return (
                                  <td
                                    key={c.k}
                                    onClick={() => onGoToDay(d)}
                                    className="py-2.5 px-2 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex justify-start">
                                        <div
                                          className={`h-full rounded-full ${
                                            okDay ? 'bg-emerald-500' : 'bg-emerald-400/80'
                                          }`}
                                          style={{ width: `${widthPct}%` }}
                                        />
                                      </div>
                                      <span className="w-[76px] text-left text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                                        {v > 0 ? g.fmt(v) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                                      </span>
                                    </div>
                                  </td>
                                );
                              }

                              const sleepWarn = c.k === 'sleep' && v > 0 && statusOf(v, ...NORM.sleep) !== 'ok';

                              return (
                                <td
                                  key={c.k}
                                  onClick={() => {
                                    if (isEditable) {
                                      const mm = Math.round(v * 60);
                                      setEditingCell({
                                        day: d,
                                        field: c.k as 'sleep' | 'phone' | 'rest',
                                        value: mm ? `${Math.floor(mm / 60)}:${String(mm % 60).padStart(2, '0')}` : '',
                                      });
                                    } else {
                                      onGoToDay(d);
                                    }
                                  }}
                                  className={`py-2.5 px-2 cursor-pointer tabular-nums ${
                                    isEditable ? 'hover:bg-amber-50 dark:hover:bg-amber-950/30' : ''
                                  } ${sleepWarn ? 'font-bold text-amber-600 dark:text-amber-400' : g.cls}`}
                                >
                                  {v > 0 ? g.fmt(v) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {dayColumns.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40">
                        <td className="pt-3 pb-1 px-2 text-right font-black text-slate-800 dark:text-slate-100">مجموع</td>
                        {dayColumns.map((c) => (
                          <td
                            key={c.k}
                            className={`pt-3 pb-1 px-2 text-sm font-black tabular-nums ${dayGetters[c.k].cls}`}
                          >
                            {daySums[c.k] > 0 ? dayGetters[c.k].fmt(daySums[c.k]) : '-'}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-50/70 dark:bg-slate-950/40">
                        <td className="pb-3 pt-1 px-2 text-right text-[11px] text-slate-500 dark:text-slate-400">
                          میانگین روزانه
                        </td>
                        {dayColumns.map((c) => {
                          const avgVal =
                            c.k === 'sleep'
                              ? st.sleepDays
                                ? daySums.sleep / st.sleepDays
                                : 0
                              : daySums[c.k] / ed;
                          return (
                            <td
                              key={c.k}
                              className="pb-3 pt-1 px-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
                            >
                              {avgVal > 0
                                ? c.k === 'tests'
                                  ? fa(Math.round(avgVal))
                                  : dayGetters[c.k].fmt(avgVal)
                                : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          )}

          {/* Subject Breakdown Table */}
          {!hiddenSecs.includes('subjects') && (
            <section className="print-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">تفکیک درس‌ها</h3>
                <div className="flex items-center gap-1.5 no-print">
                  <button
                    type="button"
                    onClick={() => setOpenCfg(openCfg === 'sub' ? null : 'sub')}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>ستون‌ها و درس‌ها</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => hideSec('subjects')}
                    aria-label="پنهان کردن تفکیک درس‌ها"
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {openCfg === 'sub' && (
                <div className="no-print mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 flex flex-wrap gap-4">
                  {renderCfgPanel('cols', 'ستون‌ها')}
                  {renderCfgPanel('rows', 'درس‌ها')}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-center text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300">
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-bold">درس</th>
                      {subCols.map((c) => (
                        <th
                          key={c.k}
                          className={`p-2.5 border border-slate-200 dark:border-slate-800 font-bold ${
                            c.k === 'fp' ? 'w-1/4' : ''
                          }`}
                        >
                          {c.l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subRows.map((row) => {
                      const it = st.subjects[row.k] || {
                        minutes: 0,
                        film: 0,
                        practice: 0,
                        tests: 0,
                        solo: 0,
                        video: 0,
                        exam: 0,
                      };
                      const activeRow = it.minutes > 0 || it.tests > 0;

                      return (
                        <tr
                          key={row.k}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                            activeRow ? '' : 'opacity-45'
                          }`}
                        >
                          <td className="p-2 border border-slate-200 dark:border-slate-800 text-right font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {row.k}
                          </td>
                          {subCols.map((c) => {
                            const sp = splitRows.find((r) => r.s === row.k);
                            const dash = <span className="text-slate-300 dark:text-slate-700">-</span>;

                            if (c.k === 'time') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  {it.minutes > 0 ? fmtMin(it.minutes, true) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'fp') {
                              const t = it.film + it.practice;
                              if (!t) {
                                return <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800">{dash}</td>;
                              }
                              const fp = Math.round((it.film / t) * 100);
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800">
                                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                    <div className="bg-violet-500" style={{ width: `${fp}%` }} />
                                    <div
                                      className={100 - fp >= 60 ? 'bg-emerald-500' : 'bg-amber-400'}
                                      style={{ width: `${100 - fp}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                    آموزش {fa(fp)}٪ · تمرین {fa(100 - fp)}٪
                                  </div>
                                </td>
                              );
                            }
                            if (c.k === 'film') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-violet-400 tabular-nums">
                                  {it.film > 0 ? fmtMin(it.film, true) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'practice') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-sky-700 dark:text-sky-400 tabular-nums">
                                  {it.practice > 0 ? fmtMin(it.practice, true) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'tests') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                                  {it.tests > 0 ? fa(it.tests) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'solo') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                                  {it.solo > 0 ? fa(it.solo) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'video') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-violet-400 tabular-nums">
                                  {it.video > 0 ? fa(it.video) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'exam') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 tabular-nums">
                                  {it.exam > 0 ? fa(it.exam) : dash}
                                </td>
                              );
                            }
                            if (c.k === 'share') {
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                                  {st.studyMin && it.minutes ? `${fa(Math.round((it.minutes / st.studyMin) * 100))}٪` : dash}
                                </td>
                              );
                            }
                            if (c.k === 'target') {
                              if (!sp) {
                                return (
                                  <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700">
                                    ·
                                  </td>
                                );
                              }
                              const clr =
                                sp.stt === 'ok'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : sp.stt === 'low'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : sp.stt === 'high'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500';
                              return (
                                <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 whitespace-nowrap tabular-nums">
                                  <strong className={clr}>{fa(Math.round(sp.share))}٪</strong>
                                  <span className="text-[11px] text-slate-400"> / {fa(Math.round(sp.target))}٪</span>
                                </td>
                              );
                            }
                            return <td key={c.k} className="border border-slate-200 dark:border-slate-800" />;
                          })}
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr className="bg-slate-100 dark:bg-slate-800/70 font-black">
                      <td className="p-2 border border-slate-200 dark:border-slate-800 text-right text-slate-800 dark:text-slate-100">
                        جمع کل
                      </td>
                      {subCols.map((c) => {
                        const dash = <span className="text-slate-400">-</span>;
                        if (c.k === 'time') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {st.studyMin ? fmtMin(st.studyMin, true) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'fp') {
                          const t = st.sessFilm + st.practiceMin;
                          if (!t) return <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800">{dash}</td>;
                          const fp = Math.round((st.sessFilm / t) * 100);
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                              آموزش {fa(fp)}٪ · تمرین {fa(100 - fp)}٪
                            </td>
                          );
                        }
                        if (c.k === 'film') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-violet-400 tabular-nums">
                              {st.sessFilm ? fmtMin(st.sessFilm, true) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'practice') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-sky-700 dark:text-sky-400 tabular-nums">
                              {st.practiceMin ? fmtMin(st.practiceMin, true) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'tests') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-blue-700 dark:text-blue-400 tabular-nums">
                              {st.tests ? fa(st.tests) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'solo') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                              {st.solo ? fa(st.solo) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'video') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-violet-400 tabular-nums">
                              {st.video ? fa(st.video) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'exam') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 tabular-nums">
                              {st.exam ? fa(st.exam) : dash}
                            </td>
                          );
                        }
                        if (c.k === 'share') {
                          return (
                            <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                              ۱۰۰٪
                            </td>
                          );
                        }
                        return <td key={c.k} className="p-2 border border-slate-200 dark:border-slate-800" />;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                «آموزش» شامل درسنامه، کلاس/فیلم و تست همراه فیلم است · «تمرین» شامل تست شخصی، آزمون و مرور.{' '}
                {SPECIAL.length > 0 && 'هدف اختصاصی بر اساس الگوی عددبازی نمایش داده شده است.'}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
