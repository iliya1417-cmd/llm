const faFmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export function fa(n: number | undefined | null): string {
  return faFmt.format(n || 0);
}

export function toEnDigits(str: unknown): string {
  return String(str ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,،]/g, '.')
    .trim();
}

export function num(v: unknown): number {
  const n = parseFloat(toEnDigits(v));
  return Number.isNaN(n) ? 0 : n;
}

export function int(v: unknown): number {
  const n = parseInt(toEnDigits(v), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function fmtMin(totalMin: number | undefined | null, short = false): string {
  const rounded = Math.round(totalMin || 0);
  if (rounded <= 0) return '-';
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const H = short ? 'س' : 'ساعت';
  const M = short ? 'د' : 'دقیقه';
  if (h && m) return `${fa(h)} ${H} و ${fa(m)} ${M}`;
  if (h) return `${fa(h)} ${H}`;
  return `${fa(m)} ${M}`;
}

export function fmtClockSeconds(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${fa(h)}:${toFaPad(pad(m))}:${toFaPad(pad(s))}` : `${toFaPad(pad(m))}:${toFaPad(pad(s))}`;
}

function toFaPad(s: string): string {
  return s.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export function dateFromKey(key: string): Date {
  const parts = String(key).split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  return new Date(y, m - 1, d, 12);
}

export function keyFromDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dt: Date, n: number): Date {
  const x = new Date(dt);
  x.setDate(x.getDate() + n);
  return x;
}

export function addDaysKey(key: string, n: number): string {
  return keyFromDate(addDays(dateFromKey(key), n));
}

export function weekStartOf(dt: Date): Date {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12);
  const offset = (x.getDay() + 1) % 7; // Saturday = 0 ... Friday = 6
  return addDays(x, -offset);
}

export function todayKey(): string {
  return keyFromDate(new Date());
}

export function todayWeekKey(): string {
  return keyFromDate(weekStartOf(new Date()));
}

export function shamsi(dt: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(dt);
}

export function weekRangeLabel(key: string): string {
  const s = dateFromKey(key);
  const e = addDays(s, 6);
  return `${shamsi(s, { day: 'numeric', month: 'long' })} تا ${shamsi(e, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function dayDate(key: string, i: number): Date {
  return addDays(dateFromKey(key), i);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / 86400000);
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  let gy: number;
  let gm: number;
  let gd: number;
  let days: number;
  const jyAdj = jy + 1595;
  days =
    -355668 +
    365 * jyAdj +
    ~~(jyAdj / 33) * 8 +
    ~~(((jyAdj % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy = 400 * ~~(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * ~~(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * ~~(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += ~~((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  const sal = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (gm = 0; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
  return new Date(gy, gm - 1, gd, 12);
}

export function relDay(key: string, referenceKey = todayKey()): string {
  const diff = daysBetween(referenceKey, key);
  if (diff === 0) return 'امروز';
  if (diff === 1) return 'فردا';
  if (diff < 0) return `${fa(-diff)} روز عقب`;
  return `${fa(diff)} روز دیگر`;
}

export function uid(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
