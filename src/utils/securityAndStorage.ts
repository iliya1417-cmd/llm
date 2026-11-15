import {
  DAYS,
  DEFAULT_EXAM,
  OLD_KEY,
  SET_KEY,
  STORAGE_KEY,
  SUBJECTS,
  SYL_KEY,
  SYL_META,
  THEME_KEY,
} from '../constants/studyData';
import type {
  AllWeeks,
  AppSettings,
  BackupEnvelope,
  Chapter,
  DayEntry,
  ReviewLogEntry,
  StudySession,
  SubTopic,
  SyllabusData,
  WeekData,
} from '../types/study';
import { buildSubjectChapters, computeWeekStats, loggedDays } from './analytics';
import { addDays, dateFromKey, fa, fmtMin, keyFromDate, weekRangeLabel } from './dateAndFormat';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeObject<T>(input: unknown): T {
  if (input === null || typeof input !== 'object') return input as T;
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    clean[k] = sanitizeObject(v);
  }
  return clean as T;
}

function clampNum(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function cleanStr(v: unknown, maxLen = 200): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, maxLen).trim();
}

function isDateKey(k: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

export function validateAndSanitizeWeeks(raw: unknown): AllWeeks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const safeRaw = sanitizeObject<Record<string, unknown>>(raw);
  const out: AllWeeks = {};

  for (const [weekKey, weekVal] of Object.entries(safeRaw)) {
    if (!isDateKey(weekKey) || !weekVal || typeof weekVal !== 'object' || Array.isArray(weekVal)) {
      continue;
    }
    const cleanWeek: WeekData = {};
    for (const dayName of DAYS) {
      const dayVal = (weekVal as Record<string, unknown>)[dayName];
      if (!dayVal || typeof dayVal !== 'object' || Array.isArray(dayVal)) continue;
      const dObj = dayVal as Record<string, unknown>;
      const sessionsRaw = Array.isArray(dObj.sessions) ? dObj.sessions : [];
      const sessions: StudySession[] = [];
      for (const sRaw of sessionsRaw.slice(0, 60)) {
        if (!sRaw || typeof sRaw !== 'object' || Array.isArray(sRaw)) continue;
        const sObj = sRaw as Record<string, unknown>;
        const minutes =
          typeof sObj.minutes === 'number' && Number.isFinite(sObj.minutes)
            ? Math.round(clampNum(sObj.minutes, 0, 1440))
            : Math.round(clampNum((Number(sObj.duration) || 0) * 60, 0, 1440));
        const tests = Math.round(clampNum(sObj.tests, 0, 5000));
        const topic = cleanStr(sObj.topic, 180);
        const subject = cleanStr(sObj.subject, 60) || SUBJECTS[0];
        const start = cleanStr(sObj.start, 10);
        const end = cleanStr(sObj.end, 10);
        const testType = cleanStr(sObj.testType, 20) || 'solo';
        if (minutes > 0 || tests > 0 || topic) {
          sessions.push({
            id: cleanStr(sObj.id, 40) || undefined,
            subject,
            topic,
            start,
            end,
            minutes,
            duration: +(minutes / 60).toFixed(3),
            tests,
            testType,
          });
        }
      }
      const entry: DayEntry = {
        sleep: +clampNum(dObj.sleep, 0, 24).toFixed(3),
        phone: +clampNum(dObj.phone, 0, 24).toFixed(3),
        rest: +clampNum(dObj.rest, 0, 24).toFixed(3),
        sessions,
      };
      if (entry.sessions.length > 0 || entry.sleep > 0 || entry.phone > 0 || entry.rest > 0) {
        cleanWeek[dayName] = entry;
      }
    }
    if (Object.keys(cleanWeek).length > 0) {
      out[weekKey] = cleanWeek;
    }
  }
  return out;
}

