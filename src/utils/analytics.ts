import {
  DAYS,
  DEFAULT_GAPS,
  GENERAL,
  NORM,
  SPECIAL,
  SUBJECTS,
  SYL_DEFAULT,
  SYL_SUBS,
  TYPES,
} from '../constants/studyData';
import type {
  ActivityKind,
  ActivityTypeValue,
  AllWeeks,
  AppSettings,
  Chapter,
  DayEntry,
  DayStats,
  NormStatus,
  StudySession,
  SubjectStats,
  SyllabusData,
  TestKind,
  WeekData,
  WeekMetrics,
  WeekStats,
} from '../types/study';
import { addDays, dateFromKey, fa, fmtMin, int, keyFromDate, todayKey, uid } from './dateAndFormat';

export function sessionMinutes(s: Partial<StudySession>): number {
  if (typeof s.minutes === 'number' && Number.isFinite(s.minutes)) {
    return Math.max(0, Math.round(s.minutes));
  }
  return Math.max(0, Math.round((s.duration || 0) * 60));
}

export function typeOf(s: { testType?: string }): ActivityTypeValue {
  const v = s.testType;
  if (v === 'film') return 'class';
  if (v === 'practice') return 'solo';
  if (TYPES.some((t) => t.v === v)) return v as ActivityTypeValue;
  return 'solo';
}

export function kindOf(s: { testType?: string }): ActivityKind {
  const found = TYPES.find((t) => t.v === typeOf(s));
  return found ? found.k : 'practice';
}

export function isFilm(s: { testType?: string }): boolean {
  const t = typeOf(s);
  return t === 'class' || t === 'video';
}

export function testKind(s: { testType?: string }): TestKind {
  if (kindOf(s) === 'learn') return 'video';
  if (typeOf(s) === 'exam') return 'exam';
  return 'solo';
}

export function dayHasData(day?: DayEntry | null): boolean {
  if (!day) return false;
  return Boolean(
    (day.sessions && day.sessions.length > 0) ||
      day.sleep > 0 ||
      day.phone > 0 ||
      day.rest > 0,
  );
}

export function loggedDays(w?: WeekData | null): number {
  if (!w) return 0;
  return DAYS.filter((d) => dayHasData(w[d])).length;
}

export function hasWeekData(w?: WeekData | null): boolean {
  return Boolean(w && DAYS.some((d) => dayHasData(w[d])));
}

export function computeWeekStats(w?: WeekData | null): WeekStats {
  const week = w || {};
  const blankSub = (): SubjectStats => ({
    minutes: 0,
    film: 0,
    practice: 0,
    tests: 0,
    solo: 0,
    video: 0,
    exam: 0,
  });

  const st: WeekStats = {
    studyMin: 0,
    sessFilm: 0,
    cardFilm: 0,
    filmMin: 0,
    totalMin: 0,
    videoMin: 0,
    practiceMin: 0,
    tests: 0,
    solo: 0,
    video: 0,
    exam: 0,
    phone: 0,
    sleep: 0,
    sleepDays: 0,
    rest: 0,
    studyDays: 0,
    specialMin: 0,
    generalMin: 0,
    topSubject: '-',
    days: {} as Record<string, DayStats>,
    subjects: {} as Record<string, SubjectStats>,
  };

  DAYS.forEach((d) => {
    st.days[d] = {
      sess: 0,
      sessFilm: 0,
      cardFilm: 0,
      practice: 0,
      tests: 0,
      sleep: 0,
      phone: 0,
      rest: 0,
    };
  });
  SUBJECTS.forEach((s) => {
    st.subjects[s] = blankSub();
  });

  DAYS.forEach((d) => {
    const item = week[d];
    if (!item) return;
    const ds = st.days[d];
    ds.sleep = item.sleep || 0;
    ds.phone = item.phone || 0;
    ds.rest = item.rest || 0;
    ds.cardFilm = 0;
    st.phone += ds.phone;
    st.sleep += ds.sleep;
    st.rest += ds.rest;
    st.cardFilm += ds.cardFilm;
    if (ds.sleep > 0) st.sleepDays++;

    (item.sessions || []).forEach((s) => {
      const mins = sessionMinutes(s);
      const tests = s.tests || 0;
      ds.sess += mins;
      ds.tests += tests;
      if (!st.subjects[s.subject]) st.subjects[s.subject] = blankSub();
      const sub = st.subjects[s.subject];
      sub.minutes += mins;
      sub.tests += tests;
      if (isFilm(s)) st.videoMin += mins;
      if (kindOf(s) === 'learn') {
        sub.film += mins;
        ds.sessFilm += mins;
      } else {
        sub.practice += mins;
        ds.practice += mins;
      }
      const tk = testKind(s);
      sub[tk] += tests;
      st[tk] += tests;
      if ((SPECIAL as readonly string[]).includes(s.subject)) st.specialMin += mins;
      if ((GENERAL as readonly string[]).includes(s.subject)) st.generalMin += mins;
    });

    st.studyMin += ds.sess;
    st.sessFilm += ds.sessFilm;
    st.practiceMin += ds.practice;
    st.tests += ds.tests;
    if (ds.sess + ds.cardFilm > 0) st.studyDays++;
  });

  st.filmMin = st.sessFilm + st.cardFilm;
  st.totalMin = st.studyMin + st.cardFilm;
  const sorted = Object.entries(st.subjects)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .find((e) => e[1].minutes > 0);
  st.topSubject = sorted ? sorted[0] : '-';
  return st;
}

