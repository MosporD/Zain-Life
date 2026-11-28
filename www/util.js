/* Zain Life: small helpers with no screen or storage code (dates, times, text escaping).
   Loaded before app.js, which picks them up from window.ZLUtil. Also loads in Node for tests. */
(function (root) {
  'use strict';

  function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function todayKey() { return dateKey(today()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function minToT(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function fmt12(t) {
    var m = toMin(t), h = Math.floor(m / 60), mm = m % 60;
    return (h % 12 || 12) + (mm ? ':' + pad(mm) : '') + (h >= 12 ? ' pm' : ' am');
  }
  function hourLabel(h) { var x = h % 24; return (x % 12 || 12) + (x < 12 ? ' am' : ' pm'); }
  function fmtDur(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function byStart(a, b) { return toMin(a.start) - toMin(b.start); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num1(n) { return (Math.round(n * 10) / 10).toString(); }

  var api = { uid: uid, esc: esc, pad: pad, dateKey: dateKey, fromKey: fromKey, today: today, todayKey: todayKey, addDays: addDays, daysBetween: daysBetween, toMin: toMin, minToT: minToT, fmt12: fmt12, hourLabel: hourLabel, fmtDur: fmtDur, nowMin: nowMin, byStart: byStart, clone: clone, num1: num1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZLUtil = api;
})(this);