export function validateAndSanitizeSyllabus(raw: unknown): SyllabusData {
  const safe = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? sanitizeObject<Record<string, unknown>>(raw)
    : {};
  const rawSubjects =
    safe.subjects && typeof safe.subjects === 'object' && !Array.isArray(safe.subjects)
      ? (safe.subjects as Record<string, unknown>)
      : {};

  const subjects: Record<string, Chapter[]> = {};
  const allSubjectNames = new Set([...Object.keys(SYL_META), ...Object.keys(rawSubjects)]);

  for (const name of allSubjectNames) {
    const arr = rawSubjects[name];
    if (!Array.isArray(arr)) {
      if (SYL_META[name]) subjects[name] = buildSubjectChapters(name);
      continue;
    }
    subjects[name] = arr
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
      .slice(0, 200)
      .map((c) => {
        const subsRaw = Array.isArray(c.subs) ? c.subs : [];
        const subs: SubTopic[] = subsRaw
          .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x)))
          .slice(0, 100)
          .map((x) => ({
            id: cleanStr(x.id, 40) || `s_${Math.random().toString(36).slice(2, 8)}`,
            t: cleanStr(x.t, 160),
            f: Boolean(x.f),
            p: Boolean(x.p),
            x: x.x ? true : undefined,
          }));
        return {
          id: cleanStr(c.id, 40) || `c_${Math.random().toString(36).slice(2, 8)}`,
          g: cleanStr(c.g, 20) || 'دوازدهم',
          t: cleanStr(c.t, 160),
          read: typeof c.read === 'string' && isDateKey(c.read) ? c.read : null,
          test: Boolean(c.test),
          stage: Math.round(clampNum(c.stage, 0, 30)),
          due: typeof c.due === 'string' && isDateKey(c.due) ? c.due : null,
          nr: c.nr ? true : undefined,
          x: c.x ? true : undefined,
          subs: subs.length ? subs : undefined,
        };
      });
  }

  // Ensure default subjects exist and run v2 migration if needed
  Object.keys(SYL_META).forEach((n) => {
    if (!subjects[n]) subjects[n] = buildSubjectChapters(n);
  });

  if (!safe.v2) {
    const chem = (subjects['شیمی'] || []).find((c) => c.g === 'دهم' && c.t === 'کیهان زادگاه الفبای هستی');
    if (chem) chem.t = 'کیهان زادگاه عنصرها';
    const ph = subjects['فیزیک'] || [];
    const iK = ph.findIndex((c) => c.g === 'دهم' && c.t === 'کار، انرژی و توان');
    const iV = ph.findIndex((c) => c.g === 'دهم' && c.t === 'ویژگی‌های فیزیکی مواد');
    if (iK >= 0 && iV >= 0 && iK < iV) [ph[iK], ph[iV]] = [ph[iV], ph[iK]];

    const defaultsByName: Record<string, Chapter[]> = {};
    Object.keys(SYL_META).forEach((n) => {
      defaultsByName[n] = buildSubjectChapters(n);
    });
    Object.entries(subjects).forEach(([n, list]) => {
      list.forEach((c) => {
        if (!c.subs) {
          const matched = (defaultsByName[n] || []).find((d) => d.g === c.g && d.t === c.t);
          c.subs = (matched?.subs || []).map((x) => ({ ...x, f: Boolean(c.read), p: Boolean(c.test) }));
        }
      });
    });
  }

  const logRaw = Array.isArray(safe.log) ? safe.log : [];
  const log: ReviewLogEntry[] = logRaw
    .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object' && !Array.isArray(l)))
    .slice(-1000)
    .map((l) => ({
      d: typeof l.d === 'string' && isDateKey(l.d) ? l.d : keyFromDate(new Date()),
      s: cleanStr(l.s, 40),
      t: cleanStr(l.t, 160),
      id: cleanStr(l.id, 40) || undefined,
      type: l.type === 'skip' || l.type === 'del' || l.type === 'done' ? l.type : 'done',
      prevStage: Math.round(clampNum(l.prevStage, 0, 30)),
      prevDue: typeof l.prevDue === 'string' && isDateKey(l.prevDue) ? l.prevDue : null,
    }));

  const revOrder = Array.isArray(safe.revOrder)
    ? safe.revOrder.filter((x): x is string => typeof x === 'string').slice(0, 500)
    : undefined;

  return {
    subjects,
    log,
    revOrder,
    v2: true,
  };
}

