// Step challenge totals (www/challenge.js summarize).
const assert = require('assert');
const { summarize } = require('../www/challenge.js');

const days = {
  '2026-11-30': { moving: 999 },                                   // before the challenge
  '2026-12-01': { moving: 6000, still: 400, unknown: 300, idle: 50, distM: 4200 },
  '2026-12-02': { moving: 8000, still: 2500, vehicle: 120, mock: 0, distM: 5600 },
  '2026-12-08': { moving: 1 }                                      // after it
};
const t = summarize(days, '2026-12-01', '2026-12-07');
assert.strictEqual(t.list.length, 2);
assert.strictEqual(t.moving, 14000);
assert.strictEqual(t.still, 2900);
assert.strictEqual(t.unchecked, 350);
assert.strictEqual(t.vehicle, 120);
assert.strictEqual(t.distM, 9800);
assert.strictEqual(t.total, 14000 + 2900 + 350 + 120);
assert.strictEqual(t.verifiedPct, 81);
assert.deepStrictEqual(t.list.map(r => r.date), ['2026-12-01', '2026-12-02']);

const empty = summarize({}, '2026-12-01', '2026-12-07');
assert.strictEqual(empty.total, 0);
assert.strictEqual(empty.verifiedPct, 0);
assert.strictEqual(summarize(null).list.length, 0);
console.log('challenge: all passed');
