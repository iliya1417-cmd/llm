import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { DAYS, SUBJECTS, TEST_TAG, TYPES } from '../constants/studyData';
import type { DayEntry, StudySession, SyllabusData, WeekData } from '../types/study';
import { dayHasData, isFilm, sessionMinutes, testKind } from '../utils/analytics';
import { dayDate, fa, fmtClockSeconds, fmtMin, int, keyFromDate, shamsi, uid } from '../utils/dateAndFormat';

interface DailyLogTabProps {
  currentWeekKey: string;
  activeDay: string;
  weekData: WeekData;
  syllabus: SyllabusData;
  saveStatusText: string;
  onSelectDay: (dayName: string) => void;
  onUpdateDay: (dayName: string, entry: DayEntry) => void;
  onExplicitSave: (dayName: string, entry: DayEntry) => void;
  onRequestClearDay: (dayName: string) => void;
  onToast: (msg: string) => void;
}

interface RowDraft {
  uid: string;
  subject: string;
  topic: string;
  start: string;
  end: string;
  h: string;
  m: string;
  tests: string;
  testType: string;
}

interface TopicOption {
  label: string;
  group: string;
}

function toHMFields(hoursVal: number): { h: string; m: string } {
  const mins = Math.round((hoursVal || 0) * 60);
  if (mins <= 0) return { h: '', m: '' };
  return {
    h: String(Math.floor(mins / 60)),
    m: String(mins % 60),
  };
}

function sessionToDraft(s: StudySession): RowDraft {
  const mins = sessionMinutes(s);
  return {
    uid: s.id || uid(),
    subject: s.subject || SUBJECTS[0],
    topic: s.topic || '',
    start: s.start || '',
    end: s.end || '',
    h: mins ? String(Math.floor(mins / 60)) : '',
    m: mins ? String(mins % 60) : '',
    tests: s.tests ? String(s.tests) : '',
    testType: s.testType || 'read',
  };
}

function draftMinutes(r: RowDraft): number {
  const h = Math.max(0, Math.min(24, int(r.h)));
  const m = Math.max(0, Math.min(59, int(r.m)));
  return Math.min(1440, h * 60 + m);
}

