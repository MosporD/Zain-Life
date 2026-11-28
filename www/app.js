/* Zain Life — a personal lifestyle app.
   All data lives on the phone in localStorage. Native reminders go through Capacitor's
   LocalNotifications plugin when running as an APK. Scheduling logic lives in planner.js,
   prayer times in prayer.js, the food list in foods.js. */
(function () {
  'use strict';

  var KEY = 'lifeplanner.v1';
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CATS = {
    work: 'Work', health: 'Health', growth: 'Growth', family: 'Family', social: 'Social',
    faith: 'Faith', rest: 'Rest', free: 'Scroll window', sleep: 'Sleep'
  };
  var CAT_KEYS = Object.keys(CATS);
  // Daily check-in habits. Which ones show depends on the weight goal (see activeHabits).
  var HABIT_LIB = {
    protein: 'Protein every meal', veg: 'Half-plate veg', noLiquid: 'No liquid calories', portion: 'Ate to ~80% full',
    eatEnough: 'Hit my calorie target', cardio: 'Cardio', mobility: 'Mobility routine', desk: 'Desk breaks',
    sleep7: 'Slept 7+ hours', water: 'Drank 2+ litres of water'
  };
  var ALTS = [
    'Stand up and do 10 slow bodyweight squats.',
    'Walk for 5 minutes, even if it is just around the house.',
    'Drink a full glass of water.',
    'Open the Today tab and look at what this hour is for.',
    'Send your friend a real message, not a reaction.',
    'Read 5 pages of something.',
    'Give your goal 10 focused minutes.',
    'Do the hip-flexor stretch, 60 seconds each side.',
    'Put the phone in another room for 20 minutes.',
    'Write one line in your end-of-day note.'
  ];
  var PRAYERS = [['fajr', 'Fajr'], ['dhuhr', 'Dhuhr'], ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha']];
  var GOALS = {
    career: { t: 'Career growth', d: 'A promotion, a bigger role or becoming the expert in your field', icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' },
    weight: { t: 'Weight', d: 'Lose fat, gain weight or build muscle', icon: '<path d="M6 7h12l2 13H4z"/><circle cx="12" cy="5" r="2"/><path d="M12 11v3"/>' },
    skill: { t: 'Learn a new skill', d: 'A language, an instrument, coding, anything', icon: '<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v5c3 2 9 2 12 0V9"/>' },
    pray: { t: 'Pray more', d: 'All five prayers on time, plus Quran', icon: '<path d="M12 3a6 6 0 0 0 0 12 7 7 0 0 1 0-12z"/><path d="M5 21h14M7 21v-4h10v4"/>' },
    money: { t: 'Save more money', d: 'A monthly saving target and a weekly money check-in', icon: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9.5h.01M18 15.5h.01"/>' },
    mind: { t: 'Look after my mind', d: 'A daily calm moment: meditation, journaling or a quiet walk', icon: '<path d="M12 20.5c-5-3.6-8-6.4-8-10a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 3.6-3 6.4-8 10z"/>' },
    social: { t: 'Family and friends', d: 'Protected time for the people who matter', icon: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.8c3 0 5.5 1.6 5.5 4.7"/>' },
    reading: { t: 'Read more', d: 'A few pages every day', icon: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>' },
    other: { t: 'Something else', d: 'Name your own goal and give it time every week', icon: '<path d="M12 5v14M5 12h14"/>' }
  };
  // A short lifestyle tip on the welcome screen, different each time the app opens.
  var TIPS = [
      "Drink a glass of water before every meal.",
      "A 10-minute walk after eating helps your blood sugar.",
      "Stand up and stretch every 30 minutes.",
      "Put your phone in another room an hour before bed.",
      "Protein at breakfast keeps you full for longer.",
      "Wake up at the same time every day, weekends too.",
      "Take the stairs whenever you can.",
      "Plan tomorrow tonight. Your morning will thank you.",
      "Fill half your plate with vegetables.",
      "Get 10 minutes of daylight in the morning.",
      "Call someone you care about this week.",
      "Small steps every day beat big steps once in a while.",
      "Eat slowly. Fullness takes about 20 minutes to arrive.",
      "Keep fruit where you can see it.",
      "Write down one thing that went well today.",
      "Feeling stressed? Breathe in for 4, out for 6.",
      "A nap under 20 minutes can reset your focus.",
      "Swap one sugary drink for water today.",
      "Every 20 minutes, look 20 metres away for 20 seconds.",
      "Start with 5 minutes. Starting is the hardest part."
  ];
  var HEART = 'M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z';

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  // Date, time and text helpers live in util.js.
  var U = window.ZLUtil;
  var uid = U.uid, esc = U.esc, pad = U.pad, dateKey = U.dateKey, fromKey = U.fromKey, today = U.today, todayKey = U.todayKey, addDays = U.addDays, daysBetween = U.daysBetween, toMin = U.toMin, minToT = U.minToT, fmt12 = U.fmt12, hourLabel = U.hourLabel, fmtDur = U.fmtDur, nowMin = U.nowMin, byStart = U.byStart, clone = U.clone, num1 = U.num1;
  function prettyDate(d) { return DAYS_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function shortDate(k) { var d = fromKey(k); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function catColor(c) { return 'var(--c-' + (CATS[c] ? c : 'rest') + ')'; }
  function isTyping() { var a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); }
  function getPath(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setPath(o, path, v) { var ks = path.split('.'), last = ks.pop(); ks.reduce(function (x, k) { return x[k] = x[k] || {}; }, o)[last] = v; }
  // One-letter day names for small charts (Arabic uses the usual initials: ح ن ث ر خ ج س).
  function dayIni(i) { return window.I18N && I18N.lang() === 'ar' ? 'حنثرخجس'.charAt(i) : DAYS[i].charAt(0); }
  function tr(x) { return window.I18N ? I18N.str(x) : x; }
  function heartSvg() { return '<svg viewBox="-1 2 44.5 42.5"><path class="sw" d="M33.1075 15.7299C33.1075 12.2743 30.4499 9.66059 26.6571 9.95169C18.6087 10.5695 17.5699 19.7237 22.8099 20.3101C28.2886 20.9216 30.2488 15.1288 30.3535 14.8042C30.3535 14.8021 30.3577 14.8021 30.3577 14.8042C30.3703 15.1979 30.6614 23.1688 22.5334 23.1688C18.3092 23.1688 16.1353 19.7174 16.1353 16.7247C16.1353 12.291 20.4496 7.88043 26.5335 7.64587C29.9431 7.51393 32.1881 8.32024 33.9474 10.0794C37.5328 13.6649 36.5003 20.3876 33.5976 23.7071C28.9922 28.9763 22.5167 30.3146 16.4851 27.6108C10.4535 24.905 8.2901 17.0744 11.9467 10.5213C13.2913 8.11081 18.1752 2.74102 26.567 2.74102C37.2207 2.74102 42.624 10.2931 41.6481 19.1645C40.9004 25.9626 36.7705 30.8863 34.8563 32.966C26.4456 42.1055 14.0871 43.9275 6.30051 39.1756C2.01558 36.5598 -0.47664 31.8644 0.0762554 26.5511C0.551661 30.39 2.46376 33.7094 5.64709 35.8812C12.0117 40.2227 22.657 40.8196 30.3494 32.3586C22.6172 38.1347 13.5824 38.0467 7.41468 34.0278C1.75379 30.3397 0.197725 22.9782 2.96848 15.6964C1.57787 22.1887 3.81249 28.2056 8.72152 31.3429C16.3741 36.231 27.5241 33.4204 34.5505 25.5479C36.9443 22.8651 38.3182 19.2462 38.2742 15.9435C38.1988 10.4376 34.3641 5.49502 26.6173 5.49502C18.6653 5.49502 13.2033 11.6418 13.2033 16.7582C13.2033 22.4379 17.1008 25.6778 22.1858 25.6778C27.2142 25.6736 33.1075 22.5028 33.1075 15.7299Z"/></svg>'; }   // the Zain swirl

  /* ---------------- storage ---------------- */
  function emptyTemplates() { var t = {}; for (var d = 0; d < 7; d++) t[d] = []; return t; }
  function defaultState() {
    return {
      v: 1, profile: null, templates: emptyTemplates(), overrides: {}, days: {}, weights: [],
      settings: { theme: 'dark', lang: 'en', reminders: false, prayerReminders: true, reportReminder: true, reminderAsked: false, city: 'amman',
        scrollAlerts: true, sessionMin: 15, stepGoal: 8000,
        start: null, target: null, limit: 30 },
      macros: { targets: null, log: {}, foods: [] }
    };
  }
  function normalize(s) {
    var d = defaultState();
    if (!s || typeof s !== 'object') return d;
    s.templates = s.templates || d.templates;
    for (var i = 0; i < 7; i++) if (!Array.isArray(s.templates[i])) s.templates[i] = [];
    s.overrides = s.overrides || {};
    s.days = s.days || {};
    s.weights = Array.isArray(s.weights) ? s.weights : [];
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.macros = Object.assign({}, d.macros, s.macros || {});
    s.macros.log = s.macros.log || {};
    s.macros.foods = Array.isArray(s.macros.foods) ? s.macros.foods : [];
    if (s.profile === undefined) s.profile = null;
    if (s.profile && !s.profile.religion) s.profile.religion = s.profile.goals && s.profile.goals.indexOf('pray') >= 0 ? 'muslim' : 'other';
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* defaults */ }
    return defaultState();
  }
  var state = load();
  // Extension points used by life.js (workouts, Ramadan, savings, widget...).
  var HOOKS = { overlay: [], today: [], health: [], reportTiles: [], reportMissed: [], notifs: [], tap: [], resume: [], saved: [], settings: [], timeline: [], todayTop: [], filter: [], dashTiles: [], dashCards: [], dashSteps: [], dayAlias: [], dashTop: [], healthActivity: [], healthBody: [], focusTop: [], quick: [], nowExtra: [], reportExtra: [], profileTop: [] };
  function runHooks(name) { var a = [].slice.call(arguments, 1), out = ''; HOOKS[name].forEach(function (f) { try { var r = f.apply(null, a); if (typeof r === 'string') out += r; } catch (e) { console.warn(name, e); } }); return out; }
  var saveFailed = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false; runHooks('saved'); }
    catch (e) { if (!saveFailed) toast('Could not save. Phone storage may be full.'); saveFailed = true; }
  }

  function displayList(k) {
    if (state.overrides[k]) return state.overrides[k];
    var day = fromKey(k).getDay();
    HOOKS.dayAlias.forEach(function (f) { try { var alt = f(k, day); if (alt != null) day = alt; } catch (e) { console.warn('dayAlias', e); } });
    return state.templates[day] || [];
  }
  function dayRec(k) {
    var r = state.days[k];
    if (!r) r = state.days[k] = { done: {}, habits: {}, screen: null, urges: 0, note: '' };
    r.done = r.done || {}; r.habits = r.habits || {}; if (r.urges == null) r.urges = 0;
    return r;
  }
  function peekDay(k) { return state.days[k] || { done: {}, habits: {}, screen: null, urges: 0, note: '' }; }
  function religion() { return (state.profile && state.profile.religion) || 'other'; }
  function isMuslim() { return religion() === 'muslim'; }
  function hasGoal(g) { return !!(state.profile && state.profile.goals && state.profile.goals.indexOf(g) >= 0); }
  function weightGoal() { return hasGoal('weight') && state.profile.weightQ ? state.profile.weightQ : null; }
  function activeHabits() {
    var W = weightGoal(), keys;
    if (!W) keys = ['sleep7', 'water'];
    else {
      keys = W.direction === 'lose' ? ['protein', 'veg', 'noLiquid', 'portion', 'cardio'] : ['protein', 'eatEnough'];
      if (W.limits) keys.push('mobility');
      if (W.activity === 'desk') keys.push('desk');
      keys.push('sleep7', 'water');
    }
    return keys.map(function (k) { return { k: k, l: HABIT_LIB[k] }; });
  }

  /* ---------------- prayer overlay ---------------- */
  function prayerBlocks(date) {
    if (!hasGoal('pray') || !isMuslim() || !window.PrayerTimes) return [];      // the five daily prayers are for Muslims
    var city = PrayerTimes.CITIES[state.settings.city] || PrayerTimes.CITIES.amman;
    var t = PrayerTimes.times(date, city.lat, city.lng);
    var mosque = state.profile.prayQ && state.profile.prayQ.place === 'mosque';
    return PRAYERS.map(function (p) {
      var friday = p[0] === 'dhuhr' && date.getDay() === 5;
      var len = friday ? 60 : (mosque ? 25 : 15);
      var s = toMin(t[p[0]]);
      return { id: 'p-' + p[0], start: t[p[0]], end: minToT(Math.min(s + len, 1439)),
        title: friday ? 'Jumu’ah prayer' : p[1] + ' prayer', cat: 'faith', remind: state.settings.prayerReminders, prayer: true };
    });
  }
  // The day's own plan, after extensions hide blocks (e.g. daytime meals during Ramadan).
  function planList(date) {
    var list = displayList(dateKey(date));
    HOOKS.filter.forEach(function (f) { try { list = f(date, list) || list; } catch (e) { console.warn('filter', e); } });
    return list;
  }
  function blocksForDate(date) {
    var extra = [];
    HOOKS.overlay.forEach(function (f) { try { extra = extra.concat(f(date) || []); } catch (e) { console.warn('overlay', e); } });
    return planList(date).concat(prayerBlocks(date), extra).sort(byStart);
  }

  /* ---------------- UI state ---------------- */
  var tab = 'dashboard';
  var reportFrom = 'dashboard';    // where Back returns to from the daily report
  var planSel = null;
  var sheetOpen = false, ignorePop = false, sheetCtx = null;
  var lastUrge = '';
  var macroDate = null;
  var reportDate = null;          // null = today
  var reportPushed = false;       // a history entry exists so Android back leaves the report
  var OB = null;                  // first-launch setup in progress
  var view = $('view');

  function applyTheme() {
    var light = state.settings.theme === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', light ? '#dfe9ff' : '#120d2b');
    document.body.classList.toggle('noglass', state.settings.glass === false);
  }

  var TABS = {
    dashboard: ['Dashboard', renderDashboard], today: ['Today', function () { return ''; }], plan: ['Plan', renderPlan], macros: ['Macros', renderMacros],
    health: ['Health', renderHealth], focus: ['Focus', renderFocus], settings: ['Settings', renderSettings],
    report: ['Daily report', renderReport]
  };
  function setTab(t) {
    if (tab === 'report' && t !== 'report' && reportPushed) { reportPushed = false; ignorePop = true; history.back(); }
    tab = t;
    if (t === 'focus' || t === 'report') syncUsage(false);
    var btns = document.querySelectorAll('#drawer button[data-tab], #tabbar button[data-tab]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-tab') === t);
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (OB) { renderOb(); return; }
    var T = TABS[tab];
    $('tb-title').textContent = T[0];
    $('tb-sub').textContent = prettyDate(today());
    view.className = 'v-' + tab;      // lets each page have its own layout (the Dashboard is centred)
    view.innerHTML = T[1]();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* =====================================================================
     FIRST-LAUNCH SETUP
     ===================================================================== */
  function fillHours(from, to, v) { var o = {}; for (var h = from; h < to; h++) o[h] = v; return o; }
  function obDefaults() {
    return {
      name: '', sex: 'male', religion: 'muslim', age: '', height: '', weight: '',
      goals: [], workDays: [0, 1, 2, 3, 4],
      grids: {
        curWork: { wake: 7, sleep: 23, cells: Object.assign({ 7: 'routine' }, fillHours(8, 17, 'work')) },
        curWeekend: { wake: 9, sleep: 24, cells: {} },
        idealWork: null, idealWeekend: null
      },
      weightQ: { direction: 'lose', goal: '', pace: 'steady', activity: 'desk', days: 3, from: 17, to: 20 },
      careerQ: { field: '', aim: 'promotion', aimOther: '', focus: 'courses', focusOther: '', hours: 5, from: 19, to: 22, where: 'any' },
      skillQ: { skill: '', level: 'beginner', hours: 4, from: 19, to: 22, where: 'any' },
      moneyQ: { monthly: '', hours: 1, from: 20, to: 22, where: 'any' },
      mindQ: { how: 'meditate', howOther: '', mins: 15, from: 21, to: 23 },
      socialQ: { who: 'both', hours: 3, from: 18, to: 21, where: 'weekend' },
      readQ: { mins: 20, from: 21, to: 23 },
      otherQ: { name: '', hours: 3, from: 19, to: 21, where: 'any' },
      prayQ: { current: [], place: 'home', quran: 15, city: 'amman', remind: true, church: true }
    };
  }
  function weekendOf(d) { return [0, 1, 2, 3, 4, 5, 6].filter(function (x) { return d.workDays.indexOf(x) < 0; }); }
  function obSteps(d) {
    var s = ['intro', 'about', 'goals', 'days'];
    // The hour-by-hour day grids are only asked in Settings > Redo setup. First-time setup
    // starts from a standard day (see ensureIdealGrids) that people adjust in the Plan tab.
    if (OB && OB.redo) {
      var split = d.workDays.length > 0 && weekendOf(d).length > 0;
      s.push('grid:curWork');
      if (split) s.push('grid:curWeekend');
      s.push('grid:idealWork');
      if (split) s.push('grid:idealWeekend');
    }
    ['weight', 'career', 'skill', 'money', 'mind', 'social', 'reading', 'other', 'pray'].forEach(function (g) { if (d.goals.indexOf(g) >= 0) s.push('q:' + g); });
    s.push('review');
    return s;
  }
  function startOnboarding(redo) {
    var d = redo && state.profile && state.profile.grids ? clone(state.profile) : obDefaults();
    var defs = obDefaults();
    // Older profiles chose "Mornings" and so on; turn that into the hour range the setup now asks for.
    var LEGACY = { morning: [6, 9], afterwork: [17, 20], evening: [19, 22], weekend: [10, 14] };
    ['weightQ', 'careerQ', 'skillQ'].forEach(function (k) {
      var q = d[k];
      if (q && q.from == null && LEGACY[q.time]) { q.from = LEGACY[q.time][0]; q.to = LEGACY[q.time][1]; if (q.time === 'weekend') q.where = 'weekend'; }
      if (q) { delete q.time; delete q.limits; }
    });
    Object.keys(defs).forEach(function (k) { if (/Q$/.test(k)) d[k] = Object.assign({}, defs[k], d[k] || {}); });
    OB = { d: d, i: 0, paint: 'work', redo: !!redo };
    closeSheetSilently();
    document.body.classList.add('ob');
    renderOb();
    window.scrollTo(0, 0);
  }

  function chips(path, options, numeric) {
    var cur = getPath(OB.d, path);
    return '<div class="choice">' + options.map(function (o) {
      var on = String(cur) === String(o[0]);
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="ob-set" data-k="' + path + '" data-v="' + esc(o[0]) + '"' +
        (numeric ? ' data-num="1"' : '') + ' aria-pressed="' + on + '">' + esc(o[1]) + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  // A row of chips that ends with "Other", which opens a box for the person's own answer.
  function chipsOther(path, options, otherLabel) {
    var cur = getPath(OB.d, path), opts = options.concat([['other', 'Other']]);
    return chips(path, opts) + (cur === 'other' ? field(path + 'Other', otherLabel, 'text', 'maxlength="50"') : '');
  }
  function hrOpts(from, to, cur) {
    var o = '';
    for (var h = from; h <= to; h++) o += '<option value="' + h + '"' + (+cur === h ? ' selected' : '') + '>' + (h === 24 ? '12 am (midnight)' : hourLabel(h)) + '</option>';
    return o;
  }
  // "From 5 pm to 8 pm": the hours of the day, picked from a list.
  function hourRange(path, label) {
    var Q = getPath(OB.d, path) || {};
    return '<div class="q"><span class="flabel">' + esc(label) + '</span><div class="two">' +
      '<label class="field"><span>From</span><select data-ob-sel="' + path + '.from">' + hrOpts(0, 23, Q.from) + '</select></label>' +
      '<label class="field"><span>To</span><select data-ob-sel="' + path + '.to">' + hrOpts(1, 24, Q.to) + '</select></label></div></div>';
  }
  var WHERE = [['any', 'Any day'], ['weekend', 'Mostly my days off']];
  function field(path, label, type, attrs, hint) {
    var v = getPath(OB.d, path);
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + type + '" data-ob="' + path + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '></label>' +
      (hint ? '<p class="q hint" style="margin-top:6px">' + esc(hint) + '</p>' : '');
  }

  function renderOb() {
    var d = OB.d, steps = obSteps(d);
    if (OB.i >= steps.length) OB.i = steps.length - 1;
    var step = steps[OB.i];
    var pct = Math.round((OB.i / (steps.length - 1)) * 100);
    var body = '';
    if (step === 'intro') body = obIntro();
    else if (step === 'about') body = obAbout();
    else if (step === 'goals') body = obGoals();
    else if (step === 'days') body = obDays();
    else if (step.indexOf('grid:') === 0) body = obGrid(step.slice(5));
    else if (step === 'q:weight') body = obWeight();
    else if (step === 'q:career') body = obCareer();
    else if (step === 'q:skill') body = obSkill();
    else if (step === 'q:pray') body = obPray();
    else if (/^q:(money|mind|social|reading|other)$/.test(step)) body = obExtra(step.slice(2));
    else if (step === 'review') body = obReview();

    var next = step === 'intro' ? 'Let’s start' : step === 'review' ? 'Start my plan' :
      steps[OB.i + 1] === 'review' ? 'Build my plan' : 'Next';
    var back = OB.i > 0 ? '<button class="btn ghost" data-act="ob-back">Back</button>' :
      (OB.redo ? '<button class="btn ghost" data-act="ob-cancel">Cancel</button>' : '');
    view.innerHTML = '<div class="ob">' +
      (step === 'intro' ? '' : '<div class="ob-prog"><span style="width:' + pct + '%"></span></div>') +
      body + '<p class="err" id="ob-err" hidden></p></div>' +
      '<div class="ob-nav"><div class="ob-nav-inner">' + back +
      '<button class="btn" data-act="' + (step === 'review' ? 'ob-apply' : 'ob-next') + '">' + next + '</button></div></div>';
  }

  function obIntro() {
    return '<div class="ob-hero">' + heartSvg() + '</div>' +
      '<p class="ob-step" style="text-align:center">' + (OB.redo ? 'Redo setup' : 'Welcome') + '</p>' +
      '<h2 style="text-align:center">' + (OB.redo ? 'Let’s rebuild your plan' : 'Welcome to Zain Life') + '</h2>' +
      '<p class="lead" style="text-align:center;max-width:34ch;margin:0 auto">' + (OB.redo ? 'A few questions first: about you, your goals, and how your days look now. ' +
      'It takes about 10 minutes. At the end you get an hour-by-hour plan built around your goals, and you can change any of it later.' :
      'A few quick questions about you and your goals. It takes about 3 minutes. At the end you get a daily plan built around your goals, and you can change any of it later.') + '</p>' +
      '<div class="choice notr" style="justify-content:center;margin-top:18px">' +
      '<button type="button" class="chip' + (state.settings.lang !== 'ar' ? ' on' : '') + '" data-act="lang" data-v="en">English</button>' +
      '<button type="button" class="chip' + (state.settings.lang === 'ar' ? ' on' : '') + '" data-act="lang" data-v="ar">العربية</button></div>';
  }
  function obAbout() {
    return '<p class="ob-step">About you</p><h2>Let’s get to know you</h2>' +
      '<p class="lead">Your body numbers are used to work out your daily calories and macros.</p>' +
      field('name', 'Name', 'text', 'maxlength="40" autocomplete="given-name" placeholder="Your first name"') +
      '<div class="q"><span class="flabel">Sex</span>' + chips('sex', [['male', 'Male'], ['female', 'Female']]) + '</div>' +
      '<div class="q"><span class="flabel">Religion</span>' + chips('religion', [['muslim', 'Muslim'], ['christian', 'Christian'], ['other', 'Other']]) +
      '<p class="hint">Sets which prayers and holidays appear. Choose Other to leave religion out.</p></div>' +
      '<div class="three" style="margin-top:4px">' +
      field('age', 'Age', 'number', 'inputmode="numeric" min="13" max="100" placeholder="years"') +
      field('height', 'Height', 'number', 'inputmode="numeric" min="120" max="230" placeholder="cm"') +
      field('weight', 'Weight', 'number', 'inputmode="decimal" step="0.1" min="30" max="300" placeholder="kg"') +
      '</div>';
  }
  function obGoals() {
    var d = OB.d;
    return '<p class="ob-step">Your goals</p><h2>What do you want to work on?</h2>' +
      '<p class="lead">Pick one or more. Each one gets a few follow-up questions.</p>' +
      '<div class="goal-cards">' + Object.keys(GOALS).filter(function (g) { return g !== 'pray' || d.religion !== 'other'; }).map(function (g) {
        var on = d.goals.indexOf(g) >= 0, G = GOALS[g];
        if (g === 'pray') G = { t: G.t, icon: G.icon, d: d.religion === 'christian' ? 'Daily prayer, Bible reading and Sunday church' : 'All five prayers on time, plus Quran' };
        return '<button type="button" class="goal-card' + (on ? ' on' : '') + '" data-act="ob-goal" data-v="' + g + '" aria-pressed="' + on + '">' +
          '<span class="gi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + G.icon + '</svg></span>' +
          '<span class="gt"><b>' + G.t + '</b><span class="d">' + G.d + '</span></span><span class="tick"></span></button>';
      }).join('') + '</div>';
  }
  function obDays() {
    var d = OB.d;
    return '<p class="ob-step">Your week</p><h2>Which days do you work?</h2>' +
      '<p class="lead">The other days are treated as your weekend. Leave them all off if you don’t work right now.</p>' +
      '<div class="q"><div class="choice">' + DAYS_FULL.map(function (n, i) {
        var on = d.workDays.indexOf(i) >= 0;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="ob-workday" data-v="' + i + '" aria-pressed="' + on + '">' + n + '</button>';
      }).join('') + '</div></div>';
  }

  var GRID_TEXT = {
    curWork: ['Your day now', 'workday', 'Your {d}, as it is right now', 'Hour by hour, from waking up until you sleep. Be honest. This is your starting point, not your plan.'],
    curWeekend: ['Your weekend now', 'weekend day', 'Your weekend days, as they are now', 'Same again for a typical day off.'],
    idealWork: ['Your ideal day', 'workday', 'How do you want your {d}s to be?', 'We copied your current day. Change the hours you want to be different. Hours you leave as free time or phone time are where your goals will be fitted in.'],
    idealWeekend: ['Your ideal weekend', 'weekend day', 'How do you want your weekends to be?', 'We copied your current weekend. Change whatever you want to be different.']
  };
  function obGrid(key) {
    var d = OB.d;
    if (key === 'idealWork' && !d.grids.idealWork) d.grids.idealWork = clone(d.grids.curWork);
    if (key === 'idealWeekend' && !d.grids.idealWeekend) d.grids.idealWeekend = clone(d.grids.curWeekend);
    var g = d.grids[key], T = GRID_TEXT[key];
    var dayWord = d.workDays.length ? T[1] : 'normal day';
    var wakeOpts = '', sleepOpts = '';
    for (var h = 4; h <= 12; h++) wakeOpts += '<option value="' + h + '"' + (g.wake === h ? ' selected' : '') + '>' + hourLabel(h) + '</option>';
    for (h = 20; h <= 26; h++) sleepOpts += '<option value="' + h + '"' + (g.sleep === h ? ' selected' : '') + '>' + hourLabel(h) + (h >= 24 ? ' (after midnight)' : '') + '</option>';

    var palette = Planner.ACTIVITIES.map(function (a) {
      return '<button type="button" class="chip' + (OB.paint === a.id ? ' on' : '') + '" data-act="ob-paint-pick" data-v="' + a.id + '">' +
        '<span class="dot" style="background:' + catColor(a.cat) + '"></span>' + esc(a.label) + '</button>';
    }).join('') + '<button type="button" class="chip' + (OB.paint === '' ? ' on' : '') + '" data-act="ob-paint-pick" data-v="">Clear</button>';

    // One row per hour; a split hour shows four 15-minute rows instead (cell keys "7" vs "7:0".."7:3").
    function cellRow(key, label, cls, side) {
      var val = g.cells[key] || '', a = Planner.activity(val);
      var text = !val ? '' : val.indexOf('c:') === 0 ? val.slice(2) : (a ? a.label : '');
      return '<li class="hr-row' + cls + (a ? ' set' : '') + '">' +
        '<button type="button" class="hr-paint" data-act="ob-paint" data-h="' + key + '" aria-label="Set ' + label + '">' +
        '<span class="hr-t">' + label + '</span><span class="hr-dot" id="dot-' + key.replace(':', '-') + '" style="' + (a ? 'background:' + catColor(a.cat) : '') + '"></span></button>' +
        '<input type="text" class="hr-in" data-ob-cell="' + key + '" maxlength="40" value="' + esc(text) + '" placeholder="Tap the time, or type">' + side + '</li>';
    }
    var rows = '';
    for (h = g.wake; h < g.sleep; h++) {
      var isSplit = g.split && g.split[h];
      var splitBtn = '<button type="button" class="hr-split' + (isSplit ? ' on' : '') + '" data-act="ob-split" data-h="' + h + '" aria-pressed="' + !!isSplit + '" ' +
        'aria-label="' + (isSplit ? 'Merge ' + hourLabel(h) + ' back into one hour' : 'Split ' + hourLabel(h) + ' into 15-minute parts') + '">' + (isSplit ? '1h' : '15′') + '</button>';
      if (!isSplit) { rows += cellRow(String(h), hourLabel(h), '', splitBtn); continue; }
      for (var qq = 0; qq < 4; qq++) {
        var x = h % 24, lbl = (x % 12 || 12) + ':' + pad(qq * 15) + (x < 12 ? ' am' : ' pm');
        rows += cellRow(h + ':' + qq, lbl, ' quarter' + (qq === 0 ? ' q-first' : '') + (qq === 3 ? ' q-last' : ''), qq === 0 ? splitBtn : '<span></span>');
      }
    }
    var copy = key.indexOf('ideal') === 0 ? '<button class="linkbtn" data-act="ob-copy-current">Start again from my current day</button>' : '';
    return '<p class="ob-step">' + T[0] + '</p><h2>' + esc(T[2].replace('{d}', dayWord)) + '</h2><p class="lead">' + esc(T[3]) + '</p>' +
      '<div class="two" style="margin-top:6px"><label class="field"><span>Wake up</span><select data-ob-grid="wake">' + wakeOpts + '</select></label>' +
      '<label class="field"><span>Go to sleep</span><select data-ob-grid="sleep">' + sleepOpts + '</select></label></div>' +
      '<p class="flabel" style="margin-top:18px">Two ways to fill it in: pick an activity, then tap the hours it covers. Or type into any hour. Tap 15′ to split an hour into quarters.</p>' +
      '<div class="palette"><div class="chips">' + palette + '</div></div>' +
      '<ol class="hours">' + rows + '</ol>' +
      '<button class="linkbtn" data-act="ob-fill-empty">Fill empty hours with the selected activity</button><br>' + copy;
  }
  // A time of day set from lists (hour, then minutes), not a clock pop-up. The chosen time is kept
  // in a hidden input, so the code that reads attrs (id or class) still gets "HH:MM".
  function timeSelect(attrs, value) {
    var mins = toMin(value || '00:00'), h = Math.floor(mins / 60) % 24, mi = mins % 60, ho = '', mo = '', steps = [0, 15, 30, 45];
    if (steps.indexOf(mi) < 0) { steps.push(mi); steps.sort(function (a, b) { return a - b; }); }
    for (var i = 0; i < 24; i++) ho += '<option value="' + i + '"' + (i === h ? ' selected' : '') + '>' + hourLabel(i) + '</option>';
    steps.forEach(function (x) { mo += '<option value="' + x + '"' + (x === mi ? ' selected' : '') + '>:' + pad(x) + '</option>'; });
    return '<span class="tsel"><input type="hidden" ' + attrs + ' value="' + pad(h) + ':' + pad(mi) + '">' +
      '<select data-tsel="h" aria-label="Hour">' + ho + '</select><select data-tsel="m" aria-label="Minutes">' + mo + '</select></span>';
  }
  function currentGridKey() { var s = obSteps(OB.d)[OB.i]; return s.indexOf('grid:') === 0 ? s.slice(5) : null; }

  function obWeight() {
    var W = OB.d.weightQ, dir = W.direction;
    var pace = dir === 'gain'
      ? [['gentle', 'Gentle', '+0.15 kg a week'], ['steady', 'Steady', '+0.3 kg a week'], ['faster', 'Faster', '+0.45 kg a week']]
      : [['gentle', 'Gentle', '≈0.25 kg a week'], ['steady', 'Steady', '≈0.5 kg a week'], ['faster', 'Faster', '≈0.75 kg a week']];
    return '<p class="ob-step">Weight</p><h2>Tell me about your weight goal</h2>' +
      '<p class="lead">This sets your calories, macros and training days.</p>' +
      '<div class="q"><span class="flabel">I want to</span>' + chips('weightQ.direction', [['lose', 'Lose weight'], ['gain', 'Gain weight'], ['muscle', 'Build muscle, same weight']]) + '</div>' +
      (dir !== 'muscle' ? field('weightQ.goal', 'Goal weight (kg)', 'number', 'inputmode="decimal" step="0.1" min="30" max="300"') +
        '<div class="q"><span class="flabel">How fast</span>' + chips('weightQ.pace', pace) + '</div>' : '') +
      '<div class="q"><span class="flabel">Your job</span>' + chips('weightQ.activity', [['desk', 'Desk job', 'mostly sitting'], ['feet', 'On my feet', 'a lot of standing'], ['physical', 'Physical job']]) + '</div>' +
      '<div class="q"><span class="flabel">Training days a week</span>' + chips('weightQ.days', [[2, '2'], [3, '3'], [4, '4'], [5, '5']], true) + '</div>' +
      hourRange('weightQ', 'Hours you can train');
  }
  function obCareer() {
    return '<p class="ob-step">Career</p><h2>Where do you want your career to go?</h2>' +
      field('careerQ.field', 'Your field or role', 'text', 'maxlength="50"') +
      '<div class="q"><span class="flabel">Right now, growth means</span>' + chipsOther('careerQ.aim', [['promotion', 'A promotion'], ['bigger', 'A bigger role or team'], ['expert', 'Becoming the expert in my area'], ['lead', 'Leading people or projects']], 'What growth means to you') + '</div>' +
      '<div class="q"><span class="flabel">Main way you’ll grow</span>' + chipsOther('careerQ.focus', Object.keys(Planner.CAREER_FOCUS).map(function (k) { return [k, Planner.CAREER_FOCUS[k]]; }), 'Your own way to grow') + '</div>' +
      '<div class="q"><span class="flabel">Hours a week you can give it</span>' + chips('careerQ.hours', [[3, '3 h'], [5, '5 h'], [7, '7 h'], [10, '10 h']], true) + '</div>' +
      hourRange('careerQ', 'Hours of the day that suit you') +
      '<div class="q"><span class="flabel">Which days</span>' + chips('careerQ.where', WHERE) + '</div>';
  }
  function obSkill() {
    return '<p class="ob-step">New skill</p><h2>What do you want to learn?</h2>' +
      field('skillQ.skill', 'The skill', 'text', 'maxlength="40"') +
      '<div class="q"><span class="flabel">Your level</span>' + chips('skillQ.level', [['beginner', 'Complete beginner'], ['some', 'Some experience'], ['improve', 'Improving a skill I have']]) + '</div>' +
      '<div class="q"><span class="flabel">Hours a week</span>' + chips('skillQ.hours', [[2, '2 h'], [4, '4 h'], [6, '6 h'], [8, '8 h']], true) + '</div>' +
      hourRange('skillQ', 'Hours of the day that suit you') +
      '<div class="q"><span class="flabel">Which days</span>' + chips('skillQ.where', WHERE) + '</div>';
  }
  // The goals added after the first four. Each asks what, how much, and between which hours.
  function obExtra(g) {
    var head = function (step, title, lead) { return '<p class="ob-step">' + step + '</p><h2>' + title + '</h2>' + (lead ? '<p class="lead">' + lead + '</p>' : ''); };
    if (g === 'money') {
      return head('Money', 'Let’s save more', 'A weekly check-in to look at your spending, and a monthly amount to put aside.') +
        field('moneyQ.monthly', 'Amount to save each month (JOD)', 'number', 'inputmode="decimal" min="0" step="1"') +
        '<div class="q"><span class="flabel">Hours a week for money check-ins</span>' + chips('moneyQ.hours', [[1, '1 h'], [2, '2 h'], [3, '3 h']], true) + '</div>' +
        hourRange('moneyQ', 'Hours of the day that suit you') + '<div class="q"><span class="flabel">Which days</span>' + chips('moneyQ.where', WHERE) + '</div>';
    }
    if (g === 'mind') {
      return head('Mind', 'Make room to breathe', 'A small daily block, every day, just for your head.') +
        '<div class="q"><span class="flabel">What helps you most</span>' + chipsOther('mindQ.how', Object.keys(Planner.MIND_HOW).map(function (k) { return [k, Planner.MIND_HOW[k]]; }), 'What helps you') + '</div>' +
        '<div class="q"><span class="flabel">Minutes a day</span>' + chips('mindQ.mins', [[10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min']], true) + '</div>' +
        hourRange('mindQ', 'Hours of the day that suit you');
    }
    if (g === 'social') {
      return head('People', 'Time for the people who matter') +
        '<div class="q"><span class="flabel">Who</span>' + chips('socialQ.who', [['family', 'Family'], ['friends', 'Friends'], ['both', 'Both']]) + '</div>' +
        '<div class="q"><span class="flabel">Hours a week</span>' + chips('socialQ.hours', [[2, '2 h'], [4, '4 h'], [6, '6 h'], [8, '8 h']], true) + '</div>' +
        hourRange('socialQ', 'Hours of the day that suit you') + '<div class="q"><span class="flabel">Which days</span>' + chips('socialQ.where', WHERE) + '</div>';
    }
    if (g === 'reading') {
      return head('Reading', 'A little every day') +
        '<div class="q"><span class="flabel">Minutes a day</span>' + chips('readQ.mins', [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min']], true) + '</div>' +
        hourRange('readQ', 'Hours of the day that suit you');
    }
    return head('Your goal', 'What do you want to work on?') +
      field('otherQ.name', 'Your goal', 'text', 'maxlength="50"') +
      '<div class="q"><span class="flabel">Hours a week</span>' + chips('otherQ.hours', [[2, '2 h'], [4, '4 h'], [6, '6 h'], [8, '8 h']], true) + '</div>' +
      hourRange('otherQ', 'Hours of the day that suit you') + '<div class="q"><span class="flabel">Which days</span>' + chips('otherQ.where', WHERE) + '</div>';
  }
  function obPray() {
    var Q = OB.d.prayQ;
    if (OB.d.religion === 'christian') {
      return '<p class="ob-step">Prayer</p><h2>Let’s make room for prayer</h2>' +
        '<div class="q"><span class="flabel">Prayer and Bible reading every day</span>' + chips('prayQ.quran', [[0, 'Not now'], [10, '10 min'], [20, '20 min'], [30, '30 min']], true) + '</div>' +
        '<div class="q"><span class="flabel">Sunday church</span>' + chips('prayQ.church', [['true', 'Yes'], ['false', 'No']]) + '</div>';
    }
    var cityOpts = Object.keys(PrayerTimes.CITIES).map(function (k) {
      return '<option value="' + k + '"' + (Q.city === k ? ' selected' : '') + '>' + PrayerTimes.CITIES[k].name + '</option>';
    }).join('');
    return '<p class="ob-step">Prayer</p><h2>Let’s make room for prayer</h2>' +
      '<p class="lead">Prayer times move through the year, so the app calculates them for your city every day and adds them to your timeline.</p>' +
      '<div class="q"><span class="flabel">Prayers you already pray regularly</span><div class="choice">' + PRAYERS.map(function (p) {
        var on = Q.current.indexOf(p[0]) >= 0;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="ob-prayed" data-v="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
      }).join('') + '</div><p class="hint">No judgement. The ones you don’t pray yet are the ones the plan helps with.</p></div>' +
      '<div class="q"><span class="flabel">Where you usually pray</span>' + chips('prayQ.place', [['home', 'At home or work', '15 min'], ['mosque', 'At the mosque', '25 min with walking']]) + '</div>' +
      '<div class="q"><span class="flabel">Quran every day</span>' + chips('prayQ.quran', [[0, 'Not now'], [10, '10 min'], [20, '20 min'], [30, '30 min']], true) + '</div>' +
      '<label class="field"><span>Your city</span><select data-ob-sel="prayQ.city">' + cityOpts + '</select></label>' +
      '<div class="q"><span class="flabel">Remind me at each prayer time</span>' + chips('prayQ.remind', [['true', 'Yes'], ['false', 'No']]) + '</div>';
  }

  function miniList(blocks) {
    return '<ul class="mini">' + blocks.map(function (b) {
      return '<li><span class="bar" style="background:' + catColor(b.cat) + '"></span><span class="t">' + fmt12(b.start) + ' – ' + fmt12(b.end) + '</span><span class="n">' + esc(b.title) + '</span></li>';
    }).join('') + '</ul>';
  }
  function ensureIdealGrids(d) {
    if (!d.grids.idealWork) d.grids.idealWork = clone(d.grids.curWork);
    if (!d.grids.idealWeekend) d.grids.idealWeekend = clone(d.grids.curWeekend);
  }
  function obReview() {
    var d = OB.d;
    ensureIdealGrids(d);
    var res = Planner.buildTemplates(d, state.settings.limit);
    var m = Planner.macroTargets(d);
    OB.res = res; OB.macros = m;
    var t = today(), wd = d.workDays.length ? d.workDays[0] : t.getDay();
    var we = weekendOf(d)[0];
    var saved = state.settings.city;
    state.settings.city = d.prayQ.city;            // preview prayers for the chosen city
    var profileBackup = state.profile;
    state.profile = d;
    function preview(day) {
      var date = addDays(t, (day - t.getDay() + 7) % 7);
      return res.templates[day].concat(prayerBlocks(date)).sort(byStart);
    }
    var html = '<p class="ob-step">Your plan</p><h2>Here’s your plan, ' + esc(d.name || 'friend') + '</h2>' +
      '<p class="lead">' + (OB.redo ? 'Built from your ideal days and your goals. Check it over. You can change any block later in the Plan tab.' :
        'Built from a standard 8-to-5 workday and your goals. Check it over. You can change any block later in the Plan tab.') + '</p>' +
      '<div class="notebox">' + res.notes.map(function (n) { return '<p>' + esc(n) + '</p>'; }).join('') + '</div>';
    if (res.shortfalls.length) {
      html += '<div class="warnbox"><b>Some goals didn’t fit.</b> ' + (OB.redo ? 'Go back and leave more free time in your ideal days, or add these yourself later.' : 'Add these yourself later in the Plan tab.') +
        '<ul>' + res.shortfalls.slice(0, 6).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
    }
    if (m) {
      html += '<section><h2>Daily food targets</h2><div class="card"><div class="kcal"><span class="big">' + m.kcal.toLocaleString() + '</span><span class="of">kcal a day</span></div>' +
        '<div class="macro-line"><span>Protein <b>' + m.p + ' g</b></span><span>Carbs <b>' + m.c + ' g</b></span><span>Fat <b>' + m.f + ' g</b></span></div>' +
        '<p class="muted small" style="margin-top:8px">Your body burns about ' + m.tdee.toLocaleString() + ' kcal a day. You can adjust these in the Macros tab.</p></div></section>';
    }
    html += '<section><h2>' + (d.workDays.length ? 'A workday · ' + DAYS_FULL[wd] : 'A normal day') + '</h2><div class="card">' + miniList(preview(wd)) + '</div></section>';
    if (we != null && d.workDays.length) html += '<section><h2>A weekend day · ' + DAYS_FULL[we] + '</h2><div class="card">' + miniList(preview(we)) + '</div></section>';
    state.settings.city = saved;
    state.profile = profileBackup;
    return html;
  }

  function obValidate(step) {
    var d = OB.d;
    if (step === 'about') {
      if (!String(d.name).trim()) return 'Enter your name.';
      if (!(+d.age >= 13 && +d.age <= 100)) return 'Enter your age in years.';
      if (!(+d.height >= 120 && +d.height <= 230)) return 'Enter your height in centimetres.';
      if (!(+d.weight >= 30 && +d.weight <= 300)) return 'Enter your weight in kilograms.';
    }
    if (step === 'goals' && !d.goals.length) return 'Pick at least one goal.';
    if (step === 'q:weight' && d.weightQ.direction !== 'muscle') {
      var g = +d.weightQ.goal;
      if (!(g >= 30 && g <= 300)) return 'Enter your goal weight in kilograms.';
      if (d.weightQ.direction === 'lose' && g >= +d.weight) return 'For losing weight, the goal should be below your current ' + d.weight + ' kg.';
      if (d.weightQ.direction === 'gain' && g <= +d.weight) return 'For gaining weight, the goal should be above your current ' + d.weight + ' kg.';
    }
    if (step === 'q:skill' && !String(d.skillQ.skill).trim()) return 'Tell me which skill you want to learn.';
    if (step === 'q:career') {
      if (d.careerQ.aim === 'other' && !String(d.careerQ.aimOther || '').trim()) return 'Tell me what growth means to you.';
      if (d.careerQ.focus === 'other' && !String(d.careerQ.focusOther || '').trim()) return 'Tell me how you want to grow.';
    }
    if (step === 'q:mind' && d.mindQ.how === 'other' && !String(d.mindQ.howOther || '').trim()) return 'Tell me what helps you.';
    if (step === 'q:other' && !String(d.otherQ.name || '').trim()) return 'Name your goal.';
    if (step === 'q:money' && d.moneyQ.monthly !== '' && !(+d.moneyQ.monthly >= 0)) return 'Enter the monthly amount as a number.';
    var QK = { 'q:weight': 'weightQ', 'q:career': 'careerQ', 'q:skill': 'skillQ', 'q:money': 'moneyQ', 'q:mind': 'mindQ', 'q:social': 'socialQ', 'q:reading': 'readQ', 'q:other': 'otherQ' }[step];
    if (QK && !(+d[QK].to > +d[QK].from)) return 'The “To” hour has to be later than the “From” hour.';
    return '';
  }

  function obNext() {
    var steps = obSteps(OB.d), err = obValidate(steps[OB.i]);
    if (err) { var e = $('ob-err'); e.textContent = err; e.hidden = false; e.scrollIntoView({ block: 'center' }); return; }
    if (steps[OB.i] === 'about') { OB.d.age = +OB.d.age; OB.d.height = +OB.d.height; OB.d.weight = +OB.d.weight; }
    if (steps[OB.i] === 'grid:curWork') OB.paint = 'free';
    OB.i = Math.min(OB.i + 1, steps.length - 1);
    renderOb(); window.scrollTo(0, 0);
  }

  function obApply() {
    var d = OB.d, res = OB.res, m = OB.macros, k = todayKey();
    d.done = true;
    d.weight = +d.weight;
    if (d.weightQ && d.weightQ.goal !== '') d.weightQ.goal = +d.weightQ.goal;
    d.prayQ.remind = d.prayQ.remind === true || d.prayQ.remind === 'true';
    d.prayQ.church = d.prayQ.church === true || d.prayQ.church === 'true';
    if (d.religion === 'other') d.goals = d.goals.filter(function (g) { return g !== 'pray'; });
    if (d.goals.indexOf('money') >= 0 && +d.moneyQ.monthly > 0) {
      state.life = state.life || {};
      state.life.savings = state.life.savings || { monthly: 0, cur: 'JOD', goals: [] };
      state.life.savings.monthly = +d.moneyQ.monthly;
    }
    state.profile = d;
    state.templates = res.templates;
    state.overrides = {};
    state.weights = state.weights.filter(function (w) { return w.date !== k; });
    state.weights.push({ date: k, kg: d.weight });
    if (state.settings.start == null || !OB.redo) state.settings.start = d.weight;
    state.settings.target = d.goals.indexOf('weight') >= 0 && d.weightQ.direction !== 'muscle' ? d.weightQ.goal : d.weight;
    if (m) state.macros.targets = Object.assign({ manual: false, atWeight: d.weight }, m);
    if (d.goals.indexOf('pray') >= 0) { state.settings.city = d.prayQ.city; state.settings.prayerReminders = d.prayQ.remind; }
    save();
    OB = null;
    document.body.classList.remove('ob');
    planSel = null;
    setTab('dashboard');
    queueReschedule();
    toast('Your plan is ready, ' + d.name);
  }


  /* =====================================================================
     DASHBOARD (home screen): what matters today, each item opens its section
     ===================================================================== */
  function dashTile(label, value, sub, t, cls) {
    return '<button class="dtile' + (cls ? ' ' + cls : '') + '" data-tab="' + t + '"><span class="dt-v">' + value + '</span>' +
      '<span class="dt-l">' + esc(label) + '</span>' + (sub ? '<span class="dt-s">' + esc(sub) + '</span>' : '') + '</button>';
  }
  function renderDashboard() {
    var t = today(), k = dateKey(t), m = nowMin(), rec = peekDay(k), blocks = blocksForDate(t);
    var acct = blocks.filter(accountable), done = acct.filter(function (b) { return rec.done[b.id]; }).length;
    var due = acct.filter(function (b) { return toMin(b.end) <= m; }).length;
    var tiles = dashTile('Plan done', done + '/' + acct.length, due > done ? (due - done) + ' missed so far' : 'on track', 'today');
    if (hasGoal('pray') && isMuslim()) {
      var pb = prayerBlocks(t), next = pb.filter(function (b) { return toMin(b.start) > m; })[0];
      var prayed = pb.filter(function (b) { return rec.done[b.id]; }).length;
      tiles += dashTile('Prayers', prayed + '/5', next ? 'Next: ' + next.title.replace(' prayer', '') + ' ' + fmt12(next.start) : 'All times passed', 'today');
    }
    var T = state.macros.targets, food = state.macros.log[k] || [];
    if (T) {
      var kc = Math.round(totals(food).k);
      tiles += dashTile('Calories', kc.toLocaleString(), 'of ' + T.kcal.toLocaleString() + '', 'macros', kc > T.kcal ? 'warn' : '');
    }
    var hl = activeHabits(), hd = hl.filter(function (h) { return rec.habits[h.k]; }).length;
    tiles += dashTile('Habits', hd + '/' + hl.length, hd === hl.length ? 'all done' : '', 'today');
    if (rec.screen != null) tiles += dashTile('Social media', rec.screen + ' min', 'limit ' + state.settings.limit, 'focus', +rec.screen > +state.settings.limit ? 'warn' : '');
    tiles += runHooks('dashTiles', k, rec);

    // Weight toward the goal
    var weight = '';
    var cur = latestWeight(), st = +state.settings.start, tg = +state.settings.target;
    if (cur && tg) {
      var total = Math.abs(st - tg) || 1, doneKg = Math.max(0, Math.min(total, Math.abs(st - cur) * (Math.sign(tg - st) === Math.sign(cur - st) ? 1 : 0)));
      weight = '<button class="card dcard" data-tab="health"><span class="lbl">Weight</span><div class="kcal" style="margin-top:4px"><span class="big">' + num1(cur) + '</span><span class="of">kg · goal ' + num1(tg) + ' kg</span></div>' +
        '<div class="track" style="margin-top:8px"><span style="width:' + (doneKg / total * 100).toFixed(1) + '%"></span></div>' +
        '<p class="muted small" style="margin-top:6px">' + (Math.abs(cur - tg) < 0.5 ? 'Goal reached' : num1(Math.abs(cur - tg)) + ' kg to go') + '</p></button>';
    }

    // Nightly report once it's time
    var report = m >= reportTimeFor(t) ? '<button class="card dcard dreport" data-act="open-report"><span class="lbl">Tonight</span><b>Your daily report is ready</b></button>' : '';
    var yRev = (peekDay(dateKey(addDays(t, -1))).review || {});
    var fromLast = yRev.tomorrow && yRev.tomorrow.trim() ? '<div class="card from-last"><span class="lbl">From last night</span><p class="notr">' + esc(yRev.tomorrow) + '</p></div>' : '';

    return greeting() + report + runHooks('dashTop', k, rec) + fromLast + runHooks('todayTop', k, rec) +
      '<div data-tab="today" role="button" class="dnow">' + nowCard(blocks) + '</div>' + runHooks('dashSteps', k, rec) +
      '<section><h2>Today at a glance</h2><div class="dgrid">' + tiles + '</div></section>' +
      (weight ? '<section>' + weight + '</section>' : '') +
      runHooks('dashCards', k, rec);
  }

  /* ---------------- side menu ---------------- */
  var drawerOpen = false;
  function setDrawer(open) {
    drawerOpen = !!open;
    var d = $('drawer'), bg = $('drawer-bg'), b = document.querySelector('.menu-btn');
    if (!d) return;
    d.classList.toggle('open', drawerOpen);
    document.body.classList.toggle('drawer-open', drawerOpen);
    d.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
    bg.hidden = !drawerOpen;
    if (b) b.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  }
  // Android back button (called from MainActivity): menu, sheet, report, section, then leave the app.
  window.__lpBack = function () {
    if (drawerOpen) { setDrawer(false); return 'handled'; }
    if (sheetOpen) { closeSheet(); return 'handled'; }
    if (OB) return 'exit';
    if (tab === 'report') { var back = reportFrom; reportPushed = false; setTab(back === 'report' ? 'dashboard' : back); return 'handled'; }
    if (tab !== 'dashboard') { setTab('dashboard'); return 'handled'; }
    return 'exit';
  };

  /* =====================================================================
     TODAY
     ===================================================================== */
  function greeting() {
    if (!state.profile || !state.profile.name) return '';
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return '<p class="greet">' + part + ', ' + esc(state.profile.name) + '</p>';
  }
  function nowCard(blocks) {
    var m = nowMin(), cur = null, next = null;
    blocks.forEach(function (b) {
      var s = toMin(b.start), e = toMin(b.end);
      if (m >= s && m < e && (!cur || s >= toMin(cur.start))) cur = b;     // most specific block wins
      if (!next && s > m) next = b;
    });
    var top;
    if (cur) {
      top = '<div><span class="lbl">Now</span><div class="big">' + esc(cur.title) + '</div>' +
        '<div class="sub">' + fmtDur(toMin(cur.end) - m) + ' left · until ' + fmt12(cur.end) + '</div></div>';
    } else if (next) {
      top = '<div><span class="lbl">Now</span><div class="big">Open time</div><div class="sub">Nothing planned until ' + fmt12(next.start) + '</div></div>';
    } else {
      top = '<div><span class="lbl">Now</span><div class="big">Day is done</div><div class="sub">Rest. Tomorrow’s plan is ready.</div></div>';
    }
    var nl = next ? '<div class="nextline"><b>Next</b>' + esc(next.title) + ' · ' + fmt12(next.start) + '</div>' : '';
    return '<div class="card now">' + top + nl + runHooks('nowExtra') + '</div>';
  }

  /* =====================================================================
     PLAN
     ===================================================================== */
  function planScope() { if (planSel === null) planSel = today().getDay(); return planSel; }
  function planViewList() { var s = planScope(); return s === 'today' ? displayList(todayKey()) : state.templates[s]; }
  function planEditList() {
    var s = planScope();
    if (s === 'today') {
      var k = todayKey();
      if (!state.overrides[k]) state.overrides[k] = clone(state.templates[today().getDay()]);
      return state.overrides[k];
    }
    return state.templates[s];
  }
  function renderPlan() {
    var s = planScope(), t = today(), k = dateKey(t);
    var chipsHtml = '<button class="chip' + (s === 'today' ? ' on' : '') + '" data-act="plan-sel" data-v="today">Today only</button>' +
      DAYS.map(function (d, i) { return '<button class="chip' + (s === i ? ' on' : '') + '" data-act="plan-sel" data-v="' + i + '">' + d + '</button>'; }).join('');
    var title, hint;
    if (s === 'today') {
      title = 'Today only · ' + shortDate(k);
      hint = state.overrides[k] ? 'A one-off version of today. Your ' + DAYS_FULL[t.getDay()] + ' plan is unchanged.' : 'Changes here affect only today, not every ' + DAYS_FULL[t.getDay()] + '.';
    } else {
      title = 'Every ' + DAYS_FULL[s];
      hint = 'Changes here apply to every ' + DAYS_FULL[s] + '.';
      if (s === t.getDay() && state.overrides[k]) hint += ' Today has its own one-off version, so edits show from next week.';
    }
    var list = planViewList().slice().sort(byStart), prevEnd = -1;
    var rows = list.map(function (b) {
      var overlap = toMin(b.start) < prevEnd;
      prevEnd = Math.max(prevEnd, toMin(b.end));
      return '<li class="bl' + (overlap ? ' overlap' : '') + '" data-act="edit-block" data-id="' + esc(b.id) + '" role="button">' +
        '<span class="bar" style="background:' + catColor(b.cat) + '"></span>' +
        '<span><span class="t">' + fmt12(b.start) + ' – ' + fmt12(b.end) + '</span><br><span class="n">' + esc(b.title) + '</span></span>' +
        '<span class="bell">' + (b.remind ? 'Remind' : '') + '</span></li>';
    }).join('');
    var btns = '<button class="btn" data-act="add-block">+ Add block</button>';
    if (s !== 'today') btns += '<button class="btn ghost" data-act="copy-day">Copy to other days</button>';
    if (s === 'today' && state.overrides[k]) btns += '<button class="btn ghost" data-act="reset-today">Use the normal ' + DAYS_FULL[t.getDay()] + ' plan</button>';
    var prayNote = '';
    return '<div class="chips">' + chipsHtml + '</div>' +
      '<div class="plan-head"><h2>' + esc(title) + '</h2><p class="muted">' + esc(hint) + '</p>' + prayNote + '</div>' +
      '<section style="margin-top:14px">' + (rows ? '<ol class="blocklist">' + rows + '</ol>' : '<p class="muted">No blocks yet.</p>') +
      '<div class="row-btns">' + btns + '</div></section>';
  }

  function openBlockSheet(id) {
    var list = planViewList().slice().sort(byStart), b = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) b = list[i];
    var last = list[list.length - 1];
    var start = b ? b.start : (last && toMin(last.end) < 23 * 60 ? last.end : '17:00');
    var end = b ? b.end : minToT(Math.min(toMin(start) + 60, 23 * 60 + 59));
    var cat = b ? b.cat : 'growth', remind = b ? b.remind : true;
    sheetCtx = { kind: 'block', id: b ? b.id : null, cat: cat };
    var s = planScope();
    openSheet('<h3>' + (b ? 'Edit block' : 'New block') + '</h3><p class="muted small">' + esc(s === 'today' ? 'Only today' : 'Every ' + DAYS_FULL[s]) + '</p>' +
      '<label class="field"><span>What</span><input type="text" id="f-title" maxlength="60" value="' + esc(b ? b.title : '') + '"></label>' +
      '<div class="two"><label class="field"><span>Start</span>' + timeSelect('id="f-start"', start) + '</label>' +
      '<label class="field"><span>End</span>' + timeSelect('id="f-end"', end) + '</label></div>' +
      '<div class="field"><span class="flabel">Type</span><div class="chips wrap" id="f-cats">' +
      CAT_KEYS.map(function (c) {
        return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-act="pick-cat" data-cat="' + c + '"><span class="dot" style="background:' + catColor(c) + '"></span>' + esc(CATS[c]) + '</button>';
      }).join('') + '</div></div>' +
      '<label class="setrow" style="margin-top:6px"><span><span class="st">Remind me</span><br><span class="sd">5 min before, and when it starts</span></span><span class="switch"><input type="checkbox" id="f-remind"' + (remind ? ' checked' : '') + '><span></span></span></label>' +
      '<p class="err" id="f-err" hidden></p>' +
      '<div class="row-btns"><button class="btn" data-act="save-block">Save</button>' + (b ? '<button class="btn warn" data-act="del-block">Delete</button>' : '') +
      '<button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  }
  function saveBlock() {
    var title = $('f-title').value.trim(), s = $('f-start').value, e = $('f-end').value, err = $('f-err');
    function fail(msg) { err.textContent = msg; err.hidden = false; }
    if (!title) return fail('Give the block a name.');
    if (!s || !e) return fail('Pick a start and an end time.');
    if (toMin(e) <= toMin(s)) return fail('The end has to be after the start. For something that runs past midnight, end it at 11:59 pm.');
    var list = planEditList(), data = { title: title, start: s, end: e, cat: sheetCtx.cat, remind: $('f-remind').checked }, found = false;
    if (sheetCtx.id) for (var i = 0; i < list.length; i++) if (list[i].id === sheetCtx.id) { Object.assign(list[i], data); found = true; }
    if (!found) list.push(Object.assign({ id: uid() }, data));
    list.sort(byStart);
    save(); closeSheet(); render(); queueReschedule(); toast('Saved');
  }
  function deleteBlock(btn) {
    if (!armed(btn, 'Tap again to delete')) return;
    var list = planEditList();
    for (var i = list.length - 1; i >= 0; i--) if (list[i].id === sheetCtx.id) list.splice(i, 1);
    save(); closeSheet(); render(); queueReschedule(); toast('Deleted');
  }
  function openCopySheet() {
    var s = planScope();
    sheetCtx = { kind: 'copy' };
    openSheet('<h3>Copy ' + DAYS_FULL[s] + ' to…</h3><p class="muted small">This replaces the plan on the days you pick.</p>' +
      '<div class="daypick">' + [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return d !== s; }).map(function (d) {
        return '<label><input type="checkbox" class="f-copy" value="' + d + '"><span>' + DAYS_FULL[d] + '</span></label>';
      }).join('') + '</div><div class="row-btns"><button class="btn" data-act="do-copy">Copy</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  }
  function doCopy() {
    var s = planScope(), n = 0, boxes = document.querySelectorAll('.f-copy');
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].checked) continue;
      state.templates[+boxes[i].value] = state.templates[s].map(function (b) { return Object.assign({}, b, { id: uid() }); });
      n++;
    }
    if (!n) { toast('Pick at least one day'); return; }
    save(); closeSheet(); render(); queueReschedule(); toast('Copied to ' + n + ' day' + (n === 1 ? '' : 's'));
  }

  /* =====================================================================
     MACROS
     ===================================================================== */
  function entryKcal(e) { return (e.p * 4 + e.c * 4 + e.f * 9) * (e.qty || 1); }
  function totals(entries) {
    return entries.reduce(function (t, e) {
      var q = e.qty || 1;
      t.p += e.p * q; t.c += e.c * q; t.f += e.f * q; t.k += entryKcal(e);
      return t;
    }, { p: 0, c: 0, f: 0, k: 0 });
  }
  function allFoods() { return state.macros.foods.concat(window.FOODS || []); }
  function findFood(id) { var l = allFoods(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function mbar(label, val, target, color) {
    var pct = target ? Math.min(100, (val / target) * 100) : 0, over = target && val > target * 1.05;
    return '<div class="mbar' + (over ? ' over' : '') + '"><div class="top"><span>' + label + '</span><span>' + Math.round(val) + ' / ' + (target || '–') + ' g</span></div>' +
      '<div class="track"><span style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></div></div>';
  }
  function renderMacros() {
    var k = macroDate || todayKey(), isToday = k === todayKey();
    var entries = state.macros.log[k] || [], T = state.macros.targets, tot = totals(entries);
    var nav = '<div class="daynav"><button class="nav" data-act="m-prev" aria-label="Previous day">‹</button>' +
      '<button class="dl" data-act="m-today">' + (isToday ? 'Today' : esc(shortDate(k))) + '</button>' +
      '<button class="nav" data-act="m-next" aria-label="Next day"' + (isToday ? ' disabled' : '') + '>›</button></div>';
    var summary;
    if (T) {
      var left = Math.round(T.kcal - tot.k), pct = Math.min(100, (tot.k / T.kcal) * 100), over = tot.k > T.kcal * 1.05;
      summary = '<div class="card"><div class="kcal"><span class="big">' + Math.round(tot.k).toLocaleString() + '</span><span class="of">/ ' + T.kcal.toLocaleString() + ' kcal</span></div>' +
        '<p class="kcal-left">' + (left >= 0 ? '<b>' + left.toLocaleString() + '</b> kcal left' : '<b>' + (-left).toLocaleString() + '</b> kcal over') + '</p>' +
        '<div class="' + (over ? 'over' : '') + '"><div class="track"><span style="width:' + pct.toFixed(1) + '%"></span></div></div>' +
        '<div class="mbars">' + mbar('Protein', tot.p, T.p, 'var(--accent)') + mbar('Carbs', tot.c, T.c, 'var(--c-growth)') + mbar('Fat', tot.f, T.f, 'var(--c-family)') + '</div></div>';
    } else {
      summary = '<div class="card"><b>Set your daily targets</b><p class="muted small" style="margin-top:4px">Add your calories and macros, or finish setup with a weight goal to have them calculated.</p>' +
        '<div class="row-btns"><button class="btn" data-act="m-targets">Set targets</button></div></div>';
    }
    var log = entries.length ? '<ul class="loglist">' + entries.map(function (e) {
      var q = e.qty || 1;
      return '<li><span class="ln"><b>' + esc(e.name) + (q !== 1 ? ' × ' + num1(q) : '') + '</b><span>' + esc(e.unit || '') + ' · P ' + num1(e.p * q) + ' · C ' + num1(e.c * q) + ' · F ' + num1(e.f * q) + '</span></span>' +
        '<span class="lk">' + Math.round(entryKcal(e)) + '</span><button class="x" data-act="m-del" data-id="' + esc(e.id) + '" aria-label="Remove ' + esc(e.name) + '">×</button></li>';
    }).join('') + '</ul>' : '<p class="muted">Nothing logged ' + (isToday ? 'yet today' : 'this day') + '.</p>';
    var targets = T ? '<section><h2>Your targets</h2><div class="card"><div class="macro-line" style="margin-top:0"><span><b>' + T.kcal.toLocaleString() + '</b> kcal</span><span>P <b>' + T.p + '</b> g</span><span>C <b>' + T.c + '</b> g</span><span>F <b>' + T.f + '</b> g</span></div>' +
      '<p class="muted small" style="margin-top:8px">' + (T.manual ? 'Set by you.' : 'Calculated from your profile' + (T.tdee ? ': you burn about ' + T.tdee.toLocaleString() + ' kcal a day.' : '.')) + '</p>' +
      '<div class="row-btns"><button class="btn ghost" data-act="m-targets">Edit targets</button></div></div></section>' : '';
    return nav + summary +
      '<div class="row-btns"><button class="btn" data-act="m-add">+ Add food</button><button class="btn ghost" data-act="m-repeat">Repeat yesterday</button></div>' +
      '<section><h2>' + (isToday ? 'Eaten today' : 'Eaten') + '</h2><div class="card">' + log + '</div></section>' + targets;
  }

  function openFoodSheet(viewName, food) {
    if (!sheetCtx || sheetCtx.kind !== 'food') sheetCtx = { kind: 'food', q: '', qty: 1, food: null };
    sheetCtx.view = viewName || 'list';
    if (food) { sheetCtx.food = food; sheetCtx.qty = 1; }
    var html;
    if (sheetCtx.view === 'pick') {
      var f = sheetCtx.food, q = sheetCtx.qty;
      html = '<h3>' + esc(f.name) + '</h3><p class="muted small">' + esc(f.unit) + ' per serving</p>' +
        '<div class="stepper"><button data-act="m-qty" data-d="-0.5" aria-label="Less">−</button><b id="m-qtyv">' + num1(q) + '</b><button data-act="m-qty" data-d="0.5" aria-label="More">+</button><span class="muted small">servings</span></div>' +
        '<div class="macro-line" id="m-pickline">' + pickLine(f, q) + '</div>' +
        '<div class="row-btns"><button class="btn" data-act="m-add-picked">Add</button><button class="btn ghost" data-act="m-back">Back</button></div>';
    } else if (sheetCtx.view === 'custom') {
      html = '<h3>Your own food</h3><p class="muted small">Enter the values for one serving.</p>' +
        '<label class="field"><span>Name</span><input type="text" id="fc-name" maxlength="40"></label>' +
        '<label class="field"><span>Serving</span><input type="text" id="fc-unit" maxlength="30"></label>' +
        '<div class="three"><label class="field"><span>Protein g</span><input type="number" id="fc-p" inputmode="decimal" step="0.1" min="0"></label>' +
        '<label class="field"><span>Carbs g</span><input type="number" id="fc-c" inputmode="decimal" step="0.1" min="0"></label>' +
        '<label class="field"><span>Fat g</span><input type="number" id="fc-f" inputmode="decimal" step="0.1" min="0"></label></div>' +
        '<label class="field"><span>Servings eaten</span><input type="number" id="fc-qty" inputmode="decimal" step="0.5" min="0.5" value="1"></label>' +
        '<label class="chk-row"><input type="checkbox" id="fc-save" checked> Save to my foods for next time</label>' +
        '<p class="err" id="fc-err" hidden></p>' +
        '<div class="row-btns"><button class="btn" data-act="m-add-custom">Add</button><button class="btn ghost" data-act="m-back">Back</button></div>';
    } else {
      html = '<h3>Add food</h3><input type="text" id="fs-q" placeholder="Search foods" value="' + esc(sheetCtx.q) + '" style="margin-top:8px">' +
        '<ul class="foodlist" id="fs-results">' + foodResults() + '</ul>' +
        '<button class="linkbtn" data-act="m-custom">+ Enter your own food</button>';
    }
    openSheet(html);
  }
  function pickLine(f, q) {
    return '<span><b>' + Math.round((f.p * 4 + f.c * 4 + f.f * 9) * q) + '</b> kcal</span><span>P <b>' + num1(f.p * q) + '</b></span><span>C <b>' + num1(f.c * q) + '</b></span><span>F <b>' + num1(f.f * q) + '</b></span>';
  }
  function foodResults() {
    var q = (sheetCtx.q || '').toLowerCase().trim();
    var list = allFoods().filter(function (f) { return !q || f.name.toLowerCase().indexOf(q) >= 0; });
    if (!list.length) return '<li style="cursor:default"><span class="muted">No match. Add it as your own food below.</span></li>';
    return list.map(function (f) {
      var mine = f.id.indexOf('u-') === 0;
      return '<li data-act="m-pick" data-id="' + esc(f.id) + '"><span><span class="fn">' + esc(f.name) + (mine ? '<span class="tag">Mine</span>' : '') + '</span><br>' +
        '<span class="fu">' + esc(f.unit) + ' · P ' + num1(f.p) + ' · C ' + num1(f.c) + ' · F ' + num1(f.f) + '</span></span>' +
        '<span class="fk">' + Math.round(f.p * 4 + f.c * 4 + f.f * 9) + ' kcal</span></li>';
    }).join('');
  }
  function addEntry(e) {
    var k = macroDate || todayKey();
    (state.macros.log[k] = state.macros.log[k] || []).push(e);
    save(); closeSheet(); render();
    toast('Added ' + e.name);
  }
  function addCustom() {
    var name = $('fc-name').value.trim(), err = $('fc-err');
    var p = parseFloat($('fc-p').value) || 0, c = parseFloat($('fc-c').value) || 0, f = parseFloat($('fc-f').value) || 0;
    var qty = parseFloat($('fc-qty').value) || 1;
    if (!name) { err.textContent = 'Give the food a name.'; err.hidden = false; return; }
    if (!(p || c || f)) { err.textContent = 'Enter at least one of protein, carbs or fat.'; err.hidden = false; return; }
    var unit = $('fc-unit').value.trim() || '1 serving';
    if ($('fc-save').checked) state.macros.foods.unshift({ id: 'u-' + uid(), name: name, unit: unit, p: p, c: c, f: f });
    addEntry({ id: uid(), name: name, unit: unit, p: p, c: c, f: f, qty: qty });
  }
  function openTargetsSheet() {
    var T = state.macros.targets || { kcal: '', p: '', c: '', f: '' };
    sheetCtx = { kind: 'targets' };
    openSheet('<h3>Daily targets</h3><p class="muted small">Set these yourself, or recalculate them from your profile.</p>' +
      '<label class="field"><span>Calories (kcal)</span><input type="number" id="mt-kcal" inputmode="numeric" min="800" max="6000" value="' + esc(T.kcal) + '"></label>' +
      '<div class="three"><label class="field"><span>Protein g</span><input type="number" id="mt-p" inputmode="numeric" min="0" value="' + esc(T.p) + '"></label>' +
      '<label class="field"><span>Carbs g</span><input type="number" id="mt-c" inputmode="numeric" min="0" value="' + esc(T.c) + '"></label>' +
      '<label class="field"><span>Fat g</span><input type="number" id="mt-f" inputmode="numeric" min="0" value="' + esc(T.f) + '"></label></div>' +
      '<p class="muted small" id="mt-sum" style="margin-top:10px"></p><p class="err" id="mt-err" hidden></p>' +
      '<div class="row-btns"><button class="btn" data-act="mt-save">Save</button>' +
      (state.profile && state.profile.weight ? '<button class="btn ghost" data-act="mt-recalc">Recalculate</button>' : '') +
      '<button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
    updateTargetSum();
  }
  function updateTargetSum() {
    var el = $('mt-sum'); if (!el) return;
    var p = +$('mt-p').value || 0, c = +$('mt-c').value || 0, f = +$('mt-f').value || 0;
    el.textContent = 'Those macros add up to ' + Math.round(p * 4 + c * 4 + f * 9).toLocaleString() + ' kcal.';
  }

  /* =====================================================================
     DAILY REPORT
     ===================================================================== */
  var REASONS = [['forgot', 'Forgot'], ['notime', 'No time'], ['mood', 'Didn’t feel like it'], ['came', 'Something came up'], ['else', 'Did something else']];
  var DAY_FEEL = [['good', 'Good'], ['okay', 'Okay'], ['bad', 'Bad']];

  // Items the report holds you to: real commitments, not sleep or idle time.
  function accountable(b) {
    return !(b.cat === 'sleep' && /^Sleep/.test(b.title)) && b.cat !== 'free' && b.title !== 'Free time';
  }
  function reviewOf(k) {
    var r = dayRec(k);
    r.review = r.review || { items: {}, day: '', tomorrow: '' };
    r.review.items = r.review.items || {};
    return r.review;
  }
  function statTile(label, value, sub) {
    return '<div class="rs"><div class="rs-v">' + value + '</div><div class="rs-l">' + esc(label) + '</div>' + (sub ? '<div class="rs-s">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function renderReport() {
    var k = reportDate || todayKey(), d = fromKey(k), isToday = k === todayKey(), m = nowMin();
    var rec = peekDay(k), rv = rec.review || { items: {}, day: '', tomorrow: '' };
    var blocks = blocksForDate(d).filter(accountable);
    var done = [], missed = [], upcoming = [];
    blocks.forEach(function (b) {
      if (rec.done[b.id]) done.push(b);
      else if (isToday && toMin(b.end) > m) upcoming.push(b);
      else missed.push(b);
    });
    var counted = done.length + missed.length;
    var pct = counted ? Math.round((done.length / counted) * 100) : 0;

    // Score tiles
    var tiles = '';
    var prayers = blocks.filter(function (b) { return b.prayer; });
    if (prayers.length) tiles += statTile('Prayers', prayers.filter(function (b) { return rec.done[b.id]; }).length + '/' + prayers.length);
    var habitList = activeHabits(), hDone = habitList.filter(function (h) { return rec.habits[h.k]; }).length;
    tiles += statTile('Habits', hDone + '/' + habitList.length);
    var food = state.macros.log[k] || [], T = state.macros.targets;
    if (food.length) {
      var tot = totals(food);
      tiles += statTile('Calories', Math.round(tot.k).toLocaleString(), T ? 'of ' + T.kcal.toLocaleString() : '');
      if (T) tiles += statTile('Protein', Math.round(tot.p) + ' g', 'of ' + T.p + ' g');
    }
    if (rec.screen != null) tiles += statTile('Social media', rec.screen + ' min', 'limit ' + state.settings.limit);
    if (rec.urges) tiles += statTile('Urges beaten', rec.urges);
    tiles += runHooks('reportTiles', k, rec);

    var nav = '<div class="daynav"><button class="nav" data-act="r-prev" aria-label="Previous day">‹</button>' +
      '<button class="dl" data-act="r-today">' + (isToday ? 'Today' : esc(shortDate(k))) + '</button>' +
      '<button class="nav" data-act="r-next" aria-label="Next day"' + (isToday ? ' disabled' : '') + '>›</button></div>';

    var score = '<div class="card"><div class="kcal"><span class="big">' + done.length + '</span><span class="of">of ' + counted + ' tasks done' +
      (upcoming.length ? ' so far' : '') + '</span></div>' +
      '<div class="track" style="margin-top:10px"><span style="width:' + pct + '%"></span></div>' +
      '<p class="muted small" style="margin-top:8px">' + (counted ? reportVerdict(pct) : 'Nothing to review yet.') + '</p>' +
      (tiles ? '<div class="rs-grid">' + tiles + '</div>' : '') + '</div>';

    var missedHtml = missed.length ? missed.map(function (b) {
      var it = rv.items[b.id] || {};
      return '<div class="card rv-item"><div class="rv-head"><span class="bar" style="background:' + catColor(b.cat) + '"></span>' +
        '<span class="rv-t"><b>' + esc(b.title) + '</b><span class="muted small">' + fmt12(b.start) + ' – ' + fmt12(b.end) + '</span></span>' +
        '<button class="btn ghost rv-did" data-act="r-did" data-id="' + esc(b.id) + '">I did it</button></div>' + runHooks('reportMissed', k, b, isToday) +
        '<p class="flabel" style="margin-top:12px">What happened?</p><div class="choice">' + REASONS.map(function (r) {
          var on = it.reason === r[0];
          return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="r-reason" data-id="' + esc(b.id) + '" data-v="' + r[0] + '" aria-pressed="' + on + '">' + esc(r[1]) + '</button>';
        }).join('') + '</div>' +
        '<p class="flabel" style="margin-top:12px">Was it</p><div class="choice">' +
        '<button type="button" class="chip' + (it.verdict === 'good' ? ' on' : '') + '" data-act="r-verdict" data-id="' + esc(b.id) + '" data-v="good">Good<small>the right call</small></button>' +
        '<button type="button" class="chip bad' + (it.verdict === 'bad' ? ' on' : '') + '" data-act="r-verdict" data-id="' + esc(b.id) + '" data-v="bad">Bad<small>I should have</small></button></div>' +
        '<textarea class="rv-c" data-review="' + esc(b.id) + '" data-date="' + k + '" placeholder="Comment">' + esc(it.comment || '') + '</textarea></div>';
    }).join('') : '<p class="muted">' + (counted ? 'Nothing missed. Well done.' : 'Nothing yet.') + '</p>';

    var doneHtml = done.length ? '<div class="card">' + miniList(done) + '</div>' : '<p class="muted">Nothing ticked off yet. Tap tasks on the Today tab as you finish them.</p>';
    var upHtml = upcoming.length ? '<section><h2>Still to come</h2><div class="card">' + miniList(upcoming) + '</div></section>' : '';

    var tmr = addDays(d, 1), tBlocks = blocksForDate(tmr).filter(accountable);
    var tomorrow = '<section><h2>Tomorrow · ' + esc(DAYS_FULL[tmr.getDay()]) + '</h2><div class="card">' +
      (tBlocks.length ? '<p class="muted small">' + tBlocks.length + ' tasks · starts ' + fmt12(tBlocks[0].start) + '</p>' + miniList(tBlocks) : '<p class="muted">Nothing planned yet.</p>') +
      '<label class="field"><span>Note for tomorrow</span><textarea data-rv="tomorrow" data-date="' + k + '" placeholder="It shows up at the top of tomorrow’s Today screen.">' + esc(rv.tomorrow || '') + '</textarea></label></div></section>';

    return nav + score + runHooks('reportExtra', k, rec) +
      '<section><h2>Not done' + (missed.length ? ' · ' + missed.length : '') + '</h2>' + missedHtml + '</section>' +
      '<section><h2>Done' + (done.length ? ' · ' + done.length : '') + '</h2>' + doneHtml + '</section>' + upHtml +
      '<section><h2>How was the day?</h2><div class="card"><div class="choice">' + DAY_FEEL.map(function (f) {
        var on = rv.day === f[0];
        return '<button type="button" class="chip' + (f[0] === 'bad' ? ' bad' : '') + (on ? ' on' : '') + '" data-act="r-day" data-v="' + f[0] + '" aria-pressed="' + on + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="field"><span>Day note</span><textarea data-field="note" data-date="' + k + '" placeholder="What went well, what got in the way.">' + esc(rec.note || '') + '</textarea></label></div></section>' +
      tomorrow;
  }
  function reportVerdict(pct) {
    if (pct >= 90) return 'An excellent day. You did almost everything you planned.';
    if (pct >= 70) return 'A solid day. Most of the plan happened.';
    if (pct >= 40) return 'A mixed day. Look at what got in the way below.';
    return 'A tough day. That happens. Note what got in the way so tomorrow goes better.';
  }
  function openReport(k) {
    reportDate = k && k !== todayKey() ? k : null;
    if (tab !== 'report') { reportFrom = tab; history.pushState({ view: 'report' }, ''); reportPushed = true; }
    setTab('report');
  }

  /* =====================================================================
     HEALTH
     ===================================================================== */
  function sortedWeights() { return state.weights.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); }
  var PACE = { lose: { gentle: -0.25, steady: -0.5, faster: -0.75 }, gain: { gentle: 0.15, steady: 0.3, faster: 0.45 } };
  function latestWeight() {
    var ws = sortedWeights();
    return ws.length ? +ws[ws.length - 1].kg : (state.profile && +state.profile.weight) || null;
  }
  function weekDays() { var t = today(), s = addDays(t, -t.getDay()); return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(s, i); }); }
  // Planned vs done this week for blocks whose title matches, e.g. /^Training/.
  function weekCount(re) {
    var planned = 0, done = 0;
    weekDays().forEach(function (d) {
      var rec = peekDay(dateKey(d));
      blocksForDate(d).forEach(function (b) { if (re.test(b.title)) { planned++; if (rec.done[b.id]) done++; } });
    });
    return { planned: planned, done: done };
  }
  // kg per week over the last 5 weeks of weigh-ins (needs 2+ weigh-ins at least 6 days apart).
  function weightTrend() {
    var cutoff = dateKey(addDays(today(), -35));
    var ws = sortedWeights().filter(function (w) { return w.date >= cutoff; });
    if (ws.length < 2) return null;
    var a = ws[0], b = ws[ws.length - 1], days = daysBetween(fromKey(a.date), fromKey(b.date));
    return days < 6 ? null : ((+b.kg - +a.kg) / days) * 7;
  }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + num1(Math.abs(n)); }

  function weightCard() {
    var W = weightGoal(), dir = W ? W.direction : null, ws = sortedWeights(), cur = latestWeight();
    var logRow = '<div class="inline"><input type="number" id="w-kg" inputmode="decimal" step="0.1" min="30" max="300" placeholder="Today’s weight (kg)"><button class="btn" data-act="log-weight">Log</button></div>';
    if (cur == null) return '<div class="card"><b>Log your first weigh-in</b>' + logRow + '</div>';
    var st = state.settings.start != null ? +state.settings.start : (ws.length ? +ws[0].kg : cur);
    var tg = state.settings.target != null ? +state.settings.target : st;
    var change = cur - st, rate = weightTrend(), html = '<div class="card">';

    if (dir === 'lose' || dir === 'gain') {
      var span = tg - st, pct = span ? Math.max(0, Math.min(100, ((cur - st) / span) * 100)) : 0, left = Math.abs(cur - tg);
      var reached = dir === 'lose' ? cur <= tg : cur >= tg;
      html += '<div class="stats"><div class="stat"><div class="k">' + num1(cur) + '<small> kg</small></div><div class="l">Now</div></div>' +
        '<div class="stat"><div class="k">' + num1(Math.abs(change)) + '<small> kg</small></div><div class="l">' + (dir === 'lose' ? 'Lost' : 'Gained') + '</div></div>' +
        '<div class="stat goal"><div class="k">' + num1(tg) + '<small> kg</small></div><div class="l">Goal</div></div></div>' +
        '<div class="prog"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<div class="prog-cap"><span>' + num1(st) + ' kg start</span><span>' + (reached ? 'Goal reached' : num1(left) + ' kg to go') + '</span></div>';
      var plan = PACE[dir][W.pace || 'steady'];
      if (rate == null) {
        html += '<p class="muted small" style="margin-top:10px">Planned pace: ' + signed(plan) + ' kg a week. Weigh in once a week to see your real trend.</p>';
      } else {
        var right = dir === 'lose' ? rate < -0.05 : rate > 0.05;
        var line = 'Last few weeks: <b>' + signed(rate) + ' kg a week</b> (plan: ' + signed(plan) + ').';
        if (right && !reached) {
          var eta = addDays(today(), Math.round((left / Math.abs(rate)) * 7));
          line += ' At this pace you reach ' + num1(tg) + ' kg around <b>' + MONTHS[eta.getMonth()] + ' ' + eta.getFullYear() + '</b>.';
        } else if (!reached) {
          line += ' You’re not moving toward the goal yet. Compare what you eat with your Macros targets.';
        }
        if (dir === 'lose' && rate < -1.2) line += ' That’s fast: make sure you’re eating enough protein.';
        html += '<p class="small" style="margin-top:10px">' + line + '</p>';
      }
    } else {
      html += '<div class="stats"><div class="stat"><div class="k">' + num1(cur) + '<small> kg</small></div><div class="l">Now</div></div>' +
        '<div class="stat"><div class="k">' + signed(change) + '<small> kg</small></div><div class="l">Since start</div></div></div>';
      if (dir === 'muscle') {
        var off = Math.abs(cur - tg);
        html += '<p class="small" style="margin-top:10px">Building muscle at a steady weight: stay within 1 kg of <b>' + num1(tg) + ' kg</b>. ' +
          (off <= 1 ? 'You’re right on track.' : 'You’re ' + num1(off) + ' kg ' + (cur > tg ? 'above' : 'below') + ' it. Adjust your calories in Macros.') + '</p>';
      }
    }
    return html + logRow + '</div>';
  }

  function weekCard() {
    var W = weightGoal(), tiles = '';
    if (W) {
      var tr = weekCount(/^Training/);
      if (tr.planned) tiles += statTile('Training', tr.done + '/' + tr.planned, 'sessions');
      if (W.direction === 'lose') { var cw = weekCount(/^Walk or bike/); if (cw.planned) tiles += statTile('Walks', cw.done + '/' + cw.planned); }
    }
    var T = state.macros.targets, logged = 0, kcal = 0, prot = 0;
    weekDays().forEach(function (d) {
      if (d > today()) return;
      var food = state.macros.log[dateKey(d)];
      if (food && food.length) { var t = totals(food); logged++; kcal += t.k; prot += t.p; }
    });
    if (logged) {
      tiles += statTile('Avg calories', Math.round(kcal / logged).toLocaleString(), T ? 'target ' + T.kcal.toLocaleString() : '');
      tiles += statTile('Avg protein', Math.round(prot / logged) + ' g', T ? 'target ' + T.p + ' g' : '');
    }
    tiles += statTile('Food logged', logged + '/' + Math.min(7, today().getDay() + 1), 'days');

    var t0 = today(), week = weekDays(), habits = activeHabits();
    var head = '<span></span>' + week.map(function (d) { return '<span class="hd' + (d.getTime() === t0.getTime() ? ' today' : '') + '">' + dayIni(d.getDay()) + '</span>'; }).join('') + '<span></span>';
    var hrows = habits.map(function (h) {
      var c = 0;
      var dots = week.map(function (d) { var on = !!peekDay(dateKey(d)).habits[h.k]; if (on) c++; return '<span class="d' + (on ? ' on' : '') + (d > t0 ? ' fut' : '') + '"></span>'; }).join('');
      return '<span class="hl">' + esc(h.l) + '</span>' + dots + '<span class="cnt">' + c + '/7</span>';
    }).join('');
    return '<section><h2>This week</h2><div class="card"><div class="rs-grid" style="margin-top:0">' + tiles + '</div>' +
      '<p class="flabel" style="margin-top:16px">Habits</p><div class="hgrid">' + head + hrows + '</div>' +
      '</div></section>';
  }

  function bodyCard() {
    var P = state.profile, cur = latestWeight();
    if (!P || !P.height || !cur) return '';
    var bmi = cur / Math.pow(P.height / 100, 2);
    var band = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy range' : bmi < 30 ? 'overweight' : 'obese range';
    var now = Planner.macroTargets(Object.assign({}, P, { weight: cur })), T = state.macros.targets;
    var html = '<section><h2>Body numbers</h2><div class="card"><div class="rs-grid" style="margin-top:0">' +
      statTile('BMI', num1(bmi), band) + (now ? statTile('Daily burn', now.tdee.toLocaleString(), 'kcal, estimated') : '') + '</div>';
    if (T && !T.manual && T.atWeight && Math.abs(T.atWeight - cur) >= 2) {
      html += '<div class="warnbox" style="margin-top:12px"><b>Your food targets are out of date.</b> They were set at ' + num1(T.atWeight) + ' kg and you’re ' + num1(cur) +
        ' kg now. As your weight changes, so does what your body burns.<div class="row-btns" style="margin-top:8px"><button class="btn" data-act="mt-recalc">Update my targets</button></div></div>';
    }
    return html + '</div></section>';
  }

  function renderHealth() {
    var ws = sortedWeights();
    var hist = ws.slice().reverse().slice(0, 10).map(function (w, i, arr) {
      var prev = arr[i + 1], delta = prev ? +w.kg - +prev.kg : null;
      var dcls = delta == null ? '' : delta < 0 ? ' down' : delta > 0 ? ' up' : '';
      var dtxt = delta == null || delta === 0 ? '' : (delta > 0 ? '+' : '') + num1(delta);
      return '<li><span class="wd">' + esc(shortDate(w.date)) + '</span><span class="wk">' + num1(+w.kg) + ' kg</span><span class="delta' + dcls + '">' + dtxt + '</span>' +
        '<button class="x" data-act="del-weight" data-date="' + esc(w.date) + '" aria-label="Remove ' + esc(shortDate(w.date)) + '">×</button></li>';
    }).join('');
    return weightCard() + weekCard() + runHooks('healthActivity') + bodyCard() + runHooks('healthBody') +
      '<section><h2>Weigh-ins</h2><div class="card">' + (hist ? '<ul class="wlist">' + hist + '</ul>' : '<p class="muted">No weigh-ins yet.</p>') + '</div></section>' +
      '<section><h2>Your guides</h2>' + healthGuides() + '</section>';
  }

  function acc(title, body) { return '<details class="acc"><summary>' + title + '</summary><div class="acc-body">' + body + '</div></details>'; }
  function ul(items) { return '<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>'; }

  // Guides written from the setup answers: goal direction, training days, job, limits.
  function healthGuides() {
    var W = weightGoal(), T = state.macros.targets, out = '';
    if (!W) {
      return acc('Staying healthy', ul(['Sleep 7+ hours.', 'Move every day: a walk counts.', 'Drink water through the day.', 'Stand up and move every 30–45 minutes if you sit a lot.'])) +
        '<p class="muted small" style="margin-top:6px">Add a weight goal in Settings → Redo setup to get training and food guidance here.</p>';
    }
    var dir = W.direction, days = Math.max(2, Math.min(5, +W.days || 3)), limits = (W.limits || '').trim();
    var back = /back|disc|spine|lumbar|hernia|sciatica/i.test(limits);

    if (limits) {
      out += acc('First: your limits', '<p>You told the app: <b>' + esc(limits) + '</b>.</p>' +
        '<p>Have a physio or doctor check it before heavy training. One visit tells you exactly which movements are safe. Eating well, walking and cycling can start now.</p>' +
        '<p>Where their advice differs from this app, follow them.</p>');
    }
    if (back) {
      out += acc('Training with a back problem',
        '<p>Back problems come in two main types, and they need opposite care. Your physio can tell you which one you have.</p>' +
        '<p class="sub">If arching back or standing long hurts</p>' + ul(['Avoid the back-extension machine, cobra, superman and prone press-ups.', 'Avoid overhead pressing that makes you arch.', 'Cycling and slight forward-lean positions usually feel better.']) +
        '<p class="sub">If bending forward or sitting long hurts</p>' + ul(['Avoid sit-ups, toe touches and lifting with a rounded back.', 'Walking usually helps.']) +
        '<p class="sub">For both</p>' + ul(['Keep a neutral spine under load: not arched, not rounded.', 'Use machines and supported movements; skip heavy barbell squats and deadlifts until cleared.', 'Build a bracing core: side plank and bird dog, not crunches.', 'If a movement causes sharp or radiating pain, stop it.']));
    }

    var title = 'Your training · ' + days + ' days a week';
    var full = days <= 3, body;
    if (full) {
      var A = back ? ['Leg press 3×8–10', 'Chest press machine 3×8–10', 'Chest-supported row 3×10', 'Side plank 3×30 s each side']
                   : ['Squat 3×6–8', 'Bench press 3×6–8', 'Barbell or cable row 3×8', 'Plank 3×40 s'];
      var B = back ? ['Hip thrust, ribs down, no arch 3×8–10', 'Lat pulldown 3×10', 'Goblet squat, neutral spine 3×8', 'Bird dog 3×8 each side']
                   : ['Romanian deadlift 3×8', 'Overhead press 3×8', 'Pull-ups or lat pulldown 3×8–10', 'Walking lunges 3×10 each leg'];
      body = '<p>Full body each session. Alternate A and B.</p><p class="sub">Session A</p>' + ul(A) + '<p class="sub">Session B</p>' + ul(B);
    } else {
      var U = back ? ['Chest press machine 3×8–10', 'Chest-supported row 3×10', 'Lat pulldown 3×10', 'Lateral raises 3×12', 'Cable curls 2×12']
                   : ['Bench press 3×6–8', 'Barbell row 3×8', 'Overhead press 3×8', 'Pull-ups or pulldown 3×8–10', 'Curls 2×12'];
      var L = back ? ['Leg press 3×8–10', 'Hip thrust, ribs down 3×8–10', 'Leg curl 3×10–12', 'Calf raises 3×12', 'Side plank 3×30 s each side']
                   : ['Squat 3×6–8', 'Romanian deadlift 3×8', 'Leg press 3×10', 'Calf raises 3×12', 'Plank 3×40 s'];
      body = '<p>Split into upper-body and lower-body days, alternating.</p><p class="sub">Upper day</p>' + ul(U) + '<p class="sub">Lower day</p>' + ul(L);
    }
    body += '<p>Write your weights down. Each week, try to beat last week by one rep or a little weight. ' +
      (dir === 'lose' ? 'Lifting is what keeps your muscle while you eat less.' : 'Progress in the gym plus enough food is what builds muscle.') + '</p>' +
      (limits ? '<p class="muted small">Start lighter than you think for the first two weeks.</p>' : '');
    out += acc(title, body);

    var tgt = T ? ' Your target: <b>' + T.kcal.toLocaleString() + ' kcal</b> and <b>' + T.p + ' g protein</b> a day (see Macros).' : '';
    if (dir === 'lose') {
      out += acc('Eating to lose fat', '<p>' + tgt + '</p>' + ul(['<b>Protein at every meal</b>: meat, chicken, eggs, yogurt or legumes.', '<b>Half the plate vegetables</b>, a quarter protein, a quarter carbs.',
        '<b>No liquid calories</b>: no juice, soda or sugary coffee.', '<b>Stop at 80% full.</b>', 'If you lose more than 1 kg a week after the first month, eat a little more.']));
      out += acc('Cardio and daily movement', ul(['The walks or rides in your plan add up: 30–40 minutes on non-training days.',
        back ? 'A bike is usually the most back-friendly option.' : 'Walking, cycling or swimming all work. Pick one you’ll keep doing.',
        W.activity === 'desk' ? 'At your desk, stand up and move every 30–45 minutes.' : 'Keep moving through the day. It burns more than most workouts.']));
    } else if (dir === 'gain') {
      out += acc('Eating to gain weight', '<p>' + tgt + '</p>' + ul(['Eat 4–5 times a day. It’s easier than three huge meals.', 'Protein at every meal.',
        'Add easy calories: olive oil, nuts, dates, whole milk, rice.', 'Aim for about +0.25–0.5 kg a week. If the scale hasn’t moved in 2 weeks, add about 200 kcal a day.']));
      out += acc('Cardio', ul(['Keep it light: 1–2 easy sessions a week, so you don’t burn off the extra food.', 'Walking is still good for you.']));
    } else {
      out += acc('Eating to build muscle', '<p>' + tgt + '</p>' + ul(['Eat around your daily burn, not less.', 'Protein at every meal: about 2 g per kg of bodyweight a day.',
        'Put some carbs around your training sessions.', 'Judge progress by strength, the mirror and your waist, not the scale.']));
    }
    out += acc('Sleep and measuring', ul(['7+ hours. Short sleep wrecks appetite, recovery and willpower.', 'Weigh once a week, same morning.', 'A photo and a waist measurement once a month show what the scale can’t.']));
    return out;
  }
  function logWeight() {
    var v = parseFloat($('w-kg').value);
    if (isNaN(v) || v < 30 || v > 300) { toast('Enter your weight in kg'); return; }
    var k = todayKey();
    state.weights = state.weights.filter(function (w) { return w.date !== k; });
    state.weights.push({ date: k, kg: Math.round(v * 10) / 10 });
    if (state.settings.start == null) state.settings.start = Math.round(v * 10) / 10;
    save(); render(); toast('Logged ' + num1(v) + ' kg');
  }

  /* =====================================================================
     FOCUS
     ===================================================================== */
  function streak() {
    var lim = +state.settings.limit, d = today(), n = 0, r0 = state.days[dateKey(d)];
    if (!(r0 && r0.screen != null)) d = addDays(d, -1);
    for (var i = 0; i < 730; i++) {
      var r = state.days[dateKey(d)];
      if (r && r.screen != null && +r.screen <= lim) { n++; d = addDays(d, -1); } else break;
    }
    return n;
  }
  function renderFocus() {
    var k = todayKey(), rec = peekDay(k), lim = +state.settings.limit, status = '';
    if (rec.screen != null) status = +rec.screen <= lim ? '<span class="pill">Under your ' + lim + '-min limit</span>' : '<span class="pill bad">' + (+rec.screen - lim) + ' min over your limit</span>';
    var s = streak(), t = today(), vals = [], maxV = lim * 2;
    for (var i = 13; i >= 0; i--) {
      var d = addDays(t, -i), r = state.days[dateKey(d)], v = r && r.screen != null ? +r.screen : null;
      vals.push({ d: d, v: v }); if (v != null && v > maxV) maxV = v;
    }
    var bars = vals.map(function (x, i) {
      var h = x.v == null ? 3 : Math.max(3, (x.v / maxV) * 100);
      var cls = 'b' + (x.v == null ? ' none' : x.v > lim ? ' over' : '') + (i === 13 ? ' today' : '');
      return '<span class="' + cls + '" style="height:' + h.toFixed(1) + '%" title="' + esc(DAYS_FULL[x.d.getDay()] + ': ' + (x.v == null ? 'not logged' : x.v + ' minutes')) + '"></span>';
    }).join('');
    var total = 0;
    Object.keys(state.days).forEach(function (key) { total += +(state.days[key].urges || 0); });
    return runHooks('focusTop') + focusTodayCard(rec, lim, status) +
      '<section><div class="card"><div class="streak"><span class="big-num">' + s + '</span><span><b>day' + (s === 1 ? '' : 's') + ' in a row</b><br><span class="muted small">at or under ' + lim + ' minutes</span></span></div>' +
      '<div class="plot" role="img" aria-label="Social media minutes over the last 14 days">' + bars + '<span class="limit" style="bottom:' + ((lim / maxV) * 100).toFixed(1) + '%"><span>' + lim + ' min</span></span></div>' +
      '<div class="plot-days">' + vals.map(function (x) { return '<span>' + dayIni(x.d.getDay()) + '</span>'; }).join('') + '</div></div></section>' +
      '<section><button class="urge" data-act="urge">I want to scroll</button>' +
      (lastUrge ? '<div class="urge-out"><span class="lbl">Do this instead</span>' + esc(lastUrge) + '</div>' : '') +
      '<p class="muted small" style="margin-top:10px">Urges beaten today: <b>' + (rec.urges || 0) + '</b> · all time: <b>' + total + '</b></p></section>' +
      '<section><h2>Set it up on your phone</h2>' +
      acc('1. App timers (the actual blocking)', '<ol><li>Open <b>Settings → Digital Wellbeing &amp; parental controls</b>.</li><li>Open the <b>Dashboard</b> (on Samsung: <b>App timers</b>).</li><li>Tap Instagram, TikTok, YouTube or whatever pulls you, then <b>App timer → 30 min</b>.</li><li>When the time runs out, the app greys out until midnight.</li></ol>') +
      acc('2. Bedtime mode', '<p>Digital Wellbeing → <b>Bedtime mode</b>. Set it to start when your wind-down block starts and turn on <b>grayscale</b>. A grey screen takes away most of the pull.</p>') +
      acc('3. Focus mode for your evening blocks', '<p>Digital Wellbeing → <b>Focus mode</b>. Pick the social apps and schedule it for your goal blocks. Your scroll window comes after it.</p>') +
      acc('4. Make scrolling inconvenient', '<ul><li>Move social apps off the home screen into a folder on the last page.</li><li>Log out of Instagram on the phone, so each visit costs a login.</li><li>Turn off their notifications.</li><li>Charge the phone outside the bedroom.</li></ul>') +
      acc('Why there is a scroll window', '<p>Your plan gives you ' + lim + ' minutes a day. Scrolling is not banned. It has a start and an end, like everything else in your day.</p>') +
      '</section>';
  }

  /* ---------------- automatic social-media tracking (native UsageWatch plugin) ---------------- */
  function UW() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.UsageWatch ? C.Plugins.UsageWatch : null;
  }
  var usageAccess = null, lastUsageSync = 0;      // null = not checked yet
  // Pulls the last 7 days of social-app minutes from Android into the day records.
  function syncUsage(force) {
    var uw = UW();
    if (!uw || (!force && Date.now() - lastUsageSync < 60000)) return Promise.resolve();
    lastUsageSync = Date.now();
    return uw.hasAccess().then(function (r) {
      var was = usageAccess;
      usageAccess = !!(r && r.granted);
      configureWatch();
      if (!usageAccess) { if (was !== usageAccess && tab === 'focus' && !OB) render(); return null; }
      return uw.getUsage({ days: 7 }).then(function (res) {
        (res && res.days || []).forEach(function (d) {
          var rec = dayRec(d.date);
          rec.screen = d.minutes; rec.screenAuto = true; rec.apps = d.apps || {};
        });
        save();
        if (!OB && !sheetOpen && !isTyping() && (tab === 'focus' || tab === 'report')) render();
      });
    }).catch(function (e) { console.warn('usage', e); });
  }
  function configureWatch() {
    var uw = UW();
    if (!uw) return;
    uw.configure({ enabled: !!state.settings.scrollAlerts && usageAccess === true,
      sessionMin: +state.settings.sessionMin || 15, dailyMin: +state.settings.limit || 30, lang: state.settings.lang || 'en' }).catch(function () {});
  }
  function focusTodayCard(rec, lim, status) {
    var uw = UW();
    if (uw && usageAccess === true) {
      var apps = rec.apps || {}, names = Object.keys(apps).sort(function (a, b) { return apps[b] - apps[a]; });
      var mins = rec.screen != null ? rec.screen : 0;
      var breakdown = names.length ? '<ul class="loglist" style="margin-top:8px">' + names.map(function (n) {
        return '<li><span class="ln"><b>' + esc(n) + '</b></span><span class="lk">' + apps[n] + ' min</span></li>';
      }).join('') + '</ul>' : '<p class="muted small" style="margin-top:8px">No social media yet today.</p>';
      var sess = +state.settings.sessionMin || 15;
      return '<div class="card"><h2>Social media today</h2><div class="kcal"><span class="big">' + mins + '</span><span class="of">min · limit ' + lim + '</span></div>' +
        (status ? '<p style="margin-top:8px">' + status + '</p>' : '') + breakdown +
        '</div>' +
        '<section><h2>Scrolling alerts</h2><div class="card">' +
        '<label class="setrow"><span><span class="st">Warn me when I scroll too long</span><br><span class="sd">Instagram, TikTok, YouTube, Facebook, Snapchat, X, Reddit and more</span></span>' +
        '<span class="switch"><input type="checkbox" id="set-scroll"' + (state.settings.scrollAlerts ? ' checked' : '') + '><span></span></span></label>' +
        '<div class="setrow" style="display:block"><span class="st">Warn after this long in one go</span><div class="choice" style="margin-top:8px">' +
        [10, 15, 20, 30].map(function (m) { return '<button type="button" class="chip' + (sess === m ? ' on' : '') + '" data-act="scroll-session" data-v="' + m + '">' + m + ' min</button>'; }).join('') +
        '</div></div></div></section>';
    }
    var manual = '<div class="inline"><input type="number" id="f-screen" inputmode="numeric" min="0" max="1440" placeholder="Minutes" value="' + (rec.screen != null ? rec.screen : '') + '"><button class="btn" data-act="save-screen">Save</button></div>' +
      (status ? '<p style="margin-top:10px">' + status + '</p>' : '');
    if (uw && usageAccess === false) {
      return '<div class="card"><h2>Track it automatically</h2>' +
        '<p class="small" style="margin-top:4px">Let Zain Life read your app usage and it will count your social media minutes by itself, and warn you when you’ve been scrolling too long.</p>' +
        '<p class="muted small" style="margin-top:6px">Tap the button, find <b>Zain Life</b> in the list and switch on <b>Permit usage access</b>. Then come back here.</p>' +
        '<div class="row-btns"><button class="btn" data-act="uw-open">Allow usage access</button></div></div>' +
        '<section><div class="card"><h2>Or enter it yourself</h2><p class="muted small">Today’s total from Digital Wellbeing.</p>' + manual + '</div></section>';
    }
    return '<div class="card"><h2>Social media today</h2><p class="muted small">Tonight, open Digital Wellbeing and enter today’s total for your social apps.</p>' + manual + '</div>';
  }

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  var setGroup = 'general';
  function renderSettings() {
    var st = state.settings, native = !!LN(), P = state.profile;
    var goals = P && P.goals ? P.goals.map(function (g) { return GOALS[g] ? GOALS[g].t : g; }).join(', ') : '';
    var cityOpts = Object.keys(PrayerTimes.CITIES).map(function (k) { return '<option value="' + k + '"' + (st.city === k ? ' selected' : '') + '>' + PrayerTimes.CITIES[k].name + '</option>'; }).join('');
    var profile = P && P.name ? '<div class="card"><b style="font-size:1.05rem">' + esc(P.name) + '</b><p class="muted small" style="margin-top:2px">' +
      esc(P.age + ' · ' + P.height + ' cm · ' + P.weight + ' kg at setup') + '</p>' + (goals ? '<p class="small" style="margin-top:6px">Goals: ' + esc(goals) + '</p>' : '') +
      '<div class="setrow"><span class="st">Religion</span><span class="chips">' + [['muslim', 'Muslim'], ['christian', 'Christian'], ['other', 'Other']].map(function (r) {
        return '<button class="chip' + (religion() === r[0] ? ' on' : '') + '" data-act="religion" data-v="' + r[0] + '">' + r[1] + '</button>';
      }).join('') + '</span></div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="redo-setup">Redo setup &amp; rebuild my plan</button></div></div>' :
      '<div class="card"><div class="row-btns" style="margin-top:0"><button class="btn" data-act="redo-setup">Run setup</button></div></div>';
    var groups = [['general', 'General'], ['health', 'Health'], ['focus', 'Focus'], ['work', 'Work']];
    if (hasGoal('pray') && isMuslim()) groups.splice(1, 0, ['prayer', 'Prayer']);
    if (!groups.some(function (g) { return g[0] === setGroup; })) setGroup = 'general';
    var bar = '<div class="chips setgroups" role="tablist">' + groups.map(function (g) {
      return '<button type="button" role="tab" class="chip' + (setGroup === g[0] ? ' on' : '') + '" data-act="set-group" data-v="' + g[0] + '" aria-selected="' + (setGroup === g[0]) + '">' + g[1] + '</button>';
    }).join('') + '</div>';
    var body = '';
    if (setGroup === 'general') body = profile +
      '<section><h2>Look</h2><div class="card"><div class="setrow"><span class="st">Language</span><span class="chips notr">' +
      '<button class="chip' + (st.lang !== 'ar' ? ' on' : '') + '" data-act="lang" data-v="en">English</button>' +
      '<button class="chip' + (st.lang === 'ar' ? ' on' : '') + '" data-act="lang" data-v="ar">العربية</button></span></div>' +
      '<div class="setrow"><span class="st">Theme</span><span class="chips">' +
      '<button class="chip' + (st.theme !== 'light' ? ' on' : '') + '" data-act="theme" data-v="dark">Dark</button>' +
      '<button class="chip' + (st.theme === 'light' ? ' on' : '') + '" data-act="theme" data-v="light">Light</button></span></div>' +
      '<label class="setrow"><span><span class="st">Glass blur</span><br><span class="sd">Turn off if scrolling feels slow on your phone</span></span>' +
      '<span class="switch"><input type="checkbox" id="set-glass"' + (st.glass !== false ? ' checked' : '') + '><span></span></span></label>' +
      '</div></section>' +
      '<section><h2>Reminders</h2><div class="card">' +
      '<label class="setrow"><span><span class="st">Block reminders</span><br><span class="sd">' + (native ? '5 minutes before each task, and when it starts' : 'Works in the installed app') + '</span></span>' +
      '<span class="switch"><input type="checkbox" id="set-reminders"' + (st.reminders ? ' checked' : '') + (native ? '' : ' disabled') + '><span></span></span></label>' +
      '<label class="setrow"><span><span class="st">Nightly report</span><br><span class="sd">15 minutes before you sleep</span></span>' +
      '<span class="switch"><input type="checkbox" id="set-report"' + (st.reportReminder ? ' checked' : '') + '><span></span></span></label>' +
      '<label class="setrow"><span><span class="st">Quiet while I sleep</span><br><span class="sd">No reminders during your Sleep block, including night-shift sleep</span></span>' +
        '<span class="switch"><input type="checkbox" id="set-quiet"' + (st.quietSleep !== false ? ' checked' : '') + '><span></span></span></label>' +
      (native ? '<div class="setrow"><span><span class="st">Test it</span><br><span class="sd">Pops up in 5 seconds. Lock the phone or switch apps to see it.</span></span>' +
        '<button class="btn ghost" data-act="test-reminder">Send test</button></div>' : '') +
      '</div></section>' +
      '<section><h2>Backup</h2><div class="card">' +
      '<div class="row-btns"><button class="btn" data-act="export">Copy backup</button><button class="btn ghost" data-act="import">Restore from backup</button></div>' +
      '<textarea id="bk" placeholder="Your backup text appears here. To restore, paste a backup here and tap Restore." style="margin-top:12px;font-size:.8rem"></textarea></div></section>' +
      runHooks('settings', 'general') +
      '<section><div class="card"><div class="setrow"><span><span class="st">Start over</span><br><span class="sd">Erase everything and run setup again</span></span><button class="btn warn" data-act="reset-all">Erase</button></div></div>' +
      '<p class="muted small" style="text-align:center;margin-top:18px">Zain Life 1.0 · a general plan, not medical or financial advice. Your physio and doctor know your body; where they differ, follow them.</p></section>';
    else if (setGroup === 'prayer') body = '<section><h2>Prayer</h2><div class="card">' +
      ('<label class="setrow"><span><span class="st">Prayer reminders</span><br><span class="sd">At each prayer time</span></span>' +
        '<span class="switch"><input type="checkbox" id="set-prayer"' + (st.prayerReminders ? ' checked' : '') + '><span></span></span></label>' +
        '<label class="setrow"><span><span class="st">Wake me for Fajr</span><br><span class="sd">Fajr still rings when “Quiet while I sleep” is on</span></span>' +
        '<span class="switch"><input type="checkbox" id="set-fajr"' + (st.fajrWake !== false ? ' checked' : '') + '><span></span></span></label>' +
        '<label class="setrow"><span class="st">City for prayer times</span><select data-set="city" style="width:150px">' + cityOpts + '</select></label>') + '</div></section>' + runHooks('settings', 'prayer');
    else if (setGroup === 'health') body = '<section><h2>Weight and steps</h2><div class="card">' +
      '<label class="setrow"><span class="st">Starting weight (kg)</span><input type="number" step="0.1" data-set="start" value="' + esc(st.start == null ? '' : st.start) + '"></label>' +
      '<label class="setrow"><span class="st">Goal weight (kg)</span><input type="number" step="0.1" data-set="target" value="' + esc(st.target == null ? '' : st.target) + '"></label>' +
      '<label class="setrow"><span class="st">Daily step goal</span><input type="number" step="500" min="1000" max="50000" inputmode="numeric" data-set="stepGoal" value="' + esc(st.stepGoal || 8000) + '"></label></div></section>' + runHooks('settings', 'health');
    else if (setGroup === 'focus') body = '<section><h2>Social media</h2><div class="card">' +
      '<label class="setrow"><span class="st">Daily social media limit (min)</span><input type="number" step="5" min="0" data-set="limit" value="' + esc(st.limit) + '"></label>' +
      '<p class="muted small" style="margin-top:8px">Scrolling alerts are in the Focus tab.</p></div></section>' + runHooks('settings', 'focus');
    else body = runHooks('settings', setGroup) || '<div class="card"><p class="muted small">Nothing to set here yet.</p></div>';
    return bar + body;
  }
  function exportData() {
    var txt = JSON.stringify(state), bk = $('bk');
    bk.value = txt;
    var done = function () { toast('Backup copied. Paste it somewhere safe.'); };
    var fallback = function () { bk.focus(); bk.select(); toast('Select all and copy the text below'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  function importData(btn) {
    var raw = $('bk').value.trim();
    if (!raw) { toast('Paste a backup into the box first'); return; }
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { toast('That is not a valid backup'); return; }
    if (!parsed || !parsed.templates || !parsed.settings) { toast('That is not a Zain Life backup'); return; }
    if (!armed(btn, 'Tap again: replaces everything')) return;
    var restored = normalize(parsed);
    // Backups from the older Reset app have no profile: keep their plan and skip setup.
    if (!restored.profile) restored.profile = { name: '', goals: [], done: true, legacy: true };
    state = restored;
    save(); applyTheme(); render(); queueReschedule(); toast('Backup restored');
  }

  /* ---------------- two-step confirm ---------------- */
  function armed(btn, label) {
    if (btn.getAttribute('data-armed') === '1') return true;
    btn.setAttribute('data-armed', '1');
    var orig = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { if (btn.isConnected) { btn.removeAttribute('data-armed'); btn.textContent = orig; } }, 4000);
    return false;
  }

  /* ---------------- sheet (bottom modal) ---------------- */
  function openSheet(html) {
    $('sheet-root').innerHTML = '<div class="backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    if (!sheetOpen) { sheetOpen = true; history.pushState({ sheet: 1 }, ''); }
  }
  function closeSheet() {
    $('sheet-root').innerHTML = '';
    sheetCtx = null;
    if (sheetOpen) { sheetOpen = false; ignorePop = true; history.back(); }
  }
  function closeSheetSilently() { if (sheetOpen) closeSheet(); }
  // Android back: closes an open sheet first, then leaves the daily report.
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    if (sheetOpen) { sheetOpen = false; sheetCtx = null; $('sheet-root').innerHTML = ''; return; }
    if (tab === 'report' && reportPushed) { reportPushed = false; setTab(reportFrom); }
  });

  /* ---------------- reminders (native) ---------------- */
  function LN() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins ? C.Plugins.LocalNotifications : null;
  }
  function enableReminders() {
    var ln = LN();
    if (!ln) { toast('Reminders work in the installed app'); return Promise.resolve(false); }
    return ln.checkPermissions().then(function (p) { return p.display === 'granted' ? p : ln.requestPermissions(); })
      .then(function (p) {
        if (p.display !== 'granted') { toast('Notifications are off for Zain Life. Turn them on in Android settings.'); return false; }
        return true;
      }).catch(function () { toast('Could not turn on reminders'); return false; });
  }
  // When the nightly report notification fires for a day (logic in reminders.js).
  function reportTimeFor(d) { return window.ZLReminders.reportMinute(blocksForDate(d)); }

  // Taps on notifications: "Mark done" ticks the task; the report notification opens the report.
  var tapsBound = false;
  function bindNotificationTaps() {
    var ln = LN();
    if (tapsBound || !ln || !ln.addListener) return;
    tapsBound = true;
    ln.addListener('localNotificationActionPerformed', function (ev) {
      var x = (ev && ev.notification && ev.notification.extra) || {};
      if (ev.actionId === 'done' && x.type === 'task' && x.id) {
        dayRec(x.date || todayKey()).done[x.id] = true;
        save();
        if (!OB) render();
        toast('Done: ' + (x.title || 'task'));
        return;
      }
      if (OB) return;
      var handled = false;
      HOOKS.tap.forEach(function (f) { if (!handled && f(x, ev)) handled = true; });
      if (handled) return;
      if (x.type === 'report') openReport(x.date);
      else if (x.type === 'task') setTab('today');
    });
  }

  var reschedTimer = null;
  function queueReschedule() { clearTimeout(reschedTimer); reschedTimer = setTimeout(reschedule, 1200); }

  // High-importance channels make reminders pop up over whatever is on screen (heads-up),
  // with sound and vibration. Android fixes a channel's importance once created, hence new ids.
  var channelsReady = null;
  function ensureChannels(ln) {
    if (channelsReady) return channelsReady;
    channelsReady = Promise.all([
      ln.createChannel({ id: 'tasks', name: 'Task reminders', description: '5 minutes before and when each task starts', importance: 4, visibility: 1, vibration: true, lights: true }),
      ln.createChannel({ id: 'prayers', name: 'Prayer reminders', description: '5 minutes before and at each prayer time', importance: 4, visibility: 1, vibration: true, lights: true }),
      // "Mark done" button on the "· now" notification, so tasks can be ticked without opening the app.
      ln.registerActionTypes({ types: [{ id: 'TASK', actions: [{ id: 'done', title: 'Mark done' }] }] })
    ]).catch(function (e) { channelsReady = null; console.warn('channels', e); });
    return channelsReady;
  }
  // Keeps a rolling week of notifications: block starts (if on) and prayer times (if on).
  function reschedule() {
    var ln = LN();
    if (!ln) return Promise.resolve();
    bindNotificationTaps();
    return ensureChannels(ln).then(function () { return ln.getPending(); }).then(function (res) {
      var pend = (res && res.notifications) || [];
      return pend.length ? ln.cancel({ notifications: pend.map(function (n) { return { id: n.id }; }) }) : null;
    }).then(function () {
      var blocksOn = state.settings.reminders, prayOn = hasGoal('pray') && state.settings.prayerReminders && state.settings.reminders;
      var now = Date.now(), t = today();
      // The week's task, prayer and report notifications are worked out in reminders.js.
      var list = window.ZLReminders.build({ start: t, now: now, blocksOn: blocksOn, prayOn: prayOn, reportOn: state.settings.reportReminder,
        cats: CATS, blocksFor: planList, prayersFor: prayerBlocks, reportMinuteFor: reportTimeFor });
      runHooks('notifs', list, t, now, blocksOn);
      if (state.settings.quietSleep !== false) list = window.ZLReminders.quietDuringSleep(list, { start: t, blocksFor: planList, fajrWake: state.settings.fajrWake !== false });
      return list.length ? ln.schedule({ notifications: list }) : null;
    }).catch(function (e) { console.warn('reminders', e); });
  }

  /* ---------------- events ---------------- */
  var saveTimer = null;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
  var ACTIONS = {
    // setup
    'ob-next': obNext,
    'ob-back': function () { OB.i = Math.max(0, OB.i - 1); renderOb(); window.scrollTo(0, 0); },
    'ob-cancel': function () { OB = null; document.body.classList.remove('ob'); setTab('settings'); },
    'ob-apply': obApply,
    'ob-set': function (el) {
      var v = el.getAttribute('data-v');
      setPath(OB.d, el.getAttribute('data-k'), el.hasAttribute('data-num') ? +v : v);
      renderOb();
    },
    'ob-goal': function (el) {
      var g = el.getAttribute('data-v'), i = OB.d.goals.indexOf(g);
      if (i >= 0) OB.d.goals.splice(i, 1); else OB.d.goals.push(g);
      renderOb();
    },
    'ob-workday': function (el) {
      var d = +el.getAttribute('data-v'), i = OB.d.workDays.indexOf(d);
      if (i >= 0) OB.d.workDays.splice(i, 1); else OB.d.workDays.push(d);
      OB.d.workDays.sort();
      renderOb();
    },
    'ob-prayed': function (el) {
      var p = el.getAttribute('data-v'), c = OB.d.prayQ.current, i = c.indexOf(p);
      if (i >= 0) c.splice(i, 1); else c.push(p);
      renderOb();
    },
    'ob-paint-pick': function (el) { OB.paint = el.getAttribute('data-v'); renderOb(); },
    'ob-paint': function (el) {
      var g = OB.d.grids[currentGridKey()], key = el.getAttribute('data-h');
      if (!OB.paint || g.cells[key] === OB.paint) delete g.cells[key]; else g.cells[key] = OB.paint;
      renderOb();
    },
    'ob-split': function (el) {
      var g = OB.d.grids[currentGridKey()], h = el.getAttribute('data-h'), q;
      g.split = g.split || {};
      if (!g.split[h]) {
        // Split: each quarter starts with the hour's activity.
        for (q = 0; q < 4; q++) { if (g.cells[h]) g.cells[h + ':' + q] = g.cells[h]; }
        delete g.cells[h];
        g.split[h] = true;
      } else {
        // Merge: the hour takes whatever filled most of it.
        var count = {}, best = '', bestN = 0;
        for (q = 0; q < 4; q++) {
          var v = g.cells[h + ':' + q];
          if (v) { count[v] = (count[v] || 0) + 1; if (count[v] > bestN) { best = v; bestN = count[v]; } }
          delete g.cells[h + ':' + q];
        }
        if (best) g.cells[h] = best;
        delete g.split[h];
      }
      renderOb();
    },
    'ob-fill-empty': function () {
      if (!OB.paint) { toast('Pick an activity first'); return; }
      var g = OB.d.grids[currentGridKey()];
      for (var h = g.wake; h < g.sleep; h++) {
        if (g.split && g.split[h]) { for (var q = 0; q < 4; q++) if (!g.cells[h + ':' + q]) g.cells[h + ':' + q] = OB.paint; }
        else if (!g.cells[h]) g.cells[h] = OB.paint;
      }
      renderOb();
    },
    'ob-copy-current': function () {
      var key = currentGridKey();
      OB.d.grids[key] = clone(OB.d.grids[key === 'idealWork' ? 'curWork' : 'curWeekend']);
      renderOb(); toast('Copied your current day');
    },
    // today
    'toggle-done': function (el) {
      var r = dayRec(todayKey()), id = el.getAttribute('data-id');
      if (r.done[id]) delete r.done[id]; else r.done[id] = true;
      save(); render();
    },
    'habit': function (el) {
      var r = dayRec(todayKey()), k = el.getAttribute('data-k');
      r.habits[k] = !r.habits[k];
      save(); render();
    },
    'remind-yes': function () {
      enableReminders().then(function (ok) {
        state.settings.reminderAsked = true;
        if (ok) state.settings.reminders = true;
        save(); render(); reschedule();
        if (ok) toast('Reminders on');
      });
    },
    'remind-no': function () { state.settings.reminderAsked = true; save(); render(); },
    'edit-today': function () { planSel = 'today'; setTab('plan'); },
    // daily report
    'open-report': function () { openReport(todayKey()); },
    'r-prev': function () { reportDate = dateKey(addDays(fromKey(reportDate || todayKey()), -1)); render(); window.scrollTo(0, 0); },
    'r-next': function () { var n = addDays(fromKey(reportDate || todayKey()), 1); if (n <= today()) { reportDate = dateKey(n) === todayKey() ? null : dateKey(n); render(); window.scrollTo(0, 0); } },
    'r-today': function () { reportDate = null; render(); },
    'r-did': function (el) {
      var k = reportDate || todayKey();
      dayRec(k).done[el.getAttribute('data-id')] = true;
      save(); render(); toast('Marked as done');
    },
    'r-reason': function (el) {
      var rv = reviewOf(reportDate || todayKey()), id = el.getAttribute('data-id'), v = el.getAttribute('data-v');
      var it = rv.items[id] = rv.items[id] || {};
      it.reason = it.reason === v ? '' : v;
      save(); render();
    },
    'r-verdict': function (el) {
      var rv = reviewOf(reportDate || todayKey()), id = el.getAttribute('data-id'), v = el.getAttribute('data-v');
      var it = rv.items[id] = rv.items[id] || {};
      it.verdict = it.verdict === v ? '' : v;
      save(); render();
    },
    'r-day': function (el) {
      var rv = reviewOf(reportDate || todayKey()), v = el.getAttribute('data-v');
      rv.day = rv.day === v ? '' : v;
      save(); render();
    },
    // plan
    'plan-sel': function (el) { var v = el.getAttribute('data-v'); planSel = v === 'today' ? 'today' : +v; render(); },
    'add-block': function () { openBlockSheet(null); },
    'edit-block': function (el) { openBlockSheet(el.getAttribute('data-id')); },
    'pick-cat': function (el) {
      if (!sheetCtx) return;
      sheetCtx.cat = el.getAttribute('data-cat');
      var cs = document.querySelectorAll('#f-cats .chip');
      for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', cs[i] === el);
    },
    'save-block': saveBlock,
    'del-block': deleteBlock,
    'close-sheet': closeSheet,
    'copy-day': openCopySheet,
    'do-copy': doCopy,
    'reset-today': function () { delete state.overrides[todayKey()]; save(); render(); queueReschedule(); toast('Today follows the normal plan again'); },
    // macros
    'm-prev': function () { macroDate = dateKey(addDays(fromKey(macroDate || todayKey()), -1)); render(); },
    'm-next': function () { var n = addDays(fromKey(macroDate || todayKey()), 1); if (n <= today()) { macroDate = dateKey(n); render(); } },
    'm-today': function () { macroDate = null; render(); },
    'm-add': function () { sheetCtx = null; openFoodSheet('list'); },
    // From the Today tab: always today's date, whatever day the Macros tab was last showing.
    'td-add-food': function () { macroDate = null; sheetCtx = null; openFoodSheet('list'); },
    'td-repeat': function () { macroDate = null; ACTIONS['m-repeat'](); },
    'td-food-del': function (el) {
      var k = todayKey(), id = el.getAttribute('data-id');
      state.macros.log[k] = (state.macros.log[k] || []).filter(function (e) { return e.id !== id; });
      save(); render(); toast('Removed');
    },
    'm-pick': function (el) { var f = findFood(el.getAttribute('data-id')); if (f) openFoodSheet('pick', f); },
    'm-qty': function (el) {
      sheetCtx.qty = Math.max(0.5, Math.min(20, sheetCtx.qty + parseFloat(el.getAttribute('data-d'))));
      $('m-qtyv').textContent = num1(sheetCtx.qty);
      $('m-pickline').innerHTML = pickLine(sheetCtx.food, sheetCtx.qty);
    },
    'm-add-picked': function () {
      var f = sheetCtx.food;
      addEntry({ id: uid(), name: f.name, unit: f.unit, p: f.p, c: f.c, f: f.f, qty: sheetCtx.qty });
    },
    'm-custom': function () { openFoodSheet('custom'); },
    'm-back': function () { openFoodSheet('list'); },
    'm-add-custom': addCustom,
    'm-del': function (el) {
      var k = macroDate || todayKey(), id = el.getAttribute('data-id');
      state.macros.log[k] = (state.macros.log[k] || []).filter(function (e) { return e.id !== id; });
      save(); render(); toast('Removed');
    },
    'm-repeat': function () {
      var k = macroDate || todayKey(), y = dateKey(addDays(fromKey(k), -1)), prev = state.macros.log[y] || [];
      if (!prev.length) { toast('Nothing was logged the day before'); return; }
      state.macros.log[k] = (state.macros.log[k] || []).concat(prev.map(function (e) { return Object.assign({}, e, { id: uid() }); }));
      save(); render(); toast('Added ' + prev.length + ' item' + (prev.length === 1 ? '' : 's') + ' from the day before');
    },
    'm-targets': openTargetsSheet,
    'mt-save': function () {
      var kcal = parseInt($('mt-kcal').value, 10), p = parseInt($('mt-p').value, 10), c = parseInt($('mt-c').value, 10), f = parseInt($('mt-f').value, 10);
      if (!(kcal >= 800 && kcal <= 6000)) { var e = $('mt-err'); e.textContent = 'Enter daily calories between 800 and 6,000.'; e.hidden = false; return; }
      state.macros.targets = { kcal: kcal, p: p || 0, c: c || 0, f: f || 0, manual: true };
      save(); closeSheet(); render(); toast('Targets saved');
    },
    'mt-recalc': function () {
      var cur = latestWeight();
      var m = Planner.macroTargets(Object.assign({}, state.profile, { weight: cur }));
      if (!m) { toast('Finish setup first'); return; }
      state.macros.targets = Object.assign({ manual: false, atWeight: cur }, m);
      save(); closeSheet(); render(); toast('Targets updated for ' + num1(cur) + ' kg');
    },
    // health & focus
    'log-weight': logWeight,
    'del-weight': function (el) {
      var d = el.getAttribute('data-date');
      state.weights = state.weights.filter(function (w) { return w.date !== d; });
      save(); render(); toast('Weigh-in removed');
    },
    'save-screen': function () {
      var v = parseInt($('f-screen').value, 10);
      if (isNaN(v) || v < 0 || v > 1440) { toast('Enter the minutes from Digital Wellbeing'); return; }
      dayRec(todayKey()).screen = v;
      save(); render(); toast('Saved');
    },
    'urge': function () {
      var r = dayRec(todayKey()), pick;
      r.urges = (r.urges || 0) + 1;
      do { pick = ALTS[Math.floor(Math.random() * ALTS.length)]; } while (pick === lastUrge && ALTS.length > 1);
      lastUrge = pick;
      save(); render();
    },
    // settings
    'open-settings': function () { setTab(tab === 'settings' ? 'dashboard' : 'settings'); },
    'menu': function () { setDrawer(!drawerOpen); },
    'menu-close': function () { setDrawer(false); },
    'uw-open': function () { var uw = UW(); if (uw) uw.openAccessSettings(); },
    'scroll-session': function (el) {
      state.settings.sessionMin = +el.getAttribute('data-v');
      save(); configureWatch(); render(); toast('You’ll be warned after ' + state.settings.sessionMin + ' minutes');
    },
    'test-reminder': function () {
      var ln = LN();
      if (!ln) return;
      enableReminders().then(function (ok) {
        if (!ok) return null;
        return ensureChannels(ln).then(function () {
          return ln.schedule({ notifications: [{ id: 9999, channelId: 'tasks', title: tr('Training in 5 minutes'), body: tr('This is how your reminders will look'), schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
        }).then(function () { toast('Test reminder in 5 seconds'); });
      }).catch(function () { toast('Could not send the test'); });
    },
    'redo-setup': function () { startOnboarding(true); },
    'religion': function (el) {
      if (!state.profile) return;
      state.profile.religion = el.getAttribute('data-v');
      save(); render(); queueReschedule();
      toast(state.profile.goals && state.profile.goals.indexOf('pray') >= 0 ? 'Saved. Redo setup to rebuild your faith time in the plan.' : 'Saved');
    },
    'lang': function (el) {
      state.settings.lang = el.getAttribute('data-v');
      save(); if (window.I18N) I18N.apply(state.settings.lang);
      render(); configureWatch(); queueReschedule();
    },
    'theme': function (el) { state.settings.theme = el.getAttribute('data-v'); save(); applyTheme(); render(); },
    'export': exportData,
    'import': importData,
    'set-group': function (el) { setGroup = el.getAttribute('data-v'); render(); window.scrollTo(0, 0); },
    'reset-all': function () {
      openSheet('<h3>Erase everything?</h3>' +
        '<p>This deletes your plan, tasks, time log, weights, money and history from this phone, then runs setup again. It can’t be undone.</p>' +
        '<p class="muted small" style="margin-top:8px">Backup files you saved stay where they are.</p>' +
        '<div class="row-btns"><button class="btn ghost" data-act="close-sheet">Cancel</button><button class="btn warn" data-act="reset-confirm">Erase everything</button></div>');
    },
    'reset-confirm': function () {
      closeSheet();
      state = defaultState();
      save(); applyTheme(); planSel = null; macroDate = null; queueReschedule();
      startOnboarding(false);
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-tab],[data-act]');
    if (!el) return;
    if (el.hasAttribute('data-tab')) { setDrawer(false); setTab(el.getAttribute('data-tab')); return; }
    var fn = ACTIONS[el.getAttribute('data-act')];
    if (fn) fn(el, e);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'set-scroll') {
      var wantAlerts = t.checked;
      (wantAlerts ? enableReminders() : Promise.resolve(true)).then(function () {
        state.settings.scrollAlerts = wantAlerts;
        save(); configureWatch();
        toast(wantAlerts ? 'Scrolling alerts on' : 'Scrolling alerts off');
      });
      return;
    }
    if (t.id === 'set-glass') { state.settings.glass = t.checked; save(); applyTheme(); return; }
    if (t.id === 'set-quiet' || t.id === 'set-fajr') {
      state.settings[t.id === 'set-quiet' ? 'quietSleep' : 'fajrWake'] = t.checked;
      save(); reschedule(); toast('Saved');
      return;
    }
    if (t.id === 'set-reminders' || t.id === 'set-prayer' || t.id === 'set-report') {
      var want = t.checked, key = t.id === 'set-reminders' ? 'reminders' : t.id === 'set-report' ? 'reportReminder' : 'prayerReminders';
      var needPerm = want && key === 'reminders';
      (needPerm ? enableReminders() : Promise.resolve(true)).then(function (ok) {
        if (want && !ok) { t.checked = false; return; }
        state.settings[key] = want;
        if (key === 'reminders') state.settings.reminderAsked = true;
        save(); reschedule();
        toast(want ? 'Reminders on' : 'Reminders off');
      });
      return;
    }
    if (t.hasAttribute('data-ob-grid')) {
      var g = OB.d.grids[currentGridKey()];
      g[t.getAttribute('data-ob-grid')] = +t.value;
      renderOb();
      return;
    }
    if (t.hasAttribute('data-tsel')) {
      var tw = t.closest('.tsel');
      tw.querySelector('input[type=hidden]').value = pad(+tw.querySelector('[data-tsel=h]').value) + ':' + pad(+tw.querySelector('[data-tsel=m]').value);
      return;
    }
    if (t.hasAttribute('data-ob-sel')) { setPath(OB.d, t.getAttribute('data-ob-sel'), t.value); return; }
    var key2 = t.getAttribute && t.getAttribute('data-set');
    if (key2) {
      var v = t.value;
      if (t.type === 'number') { if (v === '') v = null; else { v = parseFloat(v); if (isNaN(v)) { toast('Enter a number'); return; } } }
      state.settings[key2] = v;
      save();
      if (key2 === 'city') queueReschedule();
      if (key2 === 'limit') configureWatch();
      toast('Saved');
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-ob')) { setPath(OB.d, t.getAttribute('data-ob'), t.value); return; }
    if (t.hasAttribute('data-ob-cell')) {
      var g = OB.d.grids[currentGridKey()], h = t.getAttribute('data-ob-cell'), val = t.value;
      if (val.trim()) g.cells[h] = 'c:' + val; else delete g.cells[h];
      var a = Planner.activity(g.cells[h]), dot = $('dot-' + h.replace(':', '-'));
      if (dot) dot.style.background = a ? catColor(a.cat) : '';
      t.closest('.hr-row').classList.toggle('set', !!a);
      return;
    }
    if (t.id === 'fs-q') { sheetCtx.q = t.value; $('fs-results').innerHTML = foodResults(); return; }
    if (t.id === 'mt-p' || t.id === 'mt-c' || t.id === 'mt-f') { updateTargetSum(); return; }
    // Free-text answers: written into state on every keystroke (so a redraw never loses them),
    // with only the disk write delayed. No re-render, so the keyboard stays open.
    var dk = t.getAttribute('data-date') || todayKey();
    if (t.getAttribute('data-field') === 'note') {
      dayRec(dk).note = t.value; saveSoon();
    } else if (t.hasAttribute('data-review')) {
      var rv = reviewOf(dk), id = t.getAttribute('data-review');
      (rv.items[id] = rv.items[id] || {}).comment = t.value; saveSoon();
    } else if (t.getAttribute('data-rv') === 'tomorrow') {
      reviewOf(dk).tomorrow = t.value; saveSoon();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var id = e.target.id;
    if (id === 'w-kg') logWeight();
    else if (id === 'f-screen') ACTIONS['save-screen']();
    else if (id === 'f-title' || id === 'f-start' || id === 'f-end') saveBlock();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); save(); return; }   // app backgrounded: write now
    if (document.visibilityState === 'visible') {
      if (!sheetOpen && !isTyping() && !OB) render();
      queueReschedule();
      syncUsage(true);          // also picks up "Usage access" right after the person grants it
      runHooks('resume');
    }
  });
  setInterval(function () { if (tab === 'today' && !sheetOpen && !isTyping() && !OB) render(); }, 30000);

  /* ---------------- shared API for life.js ---------------- */
  window.LP = {
    timeSelect: timeSelect, runHooks: runHooks, st: function () { return state; }, HOOKS: HOOKS, TABS: TABS, ACTIONS: ACTIONS, CATS: CATS, PRAYERS: PRAYERS, DAYS: DAYS, DAYS_FULL: DAYS_FULL, MONTHS: MONTHS,
    save: save, saveSoon: saveSoon, render: render, toast: toast, setTab: setTab, openSheet: openSheet, closeSheet: closeSheet,
    esc: esc, pad: pad, dateKey: dateKey, fromKey: fromKey, today: today, todayKey: todayKey, addDays: addDays, toMin: toMin, minToT: minToT,
    fmt12: fmt12, fmtDur: fmtDur, nowMin: nowMin, shortDate: shortDate, num1: num1, uid: uid, clone: clone, catColor: catColor, byStart: byStart,
    dayRec: dayRec, peekDay: peekDay, displayList: displayList, blocksForDate: blocksForDate, prayerBlocks: prayerBlocks, accountable: accountable,
    hasGoal: hasGoal, weightGoal: weightGoal, latestWeight: latestWeight, totals: totals, activeHabits: activeHabits, reviewOf: reviewOf, REASONS: REASONS,
    LN: LN, enableReminders: enableReminders, ensureChannels: ensureChannels, queueReschedule: queueReschedule, reschedule: reschedule, statTile: statTile,
    acc: acc, ul: ul, dayIni: dayIni, religion: religion, isMuslim: isMuslim, dashTile: dashTile, reportTimeFor: reportTimeFor, armed: armed, isTyping: isTyping, tab: function () { return tab; }, sheetOpen: function () { return sheetOpen; },
    inSetup: function () { return !!OB; }, normalize: normalize, setState: function (s) { state = s; }, applyTheme: applyTheme, openReport: openReport
  };

  /* ---------------- boot (after life.js has registered its hooks) ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme();
    if (!state.profile) startOnboarding(false); else render();
    bindNotificationTaps();
    queueReschedule();
    syncUsage(true);
  });

  // Welcome animation runs for 2 seconds on launch, then fades away.
  var splash = $('splash');
  if (splash) {
    var tipEl = $('sp-tip');
    if (tipEl) tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    setTimeout(function () { splash.classList.add('out'); }, 2700);
    setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 3000);
  }
})();
