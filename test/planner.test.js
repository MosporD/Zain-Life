// Run: node test/planner.test.js
const assert = require('assert');
const P = require('../www/planner.js');

const fill = (from, to, v) => { const o = {}; for (let h = from; h < to; h++) o[h] = v; return o; };
const profile = {
  name: 'Test', sex: 'male', age: 27, height: 186, weight: 115,
  goals: ['weight', 'career', 'skill', 'pray'],
  workDays: [0, 1, 2, 3, 4],
  grids: {
    idealWork: { wake: 7, sleep: 24, cells: Object.assign({ 7: 'routine' }, fill(8, 17, 'work'), { 17: 'rest', 18: 'meal' }, fill(19, 24, 'phone')) },
    idealWeekend: { wake: 9, sleep: 25, cells: Object.assign({ 9: 'routine', 13: 'meal', 14: 'family' }, fill(20, 25, 'phone')) }
  },
  weightQ: { direction: 'lose', goal: 85, pace: 'steady', activity: 'desk', days: 3, time: 'afterwork', limits: 'lower-back disc' },
  careerQ: { focus: 'courses', hours: 5, time: 'evening' },
  skillQ: { skill: 'Guitar', hours: 2, time: 'weekend' },
  prayQ: { quran: 15, place: 'home' }
};

const res = P.buildTemplates(profile, 30);
const show = d => res.templates[d].map(b => `  ${b.start}-${b.end}  ${b.title}${b.remind ? '  [remind]' : ''}`).join('\n');
console.log('SUNDAY (training day)\n' + show(0));
console.log('\nMONDAY\n' + show(1));
console.log('\nFRIDAY (weekend)\n' + show(5));
console.log('\nnotes:', res.notes);
console.log('shortfalls:', res.shortfalls);

// Every template is sorted, non-empty, and uses valid HH:MM with start < end.
for (let d = 0; d < 7; d++) {
  const t = res.templates[d];
  assert(t.length > 0, 'empty day ' + d);
  t.forEach(b => {
    assert(/^\d\d:\d\d$/.test(b.start) && /^\d\d:\d\d$/.test(b.end), 'bad time ' + JSON.stringify(b));
    assert(b.start < b.end, 'start >= end ' + JSON.stringify(b));
  });
}
const has = (d, t) => res.templates[d].some(b => b.title.startsWith(t));
assert(has(0, 'Training') && has(2, 'Training') && has(4, 'Training'), 'training Sun/Tue/Thu');
assert(!has(1, 'Training'), 'no training Monday');
assert(has(1, 'Walk or bike'), 'cardio on rest day');
assert(has(1, 'Career'), 'career on workday');
assert(has(5, 'Practice · Guitar'), 'skill on weekend');
assert(has(3, 'Quran'), 'quran daily');
assert(res.templates[1].filter(b => b.title.startsWith('Scroll window')).length === 1, 'one scroll window');
assert(has(1, 'Wind down'), 'wind down');
assert(has(5, 'Sleep'), 'post-midnight sleep block');

// Overnight shift (Sun–Thu, 10 pm – 6 am): the tail of each shift lands on the next calendar day.
{
  const night = Object.assign({}, profile, { workDays: [0, 1, 2, 3, 4], grids: Object.assign({}, profile.grids, { idealWork: { wake: 15, sleep: 31, cells: fill(22, 30, 'work') } }) });
  const n = P.buildTemplates(night, 30).templates;
  const work = d => n[d].filter(b => b.cat === 'work').map(b => b.start + '-' + b.end).join(',');
  assert(work(0) === '22:00-23:59', 'Sunday: shift starts at 10 pm only, got ' + work(0));
  assert(work(1) === '00:00-06:00,22:00-23:59', 'Monday: end of Sunday shift + own shift, got ' + work(1));
  assert(work(5) === '00:00-06:00', 'Friday: end of Thursday shift, got ' + work(5));
  assert(work(6) === '', 'Saturday: no work');
  assert(n[0][0].title === 'Sleep' && n[0][0].start === '00:00', 'Sunday morning before the first shift is sleep');
  for (let d = 0; d < 7; d++) for (let i = 1; i < n[d].length; i++) assert(n[d][i].start >= n[d][i - 1].end, 'overlap on day ' + d);
}