export function validateAndSanitizeSettings(raw: unknown): AppSettings {
  const safe = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? sanitizeObject<Record<string, unknown>>(raw)
    : {};

  let exam: [number, number, number] = [...DEFAULT_EXAM];
  if (Array.isArray(safe.exam) && safe.exam.length === 3) {
    const [y, m, d] = safe.exam.map(Number);
    if (
      Number.isFinite(y) &&
      Number.isFinite(m) &&
      Number.isFinite(d) &&
      y >= 1400 &&
      y <= 1425 &&
      m >= 1 &&
      m <= 12 &&
      d >= 1 &&
      d <= 31
    ) {
      exam = [Math.round(y), Math.round(m), Math.round(d)];
    }
  }

  let gaps: number[] | undefined;
  if (Array.isArray(safe.gaps)) {
    const cleaned = safe.gaps
      .map(Number)
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => Math.min(365, Math.round(x)))
      .slice(0, 15);
    if (cleaned.length > 0) gaps = cleaned;
  }

  return {
    exam,
    gaps,
    wk: safe.wk && typeof safe.wk === 'object' ? (safe.wk as AppSettings['wk']) : undefined,
    an: safe.an && typeof safe.an === 'object' ? (safe.an as AppSettings['an']) : undefined,
  };
}

// ==================== Web Crypto Integrity & Encryption ====================
function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API is unavailable in this environment.');
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256(text: string): Promise<string> {
  const subtle = getSubtle();
  const data = new TextEncoder().encode(text);
  const hashBuf = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptDataAesGcm(plaintext: string, passphrase: string) {
  const subtle = getSubtle();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100000;
  const key = await deriveAesKey(passphrase, salt, iterations);
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    alg: 'AES-GCM' as const,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    iterations,
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptDataAesGcm(
  cipher: { salt: string; iv: string; iterations: number; ciphertext: string },
  passphrase: string,
): Promise<string> {
  const subtle = getSubtle();
  const salt = base64ToBytes(cipher.salt);
  const iv = base64ToBytes(cipher.iv);
  const encryptedBytes = base64ToBytes(cipher.ciphertext);
  const key = await deriveAesKey(passphrase, salt, cipher.iterations || 100000);
  const plainBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encryptedBytes.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plainBuf);
}

export async function createBackupEnvelope(
  payload: { weeks: AllWeeks; syllabus: SyllabusData; settings: AppSettings },
  passphrase?: string,
): Promise<BackupEnvelope> {
  const exportedAt = new Date().toISOString();
  const innerJson = JSON.stringify({
    weeks: payload.weeks,
    syllabus: payload.syllabus,
    settings: payload.settings,
  });
  const hash = await computeSha256(innerJson);

  if (passphrase && passphrase.trim().length > 0) {
    const cipher = await encryptDataAesGcm(innerJson, passphrase);
    return {
      app: 'study-dashboard',
      version: 6,
      exportedAt,
      encrypted: true,
      integrity: { algorithm: 'SHA-256', hash },
      cipher,
    };
  }

  return {
    app: 'study-dashboard',
    version: 6,
    exportedAt,
    encrypted: false,
    integrity: { algorithm: 'SHA-256', hash },
    weeks: payload.weeks,
    syllabus: payload.syllabus,
    settings: payload.settings,
  };
}

export interface ParsedBackupResult {
  weeks: AllWeeks;
  syllabus?: SyllabusData;
  settings?: AppSettings;
  integrityStatus: 'verified' | 'mismatch' | 'unhashed';
  wasEncrypted: boolean;
}

export async function parseBackupEnvelope(
  rawJsonText: string,
  passphrase?: string,
): Promise<ParsedBackupResult> {
  const parsed = sanitizeObject<Record<string, unknown>>(JSON.parse(rawJsonText));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('INVALID_FORMAT');
  }

  if (parsed.encrypted && parsed.cipher && typeof parsed.cipher === 'object') {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('PASSPHRASE_REQUIRED');
    }
    let plainText: string;
    try {
      plainText = await decryptDataAesGcm(
        parsed.cipher as { salt: string; iv: string; iterations: number; ciphertext: string },
        passphrase,
      );
    } catch {
      throw new Error('WRONG_PASSPHRASE');
    }
    const inner = sanitizeObject<Record<string, unknown>>(JSON.parse(plainText));
    const expectedHash = (parsed.integrity as { hash?: string } | undefined)?.hash;
    const computedHash = await computeSha256(
      JSON.stringify({
        weeks: inner.weeks,
        syllabus: inner.syllabus,
        settings: inner.settings,
      }),
    );
    const integrityStatus = expectedHash
      ? expectedHash === computedHash
        ? 'verified'
        : 'mismatch'
      : 'unhashed';

    return {
      weeks: validateAndSanitizeWeeks(inner.weeks),
      syllabus: inner.syllabus ? validateAndSanitizeSyllabus(inner.syllabus) : undefined,
      settings: inner.settings ? validateAndSanitizeSettings(inner.settings) : undefined,
      integrityStatus,
      wasEncrypted: true,
    };
  }

  // Unencrypted backup (v6 with integrity hash, or legacy v5 / raw weeks object)
  let integrityStatus: 'verified' | 'mismatch' | 'unhashed' = 'unhashed';
  const expectedHash = (parsed.integrity as { hash?: string } | undefined)?.hash;
  if (expectedHash && parsed.weeks) {
    const computedHash = await computeSha256(
      JSON.stringify({
        weeks: parsed.weeks,
        syllabus: parsed.syllabus,
        settings: parsed.settings,
      }),
    );
    integrityStatus = expectedHash === computedHash ? 'verified' : 'mismatch';
  }

  const weeksRaw = parsed.weeks ?? (parsed.syllabus ? {} : parsed);
  const weeks = validateAndSanitizeWeeks(weeksRaw);
  const syllabus = parsed.syllabus ? validateAndSanitizeSyllabus(parsed.syllabus) : undefined;
  const settings = parsed.settings ? validateAndSanitizeSettings(parsed.settings) : undefined;

  return {
    weeks,
    syllabus,
    settings,
    integrityStatus,
    wasEncrypted: false,
  };
}

