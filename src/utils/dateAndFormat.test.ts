import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysKey,
  daysBetween,
  fmtMin,
  int,
  jalaliToGregorian,
  keyFromDate,
  num,
  relDay,
  toEnDigits,
  weekStartOf,
} from './dateAndFormat';

test('toEnDigits converts Persian and Arabic digits and separators', () => {
  assert.equal(toEnDigits('۱۲۳٫۴۵'), '123.45');
  assert.equal(toEnDigits('٠٩٨،۷'), '098.7');
  assert.equal(int('۴۲'), 42);
  assert.equal(num('۱۳٫۵'), 13.5);
});

test('fmtMin formats minutes cleanly into Persian hours and minutes', () => {
  assert.equal(fmtMin(0), '-');
  assert.equal(fmtMin(45), '۴۵ دقیقه');
  assert.equal(fmtMin(120, true), '۲ س');
  assert.equal(fmtMin(135, false), '۲ ساعت و ۱۵ دقیقه');
});

test('weekStartOf returns Saturday of the same Persian week', () => {
  // 2026-11-15 is a Sunday -> Saturday is 2026-11-14
  const sunday = new Date(2026, 10, 15, 12);
  assert.equal(keyFromDate(weekStartOf(sunday)), '2026-11-14');

  const saturday = new Date(2026, 10, 14, 12);
  assert.equal(keyFromDate(weekStartOf(saturday)), '2026-11-14');

  const friday = new Date(2026, 10, 20, 12);
  assert.equal(keyFromDate(weekStartOf(friday)), '2026-11-14');
});

test('jalaliToGregorian converts 1406/04/11 accurately and daysBetween works', () => {
  const dt = jalaliToGregorian(1406, 4, 11);
  // 1406-04-11 = 2027-07-02
  assert.equal(keyFromDate(dt), '2027-07-02');
  assert.equal(daysBetween('2027-07-01', '2027-07-02'), 1);
  assert.equal(addDaysKey('2026-11-14', 7), '2026-11-21');
});

test('relDay formats relative Persian days properly', () => {
  assert.equal(relDay('2026-11-15', '2026-11-15'), 'امروز');
  assert.equal(relDay('2026-11-16', '2026-11-15'), 'فردا');
  assert.equal(relDay('2026-11-13', '2026-11-15'), '۲ روز عقب');
  assert.equal(relDay('2026-11-18', '2026-11-15'), '۳ روز دیگر');
});
