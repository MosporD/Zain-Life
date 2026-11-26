/* Zain Life — Profile: who you are, kept on this phone only. Name and body numbers come from setup;
   job title, department, work location, a photo and a short "about me" are added here. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, A = L.ACTIONS, toast = L.toast;
  var FIELDS = [['title', 'Job title', 'e.g. RAN Optimization Engineer'], ['dept', 'Department', 'e.g. Technology'],
    ['location', 'Work location', 'e.g. Amman HQ'], ['phone', 'Work phone or extension', '']];

  function P() { return L.st().profile || null; }
  function about() { var p = P(); if (!p) return {}; p.about = p.about || {}; return p.about; }
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; }
  function avatar(cls) {
    var a = about(), p = P() || {};
    return a.photo ? '<img class="' + cls + '" src="' + a.photo + '" alt="">' : '<span class="' + cls + ' pf-ini notr">' + esc(initials(p.name)) + '</span>';
  }

  function renderProfile() {
    var p = P();
    if (!p) return '<div class="card"><p class="muted">Run setup first.</p><div class="row-btns"><button class="btn" data-act="redo-setup">Run setup</button></div></div>';
    var a = about();
    var head = '<section class="pf-head">' + avatar('pf-avatar') +
      '<div class="pf-photo-btns"><label class="btn ghost sm filebtn">' + (a.photo ? 'Change photo' : 'Add photo') + '<input type="file" accept="image/*" id="pf-photo" hidden></label>' +
      (a.photo ? '<button class="btn ghost sm" data-act="pf-photo-del">Remove</button>' : '') + '</div>' +
      '<h2 class="notr">' + esc(p.name || '') + '</h2>' + (a.title ? '<p class="muted notr">' + esc(a.title) + (a.dept ? ' · ' + esc(a.dept) : '') + '</p>' : '') + '</section>';
    var form = '<section><h2>About you</h2><div class="card">' +
      '<label class="field"><span>Name</span><input type="text" class="notr" data-prof="name" maxlength="60" value="' + esc(p.name || '') + '"></label>' +
      FIELDS.map(function (f) {
        return '<label class="field"><span>' + f[1] + '</span><input type="text" class="notr" data-prof="' + f[0] + '" maxlength="80" placeholder="' + esc(f[2]) + '" value="' + esc(a[f[0]] || '') + '"></label>';
      }).join('') +
      '<label class="field"><span>About me</span><textarea class="notr" data-prof="bio" maxlength="400" rows="3" placeholder="A line or two: what you work on, what you’re aiming for.">' + esc(a.bio || '') + '</textarea></label>' +
      '<p class="muted small" style="margin-top:10px">Saved on this phone only. Nothing is sent anywhere.</p></div></section>';
    var body = '<section><h2>Body and goals</h2><div class="card">' +
      '<div class="pf-facts"><span><b>' + esc(p.age || '–') + '</b>years</span><span><b>' + esc(p.height || '–') + '</b>cm</span><span><b>' + esc(L.latestWeight ? (L.latestWeight() || p.weight || '–') : (p.weight || '–')) + '</b>kg</span></div>' +
      '<div class="row-btns"><button class="btn ghost" data-act="redo-setup">Redo setup &amp; rebuild my plan</button></div></div></section>';
    return head + form + body;
  }
  L.TABS.profile = ['Profile', renderProfile];

  document.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-prof');
    if (k) {
      var v = String(t.value || '').trim();
      if (k === 'name') { if (!v) { toast('Enter your name.'); t.value = P().name || ''; return; } P().name = v; }
      else about()[k] = v;
      L.save(); toast('Saved');
      return;
    }
    if (t.id !== 'pf-photo' || !t.files || !t.files[0]) return;
    // Shrinks the photo to 320 px so it stays a few dozen KB in the phone's storage.
    var url = URL.createObjectURL(t.files[0]), img = new Image();
    img.onload = function () {
      var sc = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      about().photo = c.toDataURL('image/jpeg', 0.8);
      L.save(); L.render(); toast('Photo saved');
    };
    img.onerror = function () { toast('Could not read that photo'); };
    img.src = url;
  });
  A['pf-photo-del'] = function (el) {
    if (!L.armed(el, 'Tap again to remove')) return;
    delete about().photo; L.save(); L.render();
  };
  A['pf-open'] = function () { L.setTab('profile'); };
  window.ZLProfile = { avatar: avatar };
})();
