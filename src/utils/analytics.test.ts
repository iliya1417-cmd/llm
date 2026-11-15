import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubjectChapters,
  computeWeekStats,
  dueReviews,
  isFilm,
  kindOf,
  overallProgress,
  subjectProgress,
  testKind,
  typeOf,
  weekMetrics,
} from './analytics';
import type { AllWeeks, AppSettings, SyllabusData } from '../types/study';

test('backward-compatible activity type mapping (film -> class, practice -> solo)', () => {
  assert.equal(typeOf({ testType: 'film' }), 'class');
  assert.equal(typeOf({ testType: 'practice' }), 'solo');
  assert.equal(kindOf({ testType: 'film' }), 'learn');
  assert.equal(kindOf({ testType: 'read' }), 'learn');
  assert.equal(kindOf({ testType: 'solo' }), 'practice');
  assert.equal(isFilm({ testType: 'class' }), true);
  assert.equal(isFilm({ testType: 'read' }), false);
  assert.equal(testKind({ testType: 'video' }), 'video');
  assert.equal(testKind({ testType: 'exam' }), 'exam');
  assert.equal(testKind({ testType: 'solo' }), 'solo');
});

test('computeWeekStats aggregates minutes, tests, sleep, phone, and top subject', () => {
  const weeks: AllWeeks = {
    '2026-11-14': {
      'شنبه': {
        sleep: 7.5,
        phone: 1.5,
        rest: 2,
        sessions: [
          { subject: 'زیست', topic: 'دنیای زنده', start: '08:00', end: '10:00', minutes: 120, tests: 40, testType: 'solo' },
          { subject: 'شیمی', topic: 'کیهان', start: '10:30', end: '12:00', minutes: 90, tests: 10, testType: 'class' },
        ],
      },
      'یکشنبه': {
        sleep: 7,
        phone: 2,
        rest: 1.5,
        sessions: [
          { subject: 'فیزیک', topic: 'اندازه‌گیری', start: '09:00', end: '10:00', minutes: 60, tests: 20, testType: 'exam' },
        ],
      },
    },
  };

  const st = computeWeekStats(weeks['2026-11-14']);
  assert.equal(st.totalMin, 270);
  assert.equal(st.filmMin, 90);
  assert.equal(st.practiceMin, 180);
  assert.equal(st.tests, 70);
  assert.equal(st.solo, 40);
  assert.equal(st.video, 10);
  assert.equal(st.exam, 20);
  assert.equal(st.sleep, 14.5);
  assert.equal(st.sleepDays, 2);
  assert.equal(st.phone, 3.5);
  assert.equal(st.topSubject, 'زیست');

  const m = weekMetrics(weeks, '2026-11-14');
  assert.equal(m.logged, 2);
  assert.equal(m.avgSleep, 7.25);
});

test('syllabus progress and dueReviews respect excluded and completed chapters', () => {
  const bio = buildSubjectChapters('زیست');
  bio[0].read = '2026-11-10';
  bio[0].test = true;
  bio[0].due = '2026-11-14';
  if (bio[0].subs) {
    bio[0].subs.forEach((s) => {
      s.f = true;
      s.p = true;
    });
  }
  bio[1].x = true; // excluded chapter

  const syllabus: SyllabusData = {
    subjects: { زیست: bio },
    log: [],
    v2: true,
  };
  const settings: AppSettings = { exam: [1406, 4, 11], gaps: [1, 3, 7, 14, 30] };

  const pr = subjectProgress(syllabus, settings, 'زیست');
  assert.equal(pr.n, bio.length - 1);
  assert.equal(pr.read, 1);
  assert.ok(overallProgress(syllabus) > 0);

  const due = dueReviews(syllabus, '2026-11-15');
  assert.equal(due.length, 1);
  assert.equal(due[0].c.id, bio[0].id);
});
