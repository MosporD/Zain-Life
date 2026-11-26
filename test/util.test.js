// Run: node test/util.test.js
process.env.TZ = 'Asia/Amman';
const assert = require('assert');
const U = require('../www/util.js');

assert.strictEqual(U.pad(5), '05');
assert.strictEqual(U.pad(12), '12');
assert.strictEqual(U.dateKey(new Date(2026, 0, 9)), '2026-01-09');
assert.strictEqual(U.dateKey(U.fromKey('2026-12-31')), '2026-12-31');
assert.strictEqual(U.dateKey(U.addDays(U.fromKey('2026-12-31'), 1)), '2027-01-01');
assert.strictEqual(U.dateKey(U.addDays(U.fromKey('2028-03-01'), -1)), '2028-02-29', 'leap day');
assert.strictEqual(U.daysBetween(U.fromKey('2026-01-01'), U.fromKey('2026-12-31')), 364);
assert.strictEqual(U.todayKey(), U.dateKey(new Date()));

assert.strictEqual(U.toMin('07:30'), 450);
assert.strictEqual(U.toMin('24:00'), 1440);
assert.strictEqual(U.minToT(450), '07:30');
assert.strictEqual(U.minToT(U.toMin('23:45')), '23:45');
assert.strictEqual(U.fmt12('00:00'), '12 am');
assert.strictEqual(U.fmt12('12:00'), '12 pm');
assert.strictEqual(U.fmt12('13:05'), '1:05 pm');
assert.strictEqual(U.hourLabel(0), '12 am');
assert.strictEqual(U.hourLabel(25), '1 am', 'hours past midnight wrap');
assert.strictEqual(U.fmtDur(45), '45 min');
assert.strictEqual(U.fmtDur(60), '1h');
assert.strictEqual(U.fmtDur(95), '1h 35m');

assert.strictEqual(U.esc(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
assert.strictEqual(U.esc(null), '');
assert.strictEqual(U.num1(2.345), '2.3');
assert.strictEqual(U.num1(3), '3');
assert.deepStrictEqual(
  [{ start: '13:00' }, { start: '07:15' }, { start: '09:00' }].sort(U.byStart).map(b => b.start),
  ['07:15', '09:00', '13:00']);
const o = { a: { b: [1] } }, c = U.clone(o); c.a.b.push(2);
assert.deepStrictEqual(o.a.b, [1], 'clone is deep');
assert(/^b[0-9a-z]+$/.test(U.uid()) && U.uid() !== U.uid(), 'uid');

console.log('ALL UTIL TESTS PASSED');
