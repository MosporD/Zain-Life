/* Zain Life — Work tab: today's work hours, meetings from the phone's calendar (read-only),
   task lists by project, a time log with a running timer, and a "Focus now" shortcut to the
   focus session in life.js. Plugged into app.js through window.LP, like life.js and money.js. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, A = L.ACTIONS, H = L.HOOKS, toast = L.toast;
  var todayKey = L.todayKey, dateKey = L.dateKey, fromKey = L.fromKey, addDays = L.addDays, today = L.today;
  var toMin = L.toMin, fmt12 = L.fmt12, fmtDur = L.fmtDur;
  var WORK_RANGES = /^(Work|Office|Shift)/;

  /* ---------------- data ---------------- */
  function W() {
    var s = L.st();
    var w = s.work = s.work || {};
    w.projects = Array.isArray(w.projects) ? w.projects : [];
    w.tasks = Array.isArray(w.tasks) ? w.tasks : [];
    w.log = Array.isArray(w.log) ? w.log : [];
    if (w.timer === undefined) w.timer = null;
    return w;
  }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function project(id) { var p = W().projects.filter(function (x) { return x.id === id; })[0]; return p ? p.name : 'General'; }
  function sec(title, body, right) { return '<section><div class="sec-h"><h2>' + title + '</h2>' + (right || '') + '</div>' + body + '</section>'; }
  function projectOptions(sel) {
    return '<option value=""' + (sel ? '' : ' selected') + '>General</option>' + W().projects.map(function (p) {
      return '<option class="notr" value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
  }
  function rerender() { if (L.tab() === 'work' && !L.sheetOpen() && !L.isTyping()) L.render(); }

  /* ---------------- phone calendar (native, read-only) ---------------- */
  function NP() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LifeNative ? C.Plugins.LifeNative : null;
  }
  var cal = { granted: null, events: null, loadedAt: 0, error: '' };
  function loadCalendar(force) {
    var n = NP();
    if (!n || !n.calendarStatus) return Promise.resolve();
    if (!force && cal.events && Date.now() - cal.loadedAt < 5 * 60000) return Promise.resolve();
    return n.calendarStatus().then(function (r) {
      cal.granted = !!(r && r.granted);
      if (!cal.granted) return;
      return n.calendarEvents({ days: 2 }).then(function (res) {
        cal.events = (res && res.events) || []; cal.loadedAt = Date.now(); cal.error = '';
        if (window.ZLWidget) ZLWidget.refresh();
      });
    }).catch(function (e) { cal.error = (e && e.message) || 'error'; }).then(rerender);
  }
  // All-day events come from Android as midnight UTC, so their date is read in UTC.
  function evDate(e) {
    if (e.allDay) { var d = new Date(e.begin); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
    return dateKey(new Date(e.begin));
  }
  function hm(ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function meetingsFor(k) {
    return (cal.events || []).filter(function (e) { return evDate(e) === k || (!e.allDay && e.begin < fromKey(k).getTime() && e.end > fromKey(k).getTime()); });
  }
  function meetingRow(e, k) {
    var now = Date.now(), live = !e.allDay && e.begin <= now && e.end > now;
    var when = e.allDay ? 'All day' : (dateKey(new Date(e.begin)) < k ? 'Until ' + fmt12(hm(e.end)) : fmt12(hm(e.begin)) + ' – ' + fmt12(hm(e.end)));
    return '<li class="' + (live ? 'live' : '') + (!e.allDay && e.end <= now ? ' past' : '') + '"><span class="ln">' + (e.title ? '<b class="notr">' + esc(e.title) + '</b>' : '<b>(No title)</b>') +
      '<span>' + esc(when) + (e.location ? ' · <span class="notr">' + esc(e.location) + '</span>' : '') + '</span></span>' + (live ? '<span class="lk job-now">Now</span>' : '') + '</li>';
  }
  function meetingsSection() {
    var n = NP();
    if (!n || !n.calendarStatus) {
      return sec('Meetings', '<div class="card"><p class="muted small">Meetings from your phone’s calendar (including Outlook, when it syncs to the phone) show here in the installed app.</p></div>');
    }
    if (cal.granted === null) { loadCalendar(false); return sec('Meetings', '<div class="card"><p class="muted small">Loading your calendar…</p></div>'); }
    if (!cal.granted) {
      return sec('Meetings', '<div class="card"><p class="small">See today’s meetings from your phone’s calendar here. Zain Life only reads them: nothing is changed or sent anywhere.</p>' +
        '<div class="row-btns"><button class="btn" data-act="job-cal-allow">Show my meetings</button></div></div>');
    }
    loadCalendar(false);
    var t = todayKey(), tm = dateKey(addDays(today(), 1)), a = meetingsFor(t), b = meetingsFor(tm);
    var list = function (arr, k) { return '<ul class="loglist">' + arr.map(function (e) { return meetingRow(e, k); }).join('') + '</ul>'; };
    var body = '<div class="card">' + (cal.error ? '<p class="muted small">Could not read the calendar.</p>' : '') +
      (a.length ? list(a, t) : '<p class="muted small">No meetings today.</p>') +
      (b.length ? '<p class="flabel" style="margin-top:14px">Tomorrow</p>' + list(b, tm) : '') + '</div>';
    return sec('Meetings', body, '<button class="btn ghost sm" data-act="job-cal-refresh">Refresh</button>');
  }
  A['job-cal-allow'] = function () {
    var n = NP(); if (!n) return;
    n.calendarRequest().then(function (r) {
      cal.granted = !!(r && r.granted);
      if (!cal.granted) toast('Calendar access is off. You can allow it in Android settings.');
      return loadCalendar(true);
    }).catch(function () { toast('Could not open the calendar permission'); });
  };
  A['job-cal-refresh'] = function () { loadCalendar(true).then(function () { toast('Meetings updated'); }); };

  /* ---------------- today's work hours + focus ---------------- */
  function workBlocks(d) { return L.blocksForDate(d).filter(function (b) { return b.cat === 'work' && !b.prayer; }); }
  function minsLogged(k) { var m = 0; W().log.forEach(function (e) { if (e.date === k) m += e.min; }); return m + (W().timer && W().timer.date === k ? running() : 0); }
  function running() { var t = W().timer; return t ? Math.max(0, Math.round((Date.now() - t.start) / 60000)) : 0; }
  function headerCard() {
    var wb = workBlocks(today()), first = wb[0], last = wb[wb.length - 1];
    var rh = readHours(), isDay = rh && rh.days.indexOf(today().getDay()) >= 0;
    var hours = isDay && W().hoursSet ? hoursText(rh) : !wb.length ? '' :
      first.start === '00:00' && wb.length === 1 ? 'Until ' + fmt12(last.end) + ' (last night’s shift)' : fmt12(first.start) + ' – ' + fmt12(last.end);
    return '<section><div class="card job-head"><div class="job-hrow"><span><span class="lbl">' + (wb.length ? 'Work today' : 'No work planned today') + '</span>' +
      (hours ? '<b class="job-hours">' + esc(hours) + '</b>' : '') + '</span>' +
      '<span class="job-logged"><b>' + esc(fmtDur(minsLogged(todayKey()))) + '</b><span class="muted small">logged</span></span></div>' +
      '<div class="row-btns"><button class="btn" data-act="ft-open" data-title="Work">Focus now</button>' + (W().hoursSet && readHours() ? '<button class="btn ghost" data-act="job-hrs-open">Work hours</button>' : '') + '</div></div></section>';
  }

  /* ---------------- tasks ---------------- */
  var showDone = false;
  function tasksSection() {
    var w = W(), open = w.tasks.filter(function (x) { return !x.done; }), k = todayKey();
    var doneToday = w.tasks.filter(function (x) { return x.done && x.doneAt === k; });
    var groups = {}, order = [];
    open.forEach(function (x) { var p = x.project || ''; if (!groups[p]) { groups[p] = []; order.push(p); } groups[p].push(x); });
    order.sort(function (a, b) { return a === '' ? 1 : b === '' ? -1 : project(a).localeCompare(project(b)); });
    var rows = function (arr) {
      return '<ul class="job-tasks">' + arr.map(function (x) {
        var due = x.due ? (x.due < k ? ' job-late' : x.due === k ? ' job-due' : '') : '';
        return '<li><button class="job-tick' + (x.done ? ' on' : '') + '" data-act="job-task-tick" data-id="' + esc(x.id) + '" aria-label="' + (x.done ? 'Mark not done' : 'Mark done') + '"></button>' +
          '<span class="ln"><b class="notr">' + esc(x.title) + '</b>' + (x.due ? '<span class="' + due + '">' + esc(x.due === k ? 'Due today' : 'Due ' + L.shortDate(x.due)) + '</span>' : '') + '</span>' +
          '<button class="x" data-act="job-task-del" data-id="' + esc(x.id) + '" aria-label="Remove">×</button></li>';
      }).join('') + '</ul>';
    };
    var lists = order.map(function (p) { return '<p class="flabel' + (p ? ' notr' : '') + '">' + esc(p ? project(p) : 'General') + '</p>' + rows(groups[p]); }).join('');
    var add = '<div class="job-add"><input type="text" id="job-task-in" placeholder="Add a task" maxlength="140">' +
      '<select id="job-task-proj" aria-label="Project">' + projectOptions(lastProject) + '</select>' +
      '<input type="date" id="job-task-due" aria-label="Due date"><button class="btn" data-act="job-task-add">Add</button></div>';
    var body = '<div class="card">' + add + (lists || '<p class="muted small" style="margin-top:12px">No open tasks. Add what you need to get done.</p>') +
      (doneToday.length ? '<button class="linkbtn" data-act="job-done-toggle">' + (showDone ? 'Hide done today' : 'Show done today') + ' <span class="muted">(' + doneToday.length + ')</span></button>' +
        (showDone ? rows(doneToday) : '') : '') + '</div>';
    return sec('Tasks', body, '<button class="btn ghost sm" data-act="job-proj-open">Projects</button>');
  }
  var lastProject = '';
  A['job-task-add'] = function () {
    var inp = document.getElementById('job-task-in'), title = (inp.value || '').trim();
    if (!title) { toast('Type the task first'); inp.focus(); return; }
    lastProject = document.getElementById('job-task-proj').value;
    var due = document.getElementById('job-task-due').value || null;
    W().tasks.push({ id: uid('t'), title: title, project: lastProject, due: due, done: false, doneAt: null, created: todayKey() });
    L.save(); L.render();
    var again = document.getElementById('job-task-in'); if (again) again.focus();
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'job-task-in') { e.preventDefault(); A['job-task-add'](); } });
  A['job-task-tick'] = function (el) {
    var id = el.getAttribute('data-id'), x = W().tasks.filter(function (t) { return t.id === id; })[0];
    if (!x) return;
    x.done = !x.done; x.doneAt = x.done ? todayKey() : null;
    L.save(); L.render(); if (x.done) toast('Done: ' + x.title);
    if (L.sheetOpen() && document.querySelector('#sheet-root .qk-top')) A['qk-open']();   // refresh the centre-button sheet
  };
  A['job-task-del'] = function (el) {
    if (!L.armed(el, 'Tap again to remove')) return;
    var id = el.getAttribute('data-id');
    W().tasks = W().tasks.filter(function (t) { return t.id !== id; });
    L.save(); L.render();
  };
  A['job-done-toggle'] = function () { showDone = !showDone; L.render(); };

  /* ---------------- projects ---------------- */
  function openProjects() {
    var ps = W().projects;
    L.openSheet('<h3>Projects</h3><p class="muted small">Group tasks and logged time by project.</p>' +
      (ps.length ? '<ul class="loglist">' + ps.map(function (p) {
        return '<li><span class="ln"><b class="notr">' + esc(p.name) + '</b></span><button class="x" data-act="job-proj-del" data-id="' + esc(p.id) + '" aria-label="Remove">×</button></li>';
      }).join('') + '</ul>' : '') +
      '<div class="inline" style="margin-top:12px"><input type="text" id="job-proj-in" placeholder="New project" maxlength="40"><button class="btn" data-act="job-proj-add">Add</button></div>');
  }
  A['job-proj-open'] = openProjects;
  A['job-proj-add'] = function () {
    var v = (document.getElementById('job-proj-in').value || '').trim();
    if (!v) return;
    if (W().projects.some(function (p) { return p.name.toLowerCase() === v.toLowerCase(); })) { toast('That project already exists'); return; }
    W().projects.push({ id: uid('p'), name: v });
    L.save(); openProjects();
  };
  A['job-proj-del'] = function (el) {
    if (!L.armed(el, 'Tap again: its tasks move to General')) return;
    var id = el.getAttribute('data-id'), w = W();
    w.projects = w.projects.filter(function (p) { return p.id !== id; });
    w.tasks.forEach(function (t) { if (t.project === id) t.project = ''; });
    w.log.forEach(function (e) { if (e.project === id) e.project = ''; });
    if (w.timer && w.timer.project === id) w.timer.project = '';
    if (lastProject === id) lastProject = '';
    L.save(); openProjects();
  };

  /* ---------------- time log ---------------- */
  var tick = null;
  function timeSection() {
    var w = W(), t = w.timer, k = todayKey();
    var entries = w.log.filter(function (e) { return e.date === k; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    var runCard = t ? '<div class="job-run"><span><span class="lbl">Timer running</span><b' + (t.note || t.project ? ' class="notr"' : '') + '>' + esc(t.note || project(t.project)) + '</b>' +
      '<span class="muted small">' + (t.note ? '<span' + (t.project ? ' class="notr"' : '') + '>' + esc(project(t.project)) + '</span> · ' : '') + 'since ' + esc(fmt12(hm(t.start))) + '</span></span>' +
      '<span class="job-elapsed" id="job-elapsed">' + esc(fmtDur(running())) + '</span></div>' +
      '<div class="row-btns"><button class="btn" data-act="job-timer-stop">Stop and log</button><button class="btn ghost" data-act="job-timer-cancel">Discard</button></div>' :
      '<div class="row-btns" style="margin-top:0"><button class="btn" data-act="job-timer-open">Start timer</button><button class="btn ghost" data-act="job-log-open">Add time</button></div>';
    if (t && !tick) tick = setInterval(function () {
      var el = document.getElementById('job-elapsed');
      if (!el || !W().timer) { clearInterval(tick); tick = null; return; }
      el.textContent = fmtDur(running());
    }, 30000);
    var list = entries.length ? '<ul class="loglist" style="margin-top:12px">' + entries.map(function (e) {
      var pj = e.note ? '<span' + (e.project ? ' class="notr"' : '') + '>' + esc(project(e.project)) + '</span>' : '';
      var sub = [pj, e.start ? esc(fmt12(e.start)) : ''].filter(Boolean).join(' · ');
      return '<li><span class="ln"><b' + (e.note || e.project ? ' class="notr"' : '') + '>' + esc(e.note || project(e.project)) + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</span>' +
        '<span class="lk">' + esc(fmtDur(e.min)) + '</span><button class="x" data-act="job-log-del" data-id="' + esc(e.id) + '" aria-label="Remove">×</button></li>';
    }).join('') + '</ul>' : '';
    return sec('Time log', '<div class="card">' + runCard + list + '</div>' + weekCard());
  }
  // This week (Sunday to today) by project.
  function weekCard() {
    var t = today(), from = dateKey(addDays(t, -t.getDay())), k = todayKey(), by = {}, total = 0;
    W().log.forEach(function (e) { if (e.date >= from && e.date <= k) { by[e.project || ''] = (by[e.project || ''] || 0) + e.min; total += e.min; } });
    if (!total) return '';
    var max = 0; Object.keys(by).forEach(function (p) { max = Math.max(max, by[p]); });
    var rows = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (p) {
      return '<li><span class="job-bn' + (p ? ' notr' : '') + '">' + esc(project(p)) + '</span><span class="job-bar"><span style="width:' + Math.max(4, by[p] / max * 100).toFixed(0) + '%"></span></span>' +
        '<span class="lk">' + esc(fmtDur(by[p])) + '</span></li>';
    }).join('');
    return '<div class="card" style="margin-top:12px"><div class="sec-h"><span class="flabel" style="margin:0">This week</span><b>' + esc(fmtDur(total)) + '</b></div>' +
      '<ul class="job-bars">' + rows + '</ul></div>';
  }
  function openTimerSheet() {
    L.openSheet('<h3>Start timer</h3><label class="field"><span>Project</span><select id="job-t-proj">' + projectOptions(lastProject) + '</select></label>' +
      '<label class="field"><span>What are you working on? (optional)</span><input type="text" id="job-t-note" maxlength="80"></label>' +
      '<div class="row-btns"><button class="btn" data-act="job-timer-start">Start</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  }
  A['job-timer-open'] = openTimerSheet;
  A['job-timer-start'] = function () {
    lastProject = document.getElementById('job-t-proj').value;
    W().timer = { start: Date.now(), date: todayKey(), project: lastProject, note: (document.getElementById('job-t-note').value || '').trim() };
    L.save(); L.closeSheet(); L.render(); toast('Timer started');
  };
  A['job-timer-stop'] = function () {
    var w = W(), t = w.timer; if (!t) return;
    var min = running();
    w.timer = null;
    if (min < 1) { L.save(); L.render(); toast('Less than a minute, not logged'); return; }
    w.log.push({ id: uid('l'), date: t.date, start: hm(t.start), min: min, project: t.project, note: t.note });
    L.save(); L.render(); toast(fmtDur(min) + ' logged');
  };
  A['job-timer-cancel'] = function (el) { if (!L.armed(el, 'Tap again to discard')) return; W().timer = null; L.save(); L.render(); };
  A['job-log-open'] = function () {
    L.openSheet('<h3>Add time</h3><label class="field"><span>Project</span><select id="job-l-proj">' + projectOptions(lastProject) + '</select></label>' +
      '<label class="field"><span>What did you work on? (optional)</span><input type="text" id="job-l-note" maxlength="80"></label>' +
      '<p class="flabel" style="margin-top:14px">How long?</p><div class="choice">' + [15, 30, 45, 60, 90, 120].map(function (m) {
        return '<button type="button" class="chip" data-act="job-log-add" data-v="' + m + '">' + fmtDur(m) + '</button>';
      }).join('') + '</div>');
  };
  A['job-log-add'] = function (el) {
    lastProject = document.getElementById('job-l-proj').value;
    W().log.push({ id: uid('l'), date: todayKey(), start: null, min: +el.getAttribute('data-v'), project: lastProject, note: (document.getElementById('job-l-note').value || '').trim() });
    L.save(); L.closeSheet(); L.render(); toast('Time added');
  };
  A['job-log-del'] = function (el) {
    if (!L.armed(el, 'Tap again to remove')) return;
    var id = el.getAttribute('data-id');
    W().log = W().log.filter(function (e) { return e.id !== id; });
    L.save(); L.render();
  };

  /* ---------------- tab ---------------- */
  /* ---------------- work hours (set by the person, not everyone works 8 to 5) ---------------- */
  // The plan is built from the hour-by-hour workday grid, so changing hours repaints the "work"
  // cells there and rebuilds the workday templates. Other days are kept unless work days change (the day after a workday is rebuilt too, for night shifts).
  function grids() { var p = L.st().profile; return p && p.grids && (p.grids.idealWork || p.grids.curWork) ? p.grids : null; }
  function cellVal(g, h, q) { var c = g.cells || {}; return g.split && g.split[h] ? c[h + ':' + q] : c[h]; }
  function readHours() {
    var G = grids(); if (!G) return null;
    var g = G.idealWork || G.curWork, first = null, last = null;
    for (var h = g.wake; h < g.sleep; h++) for (var q = 0; q < 4; q++) {
      if (cellVal(g, h, q) === 'work') { var m = h * 60 + q * 15; if (first == null) first = m; last = m + 15; }
    }
    return { start: first == null ? 480 : first, end: last == null ? 1020 : last, days: (L.st().profile.workDays || []).slice() };
  }
  function paintWork(g, s, e) {
    g.cells = g.cells || {}; g.split = g.split || {};
    Object.keys(g.cells).forEach(function (k) { if (g.cells[k] === 'work') delete g.cells[k]; });
    for (var h = Math.floor(s / 60); h * 60 < e; h++) {
      if (h * 60 >= s && h * 60 + 60 <= e && !g.split[h]) { g.cells[h] = 'work'; continue; }
      if (!g.split[h]) { var v = g.cells[h]; delete g.cells[h]; g.split[h] = true; for (var i = 0; i < 4; i++) if (v) g.cells[h + ':' + i] = v; }
      for (var q = 0; q < 4; q++) { var m = h * 60 + q * 15; if (m >= s && m < e) g.cells[h + ':' + q] = 'work'; }
    }
    if (e > 1440) {                       // overnight: sleep an hour after the shift, for 8 hours, then the day starts
      g.sleep = Math.ceil(e / 60) + 1;
      g.wake = g.sleep + 8 - 24;
    } else {                              // day shift (also undoes an earlier night pattern)
      g.wake = Math.min(g.wake > 12 ? 7 : g.wake, Math.floor(s / 60));
      g.sleep = Math.max(g.sleep > 26 ? 23 : g.sleep, Math.ceil(e / 60));
    }
  }
  function daysText(days) { return days.length ? days.slice().sort().map(function (d) { return L.DAYS[d]; }).join(', ') : 'No work days'; }
  function hoursText(h) { return fmt12(L.minToT(h.start % 1440)) + ' – ' + fmt12(L.minToT(h.end % 1440)) + (h.end > 1440 ? ' (overnight)' : ''); }
  function hoursForm(h, inSheet) {
    return '<div class="job-hrs" data-sheet="' + (inSheet ? 1 : 0) + '"><div class="two">' +
      '<label class="field"><span>Starts</span>' + L.timeSelect('class="job-hrs-s"', L.minToT(h.start)) + '</label>' +
      '<label class="field"><span>Ends</span>' + L.timeSelect('class="job-hrs-e"', L.minToT(h.end % 1440)) + '</label></div>' +
      '<p class="flabel" style="margin-top:14px">Work days</p><div class="choice">' + L.DAYS.map(function (n, i) {
        var on = h.days.indexOf(i) >= 0;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="job-hrs-day" data-v="' + i + '" aria-pressed="' + on + '">' + n + '</button>';
      }).join('') + '</div>' +
      '<p class="muted small" style="margin-top:12px">Your plan is rebuilt around these hours. Changes you made by hand to workdays in the Plan tab are replaced. For a night shift, set an end time earlier than the start, like 10 pm to 6 am.</p>' +
      '<div class="row-btns"><button class="btn" data-act="job-hrs-save">Save hours</button>' + (inSheet ? '<button class="btn ghost" data-act="close-sheet">Cancel</button>' : '') + '</div></div>';
  }
  function setupCard() {
    var h = readHours();
    if (!h || W().hoursSet) return '';
    return '<section><div class="card job-setup"><span class="lbl">Set your work hours</span>' +
      '<p class="muted small" style="margin-top:6px">Not everyone works 8 to 5. Set your hours and your plan moves around them.</p>' + hoursForm(h, false) + '</div></section>';
  }
  function openHours() {
    var h = readHours();
    if (!h) { toast('Redo setup in Settings first, then set your work hours.'); return; }
    L.openSheet('<h3>Work hours</h3>' + hoursForm(h, true));
  }
  A['job-hrs-open'] = openHours;
  A['job-hrs-day'] = function (el) { var on = !el.classList.contains('on'); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); };
  A['job-hrs-save'] = function (el) {
    var box = el.closest('.job-hrs'), st = L.st(), p = st.profile;
    var s = toMin(box.querySelector('.job-hrs-s').value || ''), e = toMin(box.querySelector('.job-hrs-e').value || '');
    if (isNaN(s) || isNaN(e)) { toast('Enter a start and an end time.'); return; }
    s = Math.round(s / 15) * 15; e = Math.round(e / 15) * 15;
    if (e === 0) e = 1440;
    if (e <= s) e += 1440;                // ends the next morning: an overnight shift
    if (e - s > 16 * 60) { toast('That’s more than 16 hours. Check the times.'); return; }
    var days = [].map.call(box.querySelectorAll('[data-act="job-hrs-day"].on'), function (b) { return +b.getAttribute('data-v'); }).sort();
    var oldDays = (p.workDays || []).slice().sort().join(), G = p.grids;
    if (!G.idealWork) G.idealWork = L.clone(G.curWork);
    if (!G.idealWeekend && G.curWeekend) G.idealWeekend = L.clone(G.curWeekend);
    ['curWork', 'idealWork'].forEach(function (k) { if (G[k]) paintWork(G[k], s, e); });
    p.workDays = days;
    var res = window.Planner.buildTemplates(p, st.settings.limit), same = days.join() === oldDays;
    st.templates = st.templates || {};
    // Workdays change, and so does the morning after each one (a night shift ends there).
    for (var d = 0; d < 7; d++) if (!same || days.indexOf(d) >= 0 || days.indexOf((d + 6) % 7) >= 0) st.templates[d] = res.templates[d];
    W().hoursSet = true;
    L.save(); if (L.sheetOpen()) L.closeSheet(); L.queueReschedule(); L.render();
    toast('Work hours saved');
  };
  H.settings.push(function (group) {
    if (group !== 'work') return '';
    var h = readHours(); if (!h) return '<section><div class="card"><p class="muted small">Run setup first to set your work hours.</p></div></section>';
    return '<section><h2>Work</h2><div class="card"><div class="setrow"><span><span class="st">Work hours</span><br><span class="sd">' +
      esc(hoursText(h)) + ' · ' + esc(daysText(h.days)) + '</span></span><button class="btn ghost" data-act="job-hrs-open">Change</button></div></div></section>';
  });

  function renderWork() { W(); return setupCard() + headerCard() + meetingsSection() + tasksSection() + timeSection(); }
  L.TABS.work = ['Work', renderWork];

  // Inside the Now card: a line for the next meeting, when calendar access is on.
  H.nowExtra.push(function () {
    if (!cal.granted || !cal.events) return '';
    var now = Date.now(), k = todayKey();
    var next = meetingsFor(k).filter(function (e) { return !e.allDay && e.end > now; })[0];
    if (!next) return '';
    var live = next.begin <= now;
    return '<button class="nextline job-nowline" data-act="job-go"><b>' + (live ? 'Meeting now' : 'Meeting') + '</b>' + (next.title ? '<span class="notr">' + esc(next.title) + '</span>' : '(No title)') +
      ' · ' + esc(fmt12(hm(next.begin)) + ' – ' + fmt12(hm(next.end))) + '</button>';
  });
  // Centre button: next meeting and the tasks to do first (overdue, due today, then the rest).
  H.quick.push(function () {
    var k = todayKey(), now = Date.now(), out = '';
    if (cal.granted && cal.events) {
      var next = meetingsFor(k).filter(function (e) { return !e.allDay && e.end > now; })[0];
      if (next) out += '<section class="qk-sec"><h3>' + (next.begin <= now ? 'Meeting now' : 'Next meeting') + '</h3><div class="qk-one">' +
        (next.title ? '<b class="notr">' + esc(next.title) + '</b>' : '<b>(No title)</b>') + '<span>' + esc(fmt12(hm(next.begin)) + ' – ' + fmt12(hm(next.end))) + '</span></div></section>';
    }
    var open = W().tasks.filter(function (x) { return !x.done; }).sort(function (a, b) {
      var ra = a.due ? (a.due < k ? 0 : a.due === k ? 1 : 2) : 3, rb = b.due ? (b.due < k ? 0 : b.due === k ? 1 : 2) : 3;
      return ra - rb || String(a.due || '').localeCompare(String(b.due || ''));
    }).slice(0, 4);
    if (open.length) out += '<section class="qk-sec"><h3>Tasks</h3><ul class="qk-list">' + open.map(function (x) {
      var due = x.due ? (x.due < k ? 'Overdue' : x.due === k ? 'Due today' : 'Due ' + L.shortDate(x.due)) : project(x.project);
      return '<li><button class="job-tick" data-act="job-task-tick" data-id="' + esc(x.id) + '" aria-label="Mark done"></button><span class="ln"><b class="notr">' + esc(x.title) + '</b><span' + (x.due && x.due <= k ? ' class="job-due"' : '') + '>' + esc(due) + '</span></span></li>';
    }).join('') + '</ul></section>';
    return out;
  });
  // For the home-screen widget: the next few timed meetings that haven't ended.
  window.ZLWork = { upcoming: function (n) {
    if (!cal.granted || !cal.events) return [];
    var now = Date.now();
    return cal.events.filter(function (e) { return !e.allDay && e.end > now; }).sort(function (a, b) { return a.begin - b.begin; })
      .slice(0, n || 3).map(function (e) { return { t: e.title || '(No title)', b: e.begin, e: e.end }; });
  } };
  A['job-go'] = function () { L.setTab('work'); };
  H.resume.push(function () { if (cal.granted) loadCalendar(true); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { loadCalendar(false); }, 3000); });
  // Daily report: time logged and tasks finished.
  H.reportTiles.push(function (k) {
    var m = 0, n = 0;
    W().log.forEach(function (e) { if (e.date === k) m += e.min; });
    W().tasks.forEach(function (t) { if (t.done && t.doneAt === k) n++; });
    return (m ? L.statTile('Work logged', fmtDur(m)) : '') + (n ? L.statTile('Tasks done', String(n)) : '');
  });
})();