function TopicCombobox({
  subject,
  value,
  options,
  onChange,
}: {
  subject: string;
  value: string;
  options: TopicOption[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 35);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 35);
  }, [options, value]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={`مبحث ${subject}...`}
          aria-label={`مبحث ${subject}`}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-7 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
        />
        {options.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen((v) => !v)}
            aria-label="نمایش لیست مباحث"
            className="absolute left-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-56 w-64 sm:w-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xl">
          {filtered.map((opt, idx) => (
            <button
              key={`${opt.label}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.label);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <span className="truncate">{opt.label}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{opt.group}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TIMER_KEY = 'study_live_timer_v1';

export function DailyLogTab({
  currentWeekKey,
  activeDay,
  weekData,
  syllabus,
  saveStatusText,
  onSelectDay,
  onUpdateDay,
  onExplicitSave,
  onRequestClearDay,
  onToast,
}: DailyLogTabProps) {
  const dayEntry = weekData[activeDay];

  const [sleepH, setSleepH] = useState('');
  const [sleepM, setSleepM] = useState('');
  const [phoneH, setPhoneH] = useState('');
  const [phoneM, setPhoneM] = useState('');
  const [restH, setRestH] = useState('');
  const [restM, setRestM] = useState('');
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [deletedBackup, setDeletedBackup] = useState<{ index: number; row: RowDraft } | null>(null);

  // Live Stopwatch state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsedSec, setTimerElapsedSec] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerStartClock, setTimerStartClock] = useState<string>('');
  const [timerSubject, setTimerSubject] = useState<string>(SUBJECTS[0]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TIMER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          running: boolean;
          accSec: number;
          startedAt: number | null;
          startClock: string;
          subject: string;
        };
        setTimerSubject(parsed.subject || SUBJECTS[0]);
        setTimerStartClock(parsed.startClock || '');
        if (parsed.running && parsed.startedAt) {
          setTimerRunning(true);
          setTimerStartedAt(parsed.startedAt);
          setTimerElapsedSec(parsed.accSec + Math.floor((Date.now() - parsed.startedAt) / 1000));
        } else {
          setTimerRunning(false);
          setTimerStartedAt(null);
          setTimerElapsedSec(parsed.accSec || 0);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!timerRunning || !timerStartedAt) return;
    const baseAcc = timerElapsedSec - Math.floor((Date.now() - timerStartedAt) / 1000);
    const id = window.setInterval(() => {
      setTimerElapsedSec(Math.max(0, baseAcc + Math.floor((Date.now() - timerStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, timerStartedAt]);

  const persistTimer = (running: boolean, accSec: number, startedAt: number | null, startClock: string, subject: string) => {
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify({ running, accSec, startedAt, startClock, subject }));
    } catch {
      // ignore
    }
  };

  const startTimer = () => {
    const now = Date.now();
    const dt = new Date(now);
    const clock = timerStartClock || `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    setTimerStartClock(clock);
    setTimerStartedAt(now);
    setTimerRunning(true);
    persistTimer(true, timerElapsedSec, now, clock, timerSubject);
  };

  const pauseTimer = () => {
    setTimerRunning(false);
    setTimerStartedAt(null);
    persistTimer(false, timerElapsedSec, null, timerStartClock, timerSubject);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedSec(0);
    setTimerStartClock('');
    persistTimer(false, 0, null, '', timerSubject);
  };

  const commitTimerToTable = () => {
    const mins = Math.max(1, Math.round(timerElapsedSec / 60));
    const now = new Date();
    const endClock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newRow: RowDraft = {
      uid: uid(),
      subject: timerSubject,
      topic: '',
      start: timerStartClock || '',
      end: endClock,
      h: String(Math.floor(mins / 60)),
      m: String(mins % 60),
      tests: '',
      testType: 'read',
    };
    const nextRows =
      rows.length === 1 && !rows[0].topic && draftMinutes(rows[0]) === 0 && int(rows[0].tests) === 0
        ? [newRow]
        : [...rows, newRow];
    setRows(nextRows);
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, nextRows);
    resetTimer();
    onToast(`زمان مطالعه (${fmtMin(mins)}) به جدول اضافه شد.`);
  };

  const loadedDayKeyRef = useRef<string>('');
  const prevHasEntryRef = useRef<boolean>(false);

  // Sync local form state when switching day/week or when day is explicitly cleared
  useEffect(() => {
    const dayKey = `${currentWeekKey}|${activeDay}`;
    const hasEntry = dayEntry !== undefined;
    const switchedDay = loadedDayKeyRef.current !== dayKey;
    const clearedExternally = !switchedDay && prevHasEntryRef.current && !hasEntry;

    loadedDayKeyRef.current = dayKey;
    prevHasEntryRef.current = hasEntry;

    if (!switchedDay && !clearedExternally) return;

    const d = dayEntry || { sleep: 0, phone: 0, rest: 0, sessions: [] };
    const sl = toHMFields(d.sleep);
    const ph = toHMFields(d.phone);
    const rs = toHMFields(d.rest);
    setSleepH(sl.h);
    setSleepM(sl.m);
    setPhoneH(ph.h);
    setPhoneM(ph.m);
    setRestH(rs.h);
    setRestM(rs.m);
    setRows(d.sessions && d.sessions.length > 0 ? d.sessions.map(sessionToDraft) : [sessionToDraft({ subject: 'زیست', topic: '', start: '', end: '', minutes: 0, tests: 0, testType: 'read' })]);
    setDeletedBackup(null);
  }, [currentWeekKey, activeDay, dayEntry]);

  // Topic options per subject from syllabus
  const topicOptionsBySubject = useMemo(() => {
    const map: Record<string, TopicOption[]> = {};
    for (const subj of SUBJECTS) {
      const list = (syllabus.subjects[subj] || []).filter((c) => !c.x);
      const opts: TopicOption[] = [];
      for (const c of list) {
        opts.push({ label: `${c.t} (${c.g})`, group: 'فصل' });
        for (const sub of (c.subs || []).filter((x) => !x.x)) {
          opts.push({ label: `${c.t} › ${sub.t} (${c.g})`, group: 'زیرمبحث' });
        }
      }
      map[subj] = opts;
    }
    return map;
  }, [syllabus]);

  const buildDayEntry = (
    sH: string,
    sM: string,
    pH: string,
    pM: string,
    rH: string,
    rM: string,
    draftRows: RowDraft[],
  ): DayEntry => {
    const hmToHours = (h: string, m: string) => {
      const hrs = Math.max(0, Math.min(24, int(h)));
      const mins = Math.max(0, Math.min(59, int(m)));
      return +Math.min(24, (hrs * 60 + mins) / 60).toFixed(3);
    };

    const sessions: StudySession[] = [];
    for (const r of draftRows) {
      const minutes = draftMinutes(r);
      const tests = Math.max(0, Math.min(5000, int(r.tests)));
      const topic = r.topic.trim();
      if (minutes > 0 || tests > 0 || topic) {
        sessions.push({
          id: r.uid,
          subject: r.subject,
          topic,
          start: r.start,
          end: r.end,
          minutes,
          duration: +(minutes / 60).toFixed(3),
          tests,
          testType: r.testType,
        });
      }
    }

    return {
      sleep: hmToHours(sH, sM),
      phone: hmToHours(pH, pM),
      rest: hmToHours(rH, rM),
      sessions,
    };
  };

  const emitChange = (
    sH: string,
    sM: string,
    pH: string,
    pM: string,
    rH: string,
    rM: string,
    draftRows: RowDraft[],
  ) => {
    onUpdateDay(activeDay, buildDayEntry(sH, sM, pH, pM, rH, rM, draftRows));
  };

  // Calculations for 24h meter
  const sleepMins = Math.min(1440, Math.max(0, int(sleepH)) * 60 + Math.max(0, Math.min(59, int(sleepM))));
  const phoneMins = Math.min(1440, Math.max(0, int(phoneH)) * 60 + Math.max(0, Math.min(59, int(phoneM))));
  const restMins = Math.min(1440, Math.max(0, int(restH)) * 60 + Math.max(0, Math.min(59, int(restM))));
  const studyMin = rows.reduce((acc, r) => acc + draftMinutes(r), 0);
  const filmMin = rows.reduce((acc, r) => acc + (isFilm({ testType: r.testType }) ? draftMinutes(r) : 0), 0);
  const totalLoggedMins = sleepMins + phoneMins + restMins + studyMin;
  const totalLoggedHours = totalLoggedMins / 60;
  const barDenominator = Math.max(1440, totalLoggedMins);

  const barSegments = [
    { label: 'خواب', mins: sleepMins, color: '#6366f1' },
    { label: 'مطالعه (بدون فیلم)', mins: Math.max(0, studyMin - filmMin), color: '#10b981' },
    { label: 'فیلم آموزشی', mins: filmMin, color: '#0ea5e9' },
    { label: 'گوشی و مجازی', mins: phoneMins, color: '#f43f5e' },
    { label: 'استراحت و تفریح', mins: restMins, color: '#f59e0b' },
  ];

  const updateRow = (index: number, patch: Partial<RowDraft>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRows(next);
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, next);
  };

  const handleTimeRangeChange = (index: number, field: 'start' | 'end', val: string) => {
    const current = rows[index];
    const nextRow = { ...current, [field]: val };
    if (nextRow.start && nextRow.end) {
      const [sh, sm] = nextRow.start.split(':').map(Number);
      const [eh, em] = nextRow.end.split(':').map(Number);
      if (Number.isFinite(sh) && Number.isFinite(sm) && Number.isFinite(eh) && Number.isFinite(em)) {
        let diff = eh * 60 + em - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        nextRow.h = String(Math.floor(diff / 60));
        nextRow.m = String(diff % 60);
      }
    }
    const next = rows.map((r, i) => (i === index ? nextRow : r));
    setRows(next);
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, next);
  };

  const addRow = () => {
    const next = [
      ...rows,
      sessionToDraft({ subject: 'زیست', topic: '', start: '', end: '', minutes: 0, tests: 0, testType: 'read' }),
    ];
    setRows(next);
  };

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, next);
  };

  const removeRow = (index: number) => {
    const removed = rows[index];
    const next = rows.filter((_, i) => i !== index);
    const finalRows =
      next.length > 0
        ? next
        : [sessionToDraft({ subject: 'زیست', topic: '', start: '', end: '', minutes: 0, tests: 0, testType: 'read' })];
    setRows(finalRows);
    setDeletedBackup({ index, row: removed });
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, finalRows);
  };

  const undoRemoveRow = () => {
    if (!deletedBackup) return;
    const next = [...rows];
    next.splice(Math.min(deletedBackup.index, next.length), 0, deletedBackup.row);
    setRows(next);
    setDeletedBackup(null);
    emitChange(sleepH, sleepM, phoneH, phoneM, restH, restM, next);
  };

  const todayStr = keyFromDate(new Date());
  const activeDayIdx = DAYS.indexOf(activeDay as (typeof DAYS)[number]);
  const activeDayLabel = activeDayIdx >= 0 ? shamsi(dayDate(currentWeekKey, activeDayIdx), { day: 'numeric', month: 'long' }) : '';

  return (
    <div className="space-y-4">
      {/* Day Selector */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>انتخاب روز هفته جهت ثبت یا ویرایش</span>
          <span className="text-[11px] font-medium text-slate-400">ذخیره‌سازی خودکار فعال است</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {DAYS.map((d, i) => {
            const dt = dayDate(currentWeekKey, i);
            const hasData = dayHasData(weekData[d]);
            const isSelected = d === activeDay;
            const isToday = keyFromDate(dt) === todayStr;

            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDay(d)}
                className={`relative flex flex-col items-center justify-center rounded-xl border px-1 py-2.5 text-center transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : isToday
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isToday && (
                  <span
                    className={`mb-0.5 text-[9px] font-extrabold ${
                      isSelected ? 'text-emerald-100' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    امروز
                  </span>
                )}
                <span className="text-[11px] md:text-xs font-bold whitespace-nowrap">{d}</span>
                <span
                  className={`mt-0.5 text-[10px] tabular-nums ${
                    isSelected ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {shamsi(dt, { day: 'numeric', month: 'short' })}
                </span>
                <span
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    hasData
                      ? isSelected
                        ? 'bg-white'
                        : 'bg-emerald-500'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* 24-Hour Time Distribution */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">توزیع زمان در شبانه‌روز</h2>
          <span
            className={`text-xs font-bold tabular-nums ${
              totalLoggedHours > 24
                ? 'text-rose-600 dark:text-rose-400'
                : totalLoggedHours >= 20
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            ثبت‌شده: {totalLoggedMins > 0 ? fmtMin(totalLoggedMins, true) : '۰'} از ۲۴ ساعت
            {totalLoggedHours > 24 ? ' (بیش از ۲۴ ساعت!)' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sleep */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
            <label htmlFor="sleep-h" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              خواب شبانه‌روز
            </label>
            <div className="flex items-center gap-1.5" dir="ltr">
              <input
                id="sleep-h"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="ساعت"
                value={sleepH}
                onChange={(e) => {
                  setSleepH(e.target.value);
                  emitChange(e.target.value, sleepM, phoneH, phoneM, restH, restM, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="font-bold text-slate-400">:</span>
              <input
                id="sleep-m"
                aria-label="دقیقه خواب"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="دقیقه"
                value={sleepM}
                onChange={(e) => {
                  setSleepM(e.target.value);
                  emitChange(sleepH, e.target.value, phoneH, phoneM, restH, restM, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
            <label htmlFor="phone-h" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              گوشی و فضای مجازی
            </label>
            <div className="flex items-center gap-1.5" dir="ltr">
              <input
                id="phone-h"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="ساعت"
                value={phoneH}
                onChange={(e) => {
                  setPhoneH(e.target.value);
                  emitChange(sleepH, sleepM, e.target.value, phoneM, restH, restM, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="font-bold text-slate-400">:</span>
              <input
                id="phone-m"
                aria-label="دقیقه گوشی"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="دقیقه"
                value={phoneM}
                onChange={(e) => {
                  setPhoneM(e.target.value);
                  emitChange(sleepH, sleepM, phoneH, e.target.value, restH, restM, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Film Auto */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              <span>فیلم آموزشی</span>
              <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400">محاسبه خودکار</span>
            </div>
            <div
              title="جمع پارت‌هایی که نوع آن‌ها کلاس/فیلم یا تست همراه فیلم است"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-bold tabular-nums text-sky-600 dark:text-sky-400"
            >
              {filmMin > 0 ? fmtMin(filmMin, true) : '۰'}
            </div>
          </div>

          {/* Rest */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
            <label htmlFor="rest-h" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              استراحت و تفریح
            </label>
            <div className="flex items-center gap-1.5" dir="ltr">
              <input
                id="rest-h"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="ساعت"
                value={restH}
                onChange={(e) => {
                  setRestH(e.target.value);
                  emitChange(sleepH, sleepM, phoneH, phoneM, e.target.value, restM, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              <span className="font-bold text-slate-400">:</span>
              <input
                id="rest-m"
                aria-label="دقیقه استراحت"
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="دقیقه"
                value={restM}
                onChange={(e) => {
                  setRestM(e.target.value);
                  emitChange(sleepH, sleepM, phoneH, phoneM, restH, e.target.value, rows);
                }}
                className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stacked 24h Distribution Bar */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {barSegments
              .filter((seg) => seg.mins > 0)
              .map((seg) => (
                <div
                  key={seg.label}
                  title={`${seg.label}: ${fmtMin(seg.mins)}`}
                  style={{
                    width: `${((seg.mins / barDenominator) * 100).toFixed(2)}%`,
                    backgroundColor: seg.color,
                  }}
                  className="h-full transition-all duration-300"
                />
              ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {barSegments.map((seg) => (
              <span key={seg.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                <span>{seg.label}</span>
                {seg.mins > 0 && <strong className="text-slate-700 dark:text-slate-200 tabular-nums">{fmtMin(seg.mins, true)}</strong>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Study Sessions & Built-in Live Study Stopwatch */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">پارت‌های مطالعه</h2>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              جمع مطالعه: {studyMin > 0 ? fmtMin(studyMin) : '۰ دقیقه'}
            </span>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>افزودن درس</span>
          </button>
        </div>

        {/* Live Study Stopwatch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-3.5 py-2.5 no-print">
          <div className="flex items-center gap-2.5">
            <Clock className={`h-4 w-4 ${timerRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">کرنومتر مطالعه زنده:</span>
            <select
              aria-label="درس کرنومتر"
              value={timerSubject}
              onChange={(e) => {
                setTimerSubject(e.target.value);
                persistTimer(timerRunning, timerElapsedSec, timerStartedAt, timerStartClock, e.target.value);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums" dir="ltr">
              {fmtClockSeconds(timerElapsedSec)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!timerRunning ? (
              <button
                type="button"
                onClick={startTimer}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors whitespace-nowrap"
              >
                <Play className="h-3 w-3" />
                <span>{timerElapsedSec > 0 ? 'ادامه' : 'شروع'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseTimer}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white transition-colors whitespace-nowrap"
              >
                <Pause className="h-3 w-3" />
                <span>توقف</span>
              </button>
            )}

            {timerElapsedSec > 0 && (
              <>
                <button
                  type="button"
                  onClick={commitTimerToTable}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors whitespace-nowrap"
                >
                  <Square className="h-3 w-3" />
                  <span>ثبت در جدول</span>
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  aria-label="صفر کردن کرنومتر"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          با وارد کردن ساعت شروع و پایان، مدت مطالعه خودکار محاسبه می‌شود. نوع فعالیت هر ردیف را انتخاب کنید تا کارنامه «آموزش / تمرین» را دقیق تفکیک کند.
        </p>

        {deletedBackup && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <span>یک ردیف مطالعه حذف شد.</span>
            <button
              type="button"
              onClick={undoRemoveRow}
              className="font-bold underline hover:no-underline"
            >
              بازگردانی ردیف
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2 w-32 font-bold">درس</th>
                <th className="py-2.5 px-2 font-bold">مبحث</th>
                <th className="py-2.5 px-2 w-28 text-center font-bold">شروع</th>
                <th className="py-2.5 px-2 w-28 text-center font-bold">پایان</th>
                <th className="py-2.5 px-2 w-36 text-center font-bold">مدت مطالعه</th>
                <th className="py-2.5 px-2 w-24 text-center font-bold">تعداد تست</th>
                <th className="py-2.5 px-2 w-48 font-bold">نوع فعالیت</th>
                <th className="py-2.5 px-2 w-24 text-center font-bold">ترتیب / حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rows.map((r, index) => {
                const tag = TEST_TAG[testKind({ testType: r.testType })];
                return (
                  <tr
                    key={r.uid}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                      <td className="p-2">
                        <select
                          aria-label={`انتخاب درس ردیف ${index + 1}`}
                          value={r.subject}
                          onChange={(e) => updateRow(index, { subject: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <TopicCombobox
                          subject={r.subject}
                          value={r.topic}
                          options={topicOptionsBySubject[r.subject] || []}
                          onChange={(val) => updateRow(index, { topic: val })}
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="time"
                          dir="ltr"
                          aria-label={`ساعت شروع ردیف ${index + 1}`}
                          value={r.start}
                          onChange={(e) => handleTimeRangeChange(index, 'start', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="time"
                          dir="ltr"
                          aria-label={`ساعت پایان ردیف ${index + 1}`}
                          value={r.end}
                          onChange={(e) => handleTimeRangeChange(index, 'end', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </td>

                      <td className="p-2">
                        <div className="flex items-center gap-1" dir="ltr">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="س"
                            aria-label={`ساعت مطالعه ردیف ${index + 1}`}
                            value={r.h}
                            onChange={(e) => updateRow(index, { h: e.target.value })}
                            className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                          <span className="font-bold text-slate-400">:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="د"
                            aria-label={`دقیقه مطالعه ردیف ${index + 1}`}
                            value={r.m}
                            onChange={(e) => updateRow(index, { m: e.target.value })}
                            className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="۰"
                          aria-label={`تعداد تست ردیف ${index + 1}`}
                          value={r.tests}
                          onChange={(e) => updateRow(index, { tests: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="mt-0.5 text-center text-[10px] text-slate-400 whitespace-nowrap">{tag}</div>
                      </td>

                      <td className="p-2">
                        <select
                          aria-label={`نوع فعالیت ردیف ${index + 1}`}
                          value={r.testType}
                          onChange={(e) => updateRow(index, { testType: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {TYPES.map((t) => (
                            <option key={t.v} value={t.v}>
                              {t.l}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 text-center">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveRow(index, -1)}
                            aria-label={`انتقال ردیف ${index + 1} به بالا`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === rows.length - 1}
                            onClick={() => moveRow(index, 1)}
                            aria-label={`انتقال ردیف ${index + 1} به پایین`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            aria-label={`حذف ردیف ${index + 1}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => onRequestClearDay(activeDay)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>پاک کردن اطلاعات این روز</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{saveStatusText}</span>
            <button
              type="button"
              onClick={() => onExplicitSave(activeDay, buildDayEntry(sleepH, sleepM, phoneH, phoneM, restH, restM, rows))}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs md:text-sm font-bold text-white shadow-sm transition-colors whitespace-nowrap"
            >
              <Save className="h-4 w-4" />
              <span>
                ذخیره روز {activeDay} {activeDayLabel}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
