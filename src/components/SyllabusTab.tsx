import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  BellOff,
  Check,
  ChevronDown,
  ChevronLeft,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { GRADES, SYL_META } from '../constants/studyData';
import type { AllWeeks, AppSettings, Chapter, SyllabusData } from '../types/study';
import {
  buildSubjectChapters,
  chapterMinutes,
  dueReviews,
  getGaps,
  subjectProgress,
} from '../utils/analytics';
import { addDaysKey, fa, fmtMin, relDay, toEnDigits, todayKey, uid } from '../utils/dateAndFormat';

interface SyllabusTabProps {
  allWeeks: AllWeeks;
  syllabus: SyllabusData;
  settings: AppSettings;
  onUpdateSyllabus: (next: SyllabusData) => void;
  onUpdateSettings: (next: AppSettings) => void;
  onRequestConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'primary';
    onConfirm: () => void;
  }) => void;
  onToast: (msg: string) => void;
}

const DUE_OPTS: ReadonlyArray<[string, string]> = [
  ['0', 'امروز'],
  ['1', 'فردا'],
  ['2', '۲ روز بعد'],
  ['3', '۳ روز بعد'],
  ['7', 'یک هفته بعد'],
];

export function SyllabusTab({
  allWeeks,
  syllabus,
  settings,
  onUpdateSyllabus,
  onUpdateSettings,
  onRequestConfirm,
  onToast,
}: SyllabusTabProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>('زیست');
  const [editMode, setEditMode] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [gapsInput, setGapsInput] = useState('');
  const [revPanelOpen, setRevPanelOpen] = useState(false);
  const [openChapters, setOpenChapters] = useState<Set<string>>(() => new Set());

  const [newChGrade, setNewChGrade] = useState<string>('دهم');
  const [newChTitle, setNewChTitle] = useState('');
  const [newSubDrafts, setNewSubDrafts] = useState<Record<string, string>>({});

  const t = todayKey();
  const gaps = getGaps(settings);
  const due = useMemo(() => dueReviews(syllabus, t), [syllabus, t]);

  // Handled today
  const handledToday = useMemo(() => {
    const list: typeof syllabus.log = [];
    const seenHandled = new Set<string>();
    for (let i = syllabus.log.length - 1; i >= 0; i--) {
      const l = syllabus.log[i];
      if (l.d !== t || !l.id || seenHandled.has(l.id)) continue;
      seenHandled.add(l.id);
      list.push(l);
    }
    return list;
  }, [syllabus.log, t]);

  const upcomingCount = useMemo(() => {
    const limit = addDaysKey(t, 7);
    let count = 0;
    for (const list of Object.values(syllabus.subjects)) {
      for (const c of list) {
        if (!c.x && !c.nr && c.read && c.due && c.due > t && c.due <= limit) count++;
      }
    }
    return count;
  }, [syllabus.subjects, t]);

  const cloneSyllabus = (): SyllabusData => structuredClone(syllabus);

  const findChapterIn = (syl: SyllabusData, id: string): { s: string; c: Chapter } | null => {
    for (const [s, list] of Object.entries(syl.subjects)) {
      const c = list.find((x) => x.id === id);
      if (c) return { s, c };
    }
    return null;
  };

  const handleReview = (id: string, type: 'done' | 'skip') => {
    const next = cloneSyllabus();
    const f = findChapterIn(next, id);
    if (!f) return;
    next.log.push({
      d: t,
      s: f.s,
      t: f.c.t,
      id,
      type,
      prevStage: f.c.stage,
      prevDue: f.c.due,
    });
    f.c.stage++;
    f.c.due = f.c.stage >= gaps.length ? null : addDaysKey(t, gaps[f.c.stage]);
    onUpdateSyllabus(next);
    if (type === 'done') {
      onToast(f.c.due ? `مرور بعدی: ${relDay(f.c.due)}` : 'این مبحث تثبیت شد.');
    }
  };

  const undoReview = (id: string) => {
    const next = cloneSyllabus();
    const idx = next.log.map((l) => l.id === id && l.d === t).lastIndexOf(true);
    if (idx < 0) return;
    const l = next.log[idx];
    const f = findChapterIn(next, id);
    if (f) {
      f.c.stage = l.prevStage;
      f.c.due = l.prevDue;
      if (l.type === 'del') f.c.nr = false;
    }
    next.log.splice(idx, 1);
    onUpdateSyllabus(next);
  };

  const setDueDays = (id: string, daysStr: string) => {
    if (daysStr === '') return;
    const next = cloneSyllabus();
    const f = findChapterIn(next, id);
    if (!f) return;
    f.c.due = addDaysKey(t, Number(daysStr));
    onUpdateSyllabus(next);
  };

  const moveReviewOrder = (id: string, dir: -1 | 1) => {
    const ids = due.map((x) => x.c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const next = cloneSyllabus();
    next.revOrder = ids;
    onUpdateSyllabus(next);
  };

  const removeReview = (id: string) => {
    const next = cloneSyllabus();
    const f = findChapterIn(next, id);
    if (!f) return;
    next.log.push({
      d: t,
      s: f.s,
      t: f.c.t,
      id,
      type: 'del',
      prevStage: f.c.stage,
      prevDue: f.c.due,
    });
    f.c.nr = true;
    next.revOrder = (next.revOrder || []).filter((x) => x !== id);
    onUpdateSyllabus(next);
    onToast('مبحث از برنامه مرورها حذف شد.');
  };

  const restoreReview = (id: string) => {
    const next = cloneSyllabus();
    const f = findChapterIn(next, id);
    if (!f) return;
    f.c.nr = false;
    next.log = next.log.filter((l) => !(l.id === id && l.type === 'del' && l.d === t));
    if (f.c.read && f.c.stage < gaps.length && (!f.c.due || f.c.due < t)) {
      f.c.due = t;
    }
    onUpdateSyllabus(next);
    onToast('به برنامه مرورها بازگشت.');
  };

  const removeAllReviews = (subject?: string) => {
    const targets = Object.entries(syllabus.subjects)
      .filter(([n]) => !subject || n === subject)
      .flatMap(([, l]) => l)
      .filter((c) => c.read && !c.x && !c.nr && c.due);
    if (!targets.length) return;
    onRequestConfirm({
      title: 'حذف گروهی مرورها',
      message: `${fa(targets.length)} مرور${subject ? ` درس «${subject}»` : ''} حذف شود؟ از بخش حذف‌شده‌ها قابل بازگشت است.`,
      confirmLabel: 'حذف مرورها',
      variant: 'danger',
      onConfirm: () => {
        const next = cloneSyllabus();
        Object.entries(next.subjects)
          .filter(([n]) => !subject || n === subject)
          .forEach(([, l]) =>
            l.forEach((c) => {
              if (c.read && !c.x && !c.nr && c.due) c.nr = true;
            }),
          );
        onUpdateSyllabus(next);
        onToast('مرورهای انتخاب‌شده حذف شدند.');
      },
    });
  };

  const saveGaps = () => {
    const arr = toEnDigits(gapsInput)
      .split(/[^0-9]+/)
      .map(Number)
      .filter((n) => n > 0 && n <= 365);
    if (!arr.length) {
      onToast('حداقل یک عدد معتبر وارد کنید؛ مثلاً: ۱، ۳، ۷، ۱۴، ۳۰');
      return;
    }
    onUpdateSettings({ ...settings, gaps: arr });
    setGapsOpen(false);
    onToast('فاصله‌های مرور ذخیره شدند.');
  };

  const toggleRead = (id: string) => {
    const current = findChapterIn(syllabus, id)?.c;
    if (!current) return;
    const applyToggle = () => {
      const next = cloneSyllabus();
      const c = findChapterIn(next, id)?.c;
      if (!c) return;
      if (c.read) {
        c.read = null;
        c.stage = 0;
        c.due = null;
        c.nr = false;
        (c.subs || []).forEach((s) => {
          s.f = false;
        });
      } else {
        c.read = t;
        c.stage = 0;
        c.due = addDaysKey(t, gaps[0]);
        c.nr = false;
        (c.subs || []).forEach((s) => {
          if (!s.x) s.f = true;
        });
      }
      onUpdateSyllabus(next);
    };

    if (current.read && current.stage > 0) {
      onRequestConfirm({
        title: 'بازنشانی برنامه مرور',
        message: 'با برداشتن تیک آموزش، برنامه مرور این مبحث از ابتدا شروع می‌شود. ادامه می‌دهید؟',
        confirmLabel: 'ادامه',
        variant: 'danger',
        onConfirm: applyToggle,
      });
    } else {
      applyToggle();
    }
  };

  const toggleTest = (id: string) => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, id)?.c;
    if (!c) return;
    c.test = !c.test;
    (c.subs || []).forEach((s) => {
      if (!s.x) s.p = c.test;
    });
    onUpdateSyllabus(next);
  };

  const syncFromSubs = (c: Chapter) => {
    const act = (c.subs || []).filter((x) => !x.x);
    if (!act.length) return;
    if (act.every((x) => x.f) && !c.read) {
      c.read = t;
      c.stage = 0;
      c.due = addDaysKey(t, gaps[0]);
      c.nr = false;
      onToast('آموزش این فصل کامل شد؛ مرورهایش فعال شدند.');
    }
    c.test = act.every((x) => x.p);
  };

  const toggleSub = (cid: string, sid: string, key: 'f' | 'p') => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, cid)?.c;
    const s = c?.subs?.find((x) => x.id === sid);
    if (!c || !s) return;
    s[key] = !s[key];
    syncFromSubs(c);
    onUpdateSyllabus(next);
  };

  const renameSub = (cid: string, sid: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const next = cloneSyllabus();
    const s = findChapterIn(next, cid)?.c.subs?.find((x) => x.id === sid);
    if (!s || s.t === trimmed) return;
    s.t = trimmed;
    onUpdateSyllabus(next);
  };

  const moveSub = (cid: string, sid: string, dir: -1 | 1) => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, cid)?.c;
    if (!c?.subs) return;
    const i = c.subs.findIndex((x) => x.id === sid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.subs.length) return;
    [c.subs[i], c.subs[j]] = [c.subs[j], c.subs[i]];
    onUpdateSyllabus(next);
  };

  const toggleSubX = (cid: string, sid: string) => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, cid)?.c;
    const s = c?.subs?.find((x) => x.id === sid);
    if (!c || !s) return;
    s.x = !s.x;
    syncFromSubs(c);
    onUpdateSyllabus(next);
  };

  const deleteSub = (cid: string, sid: string, title: string) => {
    onRequestConfirm({
      title: 'حذف زیرمبحث',
      message: `زیرمبحث «${title}» حذف شود؟`,
      confirmLabel: 'حذف',
      variant: 'danger',
      onConfirm: () => {
        const next = cloneSyllabus();
        const c = findChapterIn(next, cid)?.c;
        if (!c || !c.subs) return;
        c.subs = c.subs.filter((x) => x.id !== sid);
        onUpdateSyllabus(next);
      },
    });
  };

  const addSub = (cid: string) => {
    const title = (newSubDrafts[cid] || '').trim();
    if (!title) return;
    const next = cloneSyllabus();
    const c = findChapterIn(next, cid)?.c;
    if (!c) return;
    c.subs = c.subs || [];
    c.subs.push({ id: uid(), t: title, f: false, p: false });
    setNewSubDrafts((prev) => ({ ...prev, [cid]: '' }));
    setOpenChapters((prev) => new Set(prev).add(cid));
    onUpdateSyllabus(next);
  };

  const addChapter = () => {
    const title = newChTitle.trim();
    if (!title) return;
    const next = cloneSyllabus();
    next.subjects[selectedSubject].push({
      id: uid(),
      g: newChGrade,
      t: title,
      read: null,
      test: false,
      stage: 0,
      due: null,
      subs: [],
    });
    setNewChTitle('');
    onUpdateSyllabus(next);
  };

  const renameChapter = (id: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const next = cloneSyllabus();
    const c = findChapterIn(next, id)?.c;
    if (!c || c.t === trimmed) return;
    c.t = trimmed;
    onUpdateSyllabus(next);
  };

  const moveChapter = (id: string, dir: -1 | 1) => {
    const next = cloneSyllabus();
    const list = next.subjects[selectedSubject] || [];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    let j = i + dir;
    while (j >= 0 && j < list.length && list[j].g !== list[i].g) j += dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onUpdateSyllabus(next);
  };

  const toggleExclude = (id: string) => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, id)?.c;
    if (!c) return;
    c.x = !c.x;
    onUpdateSyllabus(next);
  };

  const resetReview = (id: string) => {
    const next = cloneSyllabus();
    const c = findChapterIn(next, id)?.c;
    if (!c || !c.read) return;
    c.stage = 0;
    c.nr = false;
    c.due = addDaysKey(t, gaps[0]);
    onUpdateSyllabus(next);
    onToast('مرور این مبحث از نوبت اول تنظیم شد.');
  };

  const deleteChapter = (id: string, title: string) => {
    onRequestConfirm({
      title: 'حذف مبحث',
      message: `مبحث «${title}» به طور کامل حذف شود؟`,
      confirmLabel: 'حذف',
      variant: 'danger',
      onConfirm: () => {
        const next = cloneSyllabus();
        next.subjects[selectedSubject] = (next.subjects[selectedSubject] || []).filter((x) => x.id !== id);
        onUpdateSyllabus(next);
      },
    });
  };

  const resetSubject = () => {
    onRequestConfirm({
      title: 'بازگردانی فهرست پیش‌فرض',
      message: `فهرست درس «${selectedSubject}» به حالت پیش‌فرض برگردد؟ تیک‌ها و مرورهای این درس پاک می‌شوند.`,
      confirmLabel: 'بازگردانی',
      variant: 'danger',
      onConfirm: () => {
        const next = cloneSyllabus();
        next.subjects[selectedSubject] = buildSubjectChapters(selectedSubject);
        onUpdateSyllabus(next);
        onToast(`فهرست ${selectedSubject} بازگردانی شد.`);
      },
    });
  };

  const toggleOpen = (id: string) => {
    setOpenChapters((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // All Reviews & Deleted Reviews
  const { allRev, delRev, revSubs } = useMemo(() => {
    const activeList: Array<{ s: string; c: Chapter }> = [];
    const deletedList: Array<{ s: string; c: Chapter }> = [];
    Object.entries(syllabus.subjects).forEach(([n, l]) =>
      l.forEach((c) => {
        if (!c.read || c.x) return;
        if (c.nr) deletedList.push({ s: n, c });
        else if (c.due) activeList.push({ s: n, c });
      }),
    );
    activeList.sort((a, b) => (a.c.due || '').localeCompare(b.c.due || ''));
    return {
      allRev: activeList,
      delRev: deletedList,
      revSubs: [...new Set(activeList.map((x) => x.s))],
    };
  }, [syllabus.subjects]);

  const subjectNames = Object.keys(SYL_META);
  const selectedMeta = SYL_META[selectedSubject] || {};
  const availableGrades = selectedMeta.main ? GRADES : ['دوازدهم'];
  const selectedProg = useMemo(
    () => subjectProgress(syllabus, settings, selectedSubject),
    [syllabus, settings, selectedSubject],
  );
  const selectedList = syllabus.subjects[selectedSubject] || [];
  const minsByChapter = useMemo(
    () => chapterMinutes(allWeeks, syllabus, selectedSubject),
    [allWeeks, syllabus, selectedSubject],
  );

  const renderSubjectCard = (name: string) => {
    const pr = subjectProgress(syllabus, settings, name);
    const sel = name === selectedSubject;
    const meta = SYL_META[name];
    return (
      <button
        key={name}
        type="button"
        onClick={() => {
          setSelectedSubject(name);
          setEditMode(false);
          setNewChGrade(meta.main ? 'دهم' : 'دوازدهم');
        }}
        className={`rounded-xl border p-3 text-right transition-all ${
          sel
            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">{name}</span>
          <span
            className={`text-xs font-black tabular-nums ${
              pr.p >= 70
                ? 'text-emerald-600 dark:text-emerald-400'
                : pr.p >= 30
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-400'
            }`}
          >
            {fa(pr.p)}٪
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pr.p}%` }} />
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {fa(pr.read)} از {fa(pr.n)} فصل آموزش{meta.coef ? ` · ضریب ${fa(meta.coef)}` : ''}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Today's Reviews Queue */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">مرورهای امروز</h2>
          <button
            type="button"
            onClick={() => {
              setGapsInput(gaps.join('، '));
              setGapsOpen((v) => !v);
            }}
            className="no-print inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Pencil className="h-3 w-3" />
            <span>فاصله مرورها: {gaps.map((n) => fa(n)).join('، ')} روز</span>
          </button>
        </div>

        {gapsOpen && (
          <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-3">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              فاصله روزهای هر نوبت مرور (با ویرگول جدا کنید):
            </span>
            <input
              type="text"
              value={gapsInput}
              onChange={(e) => setGapsInput(e.target.value)}
              placeholder="۱، ۳، ۷، ۱۴، ۳۰"
              className="flex-1 min-w-[150px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveGaps}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white"
            >
              ذخیره
            </button>
          </div>
        )}

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {due.map(({ s, c }, i) => {
              const late = (c.due || '') < t;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                    late
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="no-print flex flex-col">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveReviewOrder(c.id, -1)}
                      aria-label={`اولویت بالاتر برای ${c.t}`}
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === due.length - 1}
                      onClick={() => moveReviewOrder(c.id, 1)}
                      aria-label={`اولویت پایین‌تر برای ${c.t}`}
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{s}</span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>

                  <div className="flex-1 min-w-[160px] text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <span>{c.t}</span>
                    <span className="mr-1.5 text-xs font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                      · {c.g} · مرور {fa(c.stage + 1)} از {fa(gaps.length)}
                    </span>
                    {late && (
                      <span className="mr-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        ({relDay(c.due || t, t)})
                      </span>
                    )}
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-1.5">
                    <select
                      aria-label={`تعویق مرور ${c.t}`}
                      value=""
                      onChange={(e) => setDueDays(c.id, e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <option value="">تعویق...</option>
                      {DUE_OPTS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeReview(c.id)}
                      aria-label={`حذف ${c.t} از مرورها`}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-slate-400 hover:border-rose-300 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview(c.id, 'skip')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <X className="h-3 w-3" />
                      <span>رد کردن</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview(c.id, 'done')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>مرور کردم</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {handledToday.map((l) => (
            <div
              key={`${l.id}-${l.d}-${l.prevStage}`}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-3 py-2 opacity-75"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l.s}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex-1 text-xs text-slate-400 line-through">{l.t}</span>
              <span
                className={`text-[11px] font-bold ${
                  l.type === 'done' || !l.type
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : l.type === 'del'
                    ? 'text-rose-500'
                    : 'text-slate-400'
                }`}
              >
                {l.type === 'skip' ? 'رد شد' : l.type === 'del' ? 'حذف شد' : 'مرور شد'}
              </span>
              {l.id && (
                <button
                  type="button"
                  onClick={() => undoReview(l.id!)}
                  className="no-print inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <Undo2 className="h-3 w-3" />
                  <span>برگردان</span>
                </button>
              )}
            </div>
          ))}

          {due.length === 0 && handledToday.length === 0 && (
            <div className="py-5 text-center text-xs text-slate-500 dark:text-slate-400">
              برای امروز مروری باقی نمانده است.
              {upcomingCount > 0 && (
                <span className="mr-1 text-slate-400">({fa(upcomingCount)} مرور در ۷ روز آینده)</span>
              )}
            </div>
          )}
        </div>

        {/* All Reviews Collapsible Manager */}
        <div className="no-print border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setRevPanelOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <span>
              همه مرورهای برنامه‌ریزی‌شده ({fa(allRev.length)})
              {delRev.length > 0 ? ` · ${fa(delRev.length)} حذف‌شده` : ''}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${revPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          {revPanelOpen && (
            <div className="mt-3 max-h-80 overflow-y-auto space-y-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-3">
              {allRev.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>حذف گروهی:</span>
                    {revSubs.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => removeAllReviews(n)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 hover:border-rose-300 hover:text-rose-600"
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => removeAllReviews()}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 hover:border-rose-300 hover:text-rose-600"
                    >
                      همه
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allRev.map(({ s, c }) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">{s}</span>
                        <span className="flex-1 min-w-[140px] text-slate-800 dark:text-slate-200">
                          {c.t}{' '}
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            · {c.g} · مرور {fa(c.stage + 1)}/{fa(gaps.length)}
                          </span>
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            (c.due || '') <= t ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-500'
                          }`}
                        >
                          {relDay(c.due || t, t)}
                        </span>
                        <select
                          aria-label={`تغییر موعد ${c.t}`}
                          value=""
                          onChange={(e) => setDueDays(c.id, e.target.value)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                        >
                          <option value="">موعد...</option>
                          {DUE_OPTS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeReview(c.id)}
                          aria-label={`حذف ${c.t} از مرور`}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-2 text-center text-xs text-slate-400">مروری در برنامه نیست.</div>
              )}

              {delRev.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                  <div className="mb-1 text-[11px] font-bold text-slate-400">حذف‌شده‌ها</div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {delRev.map(({ s, c }) => (
                      <div key={c.id} className="flex items-center gap-2 py-1.5 text-xs opacity-70">
                        <span className="text-slate-400">{s}</span>
                        <span className="flex-1 line-through text-slate-400">
                          {c.t} · {c.g}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreReview(c.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <Undo2 className="h-3 w-3" />
                          <span>برگردان</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Subject Cards */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-4">
        <div>
          <div className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            دروس اختصاصی <span className="font-normal">(دهم، یازدهم، دوازدهم)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {subjectNames.filter((n) => SYL_META[n].main).map(renderSubjectCard)}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            دروس عمومی <span className="font-normal">(دوازدهم)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {subjectNames.filter((n) => !SYL_META[n].main).map(renderSubjectCard)}
          </div>
        </div>
      </section>

      {/* Selected Subject Chapters & Subtopics */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
              {selectedSubject}
              <span className="mr-2 text-xs font-normal text-slate-400 tabular-nums">
                · آموزش {fa(selectedProg.read)} از {fa(selectedProg.n)} فصل · {fa(selectedProg.mastered)} تثبیت‌شده
              </span>
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`no-print inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
              editMode
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{editMode ? 'پایان ویرایش' : 'ویرایش فهرست'}</span>
          </button>
        </div>

        {editMode && (
          <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            می‌توانید نام فصل‌ها و زیرمباحث را ویرایش کنید، ترتیبشان را با ▲▼ تغییر دهید، حذفیات را خط بزنید یا موعد مرور را تنظیم کنید.
          </p>
        )}

        <div className="space-y-4">
          {GRADES.map((g) => {
            const items = selectedList.filter((c) => c.g === g);
            if (!items.length) return null;

            return (
              <div key={g}>
                <div className="mb-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">پایه {g}</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {items.map((c, idx) => {
                    const subs = c.subs || [];
                    const actSubs = subs.filter((x) => !x.x);
                    const open = openChapters.has(c.id);
                    const fDone = actSubs.filter((x) => x.f).length;
                    const pDone = actSubs.filter((x) => x.p).length;
                    const mins = minsByChapter[c.id];

                    let statusNode: React.ReactNode = null;
                    if (c.x) {
                      statusNode = <span className="text-[11px] font-medium text-slate-400">حذف از کنکور</span>;
                    } else if (c.read && c.nr) {
                      statusNode = (
                        <button
                          type="button"
                          onClick={() => restoreReview(c.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600"
                        >
                          <BellOff className="h-3 w-3" />
                          <span>بدون مرور (بازگردانی)</span>
                        </button>
                      );
                    } else if (c.read) {
                      if (c.stage >= gaps.length) {
                        statusNode = (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            تثبیت‌شده
                          </span>
                        );
                      } else {
                        const dueNow = (c.due || '') <= t;
                        statusNode = (
                          <span
                            className={`text-[11px] tabular-nums ${
                              dueNow ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            مرور {fa(c.stage + 1)}/{fa(gaps.length)} · {relDay(c.due || t, t)}
                          </span>
                        );
                      }
                    }

                    return (
                      <div
                        key={c.id}
                        className={
                          c.x
                            ? 'bg-slate-50 dark:bg-slate-950/60'
                            : c.read && c.test
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                            : 'bg-white dark:bg-slate-900'
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                          <span className="w-5 shrink-0 text-[11px] text-slate-400 tabular-nums">{fa(idx + 1)}</span>

                          <div className="flex-1 min-w-[160px]">
                            {editMode ? (
                              <input
                                type="text"
                                defaultValue={c.t}
                                onBlur={(e) => renameChapter(c.id, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            ) : (
                              <div
                                className={`text-xs md:text-sm ${
                                  c.x
                                    ? 'line-through text-slate-400'
                                    : c.read
                                    ? 'font-bold text-slate-900 dark:text-slate-100'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {c.t}
                              </div>
                            )}

                            {!editMode && (mins > 0 || actSubs.length > 0) && (
                              <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                                {actSubs.length > 0 && `آموزش ${fa(fDone)}/${fa(actSubs.length)} · تمرین ${fa(pDone)}/${fa(actSubs.length)}`}
                                {actSubs.length > 0 && mins > 0 && ' · '}
                                {mins > 0 && `مطالعه‌شده: ${fmtMin(mins, true)}`}
                              </div>
                            )}
                          </div>

                          {!editMode && statusNode && <div className="hidden md:block">{statusNode}</div>}

                          {(subs.length > 0 || editMode) && (
                            <button
                              type="button"
                              onClick={() => toggleOpen(c.id)}
                              className={`no-print inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                open
                                  ? 'border-slate-700 bg-slate-800 text-white dark:border-slate-600 dark:bg-slate-700'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                              <span>{subs.length ? `${fa(actSubs.length)} زیرمبحث` : 'زیرمبحث'}</span>
                            </button>
                          )}

                          {editMode ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveChapter(c.id, -1)}
                                aria-label={`انتقال ${c.t} به بالا`}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChapter(c.id, 1)}
                                aria-label={`انتقال ${c.t} به پایین`}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              {c.read && !c.x && !c.nr && c.stage < gaps.length && (
                                <select
                                  aria-label={`موعد مرور ${c.t}`}
                                  value=""
                                  onChange={(e) => setDueDays(c.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-1 text-[11px]"
                                >
                                  <option value="">موعد...</option>
                                  {DUE_OPTS.map(([v, l]) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {c.read && !c.x && (
                                <button
                                  type="button"
                                  onClick={() => resetReview(c.id)}
                                  title="شروع دوباره مرورها"
                                  className="p-1 text-slate-400 hover:text-emerald-600"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleExclude(c.id)}
                                title={c.x ? 'برگرداندن' : 'خط زدن (حذفیات)'}
                                className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-amber-600"
                              >
                                {c.x ? '↶' : '⊘'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteChapter(c.id, c.t)}
                                aria-label={`حذف فصل ${c.t}`}
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <label
                                className={`flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none ${
                                  c.x ? 'opacity-40 pointer-events-none' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(c.read)}
                                  onChange={() => toggleRead(c.id)}
                                  className="h-4 w-4 accent-violet-600"
                                />
                                <span>آموزش</span>
                              </label>
                              <label
                                className={`flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none ${
                                  c.x ? 'opacity-40 pointer-events-none' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(c.test)}
                                  onChange={() => toggleTest(c.id)}
                                  className="h-4 w-4 accent-blue-600"
                                />
                                <span>تمرین</span>
                              </label>
                            </div>
                          )}
                        </div>

                        {!editMode && statusNode && (
                          <div className="md:hidden px-3 pb-2 -mt-1 mr-7">{statusNode}</div>
                        )}

                        {open && (
                          <div className="mr-8 ml-3 mb-3 border-r-2 border-slate-200 dark:border-slate-700 pr-3 space-y-1.5">
                            {subs.map((s, j) =>
                              editMode ? (
                                <div key={s.id} className="flex items-center gap-1.5 py-0.5">
                                  <input
                                    type="text"
                                    defaultValue={s.t}
                                    onBlur={(e) => renameSub(c.id, s.id, e.target.value)}
                                    className={`flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none ${
                                      s.x ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    disabled={j === 0}
                                    onClick={() => moveSub(c.id, s.id, -1)}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={j === subs.length - 1}
                                    onClick={() => moveSub(c.id, s.id, 1)}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleSubX(c.id, s.id)}
                                    className="px-1.5 text-xs text-slate-400 hover:text-amber-600"
                                  >
                                    {s.x ? '↶' : '⊘'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteSub(c.id, s.id, s.t)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div key={s.id} className={`flex items-center gap-2 py-1 ${s.x ? 'opacity-50' : ''}`}>
                                  <span className="w-4 shrink-0 text-[10px] text-slate-400 tabular-nums">{fa(j + 1)}</span>
                                  <span
                                    className={`flex-1 min-w-0 text-xs ${
                                      s.x
                                        ? 'line-through text-slate-400'
                                        : s.f && s.p
                                        ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {s.t}
                                  </span>
                                  <label
                                    className={`flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer ${
                                      s.x ? 'pointer-events-none' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={s.f}
                                      onChange={() => toggleSub(c.id, s.id, 'f')}
                                      className="h-3.5 w-3.5 accent-violet-600"
                                    />
                                    <span>آموزش</span>
                                  </label>
                                  <label
                                    className={`flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer ${
                                      s.x ? 'pointer-events-none' : ''
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={s.p}
                                      onChange={() => toggleSub(c.id, s.id, 'p')}
                                      className="h-3.5 w-3.5 accent-blue-600"
                                    />
                                    <span>تمرین</span>
                                  </label>
                                </div>
                              ),
                            )}

                            {!subs.length && !editMode && (
                              <div className="py-1 text-[11px] text-slate-400">
                                زیرمبحثی ثبت نشده است؛ از «ویرایش فهرست» اضافه کنید.
                              </div>
                            )}

                            {editMode && (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={newSubDrafts[c.id] || ''}
                                  onChange={(e) =>
                                    setNewSubDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') addSub(c.id);
                                  }}
                                  placeholder="زیرمبحث جدید..."
                                  className="flex-1 min-w-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => addSub(c.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>افزودن</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {selectedList.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-400">هنوز مبحثی برای این درس ثبت نشده است.</div>
          )}
        </div>

        {editMode && (
          <div className="no-print flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <select
              aria-label="پایه مبحث جدید"
              value={newChGrade}
              onChange={(e) => setNewChGrade(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newChTitle}
              onChange={(e) => setNewChTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addChapter();
              }}
              placeholder="نام مبحث جدید..."
              className="flex-1 min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addChapter}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
            >
              افزودن فصل
            </button>
            <button
              type="button"
              onClick={resetSubject}
              className="rounded-xl border border-rose-200 dark:border-rose-900/70 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              بازگردانی پیش‌فرض
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
