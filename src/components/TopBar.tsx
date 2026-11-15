import { motion } from 'motion/react';
import { BookOpen, Calendar, Download, Moon, RotateCw, Sun } from 'lucide-react';
import type { TabId } from '../types/study';
import { daysBetween, fa, jalaliToGregorian, keyFromDate, shamsi, todayKey } from '../utils/dateAndFormat';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: TabId;
  onSwitchTab: (tab: TabId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  exam: [number, number, number];
  onOpenExamModal: () => void;
  onOpenBackupModal: () => void;
  progressPct: number;
  dueCount: number;
  overdueCount: number;
}

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'daily', label: 'ثبت روزانه' },
  { id: 'weekly', label: 'کارنامه هفته' },
  { id: 'analysis', label: 'تحلیل و نمودار' },
  { id: 'syllabus', label: 'مباحث و مرور' },
  { id: 'history', label: 'همه هفته‌ها' },
];

export function TopBar({
  activeTab,
  onSwitchTab,
  theme,
  onToggleTheme,
  exam,
  onOpenExamModal,
  onOpenBackupModal,
  progressPct,
  dueCount,
  overdueCount,
}: TopBarProps) {
  const now = new Date();
  const examDt = jalaliToGregorian(exam[0], exam[1], exam[2]);
  const daysLeft = daysBetween(todayKey(), keyFromDate(examDt));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 md:gap-8 px-4 md:px-6 h-14">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => onSwitchTab('daily')}
            className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 text-right"
          >
            داشبورد مطالعه کنکور
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav aria-label="ناوبری اصلی" className="hidden lg:flex items-center gap-6">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSwitchTab(t.id)}
                  className={`relative py-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{t.label}</span>
                    {t.id === 'syllabus' && dueCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-rose-600 px-1.5 text-[11px] font-bold text-white tabular-nums">
                        {fa(dueCount)}
                      </span>
                    )}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="topNavIndicator"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Offline Install */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton compact onOpenBackupModal={onOpenBackupModal} />
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenBackupModal}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 px-3 sm:px-3.5 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">خروجی رایگان و پشتیبان</span>
              <span className="sm:hidden">خروجی رایگان</span>
            </motion.button>
          </div>
        </div>

        {/* Mobile/Tablet Horizontal Navigation Strip */}
        <nav
          aria-label="ناوبری موبایل"
          className="flex lg:hidden items-center justify-between sm:justify-start gap-1 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 px-2.5 sm:px-3 py-1.5"
        >
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSwitchTab(t.id)}
                className={`relative rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{t.label}</span>
                  {t.id === 'syllabus' && dueCount > 0 && (
                    <span
                      className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded px-1 text-[10px] font-bold tabular-nums ${
                        active ? 'bg-white text-emerald-700' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {fa(dueCount)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Status & Quick Controls Strip */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 pt-4 md:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            امروز: {shamsi(now, { weekday: 'long' })}، {shamsi(now, { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2 no-print">
            <div className="sm:hidden">
              <PWAInstallButton compact onOpenBackupModal={onOpenBackupModal} />
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
              <span>{theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}</span>
            </button>
          </div>
        </div>

        {/* 3-Card Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Countdown */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.16 }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">شمارش معکوس کنکور</div>
              <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                {daysLeft > 0 ? `${fa(daysLeft)} روز` : daysLeft === 0 ? 'امروز' : 'گذشت'}
              </div>
              <button
                type="button"
                onClick={onOpenExamModal}
                className="no-print mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                {shamsi(examDt, { day: 'numeric', month: 'long', year: 'numeric' })}
                {daysLeft > 0 ? ` · ${fa(Math.floor(daysLeft / 7))} هفته` : ''} — ویرایش تاریخ
              </button>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
          </motion.div>

          {/* Syllabus Progress */}
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.16 }}
            onClick={() => onSwitchTab('syllabus')}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-right hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">پیشرفت کل مباحث</div>
                <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fa(progressPct)}٪
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </motion.button>

          {/* Today's Reviews */}
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.16 }}
            onClick={() => onSwitchTab('syllabus')}
            className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 text-right flex items-center justify-between gap-3 transition-colors ${
              overdueCount > 0
                ? 'border-rose-300 dark:border-rose-800 hover:border-rose-400'
                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-700'
            }`}
          >
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">مرورهای امروز</div>
              <div
                className={`mt-1 text-2xl font-black tabular-nums ${
                  overdueCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : dueCount > 0
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {dueCount > 0 ? `${fa(dueCount)} مبحث` : 'تکمیل'}
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {overdueCount > 0
                  ? `${fa(overdueCount)} مورد عقب‌افتاده`
                  : dueCount > 0
                  ? 'آماده مرور امروز'
                  : 'مروری برای امروز نمانده است'}
              </div>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                overdueCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
              }`}
            >
              <RotateCw className="h-5 w-5" />
            </div>
          </motion.button>
        </div>
      </div>
    </>
  );
}
