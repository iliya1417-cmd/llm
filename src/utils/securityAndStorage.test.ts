import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSha256,
  createBackupEnvelope,
  generateStudyCsv,
  parseBackupEnvelope,
  sanitizeObject,
  validateAndSanitizeSettings,
  validateAndSanitizeWeeks,
} from './securityAndStorage';
import type { AllWeeks, AppSettings, SyllabusData } from '../types/study';

test('sanitizeObject strips prototype pollution keys recursively', () => {
  const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"bad":1},"safe":{"nested":"ok"}}');
  const cleaned = sanitizeObject<Record<string, unknown>>(malicious);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, 'constructor'), false);
  assert.deepEqual(cleaned.safe, { nested: 'ok' });
});

test('validateAndSanitizeWeeks clamps invalid numeric bounds and ignores bad keys', () => {
  const dirty = {
    'not-a-date': { شنبه: { sleep: 8, phone: 0, rest: 0, sessions: [] } },
    '2026-11-14': {
      شنبه: {
        sleep: 99,
        phone: -5,
        rest: 2,
        sessions: [
          { subject: 'زیست', topic: 'تست', minutes: 99999, tests: -10, testType: 'solo' },
        ],
      },
    },
  };
  const valid = validateAndSanitizeWeeks(dirty);
  assert.equal(valid['not-a-date'], undefined);
  assert.equal(valid['2026-11-14']['شنبه'].sleep, 24);
  assert.equal(valid['2026-11-14']['شنبه'].phone, 0);
  assert.equal(valid['2026-11-14']['شنبه'].sessions[0].minutes, 1440);
  assert.equal(valid['2026-11-14']['شنبه'].sessions[0].tests, 0);
});

test('validateAndSanitizeSettings falls back on out-of-range exam dates', () => {
  const s = validateAndSanitizeSettings({ exam: [1200, 99, 50], gaps: [-1, 3, 7] });
  assert.deepEqual(s.exam, [1406, 4, 11]);
  assert.deepEqual(s.gaps, [3, 7]);
});

test('backup envelope verifies SHA-256 integrity and supports AES-GCM encryption roundtrip', async () => {
  const weeks: AllWeeks = {
    '2026-11-14': {
      شنبه: {
        sleep: 7,
        phone: 1,
        rest: 2,
        sessions: [{ subject: 'زیست', topic: 'دنیای زنده', start: '08:00', end: '09:30', minutes: 90, tests: 25, testType: 'solo' }],
      },
    },
  };
  const syllabus: SyllabusData = { subjects: {}, log: [], v2: true };
  const settings: AppSettings = { exam: [1406, 4, 11] };

  // Plain + integrity hash
  const plainEnv = await createBackupEnvelope({ weeks, syllabus, settings });
  assert.equal(plainEnv.encrypted, false);
  assert.ok(plainEnv.integrity?.hash);
  const parsedPlain = await parseBackupEnvelope(JSON.stringify(plainEnv));
  assert.equal(parsedPlain.integrityStatus, 'verified');
  assert.equal(parsedPlain.weeks['2026-11-14']['شنبه'].sessions[0].minutes, 90);

  // Tampered hash detection
  const tampered = structuredClone(plainEnv);
  if (tampered.weeks) tampered.weeks['2026-11-14']['شنبه'].sleep = 12;
  const parsedTampered = await parseBackupEnvelope(JSON.stringify(tampered));
  assert.equal(parsedTampered.integrityStatus, 'mismatch');

  // Encrypted AES-GCM roundtrip
  const encEnv = await createBackupEnvelope({ weeks, syllabus, settings }, 'my-secret-pass');
  assert.equal(encEnv.encrypted, true);
  assert.equal(encEnv.weeks, undefined);
  await assert.rejects(() => parseBackupEnvelope(JSON.stringify(encEnv)), /PASSPHRASE_REQUIRED/);
  await assert.rejects(() => parseBackupEnvelope(JSON.stringify(encEnv), 'wrong'), /WRONG_PASSPHRASE/);
  const decrypted = await parseBackupEnvelope(JSON.stringify(encEnv), 'my-secret-pass');
  assert.equal(decrypted.wasEncrypted, true);
  assert.equal(decrypted.integrityStatus, 'verified');
  assert.equal(decrypted.weeks['2026-11-14']['شنبه'].sessions[0].tests, 25);
});

test('generateStudyCsv neutralizes formula injection and includes UTF-8 BOM', () => {
  const weeks: AllWeeks = {
    '2026-11-14': {
      شنبه: {
        sleep: 7,
        phone: 1,
        rest: 1,
        sessions: [{ subject: 'زیست', topic: '=HYPERLINK("bad")', start: '', end: '', minutes: 60, tests: 10, testType: 'solo' }],
      },
    },
  };
  const csv = generateStudyCsv(weeks);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
});

test('computeSha256 returns 64-char hex digest', async () => {
  const h = await computeSha256('abc');
  assert.equal(h.length, 64);
});
