/* Zain Life: turns the setup answers into weekly hour-by-hour templates and macro targets.
   Pure functions only (no DOM), so they can be tested with Node. */
(function (root) {
  'use strict';

  // Activities offered when painting a day hour by hour. free = time the planner may give to a goal.
  var ACTIVITIES = [
    { id: 'routine', label: 'Morning routine', cat: 'health' },
    { id: 'work', label: 'Work', cat: 'work' },
    { id: 'commute', label: 'Commute', cat: 'work' },
    { id: 'meal', label: 'Meal', cat: 'family' },
    { id: 'family', label: 'Family time', cat: 'family' },
    { id: 'friends', label: 'Friends', cat: 'social' },
    { id: 'exercise', label: 'Exercise', cat: 'health' },
    { id: 'study', label: 'Study / learn', cat: 'growth' },
    { id: 'side', label: 'Side business', cat: 'growth' },
    { id: 'prayer', label: 'Prayer / Quran', cat: 'faith' },
    { id: 'chores', label: 'Chores & errands', cat: 'rest' },
    { id: 'rest', label: 'Rest', cat: 'rest' },
    { id: 'phone', label: 'Phone / social media', cat: 'free', free: true, phone: true },
    { id: 'tv', label: 'TV / games', cat: 'free', free: true },
    { id: 'free', label: 'Free time', cat: 'rest', free: true }
  ];
  var BY_ID = {};
  ACTIVITIES.forEach(function (a) { BY_ID[a.id] = a; });

  var CAREER_FOCUS = {
    courses: 'Courses & certifications', projects: 'Building projects', network: 'Networking',
    mentoring: 'Mentoring & leadership', reading: 'Reading & research'
  };
  // Goals beyond weight, career, skill and prayer. Each gets one block per day or a few hours a week.
  var EXTRA_GOALS = {
    money: { label: 'Money check-in', cat: 'growth' },
    mind: { label: 'Mind', cat: 'rest' },
    social: { label: 'Family & friends', cat: 'family' },
    reading: { label: 'Reading', cat: 'growth' },
    other: { label: 'My goal', cat: 'growth' }
  };
  var MIND_HOW = { meditate: 'Meditation & breathing', journal: 'Journaling', nature: 'A walk in nature', talk: 'Talking to someone I trust' };
  var TRAIN_PATTERN = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 3, 5] };
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mToT(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  var seq = 0;
  function uid() { seq++; return 'g' + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 5); }

  // Reads a typed activity and guesses what kind of time it is, so the planner treats it correctly.
  // Order matters: phone/TV checks come first so "YouTube while eating" still counts as free time.
  var KEYWORDS = [
    [/\b(phone|scroll\w*|instagram|insta|tiktok|social|youtube|reels|snap\w*|twitter|facebook)\b/i, { cat: 'free', free: true, phone: true }],
    [/\b(tv|netflix|shahid|series|movie\w*|game\w*|gaming|playstation|ps5|xbox)\b/i, { cat: 'free', free: true }],
    [/\b(nothing|free|chill\w*|relax\w*|bored)\b/i, { cat: 'rest', free: true }],
    [/\b(pray\w*|salah|salat|quran|mosque|masjid|jumu?'?ah|dhikr)\b/i, { cat: 'faith' }],
    [/\b(gym|train\w*|workout|exercis\w*|walk\w*|run\w*|bike|cycl\w*|sport\w*|football|swim\w*|padel)\b/i, { cat: 'health' }],
    [/\b(sleep\w*|nap)\b/i, { cat: 'sleep' }],
    [/\b(work\w*|office|job|meeting\w*|shift|commut\w*|driv\w*|traffic)\b/i, { cat: 'work' }],
    [/\b(stud\w*|learn\w*|read\w*|course\w*|book\w*|business|project\w*|cod\w*|practi\w*|class\w*)\b/i, { cat: 'growth' }],
    [/\b(friend\w*|visit\w*|cafe|coffee|hang\w*|outing|out)\b/i, { cat: 'social' }],
    [/\b(family|parents|mom|mother|dad|father|dinner|lunch|breakfast|eat\w*|meal\w*|cook\w*|food)\b/i, { cat: 'family' }]
  ];
  function classify(label) {
    for (var i = 0; i < KEYWORDS.length; i++) {
      if (KEYWORDS[i][0].test(label)) return Object.assign({ label: label }, KEYWORDS[i][1]);
    }
    return { label: label, cat: 'rest' };
  }

  // Resolve a grid cell value: an activity id, or "c:<typed text>" for the person's own words.
  function activity(val) {
    if (!val) return null;
    if (val.indexOf('c:') === 0) { var t = val.slice(2).trim(); return t ? classify(t) : null; }
    return BY_ID[val] || null;
  }

  // An hour can be split into four 15-minute parts: cells["7:0"] … cells["7:3"] instead of cells["7"].
  function cellAt(grid, h, q) {
    var cells = grid.cells || {};
    return grid.split && grid.split[h] ? cells[h + ':' + q] : cells[h];
  }

  // One 15-minute slot per quarter hour between wake and sleep.
  function slotsFromGrid(grid) {
    var out = [];
    for (var h = grid.wake; h < grid.sleep; h++) {
      for (var q = 0; q < 4; q++) {
        var a = activity(cellAt(grid, h, q));
        out.push({
          m: h * 60 + q * 15,
          label: a ? a.label : 'Free time',
          cat: a ? a.cat : 'rest',
          free: a ? !!a.free : true,
          phone: a ? !!a.phone : false,
          remind: !!a && !a.free && a.cat !== 'sleep'    // every real task gets reminders; idle time doesn't
        });
      }
    }
    return out;
  }

  function lastWorkEnd(slots) {
    var end = -1;
    slots.forEach(function (s) { if (s.cat === 'work') end = s.m + 15; });
    return end;
  }

  // Put a goal block (req.min minutes) into the first run of free slots that matches the preferred
  // time of day. Returns the minutes actually placed.
  function place(slots, req) {
    var minStart, maxStart;
    var workEnd = lastWorkEnd(slots);
    var need = Math.ceil(req.min / 15);
    if (req.win) {
      // An hour range the person chose: the block must start and end inside it.
      minStart = req.win[0] * 60;
      maxStart = req.win[1] * 60 - need * 15 + 1;
    } else {
      if (req.pref === 'morning') minStart = -1;
      else if (req.pref === 'evening') minStart = 19 * 60;
      else if (req.pref === 'afterwork') minStart = workEnd > 0 ? workEnd : 16 * 60;
      else minStart = 9 * 60;
      maxStart = req.pref === 'morning' ? 12 * 60 : Infinity;
    }

    function find(need, lo, hi) {
      for (var i = 0; i + need <= slots.length; i++) {
        if (slots[i].m < lo || slots[i].m >= hi) continue;
        var ok = true;
        for (var j = 0; j < need; j++) {
          var s = slots[i + j];
          if (!s.free || s.goal || (j > 0 && s.m !== slots[i + j - 1].m + 15)) { ok = false; break; }
        }
        if (ok) return i;
      }
      return -1;
    }
    var i = find(need, minStart, maxStart);
    if (i < 0) i = find(need, 0, Infinity);           // anywhere free
    if (i < 0 && need > 2) {                          // no room for all of it: try half (at least 30 min)
      need = Math.max(2, Math.ceil(need / 2));
      if (req.win) maxStart = req.win[1] * 60 - need * 15 + 1;
      i = find(need, minStart, maxStart);
      if (i < 0) i = find(need, 0, Infinity);
    }
    if (i < 0) return 0;
    for (var k = 0; k < need; k++) {
      Object.assign(slots[i + k], { label: req.label, cat: req.cat, free: false, phone: false, goal: true, remind: req.remind !== false });
    }
    return need * 15;
  }

  function finalize(slots, limit) {
    // Keep one bounded scroll window (the daily limit, in one stretch); other phone time becomes free time.
    var windowSlots = Math.max(1, Math.ceil(limit / 15)), given = 0, lastM = -1;
    slots.forEach(function (s) {
      if (!s.phone) return;
      var contiguous = given === 0 || s.m === lastM + 15;
      if (given < windowSlots && contiguous) {
        Object.assign(s, { label: 'Scroll window · ' + limit + ' min max', cat: 'free', remind: true });
        given++; lastM = s.m;
      } else {
        Object.assign(s, { label: 'Free time', cat: 'rest', remind: false });
        if (given > 0) given = windowSlots;          // only one window per day
      }
      s.phone = false;
    });
    // Last half hour before sleep: wind down, if nothing else is planned there.
    for (var k = Math.max(0, slots.length - 2); k < slots.length; k++) {
      var s = slots[k];
      if (s.free && !s.goal) Object.assign(s, { label: 'Wind down · phone away', cat: 'sleep', remind: true, free: false });
    }
  }

  function toBlocks(slots, grid) {
    var blocks = [];
    slots.forEach(function (s) {
      var prev = blocks[blocks.length - 1];
      var crossesMidnight = s.m === 1440;
      if (prev && !crossesMidnight && prev.title === s.label && prev.cat === s.cat && prev.remind === s.remind && prev._end === s.m) {
        prev._end = s.m + 15;
      } else {
        blocks.push({ title: s.label, cat: s.cat, remind: s.remind, _start: s.m, _end: s.m + 15 });
      }
    });
    var sleepM = grid.sleep * 60, wakeM = grid.wake * 60;
    if (sleepM < 1440) blocks.push({ title: 'Sleep', cat: 'sleep', remind: false, _start: sleepM, _end: 1440 });
    else if (sleepM > 1440) blocks.push({ title: 'Sleep', cat: 'sleep', remind: false, _start: sleepM, _end: 1440 + wakeM });
    return blocks;
  }
  function finishBlocks(blocks) {
    return blocks.map(function (b) {
      var s = b._start % 1440, e = b._end % 1440;
      if (b._end === 1440 || (e === 0 && b._end > b._start)) e = 1439;      // ends at midnight → 11:59 pm
      return { id: uid(), start: mToT(s), end: mToT(e), title: b.title, cat: b.cat, remind: b.remind };
    }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  }

  // Overnight shifts: a day's blocks after midnight (the rest of the shift, winding down, sleep)
  // really happen on the next calendar day. Only days with work after midnight hand their tail on;
  // every other day keeps the usual wrap-around, so day-shift plans are unchanged.
  function carryOvernight(raw) {
    var tails = {}, any = false;
    for (var d = 0; d < 7; d++) {
      var night = raw[d].some(function (b) { return b.cat === 'work' && b._start >= 1440; });
      tails[d] = night ? raw[d].filter(function (b) { return b._start >= 1440; }) : [];
      if (night) { any = true; raw[d] = raw[d].filter(function (b) { return b._start < 1440; }); }
    }
    if (!any) return raw;
    var out = {};
    for (d = 0; d < 7; d++) {
      var inc = tails[(d + 6) % 7].map(function (b) { return Object.assign({}, b, { _start: b._start - 1440, _end: b._end - 1440 }); });
      var own = raw[d];
      if (tails[d].length && !inc.length) {          // first night of a run: the morning before it is ordinary sleep
        var upTo = Math.max.apply(null, tails[d].map(function (b) { return b._end - 1440; }));
        inc = [{ title: 'Sleep', cat: 'sleep', remind: false, _start: 0, _end: upTo }];
      }
      inc.forEach(function (r) {
        var next = [];
        own.forEach(function (b) {
          var s = b._start % 1440, e = s + (b._end - b._start);
          if (e <= r._start || s >= r._end) { next.push(b); return; }
          if (s < r._start) next.push(Object.assign({}, b, { _start: s, _end: r._start }));
          if (e > r._end) next.push(Object.assign({}, b, { _start: r._end, _end: e }));
        });
        own = next;
      });
      out[d] = own.concat(inc);
    }
    return out;
  }

  /* Builds 7 templates (0 = Sunday) from the profile's ideal days and goals.
     Returns { templates, notes: [strings], shortfalls: [strings] } */
  // The hour range a question asked for ({from: 17, to: 20}), or null for older profiles that picked "Mornings" and so on.
  function windowOf(Q) {
    if (!Q || Q.from == null || Q.from === '' || Q.to == null || Q.to === '') return null;
    var a = +Q.from, b = +Q.to;
    return b > a ? [a, b] : null;
  }
  function buildTemplates(P, limit) {
    limit = limit || 30;
    var workDays = P.workDays || [];
    var weekend = [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return workDays.indexOf(d) < 0; });
    var reqs = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    var notes = [], goals = P.goals || [];
    var weekStart = workDays.length ? workDays[0] : 0;

    if (goals.indexOf('weight') >= 0 && P.weightQ) {
      var W = P.weightQ, T = Math.max(2, Math.min(5, +W.days || 3));
      var trainDays = TRAIN_PATTERN[T].map(function (o) { return (weekStart + o) % 7; });
      trainDays.forEach(function (d) {
        reqs[d].push({ label: 'Training', cat: 'health', min: 60, pref: W.time || 'afterwork', win: windowOf(W), pri: 1 });
      });
      if (W.direction === 'lose') {
        [0, 1, 2, 3, 4, 5, 6].forEach(function (d) {
          if (trainDays.indexOf(d) < 0) reqs[d].push({ label: 'Walk or bike · 30–40 min', cat: 'health', min: 30, pref: 'afterwork', win: windowOf(W), pri: 5 });
        });
      }
      notes.push('Training ' + T + '× a week: ' + trainDays.map(function (d) { return DAY_NAMES[d].slice(0, 3); }).join(', ') + '.');
    }

    // pref: 'weekend' puts the hours on days off first. win: the hour range to place them in.
    function spread(hours, label, cat, pref, pri, win) {
      var left = Math.max(0, Math.round(+hours || 0));
      var weekendFirst = pref === 'weekend';
      var timePref = weekendFirst ? 'any' : pref;
      function onWeekend() {
        weekend.forEach(function (d) {
          if (left <= 0) return;
          var h = Math.min(2, left);
          reqs[d].push({ label: label, cat: cat, min: h * 60, pref: 'any', win: win || null, pri: pri });
          left -= h;
        });
      }
      function onWorkdays() {
        (workDays.length ? workDays : [0, 1, 2, 3, 4, 5, 6]).forEach(function (d) {
          if (left <= 0) return;
          reqs[d].push({ label: label, cat: cat, min: 60, pref: timePref, win: win || null, pri: pri });
          left -= 1;
        });
      }
      if (weekendFirst) { onWeekend(); onWorkdays(); onWeekend(); } else { onWorkdays(); onWeekend(); onWorkdays(); }
    }
    if (goals.indexOf('career') >= 0 && P.careerQ) {
      var C = P.careerQ;
      var cWhat = C.focus === 'other' ? (String(C.focusOther || '').trim() || 'growth') : (CAREER_FOCUS[C.focus] || 'growth');
      spread(C.hours, 'Career · ' + cWhat, 'growth', C.where || C.time || 'evening', 3, windowOf(C));
      notes.push('Career: ' + C.hours + ' h a week on ' + cWhat.toLowerCase() + '.');
    }
    if (goals.indexOf('skill') >= 0 && P.skillQ && P.skillQ.skill) {
      var S = P.skillQ;
      spread(S.hours, 'Practice · ' + S.skill, 'growth', S.where || S.time || 'evening', 4, windowOf(S));
      notes.push('Learning ' + S.skill + ': ' + S.hours + ' h a week.');
    }
    if (goals.indexOf('money') >= 0 && P.moneyQ) {
      var M = P.moneyQ;
      spread(M.hours || 1, EXTRA_GOALS.money.label, 'growth', M.where || 'any', 5, windowOf(M));
      notes.push('Money: ' + (M.hours || 1) + ' h a week to review spending and savings' + (+M.monthly > 0 ? ', aiming to save ' + (+M.monthly) + ' a month.' : '.'));
    }
    if (goals.indexOf('mind') >= 0 && P.mindQ) {
      var N = P.mindQ, nWhat = N.how === 'other' ? (String(N.howOther || '').trim() || 'Mind') : (MIND_HOW[N.how] || 'Mind'), nMin = Math.ceil((+N.mins || 15) / 15) * 15;
      for (var dm = 0; dm < 7; dm++) reqs[dm].push({ label: nWhat + ' · ' + (+N.mins || 15) + ' min', cat: 'rest', min: nMin, pref: 'evening', win: windowOf(N), pri: 2 });
      notes.push('Mind: ' + (+N.mins || 15) + ' min a day of ' + nWhat.toLowerCase() + '.');
    }
    if (goals.indexOf('social') >= 0 && P.socialQ) {
      var Sc = P.socialQ, who = Sc.who === 'friends' ? 'Friends' : Sc.who === 'family' ? 'Family time' : 'Family & friends';
      spread(Sc.hours || 3, who, Sc.who === 'friends' ? 'social' : 'family', Sc.where || 'weekend', 4, windowOf(Sc));
      notes.push(who + ': ' + (Sc.hours || 3) + ' h a week.');
    }
    if (goals.indexOf('reading') >= 0 && P.readQ) {
      var R = P.readQ, rMin = Math.ceil((+R.mins || 20) / 15) * 15;
      for (var dr = 0; dr < 7; dr++) reqs[dr].push({ label: 'Reading · ' + (+R.mins || 20) + ' min', cat: 'growth', min: rMin, pref: 'evening', win: windowOf(R), pri: 3 });
      notes.push('Reading: ' + (+R.mins || 20) + ' min a day.');
    }
    if (goals.indexOf('other') >= 0 && P.otherQ && String(P.otherQ.name || '').trim()) {
      var O = P.otherQ, oName = String(O.name).trim();
      spread(O.hours || 2, oName, 'growth', O.where || 'any', 5, windowOf(O));
      notes.push(oName + ': ' + (O.hours || 2) + ' h a week.');
    }
    if (goals.indexOf('pray') >= 0 && P.prayQ && P.religion === 'christian') {
      // Christian: daily prayer & Bible reading, and Sunday church in the morning.
      if (+P.prayQ.quran > 0) {
        for (var dc = 0; dc < 7; dc++) reqs[dc].push({ label: 'Prayer & Bible · ' + P.prayQ.quran + ' min', cat: 'faith', min: Math.ceil(P.prayQ.quran / 15) * 15, pref: 'evening', pri: 2 });
      }
      if (P.prayQ.church === true || P.prayQ.church === 'true') reqs[0].push({ label: 'Sunday church', cat: 'faith', min: 120, pref: 'morning', pri: 1 });
      notes.push('Faith: ' + (+P.prayQ.quran > 0 ? P.prayQ.quran + ' min of prayer and Bible reading daily' : 'no daily reading for now') +
        (P.prayQ.church === true || P.prayQ.church === 'true' ? ', plus Sunday church.' : '.'));
    } else if (goals.indexOf('pray') >= 0 && P.prayQ && P.religion !== 'other') {
      if (+P.prayQ.quran > 0) {
        for (var d = 0; d < 7; d++) reqs[d].push({ label: 'Quran · ' + P.prayQ.quran + ' min', cat: 'faith', min: Math.ceil(P.prayQ.quran / 15) * 15, pref: 'evening', pri: 2 });
      }
      notes.push('The five daily prayers are added to each day at the right time for your city.' +
        (+P.prayQ.quran > 0 ? ' Plus ' + P.prayQ.quran + ' min of Quran daily.' : ''));
    }

    var templates = {}, raw = {}, shortfalls = [];
    for (var day = 0; day < 7; day++) {
      var isWork = workDays.indexOf(day) >= 0;
      var base = isWork ? P.grids.idealWork : (P.grids.idealWeekend || P.grids.idealWork);
      var slots = slotsFromGrid(base);
      reqs[day].sort(function (a, b) { return a.pri - b.pri; }).forEach(function (r) {
        var got = place(slots, r);
        if (got < r.min) {
          var missing = r.min - got;
          shortfalls.push(DAY_NAMES[day] + ': no free time left for ' + (missing >= 60 ? missing / 60 + ' h' : missing + ' min') + ' of “' + r.label + '”.');
        }
      });
      finalize(slots, limit);
      raw[day] = toBlocks(slots, base);
    }
    raw = carryOvernight(raw);
    for (day = 0; day < 7; day++) templates[day] = finishBlocks(raw[day]);
    return { templates: templates, notes: notes, shortfalls: shortfalls };
  }

  /* Daily calorie and macro targets (Mifflin–St Jeor). */
  function macroTargets(P) {
    var w = +P.weight, h = +P.height, a = +P.age;
    if (!w || !h || !a) return null;
    var bmr = 10 * w + 6.25 * h - 5 * a + (P.sex === 'female' ? -161 : 5);
    var W = (P.goals || []).indexOf('weight') >= 0 && P.weightQ ? P.weightQ : null;
    var base = { desk: 1.2, feet: 1.35, physical: 1.5 }[(W && W.activity) || 'desk'] || 1.2;
    var mult = base + 0.05 * (W ? Math.max(2, Math.min(5, +W.days || 3)) : 0);
    var tdee = bmr * mult;
    var dir = W ? W.direction : 'maintain';
    var pace = (W && W.pace) || 'steady';
    var delta = 0;
    if (dir === 'lose') delta = { gentle: -275, steady: -550, faster: -825 }[pace];
    else if (dir === 'gain') delta = { gentle: 150, steady: 300, faster: 450 }[pace];
    var floor = P.sex === 'female' ? 1200 : 1500;
    var kcal = Math.max(floor, Math.round((tdee + delta) / 10) * 10);
    var goalW = W && +W.goal ? +W.goal : w;
    var ref = dir === 'lose' ? Math.min(w, goalW) : w;
    var p = Math.round(2.0 * ref);
    var f = Math.max(Math.round(0.8 * ref), Math.round(kcal * 0.2 / 9));
    var c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return { kcal: kcal, p: p, c: c, f: f, bmr: Math.round(bmr), tdee: Math.round(tdee), direction: dir };
  }

  var api = { ACTIVITIES: ACTIVITIES, activity: activity, classify: classify, CAREER_FOCUS: CAREER_FOCUS, EXTRA_GOALS: EXTRA_GOALS, MIND_HOW: MIND_HOW, buildTemplates: buildTemplates, macroTargets: macroTargets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(this);
