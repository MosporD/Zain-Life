// Run: node test/prayer.test.js   (forces Jordan time so results match phones in Jordan)
process.env.TZ = 'Asia/Amman';
const assert = require('assert');
const P = require('../www/prayer.js');

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const near = (got, want, tol, label) =>
  assert(Math.abs(toMin(got) - toMin(want)) <= tol, `${label}: got ${got}, expected ${want} ±${tol} min`);

// Every city, every month: valid HH:MM and prayers in the right order.
for (const [id, c] of Object.entries(P.CITIES)) {
  for (let m = 0; m < 12; m++) {
    const t = P.times(new Date(2026, m, 15), c.lat, c.lng);
    ORDER.forEach(k => assert(/^\d\d:\d\d$/.test(t[k]), `${id} month ${m + 1} ${k} = ${t[k]}`));
    for (let i = 1; i < ORDER.length; i++) {
      assert(toMin(t[ORDER[i - 1]]) < toMin(t[ORDER[i]]), `${id} month ${m + 1}: ${ORDER[i - 1]} before ${ORDER[i]}`);
    }
  }
}

// Amman sunrise and sunset (Jordan is on UTC+3 all year). Reference values come from an
// independent implementation of the NOAA solar algorithm (Python "astral" library).
const amman = P.CITIES.amman;
const winter = P.times(new Date(2026, 11, 21), amman.lat, amman.lng);
near(winter.sunrise, '07:32', 3, 'Amman 21 Dec sunrise');
near(winter.maghrib, '17:35', 3, 'Amman 21 Dec maghrib');
const summer = P.times(new Date(2026, 5, 21), amman.lat, amman.lng);
near(summer.sunrise, '05:31', 3, 'Amman 21 Jun sunrise');
near(summer.maghrib, '19:45', 3, 'Amman 21 Jun maghrib');

// Dhuhr is at solar noon (same reference: 12:34 in December, 12:38 in June).
near(winter.dhuhr, '12:34', 2, 'Amman 21 Dec dhuhr');
near(summer.dhuhr, '12:38', 2, 'Amman 21 Jun dhuhr');

// Aqaba is further south and west, so in winter its sunset is later than Amman's.
const aq = P.times(new Date(2026, 11, 21), P.CITIES.aqaba.lat, P.CITIES.aqaba.lng);
assert(toMin(aq.maghrib) > toMin(winter.maghrib), 'Aqaba sunset after Amman in winter');

console.log('Amman 21 Dec', winter);
console.log('ALL PRAYER TESTS PASSED');
