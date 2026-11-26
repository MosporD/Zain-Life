/* Company step challenge check (Health tab). Between the challenge's dates, the phone takes a GPS fix
   every 20 seconds while steps are coming in, and sorts each minute of steps into "verified" (the phone
   moved), "without movement" (steps but same place, e.g. rocking the phone or a treadmill),
   "not checked" (GPS too weak), "in a vehicle" and "fake GPS". The native ChallengeService does the
   checking; this file shows the results and the settings. Results stay on the phone. */
(function () {
  'use strict';

  // Totals over the challenge's days. days = {'YYYY-MM-DD': {moving, still, unknown, idle, vehicle, mock, distM}}
  function summarize(days, from, to) {
    var t = { moving: 0, still: 0, unchecked: 0, vehicle: 0, mock: 0, distM: 0, list: [] };
    Object.keys(days || {}).sort().forEach(function (k) {
      if ((from && k < from) || (to && k > to)) return;
      var d = days[k] || {};
      var row = { date: k, moving: d.moving || 0, still: d.still || 0, unchecked: (d.unknown || 0) + (d.idle || 0), vehicle: d.vehicle || 0, mock: d.mock || 0, distM: d.distM || 0 };
      t.moving += row.moving; t.still += row.still; t.unchecked += row.unchecked; t.vehicle += row.vehicle; t.mock += row.mock; t.distM += row.distM;
      t.list.push(row);
    });
    var all = t.moving + t.still + t.unchecked + t.vehicle + t.mock;
    t.total = all;
    t.verifiedPct = all ? Math.round(t.moving * 100 / all) : 0;
    return t;
  }
  var api = { summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  window.ZLChallenge = api;

  var L = window.LP;
  if (!L) return;
  var esc = L.esc, H = L.HOOKS, A = L.ACTIONS, toast = L.toast;
  var cs = null, lastPull = 0;

  function NP() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LifeNative ? C.Plugins.LifeNative : null;
  }
  function sec(title, body) { return '<section><div class="sec-h"><h2>' + title + '</h2></div>' + body + '</section>'; }
  function rerender() { if (!L.inSetup() && !L.sheetOpen() && !L.isTyping() && L.tab() === 'health') L.render(); }
  function keyOf(ms) { return ms ? L.dateKey(new Date(ms)) : ''; }
  function lastDayKey(ms) { return ms ? L.dateKey(new Date(ms - 1)) : ''; }
  function n(x) { return (x || 0).toLocaleString(); }

  function pull(force) {
    var np = NP();
    if (!np || (!force && Date.now() - lastPull < 15000)) return Promise.resolve(cs);
    lastPull = Date.now();
    return np.challengeEnsure().then(function (s) { cs = s; rerender(); return s; }).catch(function (e) { console.warn('challenge', e); });
  }

  function form(s) {
    var name = s && s.name || '', from = s && keyOf(s.start) || L.todayKey(), to = s && lastDayKey(s.end) || L.dateKey(L.addDays(L.today(), 29));
    return '<label class="field"><span>Challenge name</span><input type="text" class="notr" id="ch-name" maxlength="50" value="' + esc(name) + '"></label>' +
      '<div class="two"><label class="field"><span>First day</span><input type="date" id="ch-from" value="' + esc(from) + '"></label>' +
      '<label class="field"><span>Last day</span><input type="date" id="ch-to" value="' + esc(to) + '"></label></div>';
  }

  function statusLine(s) {
    var now = Date.now();
    if (s.error) return '<p class="small ch-warn">' + esc(s.error) + '</p>';
    if (!s.location) return '<p class="small ch-warn">Location is off for Zain Life, so steps can’t be checked.</p>';
    if (!s.activity) return '<p class="small ch-warn">Physical activity is off for Zain Life, so steps can’t be counted.</p>';
    if (now < s.start) return '<p class="small">Starts on <b>' + esc(L.shortDate(keyOf(s.start))) + '</b>. The check turns on by itself when you open the app that day.</p>';
    if (now >= s.end) return '<p class="small">This challenge has ended. Save the report to share your results.</p>';
    var out = s.running ? '<p class="small"><b class="ch-on">Checking</b> · GPS every 20 seconds while you walk, off when you stop.</p>'
      : '<p class="small ch-warn">The check is not running. Open the app to restart it (after a phone restart, for example).</p>';
    if (!s.precise) out += '<p class="small ch-warn">Location is set to “approximate”, so most steps will show as not checked. Allow precise location for Zain Life.</p>';
    if (s.gps === 'off') out += '<p class="small ch-warn">Location is turned off on the phone. Turn it on while you walk.</p>';
    return out;
  }

  function resultsHtml(s) {
    var t = summarize(s.days, keyOf(s.start), lastDayKey(s.end));
    var tiles = '<div class="rs-grid">' +
      L.statTile('Verified steps', n(t.moving), t.total ? t.verifiedPct + '% of counted' : 'none yet') +
      L.statTile('Steps without movement', n(t.still)) +
      L.statTile('Not checked (weak GPS)', n(t.unchecked)) +
      L.statTile('Verified distance', (t.distM / 1000).toFixed(1) + ' km') + '</div>';
    var flags = '';
    if (t.vehicle) flags += '<p class="small ch-warn">' + n(t.vehicle) + ' steps were counted while moving faster than walking (a car or bus). Not counted.</p>';
    if (t.mock) flags += '<p class="small ch-warn">' + n(t.mock) + ' steps came with a fake-location app running. Not counted.</p>';
    var rows = t.list.slice(-7).reverse().map(function (r) {
      return '<li class="ch-day"><span>' + esc(L.shortDate(r.date)) + '</span><span><b>' + n(r.moving) + '</b> verified</span><span class="muted">' + n(r.still) + ' without movement · ' + n(r.unchecked) + ' not checked</span></li>';
    }).join('');
    return tiles + flags + (rows ? '<ul class="ch-days">' + rows + '</ul>' : '');
  }

  function card() {
    var np = NP();
    if (!np) return sec('Step challenge', '<div class="card"><p class="small">The step challenge check works in the Android app. It uses GPS every 20 seconds while you walk to confirm your steps are real movement.</p></div>');
    if (!cs) { pull(true); return ''; }
    var s = cs;
    var intro = '<p class="muted small" style="margin-top:8px">During a company challenge, the phone checks its location every 20 seconds, only while steps are coming in. Steps without movement (rocking the phone, a treadmill) are shown separately. Results stay on this phone until you save the report.</p>';
    if (!s.on) {
      return sec('Step challenge', '<div class="card"><b>Join a company step challenge</b>' + form(s) +
        '<div class="row-btns"><button class="btn" data-act="ch-start">Start the check</button></div>' + intro + '</div>');
    }
    return sec('Step challenge', '<div class="card"><div class="ch-head"><b class="notr">' + esc(s.name || 'Step challenge') + '</b><span class="muted small">' +
      esc(L.shortDate(keyOf(s.start))) + ' – ' + esc(L.shortDate(lastDayKey(s.end))) + '</span></div>' + statusLine(s) + resultsHtml(s) +
      '<div class="row-btns">' + (!s.location || !s.activity ? '<button class="btn" data-act="ch-perms">Allow</button>' : '') +
      '<button class="btn ghost" data-act="ch-report">Save report</button><button class="btn ghost" data-act="ch-stop">Stop the check</button></div>' + intro + '</div>');
  }

  function dayStart(k) { return L.fromKey(k).getTime(); }

  A['ch-start'] = function () {
    var np = NP(); if (!np) return;
    var name = (document.getElementById('ch-name').value || '').trim() || 'Step challenge';
    var from = document.getElementById('ch-from').value, to = document.getElementById('ch-to').value;
    if (!from || !to || to < from) { toast('Pick a first and last day.'); return; }
    var start = dayStart(from), end = L.addDays(L.fromKey(to), 1).getTime();
    np.challengeSet({ name: name, start: start, end: end, on: true, clear: true })
      .then(function () { return np.challengePermissions(); })
      .then(function (s) { cs = s; L.render(); toast(s.running ? 'Challenge check is on' : 'Challenge saved'); })
      .catch(function (e) { toast('Could not start: ' + (e && e.message || 'error')); });
  };
  A['ch-perms'] = function () {
    var np = NP(); if (!np) return;
    np.challengePermissions().then(function (s) { cs = s; L.render(); }).catch(function () { toast('Could not ask for permission'); });
  };
  A['ch-stop'] = function (el) {
    if (!L.armed(el, 'Tap again to stop')) return;
    var np = NP(); if (!np) return;
    np.challengeSet({ on: false }).then(function (s) { cs = s; L.render(); toast('Challenge check stopped'); });
  };
  A['ch-report'] = function () {
    var np = NP(); if (!np || !cs) return;
    var st = L.st(), p = st.profile || {}, about = p.about || {};
    var t = summarize(cs.days, keyOf(cs.start), lastDayKey(cs.end));
    var report = {
      app: 'Zain Life', kind: 'step-challenge', version: 1, made: new Date().toISOString(),
      challenge: { name: cs.name, firstDay: keyOf(cs.start), lastDay: lastDayKey(cs.end) },
      person: { name: p.name || '', title: about.title || '', dept: about.dept || '' },
      method: 'GPS fix every 20 s while steps rise; each minute judged: moved >= 35% of steps x 0.7 m = verified.',
      totals: { verified: t.moving, withoutMovement: t.still, notChecked: t.unchecked, vehicle: t.vehicle, fakeGps: t.mock, verifiedKm: +(t.distM / 1000).toFixed(2) },
      days: t.list
    };
    var name = 'ZainLife-challenge-' + L.todayKey() + '.json';
    np.saveBackup({ name: name, data: JSON.stringify(report, null, 2) })
      .then(function () { toast('Report saved in Downloads/ZainLife'); })
      .catch(function (e) { toast('Could not save the report: ' + (e && e.message || 'error')); });
  };

  H.healthActivity.push(function () { pull(false); return card(); });
  H.resume.push(function () { pull(true); });
  document.addEventListener('DOMContentLoaded', function () { pull(true); });
})();
