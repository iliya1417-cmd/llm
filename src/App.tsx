import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { AnalysisTab } from './components/AnalysisTab';
import { BackupSecurityModal } from './components/BackupSecurityModal';
import { ConfirmModal, type ConfirmState } from './components/ConfirmModal';
import { DailyLogTab } from './components/DailyLogTab';
import { ExamDateModal } from './components/ExamDateModal';
import { HistoryTab } from './components/HistoryTab';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SyllabusTab } from './components/SyllabusTab';
import { TopBar } from './components/TopBar';
import { WeekNavigator } from './components/WeekNavigator';
import { WeeklyReportTab } from './components/WeeklyReportTab';
import { DAYS } from './constants/studyData';
import type { AllWeeks, AppSettings, DayEntry, SyllabusData, TabId } from './types/study';
import { dayHasData, dueReviews, overallProgress } from './utils/analytics';
import { addDays, dateFromKey, keyFromDate, todayKey, todayWeekKey, weekRangeLabel } from './utils/dateAndFormat';
import {
  loadAllFromStorage,
  saveSettingsToStorage,
  saveSyllabusToStorage,
  saveThemeToStorage,
  saveWeeksToStorage,
  type ParsedBackupResult,
} from './utils/securityAndStorage';

export default function App() {
  const initial = useMemo(() => loadAllFromStorage(), []);

  const [allWeeks, setAllWeeks] = useState<AllWeeks>(initial.weeks);
  const [syllabus, setSyllabus] = useState<SyllabusData>(initial.syllabus);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [theme, setTheme] = useState<'light' | 'dark'>(initial.theme);

  const [currentWeekKey, setCurrentWeekKey] = useState<string>(() => todayWeekKey());
  const [activeDay, setActiveDay] = useState<string>(() => DAYS[(new Date().getDay() + 1) % 7]);
  const [activeTab, setActiveTab] = useState<TabId>('daily');

  const [saveStatusText, setSaveStatusText] = useState('ذخیره‌سازی خودکار فعال است');
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [examModalOpen, setExamModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
  });

  const weeksRef = useRef(allWeeks);
  weeksRef.current = allWeeks;
  const saveTimerRef = useRef<number | null>(null);

  // Sync dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveThemeToStorage(theme);
  }, [theme]);

  // Flush pending weeks save on page hide/unload
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveWeeksToStorage(weeksRef.current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2400);
  }, []);

  const applyWeeksUpdate = useCallback(
    (nextWeeks: AllWeeks, immediate = false) => {
      setAllWeeks(nextWeeks);
      weeksRef.current = nextWeeks;
      setSaveStatusText('در حال ذخیره...');

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const commit = () => {
        const ok = saveWeeksToStorage(weeksRef.current);
        const t = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        setSaveStatusText(ok ? `ذخیره شد (${t})` : 'خطا در فضای ذخیره‌سازی مرورگر');
      };

      if (immediate) {
        commit();
      } else {
        saveTimerRef.current = window.setTimeout(commit, 400);
      }
    },
    [],
  );

  const updateDay = useCallback(
    (dayName: string, entry: DayEntry, immediate = false) => {
      const current = weeksRef.current;
      const nextWeeks: AllWeeks = { ...current };
      const weekCopy = { ...(nextWeeks[currentWeekKey] || {}) };
      if (dayHasData(entry)) {
        weekCopy[dayName] = entry;
      } else {
        delete weekCopy[dayName];
      }
      if (Object.keys(weekCopy).length > 0) {
        nextWeeks[currentWeekKey] = weekCopy;
      } else {
        delete nextWeeks[currentWeekKey];
      }
      applyWeeksUpdate(nextWeeks, immediate);
    },
    [currentWeekKey, applyWeeksUpdate],
  );

  const handleExplicitSave = useCallback(
    (dayName: string, entry: DayEntry) => {
      updateDay(dayName, entry, true);
      showToast(`اطلاعات روز ${dayName} با موفقیت ذخیره شد.`);
    },
    [updateDay, showToast],
  );

  const handleRequestClearDay = useCallback(
    (dayName: string) => {
      setConfirmState({
        open: true,
        title: `پاک کردن روز ${dayName}`,
        message: `آیا از پاک کردن کامل اطلاعات روز ${dayName} مطمئن هستید؟`,
        confirmLabel: 'پاک کردن روز',
        variant: 'danger',
        onConfirm: () => {
          updateDay(dayName, { sleep: 0, phone: 0, rest: 0, sessions: [] }, true);
          showToast(`اطلاعات روز ${dayName} پاک شد.`);
        },
      });
    },
    [updateDay, showToast],
  );

  const handleRequestDeleteWeek = useCallback(() => {
    setConfirmState({
      open: true,
      title: 'حذف اطلاعات هفته',
      message: `همه اطلاعات هفته ${weekRangeLabel(currentWeekKey)} پاک شود؟ هفته‌های دیگر دست نخورده باقی می‌مانند.`,
      confirmLabel: 'حذف هفته',
      variant: 'danger',
      onConfirm: () => {
        const nextWeeks = { ...weeksRef.current };
        delete nextWeeks[currentWeekKey];
        applyWeeksUpdate(nextWeeks, true);
        showToast('اطلاعات این هفته حذف شد.');
      },
    });
  }, [currentWeekKey, applyWeeksUpdate, showToast]);

  const handleInlineUpdateDayField = useCallback(
    (dayName: string, field: 'sleep' | 'phone' | 'rest', hours: number) => {
      const w = weeksRef.current[currentWeekKey] || {};
      const existing = w[dayName] || { sleep: 0, phone: 0, rest: 0, sessions: [] };
      const updated: DayEntry = { ...existing, [field]: hours };
      updateDay(dayName, updated, true);
      showToast(`روز ${dayName} به‌روزرسانی شد.`);
    },
    [currentWeekKey, updateDay, showToast],
  );

  const handleUpdateSyllabus = useCallback((next: SyllabusData) => {
    setSyllabus(next);
    saveSyllabusToStorage(next);
  }, []);

  const handleUpdateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettingsToStorage(next);
  }, []);

  const handleApplyRestore = useCallback(
    (result: ParsedBackupResult, mode: 'merge' | 'replace') => {
      const nextWeeks =
        mode === 'replace'
          ? result.weeks
          : { ...weeksRef.current, ...result.weeks };
      applyWeeksUpdate(nextWeeks, true);

      if (result.syllabus) {
        handleUpdateSyllabus(result.syllabus);
      }
      if (result.settings) {
        handleUpdateSettings(result.settings);
      }
      setRestoreVersion((v) => v + 1);
      showToast('بازیابی فایل پشتیبان با موفقیت انجام شد.');
    },
    [applyWeeksUpdate, handleUpdateSyllabus, handleUpdateSettings, showToast],
  );

  const changeWeek = (delta: number) => {
    const nextKey = keyFromDate(addDays(dateFromKey(currentWeekKey), delta * 7));
    setCurrentWeekKey(nextKey);
    setActiveDay(nextKey === todayWeekKey() ? DAYS[(new Date().getDay() + 1) % 7] : 'شنبه');
  };

  const goToCurrentWeek = () => {
    setCurrentWeekKey(todayWeekKey());
    setActiveDay(DAYS[(new Date().getDay() + 1) % 7]);
  };

  const openWeek = (weekKey: string) => {
    setCurrentWeekKey(weekKey);
    setActiveDay('شنبه');
    setActiveTab('weekly');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToDay = (dayName: string) => {
    setActiveDay(dayName);
    setActiveTab('daily');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progressPct = useMemo(() => overallProgress(syllabus), [syllabus]);
  const due = useMemo(() => dueReviews(syllabus, todayKey()), [syllabus]);
  const overdueCount = useMemo(() => {
    const t = todayKey();
    return due.filter((x) => (x.c.due || '') < t).length;
  }, [due]);

  const currentWeekData = allWeeks[currentWeekKey] || {};

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-12 transition-colors">
        <TopBar
          activeTab={activeTab}
          onSwitchTab={setActiveTab}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          exam={settings.exam}
          onOpenExamModal={() => setExamModalOpen(true)}
          onOpenBackupModal={() => setBackupModalOpen(true)}
          progressPct={progressPct}
          dueCount={due.length}
          overdueCount={overdueCount}
        />

        <main className="mx-auto max-w-7xl px-4 md:px-6 pt-4 space-y-4">
          {activeTab !== 'history' && activeTab !== 'syllabus' && (
            <WeekNavigator
              currentWeekKey={currentWeekKey}
              allWeeks={allWeeks}
              onChangeWeek={changeWeek}
              onGoToCurrentWeek={goToCurrentWeek}
            />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'daily' && (
                <DailyLogTab
                  key={restoreVersion}
                  currentWeekKey={currentWeekKey}
                  activeDay={activeDay}
                  weekData={currentWeekData}
                  syllabus={syllabus}
                  saveStatusText={saveStatusText}
                  onSelectDay={setActiveDay}
                  onUpdateDay={(d, entry) => updateDay(d, entry, false)}
                  onExplicitSave={handleExplicitSave}
                  onRequestClearDay={handleRequestClearDay}
                  onToast={showToast}
                />
              )}

              {activeTab === 'weekly' && (
                <WeeklyReportTab
                  currentWeekKey={currentWeekKey}
                  allWeeks={allWeeks}
                  weekData={currentWeekData}
                  syllabus={syllabus}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onInlineUpdateDayField={handleInlineUpdateDayField}
                  onGoToDay={goToDay}
                  onRequestDeleteWeek={handleRequestDeleteWeek}
                />
              )}

              {activeTab === 'analysis' && (
                <AnalysisTab
                  currentWeekKey={currentWeekKey}
                  allWeeks={allWeeks}
                  syllabus={syllabus}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onGoToDay={goToDay}
                  onOpenWeek={openWeek}
                />
              )}

              {activeTab === 'syllabus' && (
                <SyllabusTab
                  allWeeks={allWeeks}
                  syllabus={syllabus}
                  settings={settings}
                  onUpdateSyllabus={handleUpdateSyllabus}
                  onUpdateSettings={handleUpdateSettings}
                  onRequestConfirm={(opts) =>
                    setConfirmState({
                      open: true,
                      title: opts.title,
                      message: opts.message,
                      confirmLabel: opts.confirmLabel,
                      variant: opts.variant,
                      onConfirm: opts.onConfirm,
                    })
                  }
                  onToast={showToast}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  allWeeks={allWeeks}
                  onOpenWeek={openWeek}
                  onOpenBackupModal={() => setBackupModalOpen(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Modals */}
        <ConfirmModal
          state={confirmState}
          onClose={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        />

        <ExamDateModal
          open={examModalOpen}
          exam={settings.exam}
          onClose={() => setExamModalOpen(false)}
          onSave={(newExam) => {
            handleUpdateSettings({ ...settings, exam: newExam });
            showToast('تاریخ کنکور به‌روزرسانی شد.');
          }}
        />

        <BackupSecurityModal
          open={backupModalOpen}
          weeks={allWeeks}
          syllabus={syllabus}
          settings={settings}
          onClose={() => setBackupModalOpen(false)}
          onApplyRestore={handleApplyRestore}
          onToast={showToast}
        />

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              role="status"
              aria-live="polite"
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700 px-4 py-2.5 text-xs font-bold text-white shadow-xl pointer-events-none no-print"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{toastMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