export function weekMetrics(allWeeks: AllWeeks, key: string): WeekMetrics {
  const wd = allWeeks[key] || {};
  const st = computeWeekStats(wd);
  const logged = loggedDays(wd);
  const ed = Math.max(1, logged);
  const totalH = st.totalMin / 60;
  let wakeSum = 0;
  let wakeAcad = 0;
  DAYS.forEach((d) => {
    const x = st.days[d];
    if (x.sleep > 0) {
      wakeSum += 24 - x.sleep;
      wakeAcad += (x.sess + x.cardFilm) / 60;
    }
  });
  const sg = st.specialMin + st.generalMin;
  return {
    st,
    logged,
    ed,
    totalH,
    dayAvg: totalH / ed,
    wakeShare: wakeSum ? (wakeAcad / wakeSum) * 100 : null,
    avgSleep: st.sleepDays ? st.sleep / st.sleepDays : null,
    practiceShare: st.totalMin ? 100 - (st.filmMin / st.totalMin) * 100 : null,
    generalShare: sg ? (st.generalMin / sg) * 100 : null,
    phoneAvg: logged ? st.phone / ed : null,
  };
}

export function statusOf(v: number, lo: number, hi?: number | null): NormStatus {
  if (v < lo) return 'low';
  if (hi != null && v > hi) return 'high';
  return 'ok';
}

export function getGaps(settings: AppSettings): number[] {
  return settings.gaps && settings.gaps.length ? settings.gaps : DEFAULT_GAPS;
}

export function defaultSubs(s: string, g: string, t: string) {
  return ((SYL_SUBS[s] || {})[`${g}|${t}`] || []).map((x) => ({
    id: uid(),
    t: x,
    f: false,
    p: false,
  }));
}

export function buildSubjectChapters(name: string): Chapter[] {
  const out: Chapter[] = [];
  Object.entries(SYL_DEFAULT[name] || {}).forEach(([g, list]) =>
    list.forEach((t) =>
      out.push({
        id: uid(),
        g,
        t,
        read: null,
        test: false,
        stage: 0,
        due: null,
        subs: defaultSubs(name, g, t),
      }),
    ),
  );
  return out;
}

export function chPts(c: Chapter): number {
  const base = (c.read ? 1 : 0) + (c.test ? 1 : 0);
  const act = (c.subs || []).filter((x) => !x.x);
  if (!act.length) return base;
  return Math.max(
    base,
    act.reduce((a, x) => a + (x.f ? 1 : 0) + (x.p ? 1 : 0), 0) / act.length,
  );
}