// ==================== Safe LocalStorage Persistence ====================
export function loadAllFromStorage(): {
  weeks: AllWeeks;
  syllabus: SyllabusData;
  settings: AppSettings;
  theme: 'light' | 'dark';
} {
  let weeks: AllWeeks = {};
  try {
    const rawWeeks = localStorage.getItem(STORAGE_KEY);
    if (rawWeeks) weeks = validateAndSanitizeWeeks(JSON.parse(rawWeeks));
  } catch {
    weeks = {};
  }

  // Legacy v3 migration preserved safely
  try {
    const oldRaw = localStorage.getItem(OLD_KEY);
    if (oldRaw && !localStorage.getItem(`${STORAGE_KEY}_migrated`)) {
      const oldData = sanitizeObject<Record<string, unknown>>(JSON.parse(oldRaw));
      if (oldData && typeof oldData === 'object' && Object.keys(oldData).length > 0) {
        const now = new Date();
        const todayIdx = (now.getDay() + 1) % 7;
        const offset = (now.getDay() + 1) % 7;
        const curWeekStart = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), -offset);
        const curWeekKey = keyFromDate(curWeekStart);
        const hasFuture = DAYS.some((d, i) => i > todayIdx && Boolean(oldData[d]));
        const targetKey = hasFuture ? keyFromDate(addDays(dateFromKey(curWeekKey), -7)) : curWeekKey;
        const validated = validateAndSanitizeWeeks({ [targetKey]: oldData });
        if (validated[targetKey]) {
          weeks[targetKey] = Object.assign({}, validated[targetKey], weeks[targetKey] || {});
          saveWeeksToStorage(weeks);
        }
      }
      localStorage.setItem(`${STORAGE_KEY}_migrated`, '1');
    }
  } catch {
    // Ignore malformed legacy storage safely
  }

  let syllabus: SyllabusData;
  try {
    const rawSyl = localStorage.getItem(SYL_KEY);
    syllabus = validateAndSanitizeSyllabus(rawSyl ? JSON.parse(rawSyl) : null);
  } catch {
    syllabus = validateAndSanitizeSyllabus(null);
  }

  let settings: AppSettings;
  try {
    const rawSet = localStorage.getItem(SET_KEY);
    settings = validateAndSanitizeSettings(rawSet ? JSON.parse(rawSet) : null);
  } catch {
    settings = validateAndSanitizeSettings(null);
  }

  let theme: 'light' | 'dark' = 'light';
  try {
    if (localStorage.getItem(THEME_KEY) === 'dark') theme = 'dark';
  } catch {
    theme = 'light';
  }

  return { weeks, syllabus, settings, theme };
}

