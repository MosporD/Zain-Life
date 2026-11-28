/* Today tab: Now (with a mood check for whatever you are in), Today's plan as fading cards,
   Nutrition (food and water, added right here) and the end of the day. Also keeps the mood log:
   one mood per part of the plan, shown in the daily report and as a list in the Mental health tab. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, A = L.ACTIONS, H = L.HOOKS, toMin = L.toMin, fmt12 = L.fmt12;
  var FACES = ['😞', '🙁', '😐', '🙂', '😄'], WORDS = ['Low', 'Meh', 'Okay', 'Good', 'Great'];

  function sec(title, body, right) { return '<section class="tsec"><div class="sec-h"><h2>' + title + '</h2>' + (right || '') + '</div>' + body + '</section>'; }

  /* ---------------- mood per part of the plan ---------------- */
  function moods(k) { var r = L.peekDay(k); return r.bm || {}; }
  function setMood(k, id, v) {
    var r = L.dayRec(k);
    r.bm = r.bm || {};
    if (r.bm[id] === v) delete r.bm[id]; else r.bm[id] = v;
    // Keep the day's overall mood (used by the reports and the weekly review) as the average.
    var vals = Object.keys(r.bm).map(function (x) { return r.bm[x]; });
    r.mood = r.mood || {};
    if (vals.length) r.mood.m = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length); else delete r.mood.m;
    L.save();
  }
  function faceRow(id, cur) {
    return '<div class="faces" role="group" aria-label="How is this going?">' + FACES.map(function (f, i) {
      var on = cur === i + 1;
      return '<button type="button" class="face' + (on ? ' on' : '') + '" data-act="td-mood" data-id="' + esc(id) + '" data-v="' + (i + 1) + '" aria-pressed="' + on + '" aria-label="' + WORDS[i] + '">' + f + '</button>';
    }).join('') + '</div>';
  }
  A['td-mood'] = function (el) {
    setMood(L.todayKey(), el.getAttribute('data-id'), +el.getAttribute('data-v'));
    L.render();
  };

  /* ---------------- Now ---------------- */
  function nowSection(blocks, k) {
    var m = L.nowMin(), cur = null, next = null;
    blocks.forEach(function (b) {
      var s = toMin(b.start), e = toMin(b.end);
      if (m >= s && m < e && (!cur || s >= toMin(cur.start))) cur = b;     // the most specific block wins
      if (!next && s > m) next = b;
    });
    var top, mood = '';
    if (cur) {
      top = '<div><span class="lbl">Now</span><div class="big">' + esc(cur.title) + '</div><div class="sub">' + L.fmtDur(toMin(cur.end) - m) + ' left · until ' + fmt12(cur.end) + '</div></div>';
      mood = '<div class="now-mood"><span class="flabel">How is this going?</span>' + faceRow(cur.id, moods(k)[cur.id]) + '</div>';
    } else if (next) {
      top = '<div><span class="lbl">Now</span><div class="big">Open time</div><div class="sub">Nothing planned until ' + fmt12(next.start) + '</div></div>';
    } else {
      top = '<div><span class="lbl">Now</span><div class="big">Day is done</div><div class="sub">Rest. Tomorrow’s plan is ready.</div></div>';
    }
    var nl = next ? '<div class="nextline"><b>Next</b>' + esc(next.title) + ' · ' + fmt12(next.start) + '</div>' : '';
    return '<div class="card now">' + top + mood + nl + L.runHooks('nowExtra') + '</div>';
  }

  /* ---------------- Today's plan: cards that fade down the list ---------------- */
  function planSection(blocks, k, rec) {
    var m = L.nowMin(), doneCount = 0, ahead = 0, bm = moods(k);
    var rows = blocks.map(function (b) {
      var s = toMin(b.start), e = toMin(b.end), done = !!rec.done[b.id], current = m >= s && m < e, past = m >= e;
      if (done) doneCount++;
      // Past cards sit back; the next ones are clear, and each one further down fades a little more.
      var f = current ? 1 : past ? 0.65 : Math.max(0.55, 1 - 0.06 * ahead++);
      var mood = bm[b.id] ? '<span class="tl-mood" aria-label="' + WORDS[bm[b.id] - 1] + '">' + FACES[bm[b.id] - 1] + '</span>' : '';
      var cls = 'fc tl' + (done ? ' done' : '') + (past ? ' past' : '') + (current ? ' current' : '');
      return '<li class="' + cls + '" style="--f:' + f.toFixed(2) + '" data-act="toggle-done" data-id="' + esc(b.id) + '" role="button" aria-pressed="' + done + '">' +
        '<span class="tl-time">' + fmt12(b.start) + '<small>' + fmt12(b.end) + '</small></span>' +
        '<span class="tl-bar" style="background:' + L.catColor(b.cat) + '"></span>' +
        '<span class="tl-title">' + esc(b.title) + '<small>' + esc(L.CATS[b.cat] || 'Rest') + '</small></span>' +
        '<span class="tl-x">' + (!done && past && !b.prayer && !b.overlay && b.cat !== 'sleep' && b.cat !== 'free' ? '<button class="tl-move" data-act="move-later" data-id="' + esc(b.id) + '">Move</button>' : '') +
        mood + L.runHooks('timeline', b, done, current) + '</span>' +
        '<span class="tl-check" aria-hidden="true"></span></li>';
    }).join('');
    var oneOff = L.st().overrides[k] ? '<p class="muted small" style="margin-top:8px">Today has its own one-off plan.</p>' : '';
    return sec('Today’s plan', (blocks.length ? '<ol class="timeline fade-list">' + rows + '</ol>' : '<p class="muted">Nothing planned today. Add blocks in the Plan tab.</p>') +
      oneOff + '<button class="linkbtn" data-act="edit-today">Change just today’s plan</button>', '<span class="muted">' + doneCount + ' of ' + blocks.length + ' done</span>');
  }

  /* ---------------- Nutrition: food and water, added here ---------------- */
  function bar(label, val, target, color) {
    var pct = target ? Math.min(100, val / target * 100) : 0, over = target && val > target * 1.05;
    return '<div class="mbar' + (over ? ' over' : '') + '"><div class="top"><span>' + label + '</span><span>' + Math.round(val) + ' / ' + (target || '–') + ' g</span></div>' +
      '<div class="track"><span style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></div></div>';
  }
  function nutritionSection(k, rec) {
    var st = L.st(), T = st.macros.targets, food = (st.macros.log || {})[k] || [], tot = L.totals(food);
    var kc = Math.round(tot.k), over = T && tot.k > T.kcal * 1.05;
    var head = T
      ? '<div class="kcal"><span class="big">' + kc.toLocaleString() + '</span><span class="of">of ' + T.kcal.toLocaleString() + ' kcal</span></div>' +
        '<div class="' + (over ? 'over' : '') + '"><div class="track"><span style="width:' + Math.min(100, tot.k / T.kcal * 100).toFixed(1) + '%"></span></div></div>' +
        '<div class="mbars">' + bar('Protein', tot.p, T.p, 'var(--accent)') + bar('Carbs', tot.c, T.c, 'var(--c-growth)') + bar('Fat', tot.f, T.f, 'var(--c-family)') + '</div>'
      : '<div class="kcal"><span class="big">' + kc.toLocaleString() + '</span><span class="of">kcal eaten today</span></div>';
    var list = food.length ? '<ul class="loglist">' + food.map(function (e) {
      var q = e.qty || 1, kcal = Math.round((e.p * 4 + e.c * 4 + e.f * 9) * q);
      return '<li><span class="ln"><b>' + esc(e.name) + (q !== 1 ? ' × ' + L.num1(q) : '') + '</b><span>' + esc(e.unit || '') + '</span></span>' +
        '<span class="lk">' + kcal + '</span><button class="x" data-act="td-food-del" data-id="' + esc(e.id) + '" aria-label="Remove ' + esc(e.name) + '">×</button></li>';
    }).join('') + '</ul>' : '<p class="muted small" style="margin-top:10px">Nothing eaten yet today.</p>';
    var n = L.waterMl(rec), g = L.waterGoal();
    var water = '<div class="nut-water"><div class="kcal"><span class="lbl">Water</span><span class="of">' + n.toLocaleString() + ' ml of ' + g.toLocaleString() + ' ml</span></div>' +
      '<div class="track" style="margin-top:8px" aria-hidden="true"><span style="width:' + Math.min(100, n / g * 100).toFixed(1) + '%"></span></div>' +
      '<div class="row-btns">' + [[1000, '1 L'], [500, '0.5 L'], [250, '0.25 L']].map(function (x) { return '<button class="btn" data-act="w-add" data-ml="' + x[0] + '">+' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row-btns">' + [[1000, '1 L'], [500, '0.5 L'], [250, '0.25 L']].map(function (x) { return '<button class="btn ghost" data-act="w-sub" data-ml="' + x[0] + '">−' + x[1] + '</button>'; }).join('') + '</div></div>';
    return sec('Nutrition', '<div class="card">' + head + list +
      '<div class="row-btns"><button class="btn" data-act="td-add-food">+ Add food</button><button class="btn ghost" data-act="td-repeat">Repeat yesterday</button></div>' + water + '</div>');
  }

  /* ---------------- the page ---------------- */
  function renderToday() {
    var t = L.today(), k = L.dateKey(t), blocks = L.blocksForDate(t), rec = L.peekDay(k), remind = '';
    if (L.LN() && !L.st().settings.reminders && !L.st().settings.reminderAsked) {
      remind = '<div class="card" style="margin-top:14px"><b>Get reminded of each task?</b><br><span class="muted small">5 minutes before, and when it starts.</span>' +
        '<div class="row-btns" style="margin-top:10px"><button class="btn" data-act="remind-yes">Turn on reminders</button><button class="btn ghost" data-act="remind-no">Not now</button></div></div>';
    }
    return L.runHooks('todayTop', k, rec) + remind + nowSection(blocks, k) + planSection(blocks, k, rec) + nutritionSection(k, rec) +
      sec('End of the day', '<button class="btn block report-btn" data-act="open-report">See today’s report</button>' +
        '<p class="flabel" style="margin-top:14px">End-of-day note</p><textarea id="note" data-field="note" data-date="' + k + '" placeholder="What went well, what got in the way, what is on your mind.">' + esc(rec.note || '') + '</textarea>');
  }
  L.TABS.today = ['Today', renderToday];

  // Cards below the fold start faded and rise in as they scroll into view; the ones already on screen just show.
  var io = null;
  function reveal() {
    var cards = document.querySelectorAll('#view .fc:not(.in)');
    if (!cards.length) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { for (var i = 0; i < cards.length; i++) cards[i].classList.add('in'); return; }
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    for (var j = 0; j < cards.length; j++) {
      if (cards[j].getBoundingClientRect().top < window.innerHeight * 0.92) cards[j].classList.add('in'); else io.observe(cards[j]);
    }
  }
  var viewEl = document.getElementById('view');
  if (viewEl) new MutationObserver(reveal).observe(viewEl, { childList: true });
  document.addEventListener('DOMContentLoaded', reveal);

  /* ---------------- mood log ---------------- */
  function dayMoods(k) {
    var d = L.fromKey(k), bm = moods(k), blocks = L.blocksForDate(d), out = [];
    blocks.forEach(function (b) { if (bm[b.id]) out.push({ b: b, v: bm[b.id] }); });
    return out;
  }
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y.v; }, 0) / a.length : 0; }
  function moodList(rows) {
    return '<ul class="mood-list">' + rows.map(function (r) {
      return '<li><span class="mf" aria-label="' + WORDS[r.v - 1] + '">' + FACES[r.v - 1] + '</span><span class="mt notr">' + esc(r.b.title) + '</span><span class="muted small">' + fmt12(r.b.start) + '</span></li>';
    }).join('') + '</ul>';
  }
  H.reportExtra.push(function (k) {
    var rows = dayMoods(k);
    if (!rows.length) return '';
    return sec('Mood through the day', '<div class="card"><div class="kcal"><span class="big">' + FACES[Math.round(avg(rows)) - 1] + '</span><span class="of">average ' + L.num1(avg(rows)) + ' of 5</span></div>' + moodList(rows) + '</div>');
  });
  H.reportExtra.push(function (k, rec) {
    var hl = L.activeHabits();
    if (!hl.length) return '';
    return sec('Habits', '<div class="card"><div class="habits">' + hl.map(function (h) {
      var on = !!rec.habits[h.k];
      return '<button class="pill-btn' + (on ? ' on' : '') + '" data-act="r-habit" data-date="' + k + '" data-k="' + h.k + '" aria-pressed="' + on + '">' + esc(h.l) + '</button>';
    }).join('') + '</div></div>');
  });
  A['r-habit'] = function (el) {
    var r = L.dayRec(el.getAttribute('data-date')), k = el.getAttribute('data-k');
    r.habits[k] = !r.habits[k];
    L.save(); L.render();
  };
  // the Mental health tab: the last 7 days as a list, each with the average and a dot per part of the plan.
  H.healthMental.push(function () {
    var t = L.today(), days = [], any = false;
    for (var i = 0; i < 7; i++) {
      var k = L.dateKey(L.addDays(t, -i)), rows = dayMoods(k);
      if (rows.length) any = true;
      days.push({ k: k, rows: rows });
    }
    var body = any ? '<ul class="mood-days">' + days.filter(function (d) { return d.rows.length; }).map(function (d) {
      var a = avg(d.rows);
      return '<li><span class="md-day">' + esc(L.shortDate(d.k)) + '</span><span class="md-face" aria-label="' + WORDS[Math.round(a) - 1] + '">' + FACES[Math.round(a) - 1] + '</span>' +
        '<span class="md-dots" aria-hidden="true">' + d.rows.map(function (r) { return '<i class="v' + r.v + '" title="' + esc(r.b.title) + '"></i>'; }).join('') + '</span>' +
        '<span class="muted small">' + L.num1(a) + '</span></li>';
    }).join('') + '</ul>' : '<p class="muted small">Tap a face in “Now” on the Today tab as your day goes. Each part of your plan gets its own mood, and they add up here.</p>';
    return sec('Mood', '<div class="card">' + body + '</div>');
  });
})();
