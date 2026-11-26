// Smoke test: opens the app in a headless browser with a sample profile, in English and Arabic,
// visits every tab and taps every button on it (skipping delete/reset/restore), and fails on any
// JavaScript error. Catches code that breaks only when a screen is opened.
// Needs Playwright once:  npm i -D playwright  then  npx playwright install chromium
// Run: npm run smoke
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..', 'www'), port = +(process.argv[3] || 5174);
const P = require(path.join(root, 'planner.js'));
const srv = http.createServer((q, r) => { const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); r.end(d); }); }).listen(port);
const fill = (a, b, v) => { const o = {}; for (let h = a; h < b; h++) o[h] = v; return o; };
const profile = { name: 'Test', sex: 'male', age: 27, height: 186, weight: 115, religion: 'muslim', done: true,
  goals: ['weight', 'career', 'skill', 'pray'], workDays: [0, 1, 2, 3, 4],
  grids: { idealWork: { wake: 7, sleep: 24, cells: Object.assign({ 7: 'routine' }, fill(8, 17, 'work'), { 17: 'rest', 18: 'meal' }, fill(19, 24, 'phone')) },
    idealWeekend: { wake: 9, sleep: 25, cells: Object.assign({ 9: 'routine', 13: 'meal', 14: 'family' }, fill(20, 25, 'phone')) } },
  weightQ: { direction: 'lose', goal: 85, pace: 'steady', activity: 'desk', days: 3, time: 'afterwork', limits: '' },
  careerQ: { focus: 'courses', hours: 5, time: 'evening' }, skillQ: { skill: 'Guitar', hours: 2, time: 'weekend' },
  prayQ: { quran: 15, place: 'home', city: 'amman', remind: false } };
const state = { profile, templates: P.buildTemplates(profile, 30).templates, settings: { city: 'amman' }, weights: [{ date: '2026-11-20', kg: 115 }] };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const lang of ['en', 'ar']) {
    const pg = await b.newPage();
    pg.on('pageerror', e => errs.push(lang + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(lang + ' console.' + m.type() + ': ' + m.text()); });
    await pg.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('lifeplanner.v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(Object.assign({}, state, { settings: Object.assign({}, state.settings, { lang }) })));
    await pg.goto(`http://127.0.0.1:${port}/`); await pg.waitForTimeout(3500);
    const tabs = await pg.$$eval('#drawer [data-tab]', e => e.map(x => x.dataset.tab));
    let clicks = 0;
    for (const t of tabs) {
      await pg.evaluate(t => window.LP && LP.setTab ? LP.setTab(t) : document.querySelector(`#drawer [data-tab="${t}"]`).click(), t);
      await pg.waitForTimeout(300);
      const acts = await pg.$$eval('#view [data-act]', e => [...new Set(e.map(x => x.dataset.act))]);
      for (const a of acts) {
        if (/del|reset|wipe|restore|import|clear/i.test(a)) continue;
        try { await pg.evaluate(a => { const el = document.querySelector(`#view [data-act="${a}"]`); el && el.click(); }, a); clicks++; } catch (e) {}
        await pg.waitForTimeout(80);
        await pg.evaluate(() => window.LP && LP.closeSheet && document.querySelector('#sheet-root *') && LP.closeSheet());
        await pg.evaluate(t => LP.setTab(t), t);
      }
    }
    errs.push(`${lang}: ${tabs.length} tabs, ${clicks} buttons clicked`);
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(errs.join('\n'));
  const bad = errs.filter(e => !/buttons clicked$/.test(e));
  if (bad.length) { console.error(`\nSMOKE TEST FAILED: ${bad.length} error(s)`); process.exit(1); }
  console.log('SMOKE TEST PASSED');
})();
