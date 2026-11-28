/* Zain Life: builds the list of reminder notifications for the coming week. No native calls here:
   app.js passes in the day's blocks, then hands the result to Capacitor's LocalNotifications.
   Loaded after util.js and before app.js. Also loads in Node for tests. */
(function (root) {
  'use strict';
  var U = typeof module !== 'undefined' && module.exports ? require('./util.js') : root.ZLUtil;
  var toMin = U.toMin, fmt12 = U.fmt12, dateKey = U.dateKey, addDays = U.addDays, byStart = U.byStart;

  // The nightly report arrives 15 minutes before the evening Sleep block
  // (or before the day's last evening block ends, when sleep is after midnight).
  function reportMinute(list) {
    var base = null;
    list.forEach(function (b) { if (b.cat === 'sleep' && /^Sleep/.test(b.title) && toMin(b.start) >= 17 * 60 && base == null) base = toMin(b.start); });
    if (base == null) {
      list.forEach(function (b) { if (toMin(b.start) >= 12 * 60) base = Math.max(base || 0, toMin(b.end)); });
    }
    return Math.max(0, (base == null ? 22 * 60 : base) - 15);
  }

  // Keeps a rolling week of notifications: block starts (if on) and prayer times (if on).
  // o: { start (Date, midnight today), now (ms), blocksOn, prayOn, reportOn, cats,
  //      blocksFor(date) -> blocks, prayersFor(date) -> prayer blocks,
  //      reportMinuteFor(date) -> minute of day for the report (optional) }
  function build(o) {
    var now = o.now, list = [], t = o.start;
    // Two notifications per task: 5 minutes before, and when it starts.
    // IDs: tasks 1..1399 (day*200 + task*2 + 0/1), prayers 5000+ (day*20 + prayer*2 + 0/1),
    // daily report 8000+day. life.js adds its own from 9000 up.
    // allowWhileIdle + the exact-alarm permission = delivered on the minute, even in battery saving.
    function pair(baseId, d, b, kindLabel, channel) {
      var mm = toMin(b.start), extra = { type: 'task', date: dateKey(d), id: b.id, title: b.title };
      var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mm / 60), mm % 60);
      var early = new Date(at.getTime() - 5 * 60000);
      if (early.getTime() > now + 30000) {
        list.push({ id: baseId, channelId: channel, title: b.title + ' in 5 minutes', body: fmt12(b.start) + ' – ' + fmt12(b.end) + ' · ' + kindLabel, extra: extra, schedule: { at: early, allowWhileIdle: true } });
      }
      if (at.getTime() > now + 30000) {
        list.push({ id: baseId + 1, channelId: channel, actionTypeId: 'TASK', title: b.title + ' · now', body: 'Until ' + fmt12(b.end) + ' · ' + kindLabel, extra: extra, schedule: { at: at, allowWhileIdle: true } });
      }
    }
    for (var off = 0; off < 7; off++) {
      var d = addDays(t, off);
      if (o.blocksOn) {
        o.blocksFor(d).slice().sort(byStart).forEach(function (b, i) {
          if (b.remind && i < 99) pair(1 + off * 200 + i * 2, d, b, o.cats[b.cat] || 'Plan', 'tasks');
        });
      }
      if (o.prayOn) {
        o.prayersFor(d).forEach(function (p, j) { pair(5000 + off * 20 + j * 2, d, p, 'Prayer', 'prayers'); });
      }
      if (o.blocksOn && o.reportOn) {
        var rm = o.reportMinuteFor ? o.reportMinuteFor(d) : reportMinute(o.blocksFor(d)), rat = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(rm / 60), rm % 60);
        if (rat.getTime() > now + 30000) {
          list.push({ id: 8000 + off, channelId: 'tasks', title: 'Your daily report is ready', body: 'See what you did today, and get set for tomorrow.',
            extra: { type: 'report', date: dateKey(d) }, schedule: { at: rat, allowWhileIdle: true } });
        }
      }
    }
    return list;
  }

  // Quiet while asleep: drops any notification that would go off inside a "Sleep" block, so a night-shift
  // worker sleeping 7 am – 3 pm isn't woken for Dhuhr or a task. Fajr can stay on as a wake-up call, and
  // the daily report is never inside sleep (it's set before it). Works on the whole list, so reminders
  // added by life.js are covered too.
  // o: { start (Date, midnight today), blocksFor(date), fajrWake (bool) }
  function sleepWindows(o) {
    var out = [];
    for (var off = -1; off < 8; off++) {
      var d = addDays(o.start, off);
      o.blocksFor(d).forEach(function (b) {
        if (b.cat !== 'sleep' || !/^Sleep/.test(b.title)) return;
        var s = toMin(b.start), e = toMin(b.end);
        if (e === 1439) e = 1440;                 // "until 11:59 pm" means until midnight
        if (e <= s) e += 1440;                    // runs past midnight
        var base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        out.push([base + s * 60000, base + e * 60000]);
      });
    }
    return out;
  }
  function quietDuringSleep(list, o) {
    var win = sleepWindows(o);
    return list.filter(function (n) {
      var x = n.extra || {}, at = n.schedule && n.schedule.at ? new Date(n.schedule.at).getTime() : null;
      if (at == null || x.type === 'report') return true;
      if (o.fajrWake && x.id === 'p-fajr') return true;
      return !win.some(function (w) { return at >= w[0] && at < w[1]; });
    });
  }

  var api = { reportMinute: reportMinute, build: build, sleepWindows: sleepWindows, quietDuringSleep: quietDuringSleep };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZLReminders = api;
})(this);
