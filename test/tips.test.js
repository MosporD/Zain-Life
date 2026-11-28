// Run: node test/tips.test.js
process.env.TZ = 'Asia/Amman';
const assert = require('assert');
const T = require('../www/tips.js');

// Every tip has Arabic for its title, text and the notification line, and ids are unique.
const ids = T.TIPS.map(t => t.id);
assert.strictEqual(new Set(ids).size, ids.length, 'tip ids are unique');
T.TIPS.forEach(t => {
  assert(['mind', 'body'].includes(t.cat), t.id + ' has a category');
  assert(T.AR[t.title] && T.AR[t.text] && T.AR[t.title + ' · ' + t.text], t.id + ' has Arabic');
});
assert(T.TIPS.filter(t => t.cat === 'mind').length >= 15 && T.TIPS.filter(t => t.cat === 'body').length >= 15);

// Pools: desk tips only at work, night tips only in the evening, food and water hidden while fasting.
const p = T.pool({ cat: 'body', atWork: false, evening: false, fasting: true });
assert(p.length > 5 && p.every(t => !t.tags.includes('desk') && !t.tags.includes('night') && !t.tags.includes('fast')));
assert(T.pool({ cat: 'body', atWork: true, evening: true, fasting: false }).some(t => t.tags.includes('fast')));

// Same day + slot = same tip; "Another tip" moves on.
const d = new Date(2026, 10, 29), c = { cat: 'mind', atWork: true, evening: false, fasting: false };
assert.strictEqual(T.pick(c, d, 0).id, T.pick(c, d, 0).id);
assert.notStrictEqual(T.pick(c, d, 0).id, T.pick(c, d, 0, 1).id);

// Category switches.
assert.strictEqual(T.catFor(d, { mind: false, body: true }), 'body');
assert.strictEqual(T.catFor(d, { mind: true, body: false }), 'mind');
assert.strictEqual(T.catFor(d, { mind: false, body: false }), null);

// Day shape from a normal 8-to-5 workday.
const work = [
  { id: 'r', title: 'Morning routine', start: '07:00', end: '08:00', cat: 'health' },
  { id: 'w', title: 'Work', start: '08:00', end: '17:00', cat: 'work' },
  { id: 'f', title: 'Free time', start: '17:00', end: '23:00', cat: 'rest' },
  { id: 'wd', title: 'Wind down · phone away', start: '23:00', end: '23:30', cat: 'sleep' }
];
assert.deepStrictEqual(T.dayShape(work), { wake: 420, bed: 1380, work: [480, 1020] });
// A night shift (work 22:00 to 06:00, sleep 07:00 to 15:00) has no daytime work window.
const night = [{ id: 's', title: 'Sleep', start: '07:00', end: '15:00', cat: 'sleep' }, { id: 'w', title: 'Work', start: '22:00', end: '06:00', cat: 'work' }];
const ns = T.dayShape(night);
assert.strictEqual(ns.wake, 900);
assert.strictEqual(ns.work, null);

// dodge: off the round quarter hours, and clear of busy windows.
assert.strictEqual(T.dodge(720, []), 727);
assert.strictEqual(T.dodge(727, [[720, 735]]), 747);

// The week: 2 a day on a workday = a body tip during work and a mind tip in the evening, unique ids.
const start = new Date(2026, 10, 29), now = start.getTime();
const list = T.build({ start, now, perDay: 2, mind: true, body: true, blocksFor: () => work });
assert.strictEqual(list.length, 14);
assert.strictEqual(new Set(list.map(n => n.id)).size, 14);
assert(list.every(n => n.id >= 7000 && n.id < 7035 && n.channelId === 'tips' && n.extra.type === 'tip'));
const day0 = list.filter(n => n.extra.date === '2026-11-29');
const h = n => n.schedule.at.getHours() * 60 + n.schedule.at.getMinutes();
assert(h(day0[0]) > 480 && h(day0[0]) < 1020 && day0[0].title === 'A minute for your body');
assert(h(day0[1]) >= 1020 && h(day0[1]) < 1380 && day0[1].title === 'A minute for your mind');
assert(list.every(n => n.schedule.at.getMinutes() % 15 !== 0), 'never on a round quarter hour');
// 3 a day, 1 a day, off.
assert.strictEqual(T.build({ start, now, perDay: 3, mind: true, body: true, blocksFor: () => work }).length, 21);
assert.strictEqual(T.build({ start, now, perDay: 1, mind: true, body: true, blocksFor: () => work }).length, 7);
assert.strictEqual(T.build({ start, now, perDay: 0, mind: true, body: true, blocksFor: () => work }).length, 0);
assert.strictEqual(T.build({ start, now, perDay: 2, mind: false, body: false, blocksFor: () => work }).length, 0);
// Only mind tips on: every reminder is a mind tip.
assert(T.build({ start, now, perDay: 3, mind: true, body: false, blocksFor: () => work }).every(n => n.title === 'A minute for your mind'));
// Fasting all day: no food or water tips.
const fastList = T.build({ start, now, perDay: 3, mind: true, body: true, blocksFor: () => work, fastFor: () => [270, 1020] });
assert(fastList.every(n => { const t = T.byId(n.extra.tip); return !(t.tags.includes('fast') && h(n) < 1020); }));
// Past times today are skipped.
assert.strictEqual(T.build({ start, now: start.getTime() + 22 * 3600000, perDay: 2, mind: true, body: true, blocksFor: () => work }).length, 12);
// A busy window over the work-time slot pushes it past the window.
const busy = T.build({ start, now, perDay: 1, mind: true, body: true, blocksFor: () => work, busyFor: () => [[700, 790]] });
assert(h(busy[0]) >= 800);

console.log('tips tests passed');