export function saveWeeksToStorage(weeks: AllWeeks): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weeks));
    return true;
  } catch {
    return false;
  }
}

export function saveSyllabusToStorage(syllabus: SyllabusData): boolean {
  try {
    localStorage.setItem(SYL_KEY, JSON.stringify(syllabus));
    return true;
  } catch {
    return false;
  }
}

export function saveSettingsToStorage(settings: AppSettings): boolean {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function saveThemeToStorage(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

// ==================== Free Export Generators ====================
function csvCell(val: unknown): string {
  let s = String(val ?? '');
  // Neutralize CSV formula injection (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export function generateStudyCsv(weeks: AllWeeks): string {
  const headers = [
    'کلید هفته',
    'بازه هفته',
    'روز',
    'درس',
    'مبحث',
    'شروع',
    'پایان',
    'مدت (دقیقه)',
    'تعداد تست',
    'نوع فعالیت',
    'خواب روز (ساعت)',
    'گوشی روز (ساعت)',
    'استراحت روز (ساعت)',
  ];
  const rows: string[] = [headers.map(csvCell).join(',')];
  const sortedKeys = Object.keys(weeks).sort();

  for (const wk of sortedKeys) {
    const wData = weeks[wk];
    const range = weekRangeLabel(wk);
    for (const dayName of DAYS) {
      const day = wData[dayName];
      if (!day) continue;
      if (!day.sessions.length) {
        rows.push(
          [wk, range, dayName, '-', '-', '', '', 0, 0, '-', day.sleep || 0, day.phone || 0, day.rest || 0]
            .map(csvCell)
            .join(','),
        );
        continue;
      }
      for (const s of day.sessions) {
        rows.push(
          [
            wk,
            range,
            dayName,
            s.subject,
            s.topic || '-',
            s.start || '',
            s.end || '',
            s.minutes || 0,
            s.tests || 0,
            s.testType || '',
            day.sleep || 0,
            day.phone || 0,
            day.rest || 0,
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
  }
  // UTF-8 BOM so Microsoft Excel opens Persian cleanly
  return '\uFEFF' + rows.join('\n');
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateStandaloneHtmlReport(weeks: AllWeeks, syllabus: SyllabusData): string {
  const keys = Object.keys(weeks).sort().reverse();
  const rowsHtml = keys
    .map((k) => {
      const st = computeWeekStats(weeks[k]);
      const logged = loggedDays(weeks[k]);
      if (!logged) return '';
      const avgSleep = st.sleepDays ? fmtMin((st.sleep / st.sleepDays) * 60, true) : '-';
      return `<tr>
        <td>${escapeHtml(weekRangeLabel(k))}</td>
        <td>${escapeHtml(fmtMin(st.totalMin, true))}</td>
        <td>${escapeHtml(fa(logged))} روز</td>
        <td>${escapeHtml(fa(st.tests))}</td>
        <td>${escapeHtml(fmtMin(st.phone * 60, true))}</td>
        <td>${escapeHtml(avgSleep)}</td>
        <td>${escapeHtml(st.topSubject)}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join('');

  const masteredCount = Object.values(syllabus.subjects)
    .flat()
    .filter((c) => !c.x && c.read && c.stage >= 5).length;

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>گزارش مطالعه کنکور</title>
<style>
  body { font-family: Tahoma, system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.7; }
  .wrap { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 10px 8px; text-align: center; }
  th { background: #f1f5f9; font-weight: bold; }
  td:first-child { text-align: right; font-weight: bold; }
  @media print { body { background: #fff; padding: 0; } .wrap { border: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <h1>گزارش جامع مطالعه و کارنامه هفته‌ها</h1>
    <div class="meta">تاریخ خروجی: ${escapeHtml(new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'full' }).format(new Date()))} · تعداد فصل‌های تثبیت‌شده: ${escapeHtml(fa(masteredCount))}</div>
    <table>
      <thead>
        <tr><th>هفته</th><th>مجموع مطالعه</th><th>روزهای ثبت‌شده</th><th>تعداد تست</th><th>گوشی</th><th>میانگین خواب</th><th>درس برتر</th></tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="7">هنوز هفته‌ای ثبت نشده است.</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;
}
