/* Prayer-time calculation (standard astronomical method, as used by PrayTimes-style calculators).
   Jordan convention: Fajr and Isha at 18° below the horizon, Asr at shadow ratio 1 (Shafi'i).
   Results can differ by a few minutes from a local mosque's published timetable. */
(function (root) {
  'use strict';

  var CITIES = {
    amman: { name: 'Amman', lat: 31.9539, lng: 35.9106 },
    zarqa: { name: 'Zarqa', lat: 32.0728, lng: 36.0880 },
    irbid: { name: 'Irbid', lat: 32.5556, lng: 35.8500 },
    salt: { name: 'Salt', lat: 32.0392, lng: 35.7272 },
    madaba: { name: 'Madaba', lat: 31.7167, lng: 35.8000 },
    mafraq: { name: 'Mafraq', lat: 32.3429, lng: 36.2080 },
    karak: { name: 'Karak', lat: 31.1853, lng: 35.7048 },
    aqaba: { name: 'Aqaba', lat: 29.5321, lng: 35.0063 }
  };

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function sin(d) { return Math.sin(rad(d)); }
  function cos(d) { return Math.cos(rad(d)); }
  function tan(d) { return Math.tan(rad(d)); }
  function asin(x) { return deg(Math.asin(x)); }
  function acos(x) { return deg(Math.acos(x)); }
  function atan2(y, x) { return deg(Math.atan2(y, x)); }
  function acot(x) { return deg(Math.atan(1 / x)); }
  function fixAngle(a) { a = a - 360 * Math.floor(a / 360); return a < 0 ? a + 360 : a; }
  function fixHour(a) { a = a - 24 * Math.floor(a / 24); return a < 0 ? a + 24 : a; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  // Sun declination and equation of time for a Julian date.
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * D);
    var q = fixAngle(280.459 + 0.98564736 * D);
    var L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    var e = 23.439 - 0.00000036 * D;
    var RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fixHour(RA) };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toHM(hours) {
    var m = Math.round(fixHour(hours) * 60) % 1440;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  /* Returns { fajr, sunrise, dhuhr, asr, maghrib, isha } as "HH:MM" local time for the given date. */
  function times(date, lat, lng, opts) {
    opts = opts || {};
    var fajrAngle = opts.fajr || 18, ishaAngle = opts.isha || 18;
    var noonLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    var tz = -noonLocal.getTimezoneOffset() / 60;
    var jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

    function midDay(t) { return fixHour(12 - sunPosition(jd + t).eqt); }
    function angleTime(angle, t, beforeNoon) {
      var decl = sunPosition(jd + t).decl;
      var x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      var T = acos(Math.max(-1, Math.min(1, x))) / 15;
      return midDay(t) + (beforeNoon ? -T : T);
    }
    function asrTime(factor, t) {
      var decl = sunPosition(jd + t).decl;
      return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t, false);
    }

    // Start from rough guesses and refine once, as the reference method does.
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    var p = {};
    for (var k in t) p[k] = t[k] / 24;
    t = {
      fajr: angleTime(fajrAngle, p.fajr, true),
      sunrise: angleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(1, p.asr),
      maghrib: angleTime(0.833, p.maghrib, false),
      isha: angleTime(ishaAngle, p.isha, false)
    };
    var adj = tz - lng / 15, out = {};
    for (k in t) out[k] = toHM(t[k] + adj);
    return out;
  }

  var api = { CITIES: CITIES, times: times };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrayerTimes = api;
})(this);