export function subjectProgress(syllabus: SyllabusData, settings: AppSettings, name: string) {
  const list = (syllabus.subjects[name] || []).filter((c) => !c.x);
  if (!list.length) return { p: 0, read: 0, n: 0, mastered: 0 };
  const gapsLen = getGaps(settings).length;
  let pts = 0;
  let read = 0;
  let mastered = 0;
  list.forEach((c) => {
    pts += chPts(c);
    if (c.read) read++;
    if (c.read && c.stage >= gapsLen) mastered++;
  });
  return { p: Math.round((pts / (list.length * 2)) * 100), read, n: list.length, mastered };
}

export function overallProgress(syllabus: SyllabusData): number {
  let pts = 0;
  let total = 0;
  Object.values(syllabus.subjects).forEach((list) =>
    list.forEach((c) => {
      if (c.x) return;
      total += 2;
      pts += chPts(c);
    }),
  );
  return total ? Math.round((pts / total) * 100) : 0;
}

export function chapterMinutes(allWeeks: AllWeeks, syllabus: SyllabusData, subject: string): Record<string, number> {
  const list = syllabus.subjects[subject] || [];
  const res: Record<string, number> = {};
  const titleCount: Record<string, number> = {};
  list.forEach((c) => {
    titleCount[c.t] = (titleCount[c.t] || 0) + 1;
  });
  Object.values(allWeeks).forEach((w) =>
    DAYS.forEach((d) =>
      (w[d]?.sessions || []).forEach((s) => {
        if (s.subject !== subject || !s.topic) return;
        let best: Chapter | null = null;
        for (const c of list) {
          if (!s.topic.includes(c.t)) continue;
          if (titleCount[c.t] > 1 && !s.topic.includes(c.g)) continue;
          if (!best || c.t.length > best.t.length) best = c;
        }
        if (best) res[best.id] = (res[best.id] || 0) + sessionMinutes(s);
      }),
    ),
  );
  return res;
}

export function dueReviews(syllabus: SyllabusData, refToday = todayKey()): Array<{ s: string; c: Chapter }> {
  const out: Array<{ s: string; c: Chapter }> = [];
  Object.entries(syllabus.subjects).forEach(([s, list]) =>
    list.forEach((c) => {
      if (!c.x && !c.nr && c.read && c.due && c.due <= refToday) out.push({ s, c });
    }),
  );
  const order = syllabus.revOrder || [];
  const rank = (x: { s: string; c: Chapter }) => {
    const i = order.indexOf(x.c.id);
    return i < 0 ? 1e6 : i;
  };
  return out.sort((a, b) => rank(a) - rank(b) || (a.c.due || '').localeCompare(b.c.due || ''));
}

export interface AdvisorInsight {
  tone: 'positive' | 'warning' | 'danger' | 'info';
  title: string;
  text: string;
}

