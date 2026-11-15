import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AllWeeks } from '../types/study';
import { hasWeekData } from '../utils/analytics';
import { fa, todayWeekKey, weekRangeLabel } from '../utils/dateAndFormat';

interface WeekNavigatorProps {
  currentWeekKey: string;
  allWeeks: AllWeeks;
  onChangeWeek: (delta: number) => void;
  onGoToCurrentWeek: () => void;
}

export function WeekNavigator({
  currentWeekKey,
  allWeeks,
  onChangeWeek,
  onGoToCurrentWeek,
}: WeekNavigatorProps) {
  const isCurrent = currentWeekKey === todayWeekKey();
  const totalWeeks = Object.keys(allWeeks).filter((k) => hasWeekData(allWeeks[k])).length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onChangeWeek(-1)}
        className="no-print inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
      >
        <ChevronRight className="h-4 w-4" />
        <span>هفته قبل</span>
      </button>

      <div className="text-center">
        <div className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100">
          هفته {weekRangeLabel(currentWeekKey)}
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span className={isCurrent ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
            {isCurrent ? 'هفته جاری' : 'هفته آرشیوی'}
          </span>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span>{fa(totalWeeks)} هفته در آرشیو ثبت شده</span>
        </div>
      </div>

      <div className="flex items-center gap-2 no-print">
        {!isCurrent && (
          <button
            type="button"
            onClick={onGoToCurrentWeek}
            className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors whitespace-nowrap"
          >
            بازگشت به هفته جاری
          </button>
        )}
        <button
          type="button"
          onClick={() => onChangeWeek(1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
        >
          <span>هفته بعد</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
