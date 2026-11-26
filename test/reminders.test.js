// Run: node test/reminders.test.js
process.env.TZ = 'Asia/Amman';
const assert = require('assert');
const R = require('../www/reminders.js');

const CATS = { work: 'Work', health: 'Health', sleep: 'Sleep', rest: 'Rest' };
const blocks = [
  { id: 'w', title: 'Work', start: '08:00', end: '16:00', cat: 'work', remind: true },
  { id: 'g', title: 'Training', start: '17:30', end: '18:30', cat: 'health', remind: true },
  { id: 'f', title: 'Free time', start: '19:00', end: '22:00', cat: 'rest', remind: false },
  { id: 's', title: 'Sleep', start: '23:00', end: '07:00', cat: 'sleep', remind: false }
];
const prayers = [{ id: 'fajr', title: 'Fajr', start: '05:00', end: '05:15', cat: 'faith' }, { id: 'isha', title: 'Isha', start: '19:30', end: '19:45', cat: 'faith' }];
const start = new Date(2026, 10, 26);
const at = (h, m) => new Date(2026, 10, 26, h, m).getTime();
const build = o => R.build(Object.assign({ start, now: at(0, 0), blocksOn: true, prayOn: true, reportOn: true, cats: CATS,
  blocksFor: () => blocks, prayersFor: () => prayers }, o));

// Report: 15 min before an evening Sleep block, else before the last afternoon block ends, else 21:45.
assert.strictEqual(R.reportMinute(blocks), 23 * 60 - 15);
assert.strictEqual(R.reportMinute(blocks.filter(b => b.cat !== 'sleep')), 22 * 60 - 15);
assert.strictEqual(R.reportMinute([]), 22 * 60 - 15);

// A full week from midnight: per day 2 tasks x 2 + 2 prayers x 2 + 1 report = 9.
const all = build();
assert.strictEqual(all.length, 7 * 9);
const ids = all.map(n => n.id);
assert.strictEqual(new Set(ids).size, ids.length, 'notification ids are unique');
assert(ids.every(id => (id >= 1 && id < 1400) || (id >= 5000 && id < 5140) || (id >= 8000 && id < 8007)), 'ids stay in their ranges');

const work = all.filter(n => n.extra.id === 'w' && n.extra.date === '2026-11-26');
assert.deepStrictEqual(work.map(n => n.title), ['Work in 5 minutes', 'Work · now']);
assert.strictEqual(work[0].schedule.at.getTime(), at(7, 55));
assert.strictEqual(work[1].actionTypeId, 'TASK', '"now" reminder has the Mark done button');
assert.strictEqual(work[0].body, '8 am – 4 pm · Work');
assert.strictEqual(all.find(n => n.extra.id === 'fajr').channelId, 'prayers');
assert(!all.some(n => n.extra.id === 'f' || n.extra.id === 's'), 'blocks without remind stay silent');
const report = all.find(n => n.id === 8000);
assert.strictEqual(report.schedule.at.getTime(), at(22, 45));
assert.deepStrictEqual(report.extra, { type: 'report', date: '2026-11-26' });

// Nothing in the past (or within 30 s) is scheduled.
const noon = build({ now: at(12, 0) });
assert(noon.every(n => n.schedule.at.getTime() > at(12, 0) + 30000));
assert(!noon.some(n => n.extra.id === 'w' && n.extra.date === '2026-11-26'), "today's work reminder already passed");
assert(noon.some(n => n.extra.id === 'g' && n.extra.date === '2026-11-26'), "today's training is still ahead");

// Switches.
assert(!build({ prayOn: false }).some(n => n.channelId === 'prayers'));
assert(!build({ reportOn: false }).some(n => n.extra.type === 'report'));
const offOnlyPrayers = build({ blocksOn: false });
assert(offOnlyPrayers.length && offOnlyPrayers.every(n => n.channelId === 'prayers'), 'reminders off leaves prayers only');

// Quiet while asleep. Normal sleeper (23:00–07:00): Fajr at 05:00 is inside sleep.
{
  const list = build();
  const q = R.quietDuringSleep(list, { start, blocksFor: () => blocks, fajrWake: false });
  assert(!q.some(n => n.extra.id === 'fajr'), 'fajr muted when fajrWake is off');
  assert(q.some(n => n.extra.id === 'w') && q.some(n => n.id === 8000), 'work and report kept');
  const prayersP = [{ id: 'p-fajr', title: 'Fajr prayer', start: '05:00', end: '05:15', cat: 'faith' }];
  const withFajr = build({ prayersFor: () => prayersP });
  const kept = R.quietDuringSleep(withFajr, { start, blocksFor: () => blocks, fajrWake: true });
  assert(kept.some(n => n.extra.id === 'p-fajr'), 'fajr kept as a wake-up call');
}
// Night-shift sleeper (07:00–15:00 in the template): Dhuhr at 12:30 and a 09:00 task are muted.
{
  const night = [
    { id: 'n1', title: 'Work', start: '00:00', end: '06:00', cat: 'work', remind: true },
    { id: 'n2', title: 'Sleep', start: '07:00', end: '15:00', cat: 'sleep', remind: false },
    { id: 'n3', title: 'Errand', start: '09:00', end: '09:30', cat: 'rest', remind: true },
    { id: 'n4', title: 'Training', start: '16:00', end: '17:00', cat: 'health', remind: true }
  ];
  const dhuhr = [{ id: 'p-dhuhr', title: 'Dhuhr prayer', start: '12:30', end: '12:45', cat: 'faith' }];
  const list = build({ blocksFor: () => night, prayersFor: () => dhuhr });
  const q = R.quietDuringSleep(list, { start, blocksFor: () => night, fajrWake: true });
  assert(!q.some(n => n.extra.id === 'p-dhuhr' || n.extra.id === 'n3'), 'dhuhr and the 9 am task are muted');
  assert(q.some(n => n.extra.id === 'n4') && q.some(n => n.extra.id === 'n1'), 'waking-hours reminders kept');
}
console.log('ALL REMINDER TESTS PASSED');