export function buildAdvisorInsights(
  allWeeks: AllWeeks,
  syllabus: SyllabusData,
  currentWeekKey: string,
  refToday = todayKey(),
): AdvisorInsight[] {
  const m = weekMetrics(allWeeks, currentWeekKey);
  const { st, logged, ed, totalH, dayAvg, wakeShare, generalShare, phoneAvg } = m;
  const filmShare = st.totalMin ? (st.filmMin / st.totalMin) * 100 : 0;

  const ins: AdvisorInsight[] = [];

  const prevKey = keyFromDate(addDays(dateFromKey(currentWeekKey), -7));
  if (hasWeekData(allWeeks[prevKey])) {
    const prev = computeWeekStats(allWeeks[prevKey]);
    const diff = st.totalMin - prev.totalMin;
    if (diff > 0) {
      ins.push({
        tone: 'positive',
        title: 'نسبت به هفته قبل',
        text: `${fmtMin(diff, true)} مطالعه بیشتر داشته‌اید (هفته قبل: ${fmtMin(prev.totalMin, true)}).`,
      });
    } else if (diff < 0) {
      ins.push({
        tone: 'warning',
        title: 'نسبت به هفته قبل',
        text: `${fmtMin(-diff, true)} مطالعه کمتر از هفته قبل (${fmtMin(prev.totalMin, true)})${logged < 7 ? '؛ البته همه روزهای این هفته هنوز ثبت نشده است' : ''}.`,
      });
    }
  }

  if (totalH > 0) {
    const tx = `میانگین مطالعه در روز ${fmtMin(dayAvg * 60, true)} است`;
    if (dayAvg < NORM.day[0]) {
      ins.push({
        tone: 'warning',
        title: 'حد وسع روزانه',
        text: `${tx}؛ هدف ۱۰ تا ۱۳٫۵ ساعت است و ${fmtMin((NORM.day[0] - dayAvg) * 60, true)} در روز تا حداقل فاصله دارید.`,
      });
    } else if (dayAvg > NORM.day[1]) {
      ins.push({
        tone: 'danger',
        title: 'هشدار فرسودگی',
        text: `${tx}؛ بالای ۱۳٫۵ ساعت پایدار نیست و ممکن است باعث خستگی و افت بازده شود.`,
      });
    } else {
      ins.push({
        tone: 'positive',
        title: 'حد وسع روزانه',
        text: `${tx} و کاملاً در بازه استاندارد ۱۰ تا ۱۳٫۵ ساعت قرار دارد.`,
      });
    }

    if (logged === 7) {
      const w = statusOf(totalH, ...NORM.week);
      ins.push({
        tone: w === 'ok' ? 'positive' : 'info',
        title: 'جمع هفته کامل',
        text: `${fmtMin(st.totalMin, true)}${w === 'low' ? '؛ کمتر از ۷۰ ساعت' : w === 'high' ? '؛ بیشتر از ۹۵ ساعت' : '؛ در بازه استاندارد ۷۰ تا ۹۵ ساعت'}.`,
      });
    }
  }

  if (wakeShare != null && wakeShare < NORM.wake[0]) {
    ins.push({
      tone: 'warning',
      title: 'سهم زمان بیداری',
      text: `${fa(Math.round(wakeShare))}٪ از ساعات بیداری صرف درس شده (هدف ۷۰ تا ۷۵٪)${st.phone ? `؛ گوشی این هفته ${fmtMin(st.phone * 60, true)} بوده است` : ''}.`,
    });
  }

  if (st.filmMin > 0) {
    if (filmShare > NORM.film) {
      ins.push({
        tone: 'warning',
        title: 'نسبت آموزش به تمرین',
        text: `${fa(Math.round(filmShare))}٪ آموزش (فیلم، کلاس، درسنامه) و ${fa(100 - Math.round(filmShare))}٪ تمرین. طبق قاعده ۴۰/۶۰، آموزش حداکثر ۴۰٪ باشد و بقیه به تست و تمرین اختصاص یابد.`,
      });
    } else {
      ins.push({
        tone: 'positive',
        title: 'نسبت آموزش به تمرین',
        text: `${fa(Math.round(filmShare))}٪ آموزش و ${fa(100 - Math.round(filmShare))}٪ تمرین؛ تعادل بسیار خوبی است.`,
      });
    }
    const heavy = SPECIAL.filter((s) => {
      const x = st.subjects[s];
      return x && x.minutes >= 60 && x.film / x.minutes > 0.6;
    });
    if (heavy.length) {
      ins.push({
        tone: 'info',
        title: 'توصیه تست‌زنی',
        text: `در ${heavy.join('، ')} بیشتر وقت به فیلم و آموزش گذشته؛ برای همین درس‌ها تست مستقل بیشتری بگذارید.`,
      });
    }
  }

  const jm = int(new Intl.DateTimeFormat('en-u-ca-persian', { month: 'numeric' }).format(dateFromKey(currentWeekKey)));
  const autumn = jm === 7 || jm === 8;
  if (generalShare != null && autumn) {
    if (generalShare < NORM.general[0]) {
      ins.push({
        tone: 'info',
        title: 'دروس عمومی',
        text: `سهم عمومی‌ها ${fa(Math.round(generalShare))}٪ است؛ در مهر و آبان ۱۰ تا ۱۵٪ مناسب است.`,
      });
    } else if (generalShare > NORM.general[1]) {
      ins.push({
        tone: 'warning',
        title: 'دروس عمومی',
        text: `سهم عمومی‌ها ${fa(Math.round(generalShare))}٪ شده؛ در پاییز بیش از ۱۵٪ از وقت اختصاصی‌ها کم می‌کند.`,
      });
    }
  }

  if (st.generalMin > 0 && !st.subjects['فارسی']?.minutes) {
    ins.push({
      tone: 'warning',
      title: 'درس کلیدی فارسی',
      text: 'فارسی با ۱۰٫۲٪ اثر، مهم‌ترین درس عمومی است؛ این هفته برایش وقتی ثبت نشده است.',
    });
  }

  if (st.specialMin > 0) {
    const splitRows = Object.entries(NORM.split).map(([s, target]) => {
      const share = ((st.subjects[s]?.minutes || 0) / st.specialMin) * 100;
      const tol = Math.max(3, target * 0.2);
      return { s, share, target, stt: statusOf(share, target - tol, target + tol) };
    });
    const top = splitRows.reduce((a, b) => (b.share > a.share ? b : a));
    if (top.share > 50) {
      ins.push({
        tone: 'danger',
        title: 'تمرکز بیش از حد روی یک درس',
        text: `${fa(Math.round(top.share))}٪ زمان اختصاصی فقط صرف ${top.s} شده است.`,
      });
    }
    const low = splitRows.filter((r) => r.stt === 'low').map((r) => r.s);
    const high = splitRows.filter((r) => r.stt === 'high').map((r) => r.s);
    if (low.length || high.length) {
      ins.push({
        tone: 'info',
        title: 'تعادل اختصاصی‌ها',
        text: `${low.length ? `کم: ${low.join('، ')}` : ''}${low.length && high.length ? ' · ' : ''}${high.length ? `زیاد: ${high.join('، ')}` : ''} (الگو: زیست ⅓، شیمی ¼، ریاضی و فیزیک هرکدام ⅕).`,
      });
    } else {
      ins.push({
        tone: 'positive',
        title: 'تعادل اختصاصی‌ها',
        text: 'تقسیم وقت شما بین دروس اختصاصی نزدیک به الگوی عددبازی است.',
      });
    }
  }

  if (phoneAvg != null && phoneAvg > 2) {
    ins.push({
      tone: 'warning',
      title: 'مدیریت گوشی',
      text: `میانگین روزانه ${fmtMin(phoneAvg * 60, true)}؛ روزی یک ساعت کمتر یعنی ۷ ساعت مطالعه بیشتر در هفته.`,
    });
  }

  const wStart = currentWeekKey;
  const wEnd = keyFromDate(addDays(dateFromKey(currentWeekKey), 6));
  const inWeek = (d: string | null | undefined) => Boolean(d && d >= wStart && d <= wEnd);
  let newCh = 0;
  Object.values(syllabus.subjects).forEach((list) =>
    list.forEach((c) => {
      if (inWeek(c.read)) newCh++;
    }),
  );
  const revDone = syllabus.log.filter((l) => inWeek(l.d) && (l.type === 'done' || !l.type)).length;
  if (newCh || revDone) {
    ins.push({
      tone: 'positive',
      title: 'پیشروی مباحث',
      text: `${fa(newCh)} فصل جدید و ${fa(revDone)} مرور در این هفته ثبت شده است.`,
    });
  }

  const overdue = dueReviews(syllabus, refToday).filter((x) => (x.c.due || '') < refToday).length;
  if (overdue) {
    ins.push({
      tone: 'danger',
      title: 'مرور عقب‌افتاده',
      text: `${fa(overdue)} مبحث از موعد مرور عقب افتاده؛ اولویت اول جمع‌کردن آن‌هاست.`,
    });
  }

  if (ed > 0 && ins.length === 0) {
    ins.push({
      tone: 'info',
      title: 'شروع ثبت',
      text: 'با تکمیل پارت‌های مطالعه و خواب روزانه، تحلیل دقیق‌تری نمایش داده می‌شود.',
    });
  }

  return ins;
}
