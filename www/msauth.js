/* Microsoft account sign-in (optional). Standard OAuth 2.0 sign-in with PKCE, the same flow Microsoft's
   own MSAL library uses: the phone's browser shows Microsoft's page, then returns to the app through
   com.zainlife.app://auth with a one-time code; the app swaps the code for tokens, reads the name and
   email from Microsoft Graph (/me), and keeps only those details. Tokens are not stored, so nothing can
   be read from the account later. Settings live in ms-config.js. The app works the same signed out. */
(function () {
  'use strict';
  var PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';   // tenant ID of every personal Microsoft account

  /* ---------- pure helpers (also used by test/msauth.test.js) ---------- */
  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // Payload of an ID token. Read only for display: the token came straight from Microsoft over HTTPS.
  function jwtClaims(t) {
    try { return JSON.parse(b64urlDecode(String(t).split('.')[1])); } catch (e) { return {}; }
  }
  function query(url) {
    var out = {}, q = String(url || '').split('#')[0].split('?')[1] || '';
    q.split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('='), k = i < 0 ? p : p.slice(0, i), v = i < 0 ? '' : p.slice(i + 1);
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    });
    return out;
  }
  function form(o) {
    return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
  }
  function authority(cfg) { return 'https://login.microsoftonline.com/' + encodeURIComponent(cfg.tenant || 'common') + '/oauth2/v2.0/'; }
  function authorizeUrl(cfg, state, challenge, method) {
    return authority(cfg) + 'authorize?' + form({
      client_id: cfg.clientId, response_type: 'code', redirect_uri: cfg.redirectUri, response_mode: 'query',
      scope: cfg.scopes, state: state, code_challenge: challenge, code_challenge_method: method, prompt: 'select_account'
    });
  }
  // What is kept on the phone: from Graph /me where it answered, else from the ID token.
  function accountFrom(claims, me) {
    me = me || {};
    var email = me.mail || claims.email || claims.preferred_username || me.userPrincipalName || '';
    return {
      name: me.displayName || claims.name || email,
      email: email,
      kind: claims.tid === PERSONAL_TENANT ? 'personal' : 'work',
      tid: claims.tid || '', oid: claims.oid || me.id || '',
      title: me.jobTitle || '', dept: me.department || '', location: me.officeLocation || '',
      at: Date.now()
    };
  }
  // Microsoft errors look like "AADSTS50011: The redirect URI ... Trace ID: ...". Keep the first sentence.
  function errorText(code, desc) {
    var d = String(desc || '');
    if (/AADSTS65001|AADSTS90094|AADSTS90095/.test(d)) return 'Your organisation needs an admin to approve Zain Life first.';
    if (code === 'access_denied' || /AADSTS65004/.test(d)) return 'Sign-in was cancelled.';
    if (/AADSTS700016/.test(d)) return 'The app ID in ms-config.js is not found. Check the client ID.';
    if (/AADSTS50011/.test(d)) return 'The redirect URI is not set on the app registration.';
    var m = d.match(/^(AADSTS\d+)/);
    return 'Microsoft sign-in failed' + (m ? ' (' + m[1] + ')' : '') + '.';
  }

  var api = { b64url: b64url, jwtClaims: jwtClaims, query: query, form: form, authorizeUrl: authorizeUrl, accountFrom: accountFrom, errorText: errorText, PERSONAL_TENANT: PERSONAL_TENANT };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- app ---------- */
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, A = L.ACTIONS, H = L.HOOKS, toast = L.toast;
  var ACC_KEY = 'zainlife.msAccount', PEND_KEY = 'zainlife.msPending';
  var busy = false;

  function cfg() { return window.ZL_MS_CONFIG || {}; }
  function configured() { return !!(cfg().clientId && cfg().redirectUri); }
  function MS() {
    var C = window.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.MsAuth ? C.Plugins.MsAuth : null;
  }
  function getJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function setJSON(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // Kept outside the app's main data on purpose: a backup restored on another phone should not arrive signed in.
  function account() { return getJSON(ACC_KEY); }
  function rerender() { if (!L.inSetup() && !L.sheetOpen() && !L.isTyping()) L.render(); }

  function randomStr(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
  function pkce() {
    var verifier = randomStr(48);
    if (!(window.crypto && crypto.subtle)) return Promise.resolve({ verifier: verifier, challenge: verifier, method: 'plain' });
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
      return { verifier: verifier, challenge: b64url(new Uint8Array(h)), method: 'S256' };
    });
  }

  function signIn() {
    var ms = MS();
    if (!ms) { toast('Microsoft sign-in works in the installed app.'); return; }
    if (!configured()) { toast('Microsoft sign-in is not set up in this build yet.'); return; }
    pkce().then(function (p) {
      var state = randomStr(16);
      // Kept in storage, not memory: Android may close the app while the browser is open.
      setJSON(PEND_KEY, { state: state, verifier: p.verifier, at: Date.now() });
      return ms.open({ url: authorizeUrl(cfg(), state, p.challenge, p.method) });
    }).catch(function (e) { toast((e && e.message) || 'Could not open Microsoft sign-in'); });
  }

  function req(o) {
    return MS().request(o).then(function (r) {
      var body = {};
      try { body = JSON.parse(r.body || '{}'); } catch (e) {}
      return { status: r.status, body: body };
    });
  }

  function onRedirect(url) {
    var q = query(url), pend = getJSON(PEND_KEY);
    if (!pend || !q.state || q.state !== pend.state) return;    // not ours, or already used
    setJSON(PEND_KEY, null);
    if (q.error) { toast(errorText(q.error, q.error_description)); return; }
    if (!q.code || Date.now() - pend.at > 15 * 60000) { toast('Sign-in took too long. Try again.'); return; }
    busy = true; rerender();
    var c = cfg(), claims = {};
    req({ method: 'POST', url: authority(c) + 'token', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: c.clientId, grant_type: 'authorization_code', code: q.code, redirect_uri: c.redirectUri, code_verifier: pend.verifier, scope: c.scopes }) })
      .then(function (r) {
        if (r.status !== 200 || !r.body.access_token) throw new Error(errorText(r.body.error, r.body.error_description));
        claims = jwtClaims(r.body.id_token);
        return req({ method: 'GET', url: 'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation',
          headers: { Authorization: 'Bearer ' + r.body.access_token } })
          .then(function (g) { return g.status === 200 ? g.body : {}; }, function () { return {}; });
      })
      .then(function (me) {
        var a = accountFrom(claims, me);
        setJSON(ACC_KEY, a);
        // Work accounts: fill job title, department and location in Profile when they are still empty.
        var p = L.st().profile, filled = false;
        if (p) {
          p.about = p.about || {};
          [['title', a.title], ['dept', a.dept], ['location', a.location]].forEach(function (f) {
            if (f[1] && !p.about[f[0]]) { p.about[f[0]] = f[1]; filled = true; }
          });
          if (filled) L.save();
        }
        toast('Signed in');
      })
      .catch(function (e) { toast((e && e.message) || 'Microsoft sign-in failed.'); })
      .then(function () { busy = false; rerender(); });
  }

  function signOut() {
    setJSON(ACC_KEY, null); setJSON(PEND_KEY, null);
    toast('Signed out'); L.render();
  }

  function card() {
    var a = account();
    if (a) return '<section><h2>Microsoft account</h2><div class="card ms-card">' +
      '<div class="ms-row"><span class="ms-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="ms-who"><b class="notr">' + esc(a.name) + '</b>' +
      '<span class="muted small notr" dir="ltr">' + esc(a.email) + '</span></span></div>' +
      '<p class="muted small" style="margin-top:8px">' + (a.kind === 'personal' ? 'Personal account' : 'Work or school account') +
      '. Only your name and email are kept on this phone.</p>' +
      '<div class="row-btns"><button class="btn ghost" data-act="ms-out">Sign out</button></div></div></section>';
    if (!configured()) return '';
    return '<section><h2>Microsoft account</h2><div class="card ms-card">' +
      '<p class="muted small">Optional. Sign in with your Zain or personal Microsoft account. Zain Life keeps working without it.</p>' +
      '<div class="row-btns"><button class="btn ms-btn" data-act="ms-in"' + (busy ? ' disabled' : '') + '>' +
      '<span class="ms-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + (busy ? 'Signing in…' : 'Sign in with Microsoft') + '</button></div>' +
      (MS() ? '' : '<p class="muted small" style="margin-top:8px">Works in the installed app.</p>') + '</div></section>';
  }

  H.profileTop.push(card);
  H.settings.push(function (group) {
    if (group !== 'general') return '';
    var a = account();
    if (!a && !configured()) return '';
    return '<section><h2>Microsoft account</h2><div class="card"><div class="setrow"><span><span class="st">' + (a ? 'Signed in' : 'Not signed in') + '</span><br>' +
      (a ? '<span class="sd notr" dir="ltr">' + esc(a.email) + '</span>' : '<span class="sd">Optional</span>') + '</span>' +
      '<button class="btn ghost" data-act="pf-open">' + (a ? 'Manage' : 'Sign in') + '</button></div></div></section>';
  });
  A['ms-in'] = function () { if (!busy) signIn(); };
  A['ms-out'] = function (el) { if (L.armed(el, 'Tap again to sign out')) signOut(); };

  var ms = MS();
  if (ms && ms.addListener) ms.addListener('redirect', function (d) { onRedirect(d && d.url); });
  window.ZLMs = { account: account, signIn: signIn, signOut: signOut };
})();
