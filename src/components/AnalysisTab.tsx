import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Inbox, RotateCcw, Settings2, X } from 'lucide-react';
import { AN_SECS, DAYS, NORM, SPECIAL, SUBJ_CLR, SYL_META } from '../constants/studyData';
import type { AllWeeks, AppSettings, NormStatus, SyllabusData } from '../types/study';
import {
  dueReviews,
  getGaps,
  hasWeekData,
  overallProgress,
  statusOf,
  weekMetrics,
} from '../utils/analytics';
import {
  addDays,
  addDaysKey,
  dateFromKey,
  daysBetween,
  fa,
  fmtMin,
  jalaliToGregorian,
  keyFromDate,
  shamsi,
  todayKey,
  todayWeekKey,
  weekRangeLabel,
} from '../utils/dateAndFormat';

interface AnalysisTabProps {
  currentWeekKey: string;
  allWeeks: AllWeeks;
  syllabus: SyllabusData;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onGoToDay: (dayName: string) => void;
  onOpenWeek: (weekKey: string) => void;
}

const pct = (v: number) => `${fa(Math.round(v))}٪`;

const STATUS_LABEL: Record<NormStatus, { text: string; cls: string }> = {
  low: {
    text: 'کم',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
  },
  ok: {
    text: 'متعادل',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
  },
  high: {
    text: 'زیاد',
    cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
  },
  none: {
    text: '-',
    cls: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  },
};

const FILL_COLOR: Record<NormStatus, string> = {
  low: '#f59e0b',
  ok: '#10b981',
  high: '#f43f5e',
  none: '#cbd5e1',
};

