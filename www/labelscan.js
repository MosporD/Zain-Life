/* Nutrition label reading. The phone reads the text in the photo (native LabelScan plugin, ML Kit,
   on the phone, no internet) and returns each line with its position. This file puts the lines back
   into table rows and pulls out calories, protein, carbs and fat, per 100 g and/or per serving.
   Works for the usual layouts: EU/Middle East "Per 100 g | Per serving" tables, US "Nutrition Facts",
   energy in kJ and/or kcal, "6,5 g" decimals and "Og" read for "0g". English labels only: ML Kit
   cannot read Arabic script yet. */
(function () {
  'use strict';

  // Lines whose vertical centres line up form one row, read left to right.
  function rows(lines) {
    var withBox = lines.filter(function (l) { return l && l.t && l.h > 0; });
    if (withBox.length < lines.length * 0.8) return lines.map(function (l) { return typeof l === 'string' ? l : (l && l.t) || ''; });
    var hs = withBox.map(function (l) { return l.h; }).sort(function (a, b) { return a - b; });
    var tol = hs[Math.floor(hs.length / 2)] * 0.55;
    var sorted = withBox.slice().sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2); });
    var out = [];
    sorted.forEach(function (l) {
      var cy = l.y + l.h / 2, row = out[out.length - 1];
      if (row && Math.abs(cy - row.cy) <= tol) { row.items.push(l); row.cy = (row.cy * (row.items.length - 1) + cy) / row.items.length; }
      else out.push({ cy: cy, items: [l] });
    });
    return out.map(function (r) {
      r.items.sort(function (a, b) { return a.x - b.x; });
      return r.items.map(function (l) { return l.t; }).join(' | ');
    });
  }

  function clean(s) {
    return s.replace(/\b[Oo](?=\s?(g|mg|kcal)\b)/g, '0')          // "Og" → "0g"
      .replace(/(\d),(\d)/g, '$1.$2')                              // "6,5" → "6.5"
      .replace(/(\d)\s?[.](?=\s?g\b)/g, '$1')                      // "6. g"
      .replace(/<\s?/g, '');                                       // "<0.5 g" → "0.5 g"
  }
  // Numbers in a row with their unit. Percentages (daily value) are left out.
  function values(s) {
    var re = /(\d+(?:\.\d+)?)\s?(kcal|kj|cal|mg|g|ml|%)?(?![a-z])/gi, m, out = [];
    while ((m = re.exec(s))) {
      var u = (m[2] || '').toLowerCase();
      if (u === '%') continue;
      out.push({ v: parseFloat(m[1]), u: u });
    }
    return out;
  }
  function labelOf(s) { var i = s.search(/\d/); return (i < 0 ? s : s.slice(0, i)).toLowerCase(); }

  function parse(lines) {
    var rs = rows(lines || []).map(clean), found = {}, per100Idx = null, hasServ = false, has100 = false, servingG = null;
    rs.forEach(function (r) {
      var low = r.toLowerCase();
      var i100 = low.search(/100\s?(g|ml)\b/), iServ = low.search(/serving|portion|per pack|per bag|per piece/);
      if (i100 >= 0) has100 = true;
      if (iServ >= 0) hasServ = true;
      if (i100 >= 0 && iServ >= 0 && per100Idx == null) per100Idx = i100 < iServ ? 0 : 1;
      if (servingG == null && iServ >= 0 && !/servings per|per container/.test(low)) {
        var re = /(\d+(?:\.\d+)?)\s?(g|ml)\b/g, m;
        while ((m = re.exec(low))) { if (+m[1] > 0 && +m[1] !== 100) { servingG = +m[1]; break; } }
      }
    });
    rs.forEach(function (r) {
      var lab = labelOf(r), vals = values(r), low = r.toLowerCase();
      if (/energy|calor|energie|\bkcal\b|\bkj\b/.test(lab) && !/from fat|fat cal/.test(low)) {
        var kc = vals.filter(function (x) { return x.u === 'kcal' || x.u === 'cal'; });
        var kj = vals.filter(function (x) { return x.u === 'kj'; }).map(function (x) { return { v: x.v / 4.184 }; });
        var bare = vals.filter(function (x) { return !x.u; });
        var cand = null, pri = -1;
        if (kc.length) { cand = kc; pri = 3; }
        else if (/kcal|calor/.test(lab) && bare.length) { cand = bare; pri = 3; }      // US "Calories 160"
        else if (kj.length) { cand = kj; pri = 1; }
        else if (/kj/.test(lab) && bare.length) { cand = bare.map(function (x) { return { v: x.v / 4.184 }; }); pri = 1; }
        else if (bare.length) { cand = bare; pri = 0; }
        if (cand && pri > (found.kcalPri == null ? -1 : found.kcalPri)) { found.kcal = cand.map(function (x) { return x.v; }); found.kcalPri = pri; }
        return;
      }
      var grams = vals.filter(function (x) { return x.u === 'g' || !x.u; }).map(function (x) { return x.v; });
      if (!grams.length) return;
      if (/protein|prot[eé]ine/.test(lab)) { if (!found.p) found.p = grams; }
      else if (/carbo|glucide/.test(lab) && !/sugar|fib|of which|polyol|starch/.test(lab)) { if (!found.c || /total/.test(lab)) found.c = grams; }
      else if (/\bfat\b|\bfats\b|lipid|graisse/.test(lab) && !/satur|trans|mono|poly|of which|unsat/.test(lab)) { if (!found.f || /total/.test(lab)) found.f = grams; }
    });
    var keys = ['kcal', 'p', 'c', 'f'].filter(function (k) { return found[k]; });
    if (keys.length < 2) return null;
    var two = keys.some(function (k) { return found[k].length >= 2; });
    function col(i) {
      var o = {}, any = false;
      keys.forEach(function (k) { if (found[k][i] != null) { o[k] = found[k][i]; any = true; } });
      if (!any) return null;
      if (o.kcal == null && (o.p != null || o.c != null || o.f != null)) o.kcal = (o.p || 0) * 4 + (o.c || 0) * 4 + (o.f || 0) * 9;
      return o;
    }
    var res = { per100: null, serving: null, servingG: servingG };
    if (two && has100 && hasServ) {
      var a = per100Idx == null ? 0 : per100Idx;
      res.per100 = col(a); res.serving = col(1 - a);
    } else if (has100 && !hasServ) res.per100 = col(0);
    else if (hasServ && !has100) res.serving = col(0);
    else if (has100) res.per100 = col(0);
    else res.serving = col(0);
    // A per-100 g column but a known serving size: work out the serving column too.
    if (res.per100 && !res.serving && servingG) {
      res.serving = {};
      Object.keys(res.per100).forEach(function (k) { res.serving[k] = res.per100[k] * servingG / 100; });
    }
    return res.per100 || res.serving ? res : null;
  }

  // Shrinks a photo to at most `max` px on the long side (the browser applies the camera's rotation)
  // and returns it as base64 JPEG for the native reader.
  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }

  var api = { parse: parse, rows: rows, shrink: shrink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ZLLabel = api;
})();
