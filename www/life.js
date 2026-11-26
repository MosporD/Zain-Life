/* Zain Life — extra features plugged into app.js through window.LP hooks:
   water, mood, focus timer, moving missed tasks, workout logger, waist + progress photos,
   steps & sleep (Health Connect), Ramadan mode, Quran progress, prayer streaks, Qibla, athkar,
   savings goals, people, weekly review, automatic backup files and the home-screen widget. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, H = L.HOOKS, A = L.ACTIONS;
  var toMin = L.toMin, minToT = L.minToT, fmt12 = L.fmt12, todayKey = L.todayKey, dateKey = L.dateKey, fromKey = L.fromKey;
  var addDays = L.addDays, today = L.today, num1 = L.num1, toast = L.toast;
  var PHOTO_KEY = 'lifeplanner.photos';
  var KAABA = [21.4225, 39.8262];

  /* ---------------- data ---------------- */
  function F() {
    var s = L.st();
    var f = s.life = s.life || {};
    f.workouts = f.workouts || {};
    f.waist = Array.isArray(f.waist) ? f.waist : [];
    f.quran = f.quran || { log: {}, days: 30 };
    f.quran.log = f.quran.log || {};
    f.savings = f.savings || { monthly: 0, cur: 'JOD', goals: [] };
    f.savings.goals = f.savings.goals || [];
    f.people = Array.isArray(f.people) ? f.people : [];
    f.ramadan = f.ramadan || { start: '2027-02-08', len: 30, off: false };
    if (f.athkar == null) f.athkar = false;
    if (f.weekly == null) f.weekly = true;
    f.backup = f.backup || { auto: true, last: null };
    return f;
  }
  function NP() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LifeNative ? C.Plugins.LifeNative : null;
  }
  function city() { var c = PrayerTimes.CITIES[L.st().settings.city] || PrayerTimes.CITIES.amman; return c; }
  function ptimes(d) { var c = city(); return PrayerTimes.times(d, c.lat, c.lng); }
  function daysAgo(k) { return Math.round((today() - fromKey(k)) / 86400000); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rerender() { if (!L.inSetup() && !L.sheetOpen() && !L.isTyping()) L.render(); }
  function sec(title, body, right) { return '<section><div class="sec-h"><h2>' + title + '</h2>' + (right || '') + '</div>' + body + '</section>'; }
  function markTitleDone(k, re) {
    var rec = L.dayRec(k), hit = false;
    L.blocksForDate(fromKey(k)).forEach(function (b) { if (re.test(b.title) && !rec.done[b.id]) { rec.done[b.id] = true; hit = true; } });
    return hit;
  }

  /* =====================================================================
     WATER + MOOD + PEOPLE NUDGE (Today)
     ===================================================================== */
  // Water is kept in millilitres. Days saved before that counted 250 ml glasses; they convert on read.
  function waterGoal() {
    var w = +(L.latestWeight && L.latestWeight()) || (L.st().profile && +L.st().profile.weight) || 80;
    return clamp(Math.round((w * 30) / 250) * 250, 2000, 3000);      // ~30 ml per kg, rounded to 250 ml
  }
  function waterMl(rec) { return rec.waterMl != null ? rec.waterMl : (rec.water || 0) * 250; }
  L.waterMl = waterMl;
  var MOODS = ['Low', 'Meh', 'Okay', 'Good', 'Great'];
  // Today's steps as a ring (a pie of the daily goal), from Samsung Health or any app through Health Connect.
  function stepGoal() { var g = +L.st().settings.stepGoal; return g >= 1000 ? Math.round(g) : 8000; }
  function stepRing(steps, goal) {
    var R = 52, C = 2 * Math.PI * R, f = Math.min(1, steps / goal);
    return '<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="' + steps + ' of ' + goal + ' steps">' +
      '<circle class="ring-bg" cx="64" cy="64" r="' + R + '"/>' +
      '<circle class="ring-fg' + (f >= 1 ? ' full' : '') + '" cx="64" cy="64" r="' + R + '" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 64 64)"/>' +
      '<text x="64" y="62" class="ring-v">' + steps.toLocaleString() + '</text><text x="64" y="82" class="ring-l">steps</text></svg>';
  }
  H.dashSteps.push(function (k, rec) {
    var goal = stepGoal(), steps = rec.steps || 0, pct = Math.round(Math.min(1, steps / goal) * 100), left = Math.max(0, goal - steps);
    var linked = hc && hc.granted, native = !!NP();
    var side = '<div class="ring-side"><span class="lbl">Steps today</span>' +
      '<b class="ring-pct">' + pct + '%</b><span class="muted small">of your ' + goal.toLocaleString() + ' goal</span>' +
      '<span class="small" style="margin-top:6px">' + (left ? left.toLocaleString() + ' to go' : 'Goal reached') + '</span>' + '</div>';
    var note = linked ? '' : native && hc && hc.available
      ? '<div class="row-btns" style="margin-top:10px"><button class="btn ghost" data-act="hc-connect">Connect to Samsung Health</button></div>'
      : '';
    return '<section><div class="card steps-dash" data-tab="health" role="button"><div class="ring-row">' + stepRing(steps, goal) + side + '</div></div>' + note + '</section>';
  });
  L.waterGoal = waterGoal;      // the Today tab draws the water card
  H.dashTiles.push(function (k, rec) {
    var n = waterMl(rec), g = waterGoal();
    return L.dashTile('Water', num1(n / 1000) + ' L', n >= g ? 'goal reached' : 'of ' + num1(g / 1000) + ' L', 'today');
  });
  H.dashCards.push(function () {
    var due = overduePeople().slice(0, 3);
    if (!due.length) return '';
    return sec('Stay in touch', '<div class="card"><ul class="loglist">' + due.map(function (p) {
      return '<li><span class="ln"><b>' + esc(p.name) + '</b><span class="muted small">' + (p.last ? daysAgo(p.last) + ' days since you talked' : 'Not logged yet') + '</span></span>' +
        '<button class="btn ghost" data-act="p-talk" data-id="' + p.id + '">Talked today</button></li>';
    }).join('') + '</ul></div>');
  });
  function addWater(ml) {
    var r = L.dayRec(todayKey()), before = waterMl(r);
    r.waterMl = Math.max(0, before + ml);
    delete r.water;
    r.habits.water = r.waterMl >= 2000;
    L.save(); L.render();
    if (ml > 0 && before < waterGoal() && r.waterMl >= waterGoal()) toast('Water goal reached');
  }
  A['w-add'] = function (el) { addWater(+el.getAttribute('data-ml') || 250); };
  A['w-sub'] = function (el) { addWater(-(+el.getAttribute('data-ml') || 250)); };

  /* =====================================================================
     FOCUS TIMER
     ===================================================================== */
  var tick = null;
  function timer() { return F().timer || null; }
  function timerLeft(t) { return Math.max(0, t.start + t.min * 60000 - Date.now()); }
  function mmss(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + L.pad(s % 60); }
  function finishTimer(early) {
    var t = timer();
    if (!t) return;
    var mins = Math.round(Math.min(t.min * 60000, Date.now() - t.start) / 60000);
    var r = L.dayRec(t.date);
    r.focus = (r.focus || 0) + mins;
    r.focusBy = r.focusBy || {};
    r.focusBy[t.title] = (r.focusBy[t.title] || 0) + mins;
    F().timer = null;
    L.save(); L.queueReschedule();
    toast((early ? 'Stopped. ' : 'Session done. ') + mins + ' focused minutes logged');
  }
  H.todayTop.push(function () {
    var t = timer();
    if (!t) return '';
    var left = timerLeft(t);
    if (left <= 0) { setTimeout(function () { finishTimer(false); L.render(); }, 0); return ''; }
    if (!tick) tick = setInterval(function () {
      var el = document.getElementById('ft-left'), tt = timer();
      if (!el || !tt) { clearInterval(tick); tick = null; return; }
      var l = timerLeft(tt);
      el.textContent = mmss(l);
      if (l <= 0) { clearInterval(tick); tick = null; finishTimer(false); L.render(); }
    }, 1000);
    return '<div class="card ft"><span class="lbl">Focus session</span><div class="ft-row"><span class="ft-time" id="ft-left">' + mmss(left) + '</span>' +
      '<span class="ft-t"><b>' + esc(t.title) + '</b><span class="muted small">' + t.min + ' min · phone down</span></span></div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="ft-stop">Stop and save</button></div></div>';
  });
  H.timeline.push(function (b, done, isCurrent) {
    if (!isCurrent || done || timer() || !(b.cat === 'growth' || b.cat === 'work' || b.cat === 'faith') || b.prayer) return '';
    return '<button class="tl-move" data-act="ft-open" data-title="' + esc(b.title) + '">Focus</button>';
  });
  function openTimerSheet(title) {
    L.openSheet('<h3>Focus session</h3><label class="field"><span>What are you working on?</span><input id="ft-title" value="' + esc(title || '') + '"></label>' +
      '<p class="flabel" style="margin-top:14px">How long?</p><div class="choice">' + [25, 45, 60, 90].map(function (m) {
        return '<button type="button" class="chip" data-act="ft-start" data-v="' + m + '">' + m + ' min</button>';
      }).join('') + '</div><p class="muted small" style="margin-top:10px">You’ll get a notification when it ends. The minutes go into your daily report and weekly review.</p>');
  }
  A['ft-open'] = function (el) { openTimerSheet(el.getAttribute('data-title') || ''); };
  A['ft-start'] = function (el) {
    var title = (document.getElementById('ft-title').value || '').trim() || 'Focus';
    F().timer = { start: Date.now(), min: +el.getAttribute('data-v'), title: title, date: todayKey() };
    L.save(); L.closeSheet(); L.setTab('today'); L.reschedule();
    toast('Focus: ' + el.getAttribute('data-v') + ' minutes. Phone down.');
  };
  A['ft-stop'] = function () { finishTimer(true); L.render(); };

  /* =====================================================================
     MOVE A MISSED TASK TO LATER TODAY
     ===================================================================== */
  function findSlot(k, block) {
    var d = fromKey(k), len = toMin(block.end) - toMin(block.start);
    if (len <= 0) len += 1440;
    var from = Math.ceil((L.nowMin() + 5) / 15) * 15, limit = 1440;
    var all = L.blocksForDate(d).filter(function (x) { return x.id !== block.id && x.title !== 'Free time'; });
    all.forEach(function (x) { if (x.cat === 'sleep' && /^Sleep/.test(x.title) && toMin(x.start) >= from) limit = Math.min(limit, toMin(x.start)); });
    for (var t = from; t + len <= limit; t += 15) {
      var clash = all.some(function (x) {
        if (x.cat === 'sleep' && /^Sleep/.test(x.title)) return false;
        var s = toMin(x.start), e = toMin(x.end); if (e <= s) e = 1440;
        return s < t + len && e > t;
      });
      if (!clash) return t;
    }
    return null;
  }
  A['move-later'] = function (el) {
    var k = todayKey(), id = el.getAttribute('data-id'), s = L.st();
    var src = L.displayList(k).filter(function (b) { return b.id === id; })[0];
    if (!src) { toast('Only planned tasks can be moved'); return; }
    var t = findSlot(k, src);
    if (t == null) { toast('No free slot left today. Try tomorrow.'); return; }
    if (!s.overrides[k]) s.overrides[k] = L.clone(s.templates[today().getDay()]);
    var b = s.overrides[k].filter(function (x) { return x.id === id; })[0];
    var len = toMin(src.end) - toMin(src.start); if (len <= 0) len += 1440;
    b.start = minToT(t); b.end = minToT(Math.min(t + len, 1439)); b.remind = true;
    L.save(); L.render(); L.queueReschedule();
    toast('Moved ' + b.title + ' to ' + fmt12(b.start));
  };
  H.reportMissed.push(function (k, b, isToday) {
    if (!isToday || b.prayer || b.overlay) return '';
    return '<button class="linkbtn" data-act="move-later" data-id="' + esc(b.id) + '">Move to later today</button>';
  });

  /* =====================================================================
     WORKOUT LOGGER (Health)
     ===================================================================== */
  var EX = ['Leg press', 'Goblet box squat', 'Hip thrust / glute bridge', 'Leg curl', 'Leg extension', 'Chest-supported row', 'Lat pulldown',
    'Seated cable row', 'Machine chest press', 'Push-ups', 'Landmine press', 'Lateral raise', 'Biceps curl', 'Triceps pushdown',
    'Dead bug', 'Bird dog', 'Side plank', 'Pallof press', 'Incline walk', 'Bike'];
  function exNames() {
    var seen = {}, out = EX.slice();
    EX.forEach(function (e) { seen[e] = 1; });
    Object.keys(F().workouts).forEach(function (k) { F().workouts[k].forEach(function (x) { if (!seen[x.n]) { seen[x.n] = 1; out.push(x.n); } }); });
    return out;
  }
  function lastTime(name, before) {
    var ks = Object.keys(F().workouts).filter(function (k) { return k < before; }).sort().reverse();
    for (var i = 0; i < ks.length; i++) {
      var x = F().workouts[ks[i]].filter(function (e) { return e.n === name; })[0];
      if (x && x.sets.length) return { date: ks[i], sets: x.sets };
    }
    return null;
  }
  function setsTxt(sets) { return sets.map(function (s) { return (s[0] ? num1(s[0]) + ' kg × ' : '') + s[1]; }).join(', '); }
  function beatHint(sets) {
    var best = sets.reduce(function (a, s) { return !a || s[0] > a[0] || (s[0] === a[0] && s[1] > a[1]) ? s : a; }, null);
    if (!best) return '';
    return best[0] ? 'Beat it: ' + num1(best[0]) + ' kg × ' + (best[1] + 1) + ', or ' + num1(best[0] + 2.5) + ' kg × ' + best[1] : 'Beat it: ' + (best[1] + 1) + ' reps';
  }
  var wkEx = null;
  function openWorkout() {
    var k = todayKey(), list = F().workouts[k] || [];
    var names = exNames(), cur = wkEx || names[0];
    var logged = list.length ? list.map(function (x, i) {
      var lt = lastTime(x.n, k);
      return '<div class="wk-ex"><b>' + esc(x.n) + '</b>' + (lt ? '<span class="muted small">Last time (' + esc(L.shortDate(lt.date)) + '): ' + esc(setsTxt(lt.sets)) + '</span>' : '') +
        '<div class="wk-sets">' + x.sets.map(function (s, j) {
          return '<span class="wk-set">' + (s[0] ? num1(s[0]) + ' kg × ' : '') + s[1] + '<button class="x" data-act="wk-del" data-i="' + i + '" data-j="' + j + '" aria-label="Remove set">×</button></span>';
        }).join('') + '</div></div>';
    }).join('') : '<p class="muted small">No sets yet today.</p>';
    var lt = lastTime(cur, k + 'z');
    L.openSheet('<h3>Today’s workout</h3>' + logged +
      '<label class="field"><span>Exercise</span><select id="wk-n">' + names.map(function (n) { return '<option' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '<option value="__new">+ Another exercise…</option></select></label>' +
      '<input id="wk-new" placeholder="Exercise name" hidden style="margin-top:8px">' +
      '<p class="muted small" id="wk-last" style="margin-top:8px">' + (lt ? 'Last time: ' + esc(setsTxt(lt.sets)) + '<br><b>' + esc(beatHint(lt.sets)) + '</b>' : 'First time logging this one.') + '</p>' +
      '<div class="inline"><input type="number" id="wk-kg" inputmode="decimal" step="0.5" min="0" placeholder="kg (0 = bodyweight)"><input type="number" id="wk-reps" inputmode="numeric" min="1" placeholder="reps"></div>' +
      '<div class="row-btns"><button class="btn" data-act="wk-add">Add set</button><button class="btn ghost" data-act="close-sheet">Done</button></div>');
  }
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'wk-n') return;
    var nw = document.getElementById('wk-new');
    if (e.target.value === '__new') { nw.hidden = false; nw.focus(); return; }
    nw.hidden = true; wkEx = e.target.value; openWorkout();
  });
  A['wk-open'] = openWorkout;
  A['wk-add'] = function () {
    var sel = document.getElementById('wk-n').value, name = sel === '__new' ? (document.getElementById('wk-new').value || '').trim() : sel;
    var kg = parseFloat(document.getElementById('wk-kg').value), reps = parseInt(document.getElementById('wk-reps').value, 10);
    if (!name) { toast('Name the exercise'); return; }
    if (!(reps > 0 && reps < 200)) { toast('Enter the reps'); return; }
    if (isNaN(kg) || kg < 0) kg = 0;
    var k = todayKey(), list = F().workouts[k] = F().workouts[k] || [];
    var x = list.filter(function (e) { return e.n === name; })[0];
    if (!x) { x = { n: name, sets: [] }; list.push(x); }
    x.sets.push([Math.round(kg * 10) / 10, reps]);
    wkEx = name;
    if (markTitleDone(k, /training|gym|workout|exercise/i)) toast('Training ticked off for today');
    L.save(); openWorkout();
  };
  A['wk-del'] = function (el) {
    var k = todayKey(), list = F().workouts[k] || [], i = +el.getAttribute('data-i'), j = +el.getAttribute('data-j');
    if (!list[i]) return;
    list[i].sets.splice(j, 1);
    if (!list[i].sets.length) list.splice(i, 1);
    if (!list.length) delete F().workouts[k];
    L.save(); openWorkout();
  };
  function workoutCard() {
    var w = F().workouts, ks = Object.keys(w).sort().reverse();
    var weekStart = addDays(today(), -6), thisWeek = ks.filter(function (k) { return fromKey(k) >= weekStart; }).length;
    var hist = ks.slice(0, 5).map(function (k) {
      var sets = 0, vol = 0;
      w[k].forEach(function (x) { x.sets.forEach(function (s) { sets++; vol += s[0] * s[1]; }); });
      return '<li><span class="ln"><b>' + esc(L.shortDate(k)) + '</b><span class="muted small">' + esc(w[k].map(function (x) { return x.n; }).join(', ')) + '</span></span>' +
        '<span class="lk">' + sets + ' sets' + (vol ? '<br><span class="muted small">' + Math.round(vol).toLocaleString() + ' kg</span>' : '') + '</span></li>';
    }).join('');
    return sec('Workouts', '<div class="card"><div class="kcal"><span class="big">' + thisWeek + '</span><span class="of">workouts in the last 7 days</span></div>' +
      '<div class="row-btns"><button class="btn" data-act="wk-open">Log today’s workout</button></div>' +
      (hist ? '<ul class="loglist" style="margin-top:12px">' + hist + '</ul>' : '<p class="muted small" style="margin-top:10px">Log your sets and next time you’ll see exactly what to beat.</p>') + '</div>');
  }

  /* =====================================================================
     WAIST + PROGRESS PHOTOS (Health)
     ===================================================================== */
  function photos() { try { return JSON.parse(localStorage.getItem(PHOTO_KEY)) || []; } catch (e) { return []; } }
  function savePhotos(p) {
    try { localStorage.setItem(PHOTO_KEY, JSON.stringify(p)); return true; }
    catch (e) { toast('Not enough space for another photo. Remove an old one.'); return false; }
  }
  function bodyCard() {
    var ws = F().waist.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var wl = ws.slice(0, 6).map(function (w, i) {
      var prev = ws[i + 1], d = prev ? w.cm - prev.cm : null;
      return '<li><span class="wd">' + esc(L.shortDate(w.date)) + '</span><span class="wk">' + num1(w.cm) + ' cm</span><span class="delta' + (d == null ? '' : d < 0 ? ' down' : d > 0 ? ' up' : '') + '">' +
        (d ? (d > 0 ? '+' : '') + num1(d) : '') + '</span><button class="x" data-act="waist-del" data-date="' + w.date + '" aria-label="Remove">×</button></li>';
    }).join('');
    var ph = photos(), first = ph[0], last = ph[ph.length - 1];
    var cmp = ph.length ? '<div class="ph-cmp">' + (ph.length > 1 ? '<figure><img src="' + first.img + '" alt="First progress photo"><figcaption>' + esc(L.shortDate(first.date)) + '</figcaption></figure>' : '') +
      '<figure><img src="' + last.img + '" alt="Latest progress photo"><figcaption>' + esc(L.shortDate(last.date)) + (ph.length > 1 ? ' · latest' : '') + '</figcaption></figure></div>' +
      '<p class="muted small" style="margin-top:6px">' + ph.length + ' photo' + (ph.length === 1 ? '' : 's') + ' · stored only on this phone</p>' : '';
    var lastPh = last ? daysAgo(last.date) : null;
    return sec('Waist &amp; photos', '<div class="card"><p class="flabel">Waist (at the belly button, relaxed)</p>' +
      '<div class="inline"><input type="number" id="waist-cm" inputmode="decimal" step="0.5" placeholder="cm"><button class="btn" data-act="waist-log">Save</button></div>' +
      (wl ? '<ul class="wlist" style="margin-top:10px">' + wl + '</ul>' : '') +
      '<p class="flabel" style="margin-top:16px">Progress photos</p>' + cmp +
      '<p class="muted small" style="margin-top:6px">' + (lastPh == null ? 'Take one now, then once a month: same spot, same light, same clothes.' : lastPh >= 28 ? 'It’s been ' + lastPh + ' days. Time for this month’s photo.' : 'Next photo in ' + (28 - lastPh) + ' days.') + '</p>' +
      '<div class="row-btns"><label class="btn ghost filebtn">Add photo<input type="file" accept="image/*" id="ph-in" hidden></label>' +
      (ph.length ? '<button class="btn ghost" data-act="ph-del">Remove latest</button>' : '') + '</div></div>');
  }
  A['waist-log'] = function () {
    var v = parseFloat(document.getElementById('waist-cm').value);
    if (!(v >= 40 && v <= 250)) { toast('Enter your waist in cm'); return; }
    var k = todayKey();
    F().waist = F().waist.filter(function (w) { return w.date !== k; });
    F().waist.push({ date: k, cm: Math.round(v * 10) / 10 });
    L.save(); L.render(); toast('Waist saved');
  };
  A['waist-del'] = function (el) { var d = el.getAttribute('data-date'); F().waist = F().waist.filter(function (w) { return w.date !== d; }); L.save(); L.render(); };
  A['ph-del'] = function (el) {
    if (!L.armed(el, 'Tap again to remove')) return;
    var p = photos(); p.pop(); savePhotos(p); L.render();
  };
  // Shrinks the photo to 720 px so a year of monthly photos stays around a megabyte.
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'ph-in' || !e.target.files || !e.target.files[0]) return;
    var file = e.target.files[0], url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var sc = Math.min(1, 720 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var p = photos(), k = todayKey();
      p = p.filter(function (x) { return x.date !== k; });
      p.push({ date: k, img: c.toDataURL('image/jpeg', 0.72) });
      p.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (savePhotos(p)) { toast('Photo saved'); L.render(); }
    };
    img.onerror = function () { toast('Could not read that photo'); };
    img.src = url;
  });

  /* =====================================================================
     STEPS + SLEEP from Health Connect (Android 14+)
     ===================================================================== */
  var hc = null, lastHc = 0;     // {available, granted}
  function syncHealth(force) {
    var n = NP();
    if (!n || (!force && Date.now() - lastHc < 60000)) return Promise.resolve();
    lastHc = Date.now();
    return n.healthStatus().then(function (st) {
      hc = st;
      if (!st.available || !st.granted) return null;
      return n.healthDaily({ days: 7 }).then(function (res) {
        (res.days || []).forEach(function (d) {
          var r = L.dayRec(d.date);
          if (d.steps != null) r.steps = d.steps;
          if (d.sleepMin != null && d.sleepMin > 0) { r.sleepMin = d.sleepMin; if (d.sleepMin >= 420) r.habits.sleep7 = true; }
        });
        L.save(); if (L.tab() === 'health' || L.tab() === 'life') rerender();
      });
    }).catch(function (e) { console.warn('health', e); });
  }
  function fmtSleep(m) { return Math.floor(m / 60) + 'h ' + L.pad(m % 60) + 'm'; }
  function stepsCard() {
    var n = NP();
    if (!n) return '';
    if (!hc) return '';
    if (!hc.available) return sec('Steps & sleep', '<div class="card"><p class="muted small">' + esc(hc.reason || 'Health Connect is not available on this phone.') + '</p></div>');
    if (!hc.granted) {
      return sec('Steps & sleep', '<div class="card"><p class="small">Read your steps and sleep from <b>Health Connect</b>, where Samsung Health, Google Fit and most watches save them.</p>' +
        '<div class="row-btns"><button class="btn" data-act="hc-connect">Connect</button></div>' +
        '<p class="muted small" style="margin-top:8px">If the numbers stay empty, open Samsung Health (or Fit) → Settings → Health Connect and let it share steps and sleep.</p></div>');
    }
    var t = today(), r0 = L.peekDay(todayKey()), steps = [], sleeps = [];
    for (var i = 0; i < 7; i++) { var r = L.peekDay(dateKey(addDays(t, -i))); if (r.steps != null) steps.push(r.steps); if (r.sleepMin) sleeps.push(r.sleepMin); }
    var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null; };
    return sec('Steps & sleep', '<div class="card"><div class="rs-grid">' +
      L.statTile('Steps today', (r0.steps || 0).toLocaleString(), 'goal ' + stepGoal().toLocaleString()) +
      L.statTile('Sleep last night', r0.sleepMin ? fmtSleep(r0.sleepMin) : '—', r0.sleepMin ? (r0.sleepMin >= 420 ? 'enough' : 'short') : 'no data') +
      L.statTile('Avg steps · 7 days', avg(steps) == null ? '—' : avg(steps).toLocaleString()) +
      L.statTile('Avg sleep · 7 days', avg(sleeps) == null ? '—' : fmtSleep(avg(sleeps))) + '</div>' +
      '</div>');
  }
  A['hc-connect'] = function () {
    var n = NP(); if (!n) return;
    n.healthRequest().then(function (r) { hc = r; lastHc = 0; return syncHealth(true); }).then(function () { L.render(); })
      .catch(function () { toast('Could not open Health Connect'); });
  };
  H.healthActivity.push(function () { syncHealth(false); return workoutCard() + stepsCard(); });
  H.healthBody.push(function () { return bodyCard(); });

  /* =====================================================================
     RAMADAN MODE
     ===================================================================== */
  function rStart() { return fromKey(F().ramadan.start); }
  function ramadanDay(d) {
    var R = F().ramadan;
    if (!L.isMuslim() || R.off || !R.start) return 0;
    var n = Math.round((d - rStart()) / 86400000) + 1;
    return n >= 1 && n <= (+R.len || 30) ? n : 0;
  }
  function ramadanBlocks(d) {
    var t = ptimes(d), fj = toMin(t.fajr), mg = toMin(t.maghrib), is = toMin(t.isha), out = [
      { id: 'r-suhoor', start: minToT(fj - 40), end: minToT(fj - 10), title: 'Suhoor', cat: 'health', overlay: true, remind: true },
      { id: 'r-iftar', start: minToT(mg), end: minToT(mg + 30), title: 'Iftar', cat: 'family', overlay: true, remind: true }
    ];
    if (L.hasGoal('pray')) out.push({ id: 'r-taraweeh', start: minToT(is + 20), end: minToT(Math.min(is + 80, 1439)), title: 'Taraweeh', cat: 'faith', overlay: true, remind: true });
    return out;
  }
  H.overlay.push(function (d) { return ramadanDay(d) ? ramadanBlocks(d) : []; });
  // While fasting, daytime meal blocks are hidden from the plan and their reminders.
  H.filter.push(function (d, list) {
    if (!ramadanDay(d)) return list;
    var t = ptimes(d), fj = toMin(t.fajr), mg = toMin(t.maghrib);
    return list.filter(function (b) { var s = toMin(b.start); return !(/^(meal|breakfast|lunch|snack|dinner)\b/i.test(b.title) && s >= fj && s < mg); });
  });
  H.todayTop.push(function () {
    var d = today(), n = ramadanDay(d), R = F().ramadan;
    if (!L.isMuslim()) return '';
    if (!n) {
      var until = Math.round((rStart() - d) / 86400000);
      return !R.off && until > 0 && until <= 3 ? '<div class="card ram"><span class="lbl">Ramadan</span><p><b>Ramadan starts in ' + until + ' day' + (until === 1 ? '' : 's') + '.</b> Your plan switches to fasting mode automatically.</p></div>' : '';
    }
    var t = ptimes(d), m = L.nowMin(), mg = toMin(t.maghrib), fj = toMin(t.fajr), line;
    if (m < fj) line = 'Suhoor ends at <b>' + fmt12(t.fajr) + '</b> · ' + L.fmtDur(fj - m) + ' left';
    else if (m < mg) line = 'Iftar at <b>' + fmt12(t.maghrib) + '</b> · ' + L.fmtDur(mg - m) + ' to go';
    else line = 'Fast complete. Tomorrow’s suhoor ends at <b>' + fmt12(ptimes(addDays(d, 1)).fajr) + '</b>';
    var T = L.st().macros.targets, split = T ? '<p class="muted small" style="margin-top:6px">Food today: iftar ~' + Math.round(T.kcal * 0.4) + ' kcal · after Taraweeh ~' + Math.round(T.kcal * 0.25) + ' · suhoor ~' + Math.round(T.kcal * 0.35) + '. Protein at every one.</p>' : '';
    return '<div class="card ram"><span class="lbl">Ramadan · day ' + n + '</span><p style="margin-top:4px">' + line + '</p>' + split + '</div>';
  });
  function ramadanCard() {
    var R = F().ramadan, d = today(), n = ramadanDay(d), until = Math.round((rStart() - d) / 86400000);
    var status = R.off ? 'Off.' : n ? 'Day ' + n + ' of ' + R.len + '. Fasting mode is on.' : until > 0 ? 'Starts in ' + until + ' days (' + esc(L.shortDate(R.start)) + ').' : 'Finished for this year. Set next year’s date when it’s announced.';
    return '<div class="card"><b>Ramadan mode</b><p class="small" style="margin-top:4px">' + status + '</p>' +
      '<label class="setrow"><span class="st">First day</span><input type="date" id="ram-start" value="' + esc(R.start) + '" style="width:160px"></label>' +
      '<label class="setrow"><span class="st">Days</span><select id="ram-len" style="width:90px"><option' + (+R.len === 29 ? ' selected' : '') + '>29</option><option' + (+R.len !== 29 ? ' selected' : '') + '>30</option></select></label>' +
      '<label class="setrow"><span class="st">Use Ramadan mode</span><span class="switch"><input type="checkbox" id="ram-on"' + (R.off ? '' : ' checked') + '><span></span></span></label>' + '</div>';
  }

  /* =====================================================================
     FAITH: prayer streaks, Quran, Qibla, athkar
     ===================================================================== */
  function prayerStreak(key) {
    var d = today(), n = 0;
    if (!L.peekDay(dateKey(d)).done['p-' + key]) d = addDays(d, -1);
    for (var i = 0; i < 1000; i++) {
      var r = L.peekDay(dateKey(d));
      if (key === 'all' ? L.PRAYERS.every(function (p) { return r.done['p-' + p[0]]; }) : r.done['p-' + key]) { n++; d = addDays(d, -1); } else break;
    }
    return n;
  }
  function quranStats() {
    var Q = F().quran, log = Q.log, total = 0;
    Object.keys(log).forEach(function (k) { total += +log[k] || 0; });
    var d = today(), streak = 0;
    if (!(log[dateKey(d)] > 0)) d = addDays(d, -1);
    while (log[dateKey(d)] > 0) { streak++; d = addDays(d, -1); }
    return { total: total, khatmas: Math.floor(total / 604), page: total % 604, today: +log[todayKey()] || 0, perDay: Math.ceil(604 / (+Q.days || 30)), streak: streak };
  }
  function faithSection() {
    var out = '';
    if (L.hasGoal('pray')) {
      var tiles = L.PRAYERS.map(function (p) { return L.statTile(p[1], prayerStreak(p[0]), 'days in a row'); }).join('') + L.statTile('All five', prayerStreak('all'), 'days in a row');
      out += '<div class="card"><b>Prayer streaks</b><div class="rs-grid">' + tiles + '</div></div>';
    }
    var q = quranStats(), pct = (q.page / 604) * 100;
    out += '<div class="card" style="margin-top:12px"><b>Quran</b><div class="kcal" style="margin-top:6px"><span class="big">' + q.today + '</span><span class="of">pages today · goal ' + q.perDay + '</span></div>' +
      '<div class="track" style="margin-top:8px"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
      '<p class="muted small" style="margin-top:6px">Page ' + q.page + ' of 604 · juz ' + Math.min(30, Math.floor(q.page / 20) + 1) + (q.khatmas ? ' · ' + q.khatmas + ' khatma' + (q.khatmas > 1 ? 's' : '') + ' done' : '') + (q.streak ? ' · ' + q.streak + '-day streak' : '') + '</p>' +
      '<div class="row-btns"><button class="btn" data-act="q-add" data-v="1">+1 page</button><button class="btn ghost" data-act="q-add" data-v="5">+5</button><button class="btn ghost" data-act="q-add" data-v="20">+1 juz</button><button class="btn ghost" data-act="q-add" data-v="-1" aria-label="Remove a page">−1</button></div>' +
      '<label class="setrow"><span class="st">Finish a khatma in</span><select id="q-days" style="width:120px">' + [30, 60, 90, 180, 365].map(function (n) { return '<option value="' + n + '"' + (+F().quran.days === n ? ' selected' : '') + '>' + n + ' days</option>'; }).join('') + '</select></label></div>';
    out += '<div class="card" style="margin-top:12px"><label class="setrow"><span><span class="st">Morning &amp; evening athkar</span><br><span class="sd">A reminder 20 minutes after Fajr and after Asr</span></span>' +
      '<span class="switch"><input type="checkbox" id="athkar-on"' + (F().athkar ? ' checked' : '') + '><span></span></span></label>' +
      '<div class="setrow"><span><span class="st">Qibla</span><br><span class="sd">' + Math.round(qiblaBearing()) + '° from north, from ' + esc(city().name) + '</span></span><button class="btn ghost" data-act="qibla">Compass</button></div></div>';
    return sec('Faith', out);
  }
  A['q-add'] = function (el) {
    var Q = F().quran, k = todayKey(), q;
    Q.log[k] = Math.max(0, (+Q.log[k] || 0) + +el.getAttribute('data-v'));
    if (!Q.log[k]) delete Q.log[k];
    q = quranStats();
    if (q.today >= q.perDay && markTitleDone(k, /quran/i)) toast('Today’s Quran ticked off');
    L.save(); L.render();
  };
  function qiblaBearing() {
    var c = city(), r = Math.PI / 180, p1 = c.lat * r, p2 = KAABA[0] * r, dl = (KAABA[1] - c.lng) * r;
    var y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function onOrient(e) {
    var arrow = document.getElementById('qb-arrow');
    if (!arrow) { window.removeEventListener('deviceorientationabsolute', onOrient); return; }
    if (e.alpha == null) return;
    var heading = (360 - e.alpha) % 360, rot = qiblaBearing() - heading;
    arrow.style.transform = 'rotate(' + rot + 'deg)';
    var ok = Math.abs(((rot % 360) + 540) % 360 - 180) < 6;
    arrow.classList.toggle('ok', ok);
    document.getElementById('qb-txt').textContent = ok ? 'You’re facing the Qibla' : 'Turn until the arrow points straight up';
  }
  A.qibla = function () {
    var b = Math.round(qiblaBearing());
    L.openSheet('<h3>Qibla</h3><div class="qibla"><div class="qb-dial"><span class="qb-n">N</span><svg id="qb-arrow" viewBox="0 0 24 24" style="transform:rotate(' + b + 'deg)"><path d="M12 2l5 10h-3v10h-4V12H7z"/></svg></div></div>' +
      '<p class="small" id="qb-txt" style="text-align:center;margin-top:10px">Hold the phone flat. The arrow points to the Qibla.</p>' +
      '<p class="muted small" style="text-align:center">' + b + '° from true north. Keep it away from metal and magnets; if it looks off, wave the phone in a figure-8.</p>' +
      '<div class="row-btns"><button class="btn ghost block" data-act="close-sheet">Close</button></div>');
    window.addEventListener('deviceorientationabsolute', onOrient);
  };

  /* =====================================================================
     SAVINGS GOALS
     ===================================================================== */
  function money(n) { return Math.round(n).toLocaleString() + ' ' + esc(F().savings.cur || 'JOD'); }
  function savingsSection() {
    var S = F().savings, now = today(), cum = 0;
    var rows = S.goals.map(function (g, i) {
      var left = Math.max(0, g.target - g.saved), pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0, eta;
      cum += left;
      if (!left) eta = 'Reached';
      else if (!(+S.monthly > 0)) eta = 'Set a monthly amount to see a date';
      else { var mo = Math.ceil(cum / S.monthly), d = new Date(now.getFullYear(), now.getMonth() + mo, 1); eta = 'About ' + L.MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' (' + mo + ' month' + (mo === 1 ? '' : 's') + ')'; }
      return '<div class="card sv"><div class="sv-h"><b>' + (i + 1) + '. ' + esc(g.name) + '</b><span class="sv-btns">' +
        (i ? '<button class="x" data-act="sv-up" data-i="' + i + '" aria-label="Move up">↑</button>' : '') +
        '<button class="x" data-act="sv-del" data-i="' + i + '" aria-label="Delete goal">×</button></span></div>' +
        '<div class="track" style="margin-top:8px"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<p class="small" style="margin-top:6px">' + money(g.saved) + ' of ' + money(g.target) + ' · ' + Math.round(pct) + '%</p>' +
        '<p class="muted small">' + eta + '</p>' +
        '<div class="row-btns"><button class="btn ghost" data-act="sv-add" data-i="' + i + '">Add money</button></div></div>';
    }).join('');
    return sec('Savings', '<div class="card"><label class="setrow"><span><span class="st">I can save each month</span><br><span class="sd">Goes to the goals in order, top first</span></span>' +
      '<input type="number" id="sv-monthly" inputmode="numeric" min="0" step="10" value="' + (S.monthly || '') + '" placeholder="' + esc(S.cur) + '" style="width:110px"></label></div>' +
      (rows ? '<div class="sv-list">' + rows + '</div>' : '<p class="muted small" style="margin-top:10px">Add your goals in the order you want them, e.g. the apartment first, then the car.</p>') +
      '<div class="row-btns"><button class="btn" data-act="sv-new">New goal</button></div>');
  }
  A['sv-new'] = function () {
    L.openSheet('<h3>New savings goal</h3><label class="field"><span>Name</span><input id="sv-name"></label>' +
      '<label class="field"><span>Target (' + esc(F().savings.cur) + ')</span><input type="number" id="sv-target" inputmode="numeric" min="1"></label>' +
      '<label class="field"><span>Already saved</span><input type="number" id="sv-saved" inputmode="numeric" min="0" value="0"></label>' +
      '<div class="row-btns"><button class="btn" data-act="sv-create">Add goal</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  };
  A['sv-create'] = function () {
    var name = document.getElementById('sv-name').value.trim(), t = parseFloat(document.getElementById('sv-target').value), s = parseFloat(document.getElementById('sv-saved').value) || 0;
    if (!name || !(t > 0)) { toast('Enter a name and a target'); return; }
    F().savings.goals.push({ id: L.uid(), name: name, target: t, saved: Math.max(0, s) });
    L.save(); L.closeSheet(); L.render();
  };
  A['sv-add'] = function (el) {
    var i = +el.getAttribute('data-i'), g = F().savings.goals[i];
    L.openSheet('<h3>' + esc(g.name) + '</h3><label class="field"><span>Amount (' + esc(F().savings.cur) + '). Use a minus to take money out.</span><input type="number" id="sv-amt" inputmode="numeric"></label>' +
      '<div class="row-btns"><button class="btn" data-act="sv-put" data-i="' + i + '">Save</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  };
  A['sv-put'] = function (el) {
    var g = F().savings.goals[+el.getAttribute('data-i')], a = parseFloat(document.getElementById('sv-amt').value);
    if (!g || isNaN(a) || !a) { toast('Enter an amount'); return; }
    g.saved = Math.max(0, g.saved + a);
    L.save(); L.closeSheet(); L.render(); toast(g.saved >= g.target ? g.name + ': goal reached' : 'Saved');
  };
  A['sv-up'] = function (el) { var i = +el.getAttribute('data-i'), G = F().savings.goals, x = G.splice(i, 1)[0]; G.splice(i - 1, 0, x); L.save(); L.render(); };
  A['sv-del'] = function (el) { if (!L.armed(el, 'Sure?')) return; F().savings.goals.splice(+el.getAttribute('data-i'), 1); L.save(); L.render(); };

  /* =====================================================================
     PEOPLE
     ===================================================================== */
  function overduePeople() {
    return F().people.filter(function (p) { return !p.last || daysAgo(p.last) >= p.every; })
      .sort(function (a, b) { return (b.last ? daysAgo(b.last) - b.every : 999) - (a.last ? daysAgo(a.last) - a.every : 999); });
  }
  function peopleSection() {
    var P = F().people.slice().sort(function (a, b) { return (a.last ? a.every - daysAgo(a.last) : -999) - (b.last ? b.every - daysAgo(b.last) : -999); });
    var rows = P.map(function (p) {
      var ago = p.last ? daysAgo(p.last) : null, due = ago == null || ago >= p.every;
      return '<li><span class="ln"><b>' + esc(p.name) + '</b><span class="muted small">' + (ago == null ? 'Not logged yet' : ago === 0 ? 'Talked today' : ago + ' days ago') + ' · every ' + p.every + ' days</span></span>' +
        '<span class="lk">' + (ago === 0 ? '' : '<button class="btn ' + (due ? '' : 'ghost') + '" data-act="p-talk" data-id="' + p.id + '">Talked</button>') +
        '<button class="x" data-act="p-del" data-id="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">×</button></span></li>';
    }).join('');
    return sec('People', '<div class="card">' + (rows ? '<ul class="loglist">' + rows + '</ul>' : '<p class="muted small">The people you don’t want to drift from: family, old friends. You’ll get a nudge on Today when it’s been a while.</p>') +
      '<div class="row-btns"><button class="btn ghost" data-act="p-new">Add a person</button></div></div>');
  }
  A['p-new'] = function () {
    L.openSheet('<h3>Add a person</h3><label class="field"><span>Name</span><input id="p-name"></label><p class="flabel" style="margin-top:14px">Check in every</p><div class="choice">' +
      [7, 14, 30].map(function (n) { return '<button type="button" class="chip" data-act="p-create" data-v="' + n + '">' + n + ' days</button>'; }).join('') + '</div>');
  };
  A['p-create'] = function (el) {
    var n = document.getElementById('p-name').value.trim();
    if (!n) { toast('Enter a name'); return; }
    F().people.push({ id: L.uid(), name: n, every: +el.getAttribute('data-v'), last: null });
    L.save(); L.closeSheet(); L.render();
  };
  A['p-talk'] = function (el) { var p = F().people.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (p) { p.last = todayKey(); L.save(); L.render(); toast('Logged: ' + p.name); } };
  A['p-del'] = function (el) { if (!L.armed(el, 'Sure?')) return; var id = el.getAttribute('data-id'); F().people = F().people.filter(function (x) { return x.id !== id; }); L.save(); L.render(); };

  /* =====================================================================
     WEEKLY REVIEW (Saturday to Friday)
     ===================================================================== */
  var weekOff = 0;
  function weekStart(d) { return addDays(d, -((d.getDay() + 1) % 7)); }
  function dayStats(d) {
    var k = dateKey(d), rec = L.peekDay(k), isToday = k === todayKey(), m = L.nowMin();
    var blocks = L.blocksForDate(d).filter(L.accountable), done = 0, counted = 0;
    blocks.forEach(function (b) {
      if (rec.done[b.id]) { done++; counted++; } else if (!(isToday && toMin(b.end) > m)) counted++;
    });
    return { k: k, d: d, rec: rec, blocks: blocks, done: done, counted: counted, pct: counted ? done / counted : null };
  }
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function pctTxt(x) { return Math.round(x * 100) + '%'; }
  function weekData(off) {
    var start = addDays(weekStart(today()), off * 7), days = [];
    for (var i = 0; i < 7; i++) { var d = addDays(start, i); if (d <= today()) days.push(dayStats(d)); }
    return { start: start, days: days };
  }
  function weeklyReview() {
    var W = weekData(weekOff), days = W.days, lim = +L.st().settings.limit;
    var nav = '<div class="daynav"><button class="nav" data-act="wr-prev" aria-label="Previous week">‹</button><button class="dl" data-act="wr-now">' +
      (weekOff ? esc(L.shortDate(dateKey(W.start))) + ' – ' + esc(L.shortDate(dateKey(addDays(W.start, 6)))) : 'This week') +
      '</button><button class="nav" data-act="wr-next" aria-label="Next week"' + (weekOff ? '' : ' disabled') + '>›</button></div>';
    var done = 0, counted = 0, missed = {}, reasons = {}, bad = 0, pr = {}, scr = [], over = 0, sleep = [], steps = [], water = [], mood = [], energy = [], focus = 0, wk = 0;
    days.forEach(function (s) {
      done += s.done; counted += s.counted;
      var rv = (s.rec.review && s.rec.review.items) || {};
      s.blocks.forEach(function (b) {
        if (b.prayer) { pr[b.id] = pr[b.id] || [0, 0]; pr[b.id][1]++; if (s.rec.done[b.id]) pr[b.id][0]++; }
        if (!b.prayer && !s.rec.done[b.id] && !(s.k === todayKey() && toMin(b.end) > L.nowMin())) {
          var t = b.title.replace(/ · .*/, '');
          missed[t] = missed[t] || { n: 0, why: {} }; missed[t].n++;
          var it = rv[b.id]; if (it && it.reason) { missed[t].why[it.reason] = (missed[t].why[it.reason] || 0) + 1; reasons[it.reason] = (reasons[it.reason] || 0) + 1; }
          if (it && it.verdict === 'bad') bad++;
        }
      });
      if (s.rec.screen != null) { scr.push(+s.rec.screen); if (+s.rec.screen > lim) over++; }
      if (s.rec.sleepMin) sleep.push(s.rec.sleepMin);
      if (s.rec.steps != null) steps.push(s.rec.steps);
      if (waterMl(s.rec)) water.push(waterMl(s.rec));
      if (s.rec.mood && s.rec.mood.m) mood.push(s.rec.mood.m);
      if (s.rec.mood && s.rec.mood.e) energy.push(s.rec.mood.e);
      focus += s.rec.focus || 0;
      if (F().workouts[s.k]) wk++;
    });
    if (!counted) return nav + '<div class="card"><p class="muted">Nothing to review for this week yet.</p></div>';
    var prev = weekData(weekOff - 1), pd = 0, pc = 0;
    prev.days.forEach(function (s) { pd += s.done; pc += s.counted; });
    var cmp = pc ? (done / counted - pd / pc) : null;
    var tiles = L.statTile('Plan done', pctTxt(done / counted), cmp == null ? '' : (cmp >= 0 ? '+' : '−') + Math.abs(Math.round(cmp * 100)) + ' pts vs last week') +
      L.statTile('Workouts', wk) + (focus ? L.statTile('Focused', L.fmtDur(focus)) : '') +
      (scr.length ? L.statTile('Social media', Math.round(avg(scr)) + ' min/day', over + ' day' + (over === 1 ? '' : 's') + ' over') : '') +
      (sleep.length ? L.statTile('Sleep', fmtSleep(Math.round(avg(sleep))), 'average') : '') +
      (steps.length ? L.statTile('Steps', Math.round(avg(steps)).toLocaleString(), 'a day') : '') +
      (water.length ? L.statTile('Water', num1(avg(water) / 1000) + ' L', 'a day') : '') +
      (mood.length ? L.statTile('Mood', num1(avg(mood)) + '/5', energy.length ? 'energy ' + num1(avg(energy)) + '/5' : '') : '')
      + (L.weekTiles ? L.weekTiles(days) : '');
    var ws = L.st().weights.filter(function (w) { var d = fromKey(w.date); return d >= W.start && d <= addDays(W.start, 6); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var lastBefore = L.st().weights.filter(function (w) { return fromKey(w.date) < W.start; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    if (ws.length && lastBefore) { var ch = ws[ws.length - 1].kg - lastBefore.kg; tiles += L.statTile('Weight', (ch > 0 ? '+' : ch < 0 ? '−' : '') + num1(Math.abs(ch)) + ' kg', 'vs last weigh-in'); }

    // Day strip
    var strip = '<div class="wr-strip">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = addDays(W.start, i), s = days[i];
      var p = s && s.pct != null ? s.pct : null;
      return '<button class="wr-day" data-act="wr-open" data-date="' + dateKey(d) + '"' + (s ? '' : ' disabled') + '><span class="wr-bar"><span style="height:' + (p == null ? 0 : Math.max(4, p * 100)) + '%"></span></span><span>' + L.dayIni(d.getDay()) + '</span></button>';
    }).join('') + '</div>';

    // Insights
    var ins = [], RN = {}; L.REASONS.forEach(function (r) { RN[r[0]] = r[1]; });
    var top = Object.keys(missed).sort(function (a, b) { return missed[b].n - missed[a].n; })[0];
    if (top && missed[top].n >= 2) {
      var why = Object.keys(missed[top].why).sort(function (a, b) { return missed[top].why[b] - missed[top].why[a]; })[0];
      ins.push('<b>' + esc(top) + '</b> was missed ' + missed[top].n + ' times' + (why ? ', mostly “' + esc(RN[why]) + '”.' : '. Note why in the nightly report to see a pattern.'));
    }
    var worstP = Object.keys(pr).sort(function (a, b) { return pr[a][0] / pr[a][1] - pr[b][0] / pr[b][1]; })[0];
    if (worstP && pr[worstP][0] < pr[worstP][1]) {
      var pn = worstP.replace('p-', ''); pn = pn.charAt(0).toUpperCase() + pn.slice(1);
      ins.push('<b>' + esc(pn) + '</b> was your hardest prayer: ' + pr[worstP][0] + ' of ' + pr[worstP][1] + ' ticked.');
    }
    function splitBy(test, label1, label2) {
      var a = [], b = [];
      days.forEach(function (s) { if (s.pct == null) return; var t = test(s); if (t === true) a.push(s.pct); else if (t === false) b.push(s.pct); });
      if (a.length >= 2 && b.length >= 2 && Math.abs(avg(a) - avg(b)) >= 0.15) ins.push(label1 + ' you finished <b>' + pctTxt(avg(a)) + '</b> of your plan, vs <b>' + pctTxt(avg(b)) + '</b> ' + label2 + '.');
    }
    splitBy(function (s) { return s.rec.screen == null ? null : +s.rec.screen > lim; }, 'On days you scrolled past your limit', 'on the others');
    splitBy(function (s) { var prevRec = s.rec.sleepMin; return prevRec ? prevRec < 420 : null; }, 'After short nights (under 7 hours)', 'after full ones');
    var mw = [], mn = [];
    days.forEach(function (s) { if (s.rec.mood && s.rec.mood.m) (F().workouts[s.k] ? mw : mn).push(s.rec.mood.m); });
    if (mw.length >= 2 && mn.length >= 2 && Math.abs(avg(mw) - avg(mn)) >= 0.5) ins.push('Your mood averaged <b>' + num1(avg(mw)) + '</b> on workout days and <b>' + num1(avg(mn)) + '</b> on the rest.');
    var best = days.filter(function (s) { return s.pct != null && s.counted >= 3; }).sort(function (a, b) { return b.pct - a.pct; })[0];
    if (best) ins.push('Best day: <b>' + L.DAYS_FULL[best.d.getDay()] + '</b>, ' + pctTxt(best.pct) + ' done. What made it work?');
    if (bad) ins.push('You marked ' + bad + ' missed task' + (bad === 1 ? '' : 's') + ' as “should have done”. Those are the ones to protect next week.');

    return nav + '<div class="card"><div class="kcal"><span class="big">' + done + '</span><span class="of">of ' + counted + ' tasks done</span></div>' + strip +
      '<div class="rs-grid">' + tiles + '</div></div>' +
      (ins.length ? '<div class="card" style="margin-top:12px"><span class="lbl">What the week says</span><ul class="ins">' + ins.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '');
  }
  A['wr-prev'] = function () { weekOff--; L.render(); };
  A['wr-next'] = function () { if (weekOff < 0) { weekOff++; L.render(); } };
  A['wr-now'] = function () { weekOff = 0; L.render(); };
  A['wr-open'] = function (el) { L.openReport(el.getAttribute('data-date')); };


  /* =====================================================================
     HOLIDAYS (Jordan public holidays + Islamic or Christian observances)
     Islamic dates come from the Umm al-Qura calendar built into the phone; the
     official dates in Jordan follow the moon sighting and can differ by a day.
     ===================================================================== */
  var hijriFmt = null;
  function hijri(d) {
    try {
      if (!hijriFmt) hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
      var o = {}; hijriFmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      return { d: +o.day, m: +o.month, y: parseInt(o.year, 10) };
    } catch (e) { return null; }
  }
  // Easter: Western (Gregorian) and Orthodox (Julian, shown in Gregorian dates).
  function westernEaster(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  function orthodoxEaster(y) {
    var a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7,
      month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    return addDays(new Date(y, month - 1, day), 13);
  }
  var holCache = null;
  function holidays() {
    var rel = L.religion(), key = rel + todayKey();
    if (holCache && holCache.key === key) return holCache.list;
    var list = [], t = today(), from = addDays(t, -2), to = addDays(t, 400);
    function add(date, name, kind, off) { if (date >= from && date <= to) list.push({ date: dateKey(date), d: date, name: name, kind: kind, off: !!off }); }
    // Islamic calendar dates (Eids are public holidays in Jordan for everyone)
    for (var x = from; x <= to; x = addDays(x, 1)) {
      var hj = hijri(x); if (!hj) break;
      var md = hj.m + '/' + hj.d;
      if (md === '10/1') add(x, 'Eid al-Fitr', rel === 'muslim' ? 'faith' : 'public', true);
      else if (md === '10/2' || md === '10/3') add(x, 'Eid al-Fitr holiday', 'public', true);
      else if (md === '12/10') add(x, 'Eid al-Adha', rel === 'muslim' ? 'faith' : 'public', true);
      else if (md === '12/11' || md === '12/12' || md === '12/13') add(x, 'Eid al-Adha holiday', 'public', true);
      else if (md === '1/1') add(x, 'Islamic New Year', 'public', true);
      else if (md === '3/12') add(x, 'Prophet’s Birthday', 'public', true);
      else if (rel === 'muslim' && md === '12/9') add(x, 'Day of Arafah', 'faith', false);
      else if (rel === 'muslim' && md === '9/1') add(x, 'Ramadan begins', 'faith', false);
      else if (rel === 'muslim' && md === '7/27') add(x, 'Isra and Mi’raj', 'faith', false);
    }
    // Fixed-date public holidays in Jordan
    [t.getFullYear(), t.getFullYear() + 1].forEach(function (y) {
      add(new Date(y, 0, 1), 'New Year’s Day', 'public', true);
      add(new Date(y, 4, 1), 'Labour Day', 'public', true);
      add(new Date(y, 4, 25), 'Independence Day', 'public', true);
      add(new Date(y, 11, 25), 'Christmas Day', rel === 'christian' ? 'faith' : 'public', true);
      if (rel === 'christian') {
        add(new Date(y, 0, 6), 'Epiphany', 'faith', false);
        add(new Date(y, 0, 7), 'Orthodox Christmas', 'faith', false);
        var oe = orthodoxEaster(y), we = westernEaster(y);
        add(addDays(oe, -7), 'Palm Sunday', 'faith', false);
        add(addDays(oe, -2), 'Good Friday', 'faith', false);
        add(oe, 'Easter', 'faith', false);
        if (dateKey(we) !== dateKey(oe)) add(we, 'Western Easter', 'faith', false);
      }
    });
    list.sort(function (a, b) { return a.d - b.d; });
    holCache = { key: key, list: list };
    return list;
  }
  function holidayOn(k) { var l = holidays(); for (var i = 0; i < l.length; i++) if (l[i].date === k) return l[i]; return null; }
  function workDays() { var p = L.st().profile; return p && p.workDays ? p.workDays : [0, 1, 2, 3, 4]; }
  // A public holiday that falls on a workday follows your weekend plan (and its reminders).
  H.dayAlias.push(function (k, day) {
    if (F().holidayOff === false) return null;
    var h = holidayOn(k), wd = workDays();
    if (!h || !h.off || wd.indexOf(day) < 0) return null;
    var we = [5, 6, 0, 1, 2, 3, 4].filter(function (x) { return wd.indexOf(x) < 0; });
    return we.length ? we[0] : null;
  });
  function inDays(n) { return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; }
  H.dashTop.push(function (k) {
    var h = holidayOn(k);
    if (h) return '<div class="card hol-today"><span class="lbl">Today</span><div class="big" style="font-size:1.3rem;font-weight:800;margin-top:2px">' + esc(h.name) + '</div>' +
      (h.off ? '<p class="muted small" style="margin-top:2px">Day off · weekend plan</p>' : '') + '</div>';
    return '';
  });
  H.dashTiles.push(function () {
    var t = today(), next = holidays().filter(function (h) { return h.d > t && h.name.indexOf(' holiday') < 0; })[0];
    if (!next) return '';
    return L.dashTile('Next holiday', esc(next.name), inDays(Math.round((next.d - t) / 86400000)), 'life');
  });
  function holidaysSection() {
    var t = today(), up = holidays().filter(function (h) { return h.d >= t && h.name.indexOf(' holiday') < 0; }).slice(0, 8);
    var rows = up.map(function (h) {
      var n = Math.round((h.d - t) / 86400000);
      return '<li><span class="ln"><b>' + esc(h.name) + (h.off ? '<span class="hol-tag">Day off</span>' : '') + '</b><span>' + esc(L.DAYS_FULL[h.d.getDay()] + ', ' + h.d.getDate() + ' ' + L.MONTHS[h.d.getMonth()] + ' ' + h.d.getFullYear()) + '</span></span>' +
        '<span class="lk">' + inDays(n) + '</span></li>';
    }).join('');
    return sec('Holidays', '<div class="card">' + (rows ? '<ul class="loglist hol-list">' + rows + '</ul>' : '<p class="muted small">No holidays coming up.</p>') +
      '<label class="setrow"><span class="st">Use my weekend plan on days off</span><span class="switch"><input type="checkbox" id="hol-off"' + (F().holidayOff === false ? '' : ' checked') + '><span></span></span></label></div>');
  }
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'hol-off') return;
    F().holidayOff = e.target.checked; L.save(); L.queueReschedule(); L.render();
  });
  // Ramadan start from the calendar, until the person sets the date themselves.
  function autoRamadan() {
    var R = F().ramadan;
    if (R.userSet || !L.isMuslim()) return;
    var t = today();
    for (var x = addDays(t, -30); x <= addDays(t, 360); x = addDays(x, 1)) {
      var hj = hijri(x); if (!hj) return;
      if (hj.m === 9 && hj.d === 1) { if (R.start !== dateKey(x)) { R.start = dateKey(x); L.save(); } return; }
    }
  }

  /* =====================================================================
     LIFE TAB
     ===================================================================== */
  H.focusTop.push(function () {
    return sec('Focus session', '<div class="card"><div class="row-btns" style="margin-top:0"><button class="btn" data-act="ft-open">' + (timer() ? 'A session is running' : 'Start a session') + '</button></div></div>');
  });
  function renderLife() {
    syncHealth(false);
    return sec('Weekly review', weeklyReview() +
        '<div class="card" style="margin-top:12px"><label class="setrow"><span><span class="st">Remind me on Friday evening</span><br><span class="sd">A notification at 8 pm to look back at the week</span></span>' +
        '<span class="switch"><input type="checkbox" id="weekly-on"' + (F().weekly ? ' checked' : '') + '><span></span></span></label></div>') +
      (L.isMuslim() ? faithSection() + sec('Ramadan', ramadanCard()) : '') + holidaysSection() + peopleSection();
  }
  L.TABS.life = ['Life', renderLife];
  L.lifeData = F;                   // shared with money.js
  L.savingsSection = savingsSection;

  /* ---------------- report tiles ---------------- */
  H.reportTiles.push(function (k, rec) {
    var out = '';
    if (waterMl(rec)) out += L.statTile('Water', num1(waterMl(rec) / 1000) + ' L');
    if (rec.focus) out += L.statTile('Focused', L.fmtDur(rec.focus));
    if (F().workouts[k]) { var n = 0; F().workouts[k].forEach(function (x) { n += x.sets.length; }); out += L.statTile('Workout', n + ' sets'); }
    if (rec.steps != null) out += L.statTile('Steps', rec.steps.toLocaleString());
    if (rec.mood && rec.mood.m) out += L.statTile('Mood', rec.mood.m + '/5');
    return out;
  });

  /* ---------------- settings: life inputs ---------------- */
  document.addEventListener('change', function (e) {
    var t = e.target, f = F();
    if (t.id === 'ram-start') { if (t.value) { f.ramadan.start = t.value; f.ramadan.userSet = true; L.save(); L.queueReschedule(); L.render(); toast('Ramadan date saved'); } }
    else if (t.id === 'ram-len') { f.ramadan.len = +t.value; L.save(); L.queueReschedule(); L.render(); }
    else if (t.id === 'ram-on') { f.ramadan.off = !t.checked; L.save(); L.queueReschedule(); L.render(); }
    else if (t.id === 'q-days') { f.quran.days = +t.value; L.save(); L.render(); }
    else if (t.id === 'athkar-on' || t.id === 'weekly-on') {
      var want = t.checked, key = t.id === 'athkar-on' ? 'athkar' : 'weekly';
      (want ? L.enableReminders() : Promise.resolve(true)).then(function () { f[key] = want; L.save(); L.reschedule(); toast(want ? 'Reminder on' : 'Reminder off'); });
    }
    else if (t.id === 'sv-monthly') { var v = parseFloat(t.value); f.savings.monthly = v > 0 ? v : 0; L.save(); L.render(); }
    else if (t.id === 'bk-auto') { f.backup.auto = t.checked; L.save(); if (t.checked) autoBackup(true); }
  });

  /* =====================================================================
     NOTIFICATIONS: Ramadan, athkar, weekly review, focus timer end
     IDs: Ramadan 6100+, athkar 6500+, weekly 8200+, focus 9100.
     ===================================================================== */
  H.notifs.push(function (list, t, now) {
    var f = F();
    function at(d, m) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60); }
    function add(id, when, title, body, extra) { if (when.getTime() > now + 30000) list.push({ id: id, channelId: 'prayers', title: title, body: body, extra: extra, schedule: { at: when, allowWhileIdle: true } }); }
    for (var off = 0; off < 7; off++) {
      var d = addDays(t, off), pt = ptimes(d);
      if (ramadanDay(d)) {
        add(6100 + off * 4, at(d, toMin(pt.fajr) - 40), 'Suhoor', 'Fajr at ' + fmt12(pt.fajr) + '. Eat, drink water, set your intention.', { type: 'ramadan' });
        add(6101 + off * 4, at(d, toMin(pt.maghrib) - 10), 'Iftar in 10 minutes', 'Maghrib at ' + fmt12(pt.maghrib), { type: 'ramadan' });
        add(6102 + off * 4, at(d, toMin(pt.maghrib)), 'Iftar time', 'Start with water and dates.', { type: 'ramadan' });
      }
      var hol = holidayOn(dateKey(d));
      if (hol && hol.name.indexOf(' holiday') < 0) {
        var hat = at(d, 9 * 60);
        if (hat.getTime() > now + 30000) list.push({ id: 6600 + off, channelId: 'tasks', title: hol.name, body: hol.off ? 'A day off. Today follows your weekend plan.' : 'Have a blessed day.', extra: { type: 'holiday' }, schedule: { at: hat, allowWhileIdle: true } });
      }
      if (f.athkar && L.isMuslim()) {
        add(6500 + off * 2, at(d, toMin(pt.fajr) + 20), 'Morning athkar', 'A few minutes to start the day.', { type: 'athkar' });
        add(6501 + off * 2, at(d, toMin(pt.asr) + 20), 'Evening athkar', 'A few minutes before the evening.', { type: 'athkar' });
      }
      if (f.weekly && d.getDay() === 5) {
        list.push({ id: 8200 + off, channelId: 'tasks', title: 'Your week in review', body: 'See what worked this week and what to protect next week.', extra: { type: 'week' }, schedule: { at: at(d, 20 * 60), allowWhileIdle: true } });
        if (list[list.length - 1].schedule.at.getTime() <= now + 30000) list.pop();
      }
    }
    var tm = f.timer;
    if (tm) {
      var end = new Date(tm.start + tm.min * 60000);
      if (end.getTime() > now + 5000) list.push({ id: 9100, channelId: 'tasks', title: 'Focus session done', body: tm.min + ' minutes on ' + tm.title + '. Take a short break.', extra: { type: 'focus' }, schedule: { at: end, allowWhileIdle: true } });
    }
  });
  H.tap.push(function (x) {
    if (x.type === 'week') { weekOff = 0; L.setTab('life'); return true; }
    if (x.type === 'athkar') { L.setTab('life'); return true; }
    if (x.type === 'focus') { L.setTab('focus'); return true; }
    if (x.type === 'ramadan' || x.type === 'focus') { L.setTab('today'); return true; }
    return false;
  });

  /* =====================================================================
     BACKUP FILES (weekly, automatic) + restore
     ===================================================================== */
  function backupBlob() { return JSON.stringify({ app: 'lifeplanner', v: 1, saved: new Date().toISOString(), state: L.st(), photos: photos() }); }
  function saveBackupFile(quiet) {
    var n = NP(), name = 'ZainLife-backup-' + todayKey() + '.json', data = backupBlob();
    var done = function () { F().backup.last = todayKey(); L.save(); if (!quiet) { toast('Saved to Downloads/ZainLife'); L.render(); } };
    if (n) return n.saveBackup({ name: name, data: data }).then(done).catch(function (e) { if (!quiet) toast('Could not save the backup: ' + (e && e.message || 'error')); });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    done(); return Promise.resolve();
  }
  // Runs when the app opens: one file a week, kept in Downloads/ZainLife so it survives an uninstall.
  function autoBackup(force) {
    var b = F().backup;
    if (!NP() || !b.auto || !L.st().profile) return;
    if (!force && b.last && daysAgo(b.last) < 7) return;
    saveBackupFile(true);
  }
  H.settings.push(function (group) {
    if (group !== 'general') return '';
    var b = F().backup, native = !!NP();
    return '<section><h2>Backup files</h2><div class="card">' +
      '<label class="setrow"><span><span class="st">Weekly backup file</span><br><span class="sd">' + (native ? 'Saved to Downloads/ZainLife. Survives uninstalling the app.' : 'Works in the installed app') + '</span></span>' +
      '<span class="switch"><input type="checkbox" id="bk-auto"' + (b.auto ? ' checked' : '') + (native ? '' : ' disabled') + '><span></span></span></label>' +
      '<p class="muted small">' + (b.last ? 'Last backup: ' + esc(L.shortDate(b.last)) : 'No backup file yet.') + '</p>' +
      '<div class="row-btns"><button class="btn" data-act="bk-save">Save a backup now</button><label class="btn ghost filebtn">Restore from file<input type="file" accept="application/json,.json,text/plain" id="bk-file" hidden></label></div>' + '</div></section>';
  });
  A['bk-save'] = function () { saveBackupFile(false); };
  var pendingRestore = null;
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'bk-file' || !e.target.files || !e.target.files[0]) return;
    var rd = new FileReader();
    rd.onload = function () {
      var o;
      try { o = JSON.parse(rd.result); } catch (err) { toast('That file is not a Zain Life backup'); return; }
      var st = o && o.state ? o.state : o;
      if (!st || !st.templates || !st.settings) { toast('That file is not a Zain Life backup'); return; }
      pendingRestore = { state: st, photos: o.photos || null };
      L.openSheet('<h3>Restore this backup?</h3><p class="small">' + (o.saved ? 'Saved ' + esc(new Date(o.saved).toLocaleString()) + '. ' : '') + 'It replaces everything in the app now.</p>' +
        '<div class="row-btns"><button class="btn warn" data-act="bk-restore">Replace and restore</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
    };
    rd.readAsText(e.target.files[0]);
    e.target.value = '';
  });
  A['bk-restore'] = function () {
    if (!pendingRestore) return;
    var s = L.normalize(pendingRestore.state);
    if (!s.profile) s.profile = { name: '', goals: [], done: true, legacy: true };
    L.setState(s);
    if (pendingRestore.photos) savePhotos(pendingRestore.photos);
    pendingRestore = null;
    L.save(); L.closeSheet(); L.applyTheme(); L.render(); L.queueReschedule(); toast('Backup restored');
  };

  /* =====================================================================
     HOME-SCREEN WIDGET (native PlannerWidget reads what we push here)
     ===================================================================== */
  var widgetTimer = null;
  function pushWidget() {
    var n = NP();
    if (!n || !L.st().profile) return;
    var t = today(), days = {}, done = {}, prayers = {};
    [t, addDays(t, 1)].forEach(function (d) {
      var k = dateKey(d), rec = L.peekDay(k);
      var tr = function (x) { return window.I18N ? I18N.str(x) : x; };
      days[k] = L.blocksForDate(d).filter(function (b) { return b.title !== 'Free time' && !b.prayer; })
        .map(function (b) { return { id: b.id, s: toMin(b.start), e: toMin(b.end) <= toMin(b.start) ? 1440 : toMin(b.end), t: tr(b.title) }; });
      prayers[k] = L.prayerBlocks(d).map(function (p) { return { t: tr(p.title), s: toMin(p.start) }; });
      done[k] = Object.keys(rec.done || {}).filter(function (id) { return rec.done[id]; });
    });
    var ar = L.st().settings.lang === 'ar';
    var labels = ar ? { now: 'الآن', done: 'الآن · تمّ', next: 'التالي', until: 'حتى', tomorrow: 'غدًا', open: 'وقت حر', nothing: 'لا شيء مخطط', dayDone: 'انتهى اليوم', ready: 'خطة الغد جاهزة', am: 'ص', pm: 'م',
      prayer: 'الصلاة', meeting: 'اجتماع', meetingNow: 'اجتماع الآن' } : null;
    // Next meetings come from the Work tab's phone-calendar read (times in ms, so they cross midnight cleanly).
    var meetings = window.ZLWork && ZLWork.upcoming ? ZLWork.upcoming(4) : [];
    n.setWidget({ data: JSON.stringify({ days: days, done: done, prayers: prayers, meetings: meetings, labels: labels }) }).catch(function () {});
  }
  function pushWidgetSoon() { clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidget, 1500); }
  window.ZLWidget = { refresh: pushWidgetSoon };
  // Tasks ticked on the widget are held natively until the app opens, then applied here.
  function pullWidgetDone() {
    var n = NP();
    if (!n) return Promise.resolve();
    return n.takeWidgetDone().then(function (r) {
      var items = (r && r.items) || [];
      if (!items.length) return;
      items.forEach(function (x) { L.dayRec(x.date).done[x.id] = true; });
      L.save(); rerender();
    }).catch(function () {});
  }
  H.saved.push(pushWidgetSoon);
  H.resume.push(function () { pullWidgetDone().then(pushWidget); syncHealth(true); autoBackup(false); });
  // Weekly backup + first sync after the app has started.
  document.addEventListener('DOMContentLoaded', function () {
    autoRamadan();
    setTimeout(function () { pullWidgetDone().then(pushWidget); syncHealth(true); autoBackup(false); }, 2500);
  });
})();