function NormRow({
  title,
  sub,
  v,
  max,
  lo,
  hi,
  valTxt,
  goalTxt,
  stt,
}: {
  title: string;
  sub: React.ReactNode;
  v: number;
  max: number;
  lo: number | null;
  hi: number;
  valTxt: string;
  goalTxt: string;
  stt: NormStatus;
}) {
  const pc = (x: number) => Math.max(0, Math.min(100, (x / max) * 100));
  const badge = STATUS_LABEL[stt];

  return (
    <div className="grid grid-cols-[1fr_auto] md:grid-cols-[215px_1fr_220px_68px] items-center gap-x-4 gap-y-2 py-3 border-b border-slate-100 dark:border-slate-800/80 last:border-0">
      <div>
        <div className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
        {sub && <div className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
      </div>

      <div className="md:order-last text-left md:text-center">
        <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>
          {badge.text}
        </span>
      </div>

      <div className="col-span-2 md:col-span-1">
        <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
          {lo != null && (
            <div
              className="absolute inset-y-0 bg-emerald-100 dark:bg-emerald-950/60"
              style={{ right: `${pc(lo)}%`, width: `${Math.max(0, pc(hi) - pc(lo))}%` }}
            />
          )}
          <motion.div
            className="absolute inset-y-0 right-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pc(v)}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ backgroundColor: FILL_COLOR[stt] }}
          />
          {lo != null && (
            <>
              <div
                className="absolute -inset-y-0.5 w-0.5 bg-emerald-500 z-10"
                style={{ right: `${pc(lo)}%` }}
              />
              {hi < max && (
                <div
                  className="absolute -inset-y-0.5 w-0.5 bg-emerald-500 z-10"
                  style={{ right: `${pc(hi)}%` }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="col-span-2 md:col-span-1 text-[11px] text-slate-500 dark:text-slate-400 md:text-left whitespace-nowrap tabular-nums">
        <strong className="text-sm text-slate-800 dark:text-slate-100 ml-1">{valTxt}</strong>
        <span>{goalTxt}</span>
      </div>
    </div>
  );
}

function LifeSvgChart({
  series,
  maxY,
}: {
  series: Array<{ l: string; c: string; vals: Array<number | null> }>;
  maxY: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pl = 36;
  const pr = 10;
  const pt = 14;
  const pb = 32;
  const xs = (i: number) => W - pr - (i + 0.5) * ((W - pl - pr) / 7);
  const ys = (v: number) => pt + (1 - Math.min(v, maxY) / maxY) * (H - pt - pb);

  const ticks: number[] = [];
  const step = maxY <= 8 ? 1 : 2;
  for (let t = 0; t <= maxY; t += step) ticks.push(t);

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-72" role="img" aria-label="نمودار خواب، گوشی و استراحت">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pl}
                x2={W - pr}
                y1={ys(t)}
                y2={ys(t)}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={pl - 8}
                y={ys(t) + 3}
                fontSize="10"
                className="fill-slate-400 dark:fill-slate-500"
                textAnchor="end"
              >
                {fa(t)}
              </text>
            </g>
          ))}

          {/* Sleep healthy band 6-8h */}
          <rect
            x={pl}
            width={W - pl - pr}
            y={ys(8)}
            height={ys(6) - ys(8)}
            fill="#6366f1"
            opacity="0.12"
          />

          {/* Hover vertical guide */}
          {hoverIdx != null && (
            <line
              x1={xs(hoverIdx)}
              x2={xs(hoverIdx)}
              y1={pt}
              y2={H - pb}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
          )}

          {DAYS.map((d, i) => (
            <text
              key={d}
              x={xs(i)}
              y={H - 10}
              fontSize="10"
              className="fill-slate-500 dark:fill-slate-400"
              textAnchor="middle"
            >
              {d}
            </text>
          ))}

          {series.map((se) => {
            const pts = se.vals
              .map((v, i) => (v == null ? null : `${xs(i)},${ys(v)}`))
              .filter((p): p is string => Boolean(p));

            return (
              <g key={se.l}>
                {pts.length > 1 && (
                  <polyline
                    points={pts.join(' ')}
                    fill="none"
                    stroke={se.c}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {se.vals.map((v, i) =>
                  v != null ? (
                    <circle
                      key={i}
                      cx={xs(i)}
                      cy={ys(v)}
                      r={hoverIdx === i ? 6 : 4}
                      className="fill-white dark:fill-slate-900 transition-all"
                      stroke={se.c}
                      strokeWidth="2.5"
                    />
                  ) : null,
                )}
              </g>
            );
          })}

          {/* Invisible hover columns for crisp pointer inspection */}
          {DAYS.map((d, i) => {
            const colW = (W - pl - pr) / 7;
            return (
              <rect
                key={`hit-${d}`}
                x={xs(i) - colW / 2}
                y={pt}
                width={colW}
                height={H - pt - pb}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            );
          })}
        </svg>

        {hoverIdx != null && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1.5 text-xs tabular-nums">
            <span className="font-bold text-slate-800 dark:text-slate-100">{DAYS[hoverIdx]}:</span>
            {series.map((se) => (
              <span key={se.l} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: se.c }} />
                <span>{se.l}:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {se.vals[hoverIdx] != null ? fmtMin((se.vals[hoverIdx] || 0) * 60, true) : '-'}
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        {series.map((se) => (
          <span key={se.l} className="inline-flex items-center gap-1.5">
            <span className="h-1 w-3.5 rounded" style={{ backgroundColor: se.c }} />
            <span>{se.l}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm bg-indigo-500/25" />
          <span>بازه خواب سالم ۶ تا ۸ ساعت</span>
        </span>
      </div>
    </div>
  );
}

export function AnalysisTab({
  currentWeekKey,
  allWeeks,
  syllabus,
  settings,
  onUpdateSettings,
  onGoToDay,
  onOpenWeek,
}: AnalysisTabProps) {
  const [cfgOpen, setCfgOpen] = useState(false);

  const m = useMemo(() => weekMetrics(allWeeks, currentWeekKey), [allWeeks, currentWeekKey]);
  const { st, logged, ed } = m;
  const hasWeek = logged > 0;
  const tKey = todayKey();

  // Settings order/hide management
  const rawOrder = (settings.an?.order || []).filter((k) => AN_SECS.some((s) => s.k === k));
  AN_SECS.forEach((s) => {
    if (!rawOrder.includes(s.k)) rawOrder.push(s.k);
  });
  const hiddenList = settings.an?.hide || [];

  const updateAn = (order: string[], hide: string[]) => {
    onUpdateSettings({
      ...settings,
      an: { order, hide },
    });
  };

  const toggleSec = (k: string) => {
    const nextHide = hiddenList.includes(k)
      ? hiddenList.filter((x) => x !== k)
      : [...hiddenList, k];
    updateAn(rawOrder, nextHide);
  };

  const moveSec = (k: string, dir: -1 | 1) => {
    const i = rawOrder.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rawOrder.length) return;
    const nextOrder = [...rawOrder];
    [nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]];
    updateAn(nextOrder, hiddenList);
  };

  const resetAn = () => {
    const next = { ...settings };
    delete next.an;
    onUpdateSettings(next);
  };

  const renderSectionWrapper = (
    k: string,
    title: string,
    note: string,
    body: React.ReactNode,
    foot?: React.ReactNode,
  ) => (
    <motion.section
      key={k}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="print-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
        <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="flex items-center gap-2">
          {note && <span className="text-[11px] text-slate-400 dark:text-slate-500">{note}</span>}
          <button
            type="button"
            onClick={() => toggleSec(k)}
            aria-label={`پنهان کردن بخش ${title}`}
            className="no-print rounded-lg p-1 text-slate-400 hover:text-rose-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {body}
      {foot && (
        <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {foot}
        </div>
      )}
    </motion.section>
  );

  // Section renderers
  const renderBalance = () => {
    const sd = statusOf(m.dayAvg, ...NORM.day);
    const proj = logged < 7 ? (m.totalH / ed) * 7 : m.totalH;

    const lows: string[] = [];
    const highs: string[] = [];
    if (sd === 'low') lows.push('مطالعه روزانه');
    if (sd === 'high') highs.push('مطالعه روزانه');
    if (m.avgSleep != null && m.avgSleep < 6) lows.push('خواب');
    if (m.avgSleep != null && m.avgSleep > 8) highs.push('خواب');
    if (m.practiceShare != null && m.practiceShare < 60) lows.push('سهم تمرین');
    if (m.wakeShare != null && m.wakeShare < NORM.wake[0]) lows.push('سهم درس از بیداری');
    if (m.generalShare != null && m.generalShare < NORM.general[0]) lows.push('دروس عمومی');
    if (m.generalShare != null && m.generalShare > NORM.general[1]) highs.push('دروس عمومی');
    if (logged === 7 && m.totalH < NORM.week[0]) lows.push('جمع هفته');
    if (m.phoneAvg != null && m.phoneAvg > 2) highs.push('گوشی');

    return renderSectionWrapper(
      'balance',
      'تعادل و عددبازی',
      'ناحیه سبز کم‌رنگ = بازه استاندارد',
      <div>
        <NormRow
          title="فعالیت درسی روزانه"
          sub="مطالعه + فیلم (میانگین روزهای ثبت‌شده)"
          v={m.dayAvg}
          max={16}
          lo={NORM.day[0]}
          hi={NORM.day[1]}
          valTxt={fmtMin(m.dayAvg * 60, true)}
          goalTxt="هدف: ۱۰ تا ۱۳٫۵ ساعت"
          stt={sd}
        />
        <NormRow
          title="فعالیت درسی هفته"
          sub={
            logged < 7 ? (
              <>
                تا الان · روند هفته ≈ <span className="whitespace-nowrap">{fmtMin(proj * 60, true)}</span>
              </>
            ) : (
              'جمع هفت روز'
            )
          }
          v={m.totalH}
          max={110}
          lo={NORM.week[0]}
          hi={NORM.week[1]}
          valTxt={fmtMin(m.totalH * 60, true)}
          goalTxt="هدف: ۷۰ تا ۹۵ ساعت"
          stt={statusOf(proj, ...NORM.week)}
        />
        <NormRow
          title="سهم درس از زمان بیداری"
          sub={m.wakeShare != null ? 'روزهایی که خواب ثبت شده' : 'برای محاسبه، خواب را ثبت کنید'}
          v={m.wakeShare ?? 0}
          max={100}
          lo={NORM.wake[0]}
          hi={NORM.wake[1]}
          valTxt={m.wakeShare != null ? pct(m.wakeShare) : '-'}
          goalTxt="هدف: ۷۰ تا ۷۵٪"
          stt={m.wakeShare != null ? statusOf(m.wakeShare, ...NORM.wake) : 'none'}
        />
        <NormRow
          title="خواب شبانه‌روز"
          sub={m.avgSleep != null ? 'میانگین شبانه‌روز' : 'ثبت نشده'}
          v={m.avgSleep ?? 0}
          max={12}
          lo={NORM.sleep[0]}
          hi={NORM.sleep[1]}
          valTxt={m.avgSleep != null ? fmtMin(m.avgSleep * 60, true) : '-'}
          goalTxt="هدف: ۶ تا ۸ ساعت"
          stt={m.avgSleep != null ? statusOf(m.avgSleep, ...NORM.sleep) : 'none'}
        />
        <NormRow
          title="سهم تمرین و تست"
          sub="تست شخصی، آزمون و مرور در برابر آموزش"
          v={m.practiceShare ?? 0}
          max={100}
          lo={100 - NORM.film}
          hi={100}
          valTxt={m.practiceShare != null ? pct(m.practiceShare) : '-'}
          goalTxt="هدف: حداقل ۶۰٪"
          stt={m.practiceShare != null ? (m.practiceShare >= 60 ? 'ok' : 'low') : 'none'}
        />
        <NormRow
          title="سهم دروس عمومی"
          sub="از کل مطالعه درسی · معیار پاییز"
          v={m.generalShare ?? 0}
          max={50}
          lo={NORM.general[0]}
          hi={NORM.general[1]}
          valTxt={m.generalShare != null ? pct(m.generalShare) : '-'}
          goalTxt="هدف: ۱۰ تا ۱۵٪"
          stt={m.generalShare != null ? statusOf(m.generalShare, ...NORM.general) : 'none'}
        />
        {m.phoneAvg != null && (
          <NormRow
            title="گوشی و فضای مجازی"
            sub="میانگین روزانه"
            v={m.phoneAvg}
            max={6}
            lo={0}
            hi={2}
            valTxt={m.phoneAvg ? fmtMin(m.phoneAvg * 60, true) : '۰'}
            goalTxt="حداکثر ۲ ساعت"
            stt={m.phoneAvg > 2 ? 'high' : 'ok'}
          />
        )}

        {st.specialMin > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              تقسیم وقت اختصاصی‌ها{' '}
              <span className="font-normal text-[11px] text-slate-400">
                (الگو: زیست ⅓ · شیمی ¼ · ریاضی و فیزیک هرکدام ⅕)
              </span>
            </div>
            {Object.entries(NORM.split).map(([s, target]) => {
              const share = ((st.subjects[s]?.minutes || 0) / st.specialMin) * 100;
              const tol = Math.max(3, target * 0.2);
              return (
                <NormRow
                  key={s}
                  title={s}
                  sub={`${st.subjects[s]?.minutes ? fmtMin(st.subjects[s].minutes, true) : '۰'} از اختصاصی‌ها`}
                  v={share}
                  max={60}
                  lo={Math.max(0, target - tol)}
                  hi={target + tol}
                  valTxt={pct(share)}
                  goalTxt={`هدف: حدود ${pct(target)}`}
                  stt={share === 0 ? 'low' : statusOf(share, target - tol, target + tol)}
                />
              );
            })}
          </div>
        )}
      </div>,
      lows.length || highs.length ? (
        <span>
          {lows.length > 0 && (
            <>
              <strong>نیاز به افزایش:</strong> {lows.join('، ')}
            </>
          )}
          {lows.length > 0 && highs.length > 0 && ' · '}
          {highs.length > 0 && (
            <>
              <strong>نیاز به کاهش:</strong> {highs.join('، ')}
            </>
          )}
          {sd === 'low' && ` — برای رسیدن به ۱۰ ساعت، روزی ${fmtMin((NORM.day[0] - m.dayAvg) * 60, true)} بیشتر لازم است.`}
        </span>
      ) : (
        'همه شاخص‌های اصلی در بازه استاندارد قرار دارند.'
      ),
    );
  };

  const renderDailyChart = () => {
    const vals = DAYS.map((d) => ({
      d,
      learn: st.days[d].sessFilm,
      prac: st.days[d].practice,
      tot: st.days[d].sess,
    }));
    const maxH = Math.max(14, Math.ceil(Math.max(...vals.map((v) => v.tot)) / 60) + 1);
    const y = (h: number) => (h / maxH) * 100;
    const best = vals.reduce((a, b) => (b.tot > a.tot ? b : a));
    const okDays = vals.filter((v) => v.tot / 60 >= NORM.day[0]).length;

    return renderSectionWrapper(
      'daily',
      'نمودار مطالعه روزانه',
      'کلیک روی هر ستون برای باز کردن همان روز',
      <div>
        <div className="relative h-56 pt-2">
          <div
            className="absolute inset-x-0 bg-emerald-500/10 border-y border-dashed border-emerald-500/50"
            style={{ bottom: `${y(NORM.day[0])}%`, height: `${y(NORM.day[1] - NORM.day[0])}%` }}
          />
          <div
            className="absolute left-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
            style={{ bottom: `${y(NORM.day[1])}%` }}
          >
            ۱۳٫۵ س
          </div>
          <div
            className="absolute left-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
            style={{ bottom: `${Math.max(0, y(NORM.day[0]) - 5)}%` }}
          >
            ۱۰ س
          </div>

          <div className="relative flex items-end gap-1.5 md:gap-4 h-full px-8">
            {vals.map((v) => (
              <button
                key={v.d}
                type="button"
                onClick={() => onGoToDay(v.d)}
                title={`${v.d}: ${fmtMin(v.tot, true)}`}
                className="flex-1 flex flex-col items-center justify-end h-full group"
              >
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1 tabular-nums whitespace-nowrap">
                  {v.tot > 0 ? fmtMin(v.tot, true) : ''}
                </span>
                <div
                  className="w-7 md:w-11 flex flex-col justify-end rounded-t-lg overflow-hidden transition-opacity group-hover:opacity-80"
                  style={{ height: `${y(v.tot / 60)}%` }}
                >
                  <div style={{ height: `${v.tot ? (v.learn / v.tot) * 100 : 0}%`, backgroundColor: '#8b5cf6' }} />
                  <div style={{ height: `${v.tot ? (v.prac / v.tot) * 100 : 0}%`, backgroundColor: '#10b981' }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5 md:gap-4 px-8 mt-1.5 border-t border-slate-200 dark:border-slate-800 pt-2">
          {DAYS.map((d, i) => {
            const isToday = keyFromDate(addDays(dateFromKey(currentWeekKey), i)) === tKey;
            return (
              <div
                key={d}
                className={`flex-1 text-center text-[11px] ${
                  isToday ? 'font-black text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {d}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
            <span>آموزش و فیلم</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            <span>تمرین و تست</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm bg-emerald-500/20 border border-dashed border-emerald-500" />
            <span>بازه حد وسع (۱۰ تا ۱۳٫۵ ساعت)</span>
          </span>
        </div>
      </div>,
      <span>
        {fa(okDays)} روز از {fa(logged)} روز ثبت‌شده در بازه حد وسع بوده است. پرکارترین روز:{' '}
        <strong>{best.d}</strong> ({fmtMin(best.tot, true)}).
      </span>,
    );
  };

  const renderSubjectsDonut = () => {
    const list = Object.entries(st.subjects)
      .filter(([, x]) => x.minutes > 0)
      .sort((a, b) => b[1].minutes - a[1].minutes);

    if (!list.length) {
      return renderSectionWrapper(
        'subjects',
        'سهم درس‌ها',
        '',
        <div className="py-6 text-center text-xs text-slate-400">هنوز پارت مطالعه‌ای در این هفته ثبت نشده است.</div>,
      );
    }

    let acc = 0;
    const stops = list
      .map(([s, x]) => {
        const start = acc;
        acc += (x.minutes / st.studyMin) * 360;
        return `${SUBJ_CLR[s] || '#94a3b8'} ${start}deg ${acc}deg`;
      })
      .join(',');

    const top = list[0];
    const missing = SPECIAL.filter((s) => s !== 'زمین‌شناسی' && !st.subjects[s]?.minutes);

    return renderSectionWrapper(
      'subjects',
      'سهم درس‌ها',
      'از کل پارت‌های مطالعه',
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div
          className="relative h-48 w-48 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
        >
          <div className="absolute inset-[22%] rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center shadow-inner">
            <div className="text-[11px] text-slate-400">جمع پارت‌ها</div>
            <div className="text-base font-black text-slate-900 dark:text-slate-100 tabular-nums">
              {fmtMin(st.studyMin, true)}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">{fa(list.length)} درس</div>
          </div>
        </div>

        <div className="flex-1 w-full divide-y divide-slate-100 dark:divide-slate-800/80">
          {list.map(([s, x]) => {
            const share = (x.minutes / st.studyMin) * 100;
            const fp = x.minutes ? Math.round((x.film / x.minutes) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-2.5 py-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: SUBJ_CLR[s] || '#94a3b8' }}
                />
                <span className="w-24 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{s}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share}%`, backgroundColor: SUBJ_CLR[s] || '#94a3b8' }}
                  />
                </div>
                <span className="w-10 text-left text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                  {pct(share)}
                </span>
                <span className="w-20 text-left text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                  {fmtMin(x.minutes, true)}
                </span>
                <span className="hidden sm:inline w-24 text-left text-[10px] text-slate-400 tabular-nums">
                  آموزش {fa(fp)}٪ · تمرین {fa(100 - fp)}٪
                </span>
              </div>
            );
          })}
        </div>
      </div>,
      <span>
        بیشترین زمان مطالعه: <strong>{top[0]}</strong> ({pct((top[1].minutes / st.studyMin) * 100)}).
        {missing.length > 0 && ` این هفته برای ${missing.join('، ')} پارتی ثبت نشده است.`}
      </span>,
    );
  };

  const renderTestsAnalysis = () => {
    if (!st.tests) {
      return renderSectionWrapper(
        'tests',
        'تحلیل تست‌ها',
        '',
        <div className="py-6 text-center text-xs text-slate-400">در این هفته تستی ثبت نشده است.</div>,
      );
    }

    const practiceH = st.practiceMin / 60;
    const pace = practiceH ? (st.solo + st.exam) / practiceH : 0;
    const types = [
      { label: 'تست شخصی', val: st.solo, color: '#10b981' },
      { label: 'همراه فیلم', val: st.video, color: '#8b5cf6' },
      { label: 'آزمونی', val: st.exam, color: '#f43f5e' },
    ];
    const subs = Object.entries(st.subjects)
      .filter(([, x]) => x.tests > 0)
      .sort((a, b) => b[1].tests - a[1].tests);
    const maxT = Math.max(1, ...subs.map(([, x]) => x.tests));
    const maxD = Math.max(1, ...DAYS.map((d) => st.days[d].tests));
    const noTest = SPECIAL.filter(
      (s) => s !== 'زمین‌شناسی' && st.subjects[s]?.minutes >= 60 && !st.subjects[s]?.tests,
    );

    return renderSectionWrapper(
      'tests',
      'تحلیل تست‌ها',
      '',
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { t: 'کل تست', v: fa(st.tests), s: 'این هفته', clr: 'text-blue-600 dark:text-blue-400' },
            { t: 'میانگین روزانه', v: fa(Math.round(st.tests / ed)), s: 'تست در روز', clr: 'text-slate-900 dark:text-slate-100' },
            { t: 'سرعت تمرین', v: pace ? fa(Math.round(pace)) : '-', s: 'تست مستقل در ساعت تمرین', clr: 'text-emerald-600 dark:text-emerald-400' },
            { t: 'تراکم تست', v: st.studyMin ? fa(Math.round(st.tests / (st.studyMin / 60))) : '-', s: 'تست در هر ساعت مطالعه', clr: 'text-violet-600 dark:text-violet-400' },
          ].map((k) => (
            <div
              key={k.t}
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 text-center"
            >
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{k.t}</div>
              <div className={`mt-1 text-lg font-black tabular-nums ${k.clr}`}>{k.v}</div>
              <div className="text-[10px] text-slate-400">{k.s}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">تفکیک نوع تست‌ها</div>
          <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            {types
              .filter((t) => t.val > 0)
              .map((t) => (
                <div
                  key={t.label}
                  style={{ width: `${(t.val / st.tests) * 100}%`, backgroundColor: t.color }}
                  title={`${t.label}: ${fa(t.val)}`}
                />
              ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {types.map((t) => (
              <span key={t.label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <span>{t.label}:</span>
                <strong className="text-slate-800 dark:text-slate-100">{fa(t.val)}</strong>
                <span>({pct((t.val / st.tests) * 100)})</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">تست به تفکیک درس</div>
            <div className="space-y-2">
              {subs.map(([s, x]) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-24 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(x.tests / maxT) * 100}%`, backgroundColor: SUBJ_CLR[s] || '#3b82f6' }}
                    />
                  </div>
                  <span className="w-12 text-left text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    {fa(x.tests)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">تست در روزهای هفته</div>
            <div className="flex items-end gap-2 h-28 px-2">
              {DAYS.map((d) => (
                <div key={d} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {st.days[d].tests ? fa(st.days[d].tests) : ''}
                  </span>
                  <div
                    className="w-6 rounded-t-md bg-blue-500/80"
                    style={{ height: `${(st.days[d].tests / maxD) * 75}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-2 border-t border-slate-200 dark:border-slate-800 pt-1.5">
              {DAYS.map((d) => (
                <div key={d} className="flex-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>,
      <span>
        {pct((st.video / st.tests) * 100)} تست‌ها همراه فیلم و {pct(((st.solo + st.exam) / st.tests) * 100)} تست شخصی یا آزمونی بوده است.
        {st.video > st.solo + st.exam && ' تست شخصی بدون کمک فیلم را بیشتر کنید.'}
        {noTest.length > 0 && ` برای ${noTest.join('، ')} مطالعه ثبت شده ولی تستی وارد نشده است.`}
      </span>,
    );
  };

  const renderLifeChart = () => {
    const wd = allWeeks[currentWeekKey] || {};
    const val = (d: string, k: 'sleep' | 'phone' | 'rest') => {
      const has = Boolean(wd[d]);
      if (!has) return null;
      return st.days[d][k] > 0 ? st.days[d][k] : k !== 'sleep' ? 0 : null;
    };
    const series = [
      { l: 'خواب', c: '#6366f1', vals: DAYS.map((d) => val(d, 'sleep')) },
      { l: 'گوشی و مجازی', c: '#f43f5e', vals: DAYS.map((d) => val(d, 'phone')) },
      { l: 'استراحت و تفریح', c: '#f59e0b', vals: DAYS.map((d) => val(d, 'rest')) },
    ];
    const allNums = series.flatMap((s) => s.vals.filter((v): v is number => v != null));
    const maxY = Math.max(10, Math.ceil(Math.max(0, ...allNums)));
    const sl = series[0].vals.filter((v): v is number => v != null);
    const irregular = sl.length > 1 ? Math.max(...sl) - Math.min(...sl) : 0;

    const tips: string[] = [];
    if (m.avgSleep != null) {
      tips.push(
        `میانگین خواب ${fmtMin(m.avgSleep * 60, true)}${
          m.avgSleep < 6 ? ' — کم‌خوابی تمرکز را کاهش می‌دهد' : m.avgSleep > 8 ? ' — کمی بیشتر از نیاز' : ' — متعادل'
        }.`,
      );
    }
    if (irregular >= 2) {
      tips.push(`اختلاف بیشترین و کمترین خواب ${fmtMin(irregular * 60, true)} است؛ تنظیم ساعت خواب کمک می‌کند.`);
    }
    if (st.phone > 0) {
      tips.push(`مجموع استفاده از گوشی ${fmtMin(st.phone * 60, true)}.`);
    }

    return renderSectionWrapper(
      'life',
      'خواب، گوشی و استراحت',
      'نشانگر ماوس را روی روزها ببرید',
      <LifeSvgChart series={series} maxY={maxY} />,
      tips.length > 0 ? tips.join(' ') : undefined,
    );
  };

  const renderConsistency = () => {
    const wd = allWeeks[currentWeekKey] || {};
    const daysList = DAYS.filter((d) => Boolean(wd[d])).map((d) => ({ d, v: st.days[d].sess }));
    const vals = daysList.map((x) => x.v);
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length));
    const cv = mean ? (sd / mean) * 100 : 0;
    const best = daysList.reduce<{ d: string; v: number } | null>((a, b) => (!a || b.v > a.v ? b : a), null);
    const worst = daysList.reduce<{ d: string; v: number } | null>((a, b) => (!a || b.v < a.v ? b : a), null);

    let streak = 0;
    let dt = new Date();
    const studied = (k: string) => {
      const parsed = dateFromKey(k);
      const offset = (parsed.getDay() + 1) % 7;
      const ws = keyFromDate(addDays(parsed, -offset));
      const w = allWeeks[ws];
      const dayName = DAYS[(parsed.getDay() + 1) % 7];
      return Boolean(w && w[dayName] && (w[dayName].sessions || []).some((s) => (s.minutes || 0) > 0));
    };
    if (!studied(keyFromDate(dt))) dt = addDays(dt, -1);
    while (studied(keyFromDate(dt)) && streak < 999) {
      streak++;
      dt = addDays(dt, -1);
    }

    const okDays = vals.filter((v) => v / 60 >= NORM.day[0]).length;
    const cvLbl = !vals.length ? '-' : cv < 15 ? 'خیلی منظم' : cv < 30 ? 'نسبتاً منظم' : 'پرنوسان';

    const tiles = [
      { t: 'روزهای ثبت‌شده', v: `${fa(logged)} از ۷`, s: logged === 7 ? 'هفته کامل' : 'ثبت روزانه', clr: 'text-slate-900 dark:text-slate-100' },
      { t: 'زنجیره مطالعه', v: `${fa(streak)} روز`, s: 'روزهای پیاپی تا امروز', clr: streak >= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100' },
      { t: 'روزهای حد وسع', v: `${fa(okDays)} روز`, s: 'بالای ۱۰ ساعت', clr: okDays ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
      { t: 'پرکارترین روز', v: best ? best.d : '-', s: best ? fmtMin(best.v, true) : '', clr: 'text-emerald-600 dark:text-emerald-400' },
      { t: 'کم‌کارترین روز', v: worst ? worst.d : '-', s: worst ? (fmtMin(worst.v, true) === '-' ? '۰' : fmtMin(worst.v, true)) : '', clr: 'text-amber-600 dark:text-amber-400' },
      { t: 'ثبات مطالعه', v: cvLbl, s: vals.length ? `نوسان ${pct(cv)} حول میانگین` : '', clr: cv < 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
    ];

    return renderSectionWrapper(
      'consistency',
      'نظم و ثبات',
      '',
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.t}
            className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 text-center"
          >
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tile.t}</div>
            <div className={`mt-1 text-base font-black tabular-nums ${tile.clr}`}>{tile.v}</div>
            <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">{tile.s}</div>
          </div>
        ))}
      </div>,
      vals.length > 1 && best && worst ? (
        <span>
          {cv >= 30
            ? `فاصله پرکارترین و کم‌کارترین روز ${fmtMin(best.v - worst.v, true)} است. ریتم یکنواخت‌تر بازده پایدارتری ایجاد می‌کند.`
            : 'مطالعه شما در طول هفته یکنواخت و پایدار بوده است.'}
        </span>
      ) : undefined,
    );
  };

  const renderTrend = () => {
    const keys = Object.keys(allWeeks)
      .filter((k) => hasWeekData(allWeeks[k]))
      .sort()
      .slice(-10);

    if (keys.length < 2) {
      return renderSectionWrapper(
        'trend',
        'روند هفته‌ها',
        '',
        <div className="py-6 text-center text-xs text-slate-400">
          برای نمایش نمودار روند، حداقل ۲ هفته ثبت‌شده لازم است.
        </div>,
      );
    }

    const data = keys.map((k) => {
      const mm = weekMetrics(allWeeks, k);
      return { k, h: mm.totalH, tests: mm.st.tests, logged: mm.logged, cur: k === todayWeekKey() };
    });
    const maxH = Math.max(NORM.week[1] + 10, ...data.map((x) => x.h));
    const y = (v: number) => (v / maxH) * 100;
    const maxT = Math.max(1, ...data.map((x) => x.tests));

    const full = data.filter((x) => !(x.cur && x.logged < 7));
    const last = full[full.length - 1];
    const prev = full[full.length - 2];
    const last4 = full.slice(-4);
    const avg4 = last4.reduce((a, x) => a + x.h, 0) / Math.max(1, last4.length);

    return renderSectionWrapper(
      'trend',
      'روند هفته‌ها',
      `${fa(keys.length)} هفته اخیر · کلیک روی هر ستون برای باز کردن هفته`,
      <div>
        <div className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          ساعت مطالعه هر هفته <span className="font-normal text-[11px] text-slate-400">(ناحیه سبز: ۷۰ تا ۹۵ ساعت)</span>
        </div>
        <div className="relative h-48">
          <div
            className="absolute inset-x-0 bg-emerald-500/10 border-y border-dashed border-emerald-500/40"
            style={{ bottom: `${y(NORM.week[0])}%`, height: `${y(NORM.week[1] - NORM.week[0])}%` }}
          />
          <div className="relative flex items-end gap-2 md:gap-3 h-full px-1">
            {data.map((x) => (
              <button
                key={x.k}
                type="button"
                onClick={() => onOpenWeek(x.k)}
                title={`${weekRangeLabel(x.k)}: ${fmtMin(x.h * 60, true)} · ${fa(x.tests)} تست`}
                className="flex-1 flex flex-col items-center justify-end h-full group"
              >
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums mb-0.5">
                  {fa(Math.round(x.h))}س
                </span>
                <div
                  className={`w-full max-w-[44px] rounded-t-lg transition-opacity group-hover:opacity-80 ${
                    x.k === currentWeekKey ? 'bg-emerald-600' : 'bg-emerald-400/80 dark:bg-emerald-500/60'
                  } ${x.cur && x.logged < 7 ? 'opacity-60' : ''}`}
                  style={{ height: `${y(x.h)}%` }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 px-1 border-t border-slate-200 dark:border-slate-800 pt-1.5">
          {data.map((x) => (
            <div
              key={x.k}
              className={`flex-1 text-center text-[10px] tabular-nums ${
                x.k === currentWeekKey ? 'font-black text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              {shamsi(dateFromKey(x.k), { day: 'numeric', month: 'numeric' })}
              {x.cur && <div className="text-[9px]">جاری</div>}
            </div>
          ))}
        </div>

        <div className="mt-5 mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">تعداد تست هر هفته</div>
        <div className="flex items-end gap-2 md:gap-3 h-16 px-1">
          {data.map((x) => (
            <div key={x.k} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {fa(x.tests)}
              </span>
              <div
                className={`w-full max-w-[44px] rounded-t-md ${
                  x.k === currentWeekKey ? 'bg-blue-600' : 'bg-blue-400/75'
                }`}
                style={{ height: `${Math.max(4, (x.tests / maxT) * 70)}%` }}
              />
            </div>
          ))}
        </div>
      </div>,
      <span>
        میانگین {fa(last4.length)} هفته کامل اخیر: <strong>{fmtMin(avg4 * 60, true)}</strong> در هفته.
        {last && prev && prev.h > 0 && (
          <>
            {' '}
            تغییر آخرین هفته کامل:{' '}
            <strong className={last.h >= prev.h ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {last.h >= prev.h ? `${pct(((last.h - prev.h) / prev.h) * 100)} بیشتر` : `${pct(((prev.h - last.h) / prev.h) * 100)} کمتر`}
            </strong>
          </>
        )}
      </span>,
    );
  };

  const renderHeatmap = () => {
    const N = 10;
    const start = addDays(dateFromKey(todayWeekKey()), -7 * (N - 1));
    const shade = (mins: number) => {
      const h = mins / 60;
      if (h <= 0) return null;
      if (h < 4) return '#bbf7d0';
      if (h < 7) return '#6ee7b7';
      if (h < 10) return '#10b981';
      return '#047857';
    };

    return renderSectionWrapper(
      'heat',
      'نقشه حرارتی مطالعه',
      `${fa(N)} هفته اخیر · هر خانه یک روز`,
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="flex flex-col gap-1 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            {DAYS.map((d) => (
              <div key={d} className="h-5 md:h-6 leading-5 md:leading-6">
                {d}
              </div>
            ))}
          </div>

          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: N }).map((_, w) => {
              const wk = keyFromDate(addDays(start, w * 7));
              const wdat = allWeeks[wk] || {};
              return (
                <div key={wk} className="flex-1 min-w-[20px] max-w-[60px] flex flex-col gap-1">
                  {DAYS.map((d, i) => {
                    const dt = addDays(start, w * 7 + i);
                    const k = keyFromDate(dt);
                    const future = k > tKey;
                    const mins = (wdat[d]?.sessions || []).reduce((a, s) => a + (s.minutes || 0), 0);
                    const c = shade(mins);
                    return (
                      <div
                        key={k}
                        title={`${shamsi(dt, { weekday: 'long', day: 'numeric', month: 'long' })}: ${
                          mins ? fmtMin(mins, true) : 'بدون مطالعه'
                        }`}
                        style={c ? { backgroundColor: c } : undefined}
                        className={`w-full h-5 md:h-6 rounded ${
                          c
                            ? ''
                            : future
                            ? 'border border-dashed border-slate-200 dark:border-slate-800'
                            : 'bg-slate-100 dark:bg-slate-800'
                        } ${k === tKey ? 'ring-2 ring-amber-400' : ''}`}
                      />
                    );
                  })}
                  <div className="text-[9px] text-slate-400 text-center mt-0.5 tabular-nums">
                    {shamsi(addDays(start, w * 7), { day: 'numeric', month: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>کم</span>
          <span className="h-3.5 w-3.5 rounded bg-slate-100 dark:bg-slate-800" />
          {['#bbf7d0', '#6ee7b7', '#10b981', '#047857'].map((c) => (
            <span key={c} className="h-3.5 w-3.5 rounded" style={{ backgroundColor: c }} />
          ))}
          <span>زیاد</span>
          <span className="mr-2 text-slate-400">(۰ · زیر ۴ · ۴–۷ · ۷–۱۰ · بالای ۱۰ ساعت)</span>
        </div>
      </div>,
    );
  };

  const renderSyllabusProgress = () => {
    const names = Object.keys(SYL_META);
    const gapsLen = getGaps(settings).length;
    const from = addDaysKey(tKey, -28);
    let readRecent = 0;
    let remain = 0;
    Object.values(syllabus.subjects).forEach((l) =>
      l.forEach((c) => {
        if (c.x) return;
        if (c.read && c.read >= from) readRecent++;
        if (!c.read) remain++;
      }),
    );
    const perWeek = readRecent / 4;
    const [ey, em, edd] = settings.exam;
    const weeksLeft = Math.max(0, daysBetween(tKey, keyFromDate(jalaliToGregorian(ey, em, edd))) / 7);
    const revWeek = syllabus.log.filter(
      (l) => l.d >= currentWeekKey && l.d <= addDaysKey(currentWeekKey, 6) && (l.type === 'done' || !l.type),
    ).length;
    const overdue = dueReviews(syllabus, tKey).filter((x) => (x.c.due || '') < tKey).length;

    return renderSectionWrapper(
      'syllabus',
      'پیشرفت مباحث و سرعت پیشروی',
      `پیشرفت کل ${fa(overallProgress(syllabus))}٪`,
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {names.map((n) => {
          const list = (syllabus.subjects[n] || []).filter((c) => !c.x);
          if (!list.length) return null;
          const N = list.length;
          const read = list.filter((c) => c.read).length;
          const test = list.filter((c) => c.test).length;
          const mast = list.filter((c) => c.read && c.stage >= gapsLen).length;

          const miniBar = (val: number, color: string, label: string) => (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(val / N) * 100}%`, backgroundColor: color }} />
              </div>
              <span className="w-16 text-left text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {fa(val)}/{fa(N)} {label}
              </span>
            </div>
          );

          return (
            <div key={n} className="grid grid-cols-[90px_1fr] md:grid-cols-[110px_1fr_1fr_1fr] items-center gap-x-3 gap-y-1.5 py-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 row-span-3 md:row-span-1">
                {n}
              </span>
              {miniBar(read, '#8b5cf6', 'آموزش')}
              {miniBar(test, '#3b82f6', 'تمرین')}
              {miniBar(mast, '#10b981', 'تثبیت')}
            </div>
          );
        })}
      </div>,
      <span>
        {fa(readRecent)} فصل در ۴ هفته اخیر آموزش دیده شده (≈ {fa(Math.round(perWeek * 10) / 10)} فصل در هفته) و{' '}
        {fa(remain)} فصل باقی مانده است.{' '}
        {perWeek > 0 ? (
          <>
            با همین سرعت حدود <strong>{fa(Math.ceil(remain / perWeek))} هفته</strong> دیگر تمام می‌شود؛ تا کنکور{' '}
            {fa(Math.floor(weeksLeft))} هفته مانده است.
          </>
        ) : (
          'با تیک زدن فصل‌ها در بخش مباحث و مرور، سرعت پیشروی شما محاسبه می‌شود.'
        )}
        {' · '}مرورهای انجام‌شده این هفته: <strong>{fa(revWeek)}</strong>
        {overdue > 0 && <strong className="text-rose-600 dark:text-rose-400"> · {fa(overdue)} مرور عقب‌افتاده</strong>}
      </span>,
    );
  };

  const sectionsMap: Record<string, () => React.ReactNode> = {
    balance: renderBalance,
    daily: renderDailyChart,
    subjects: renderSubjectsDonut,
    tests: renderTestsAnalysis,
    life: renderLifeChart,
    consistency: renderConsistency,
    trend: renderTrend,
    heat: renderHeatmap,
    syllabus: renderSyllabusProgress,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
              تحلیل و نمودار · هفته {weekRangeLabel(currentWeekKey)}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {hasWeek ? `${fa(logged)} روز از ۷ روز ثبت شده` : 'داده‌های کلی و روند بلندمدت'}
              {' · '}هر بخش را می‌توانید پنهان یا جابه‌جا کنید
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCfgOpen((v) => !v)}
            className="no-print inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>چیدمان بخش‌ها</span>
          </button>
        </div>

        {cfgOpen && (
          <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                بخش‌های صفحه (تیک = نمایش)
              </span>
              <button
                type="button"
                onClick={resetAn}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600"
              >
                <RotateCcw className="h-3 w-3" />
                <span>بازگردانی پیش‌فرض</span>
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {rawOrder.map((k, i) => {
                const meta = AN_SECS.find((x) => x.k === k);
                if (!meta) return null;
                const off = hiddenList.includes(k);
                return (
                  <div
                    key={k}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => toggleSec(k)}
                      className="h-3.5 w-3.5 accent-emerald-600"
                    />
                    <span className={`flex-1 text-xs ${off ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {meta.l}
                    </span>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveSec(k, -1)}
                      aria-label={`انتقال ${meta.l} به بالا`}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === rawOrder.length - 1}
                      onClick={() => moveSec(k, 1)}
                      aria-label={`انتقال ${meta.l} به پایین`}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hiddenList.length > 0 && (
          <div className="no-print flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs text-slate-500 dark:text-slate-400">
            <span>بخش‌های پنهان:</span>
            {hiddenList.map((k) => {
              const meta = AN_SECS.find((x) => x.k === k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleSec(k)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-400"
                >
                  {meta?.l || k} +
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!hasWeek && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center">
          <Inbox className="mx-auto h-6 w-6 text-slate-400" />
          <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            برای این هفته هنوز مطالعه‌ای ثبت نشده؛ نمودارهای هفتگی پس از ثبت اولین روز فعال می‌شوند.
          </div>
        </div>
      )}

      {/* Render visible ordered sections */}
      <div className="space-y-4">
        {rawOrder
          .filter((k) => !hiddenList.includes(k))
          .map((k) => {
            const meta = AN_SECS.find((x) => x.k === k);
            if (!meta || (meta.week && !hasWeek)) return null;
            return sectionsMap[k]?.();
          })}
      </div>
    </div>
  );
}