const m = P.macroTargets(profile);
console.log('\nmacros:', m);
assert(m.kcal > 2000 && m.kcal < 2700, 'kcal sane');
assert.strictEqual(m.p, 170);
assert(Math.abs(m.p * 4 + m.c * 4 + m.f * 9 - m.kcal) < 10, 'macros add up to kcal');
const f = P.macroTargets({ sex: 'female', age: 30, height: 160, weight: 60, goals: [] });
assert(f.kcal >= 1200, 'female floor');
// Typed activities are classified so the planner can use them.
const C = P.classify;
assert.strictEqual(C('Scrolling Instagram').phone, true);
assert.strictEqual(C('Watching Netflix').free, true);
assert.strictEqual(C('Gym with Ahmad').cat, 'health');
assert.strictEqual(C('Drive to work').cat, 'work');
assert.strictEqual(C('Read Quran').cat, 'faith');
assert.strictEqual(C('Dinner with family').cat, 'family');
assert.strictEqual(C('Something else').cat, 'rest');
assert.strictEqual(C('Something else').free, undefined);
// A typed phone hour gets replaced by a goal, a typed fixed hour does not.
const typed = JSON.parse(JSON.stringify(profile));
typed.grids.idealWork.cells = Object.assign({ 7: 'routine' }, fill(8, 17, 'work'),
  { 17: 'c:Drive to my parents', 18: 'c:Dinner', 19: 'c:TikTok', 20: 'c:TikTok', 21: 'c:Instagram', 22: 'c:Netflix', 23: 'c:Netflix' });
const r2 = P.buildTemplates(typed, 30);
assert(r2.templates[0].some(b => b.title === 'Drive to my parents'), 'typed fixed hour kept');
assert(r2.templates[0].some(b => b.title === 'Training'), 'training placed into typed phone time');
// 15-minute precision: Quran 15 min is exactly 15 min, scroll window is exactly the limit.
const dur = b => { const m = t => +t.slice(0, 2) * 60 + +t.slice(3); return m(b.end) - m(b.start); };
assert.strictEqual(dur(res.templates[1].find(b => b.title.startsWith('Quran'))), 15, 'quran 15 min');
assert.strictEqual(dur(res.templates[1].find(b => b.title.startsWith('Scroll window'))), 30, 'scroll window 30 min');
// A split hour: 18:00 meal 15 min, 18:15 prayer 15 min, 18:30-19:00 phone.
const split = JSON.parse(JSON.stringify(profile));
split.goals = [];
split.grids.idealWork.split = { 18: true };
Object.assign(split.grids.idealWork.cells, { '18:0': 'meal', '18:1': 'c:Maghrib prayer', '18:2': 'phone', '18:3': 'phone' });
const r3 = P.buildTemplates(split, 30).templates[1];
const at = t => r3.find(b => b.start === t);
assert(at('18:00').title === 'Meal' && at('18:00').end === '18:15', 'quarter meal');
assert(at('18:15').title === 'Maghrib prayer' && at('18:15').cat === 'faith' && at('18:15').end === '18:30', 'quarter typed prayer');
assert(at('18:30').title.startsWith('Scroll window'), 'scroll window starts at first phone quarter');

// Reminders: every real task on, idle time and sleep off.
const sun = res.templates[0];
assert(sun.find(b => b.title === 'Work').remind, 'work reminds');
assert(sun.find(b => b.title === 'Meal').remind, 'meal reminds');
assert(!sun.find(b => b.title === 'Free time').remind, 'free time silent');
assert(!res.templates[5].find(b => b.title === 'Sleep').remind, 'sleep silent');
console.log('\nALL PLANNER TESTS PASSED');
