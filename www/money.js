/* Zain Life — Money tab: monthly income, spending by category, fixed monthly bills, budgets,
   savings rate, and the savings goals (from life.js). Amounts are in the currency set for savings (JOD).
   A tracker for your own numbers, not financial advice. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L || !L.lifeData) return;
  var esc = L.esc, A = L.ACTIONS, toast = L.toast, todayKey = L.todayKey, fromKey = L.fromKey;

  var CATS = [
    ['food', 'Food & groceries'], ['car', 'Car & fuel'], ['bills', 'Bills'], ['family', 'Family'], ['shopping', 'Shopping'],
    ['health', 'Health & gym'], ['fun', 'Going out'], ['giving', 'Charity'], ['business', 'Business costs'], ['loans', 'Loan installments'], ['other', 'Other']
  ];
  var CAT_NAME = {}; CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var INCOME = [['salary', 'Salary'], ['business', 'Side business'], ['gift', 'Gift'], ['other', 'Other income']];
  var IN_NAME = {}; INCOME.forEach(function (c) { IN_NAME[c[0]] = c[1]; });

  function M() {
    var f = L.lifeData();
    var m = f.money = f.money || {};
    if (m.salary == null) m.salary = 0;
    if (m.target == null) m.target = 70;
    m.budgets = m.budgets || {};
    m.tx = Array.isArray(m.tx) ? m.tx : [];
    m.bills = Array.isArray(m.bills) ? m.bills : [];
    m.debts = Array.isArray(m.debts) ? m.debts : [];
    m.plan = m.plan || { cash: null, save: null, cushion: 1000, ret: 0, redirect: true };
    return m;
  }
  function cur() { return (L.lifeData().savings && L.lifeData().savings.cur) || 'JOD'; }
  function amt(n) { return (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + esc(cur()); }
  function monthKey(d) { return d.getFullYear() + '-' + L.pad(d.getMonth() + 1); }
  var viewMonth = null;    // 'YYYY-MM', null = this month
  function curMonth() { return viewMonth || monthKey(L.today()); }
  function monthLabel(k) { var p = k.split('-'); return L.MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function shiftMonth(k, n) { var p = k.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return monthKey(d); }

  // Totals for a month: salary + logged income; bills + logged spending.
  function monthStats(k) {
    var m = M(), inc = +m.salary || 0, spent = 0, byCat = {}, extraIn = 0;
    m.bills.forEach(function (b) { spent += +b.amt; byCat[b.cat || 'bills'] = (byCat[b.cat || 'bills'] || 0) + +b.amt; });
    m.debts.forEach(function (d) {          // loan installments count while the loan runs
      if (!(d.inst > 0) || k < (d.since || '0000-00') || k >= shiftMonth(d.since || monthKey(L.today()), monthsLeft(d))) return;
      spent += +d.inst; byCat.loans = (byCat.loans || 0) + +d.inst;
    });
    m.tx.forEach(function (t) {
      if (t.date.slice(0, 7) !== k) return;
      if (t.type === 'in') { inc += +t.amt; extraIn += +t.amt; }
      else { spent += +t.amt; byCat[t.cat] = (byCat[t.cat] || 0) + +t.amt; }
    });
    return { income: inc, extraIn: extraIn, spent: spent, saved: inc - spent, rate: inc > 0 ? (inc - spent) / inc : null, byCat: byCat };
  }
  function spentOn(k) { var s = 0; M().tx.forEach(function (t) { if (t.date === k && t.type !== 'in') s += +t.amt; }); return s; }

  function renderMoney() {
    var m = M(), k = curMonth(), isNow = k === monthKey(L.today()), st = monthStats(k);
    var nav = '<div class="daynav"><button class="nav" data-act="mo-prev" aria-label="Previous month">‹</button>' +
      '<button class="dl" data-act="mo-now">' + (isNow ? 'This month' : esc(monthLabel(k))) + '</button>' +
      '<button class="nav" data-act="mo-next" aria-label="Next month"' + (isNow ? ' disabled' : '') + '>›</button></div>';

    var rate = st.rate == null ? null : Math.round(st.rate * 100), tgt = +m.target || 0;
    var rateTxt = rate == null ? 'Set your monthly salary below to see your savings rate.' :
      rate >= tgt ? 'On target: you’re saving ' + rate + '% (goal ' + tgt + '%).' : 'You’re saving ' + rate + '% so far (goal ' + tgt + '%).';
    var pctBar = rate == null ? 0 : Math.max(0, Math.min(100, rate));
    var summary = '<div class="card"><div class="kcal"><span class="big">' + amt(Math.max(0, st.saved)) + '</span><span class="of">saved</span></div>' +
      '<div class="track" style="margin-top:10px"><span style="width:' + pctBar + '%"></span></div>' +
      '<p class="muted small" style="margin-top:8px">' + rateTxt + '</p>' +
      '<div class="rs-grid">' + L.statTile('Income', amt(st.income), st.extraIn ? '+' + amt(st.extraIn) + ' extra' : '') +
      L.statTile('Spent', amt(st.spent)) + L.statTile('Savings rate', rate == null ? '—' : rate + '%', 'goal ' + tgt + '%') + '</div>' +
      '<div class="row-btns"><button class="btn" data-act="mo-add" data-type="out">Add spending</button><button class="btn ghost" data-act="mo-add" data-type="in">Add income</button></div></div>';

    // Categories with budgets
    var cats = CATS.filter(function (c) { return st.byCat[c[0]] || m.budgets[c[0]]; }).sort(function (a, b) { return (st.byCat[b[0]] || 0) - (st.byCat[a[0]] || 0); });
    var catHtml = cats.length ? cats.map(function (c) {
      var s = st.byCat[c[0]] || 0, b = +m.budgets[c[0]] || 0, over = b && s > b;
      var w = b ? Math.min(100, (s / b) * 100) : (st.spent ? (s / st.spent) * 100 : 0);
      return '<div class="mo-cat' + (over ? ' over' : '') + '"><div class="mo-cat-h"><span>' + esc(c[1]) + '</span><span>' + amt(s) + (b ? ' <span class="muted">/ ' + amt(b) + '</span>' : '') + '</span></div>' +
        '<div class="track"><span style="width:' + w.toFixed(1) + '%"></span></div></div>';
    }).join('') : '<p class="muted small">Nothing spent yet this month.</p>';
    var catSec = '<section><div class="sec-h"><h2>Where it went</h2><button class="linkbtn" data-act="mo-budgets">Budgets</button></div><div class="card">' + catHtml + '</div></section>';

    // Recent transactions this month
    var tx = m.tx.filter(function (t) { return t.date.slice(0, 7) === k; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var txHtml = tx.length ? '<ul class="loglist">' + tx.slice(0, 40).map(function (t) {
      var name = t.type === 'in' ? IN_NAME[t.cat] || 'Income' : CAT_NAME[t.cat] || 'Other';
      return '<li><span class="ln"><b>' + esc(t.note || name) + '</b><span>' + esc(L.shortDate(t.date)) + (t.note ? ' · ' + esc(name) : '') + '</span></span>' +
        '<span class="lk' + (t.type === 'in' ? ' mo-in' : '') + '">' + (t.type === 'in' ? '+' : '−') + amt(t.amt) + '</span>' +
        '<button class="x" data-act="mo-del" data-id="' + t.id + '" aria-label="Delete">×</button></li>';
    }).join('') + '</ul>' : '<p class="muted small">No entries this month.</p>';
    var txSec = '<section><h2>Entries</h2><div class="card">' + txHtml + '</div></section>';

    // Monthly bills
    var billTotal = 0; m.bills.forEach(function (b) { billTotal += +b.amt; });
    var bills = '<section><div class="sec-h"><h2>Monthly bills</h2><span class="muted">' + amt(billTotal) + '</span></div><div class="card">' +
      (m.bills.length ? '<ul class="loglist">' + m.bills.map(function (b) {
        return '<li><span class="ln"><b>' + esc(b.name) + '</b><span>' + esc(CAT_NAME[b.cat] || 'Bills') + '</span></span><span class="lk">' + amt(b.amt) + '</span>' +
          '<button class="x" data-act="mo-bill-del" data-id="' + b.id + '" aria-label="Delete">×</button></li>';
      }).join('') + '</ul>' : '<p class="muted small">Fixed costs every month, like your phone line, internet, car installment or giving to family. They count automatically each month.</p>') +
      '<div class="row-btns"><button class="btn ghost" data-act="mo-bill-new">Add a bill</button></div></div></section>';

    var settings = '<section><h2>Your numbers</h2><div class="card">' +
      '<label class="setrow"><span><span class="st">Monthly salary</span><br><span class="sd">After deductions</span></span><input type="number" id="mo-salary" inputmode="decimal" min="0" value="' + (m.salary || '') + '" placeholder="' + esc(cur()) + '" style="width:120px"></label>' +
      '<label class="setrow"><span class="st">Savings goal (% of income)</span><input type="number" id="mo-target" inputmode="numeric" min="0" max="100" value="' + tgt + '" style="width:90px"></label></div></section>';

    var setupFirst = !(+m.salary > 0);      // until the salary is set, ask for it right under the summary
    return nav + summary + (setupFirst ? settings : '') + catSec + txSec + bills + (isNow ? debtsSection() + L.savingsSection() : '') + (setupFirst ? '' : settings);
  }
  L.TABS.money = ['Money', renderMoney];

  /* ---------------- add / delete ---------------- */
  var addCtx = null;
  function openAdd() {
    var isIn = addCtx.type === 'in', list = isIn ? INCOME : CATS;
    L.openSheet('<h3>' + (isIn ? 'Add income' : 'Add spending') + '</h3>' +
      '<label class="field"><span>Amount (' + esc(cur()) + ')</span><input type="number" id="mo-amt" inputmode="decimal" min="0" step="0.01" value="' + (addCtx.amt || '') + '"></label>' +
      '<p class="flabel" style="margin-top:14px">Category</p><div class="choice">' + list.map(function (c) {
        return '<button type="button" class="chip' + (addCtx.cat === c[0] ? ' on' : '') + '" data-act="mo-cat" data-v="' + c[0] + '">' + esc(c[1]) + '</button>';
      }).join('') + '</div>' +
      '<label class="field"><span>Note (optional)</span><input id="mo-note" maxlength="60" value="' + esc(addCtx.note || '') + '" placeholder="e.g. Fuel, lunch with friends"></label>' +
      '<label class="field"><span>Date</span><input type="date" id="mo-date" value="' + esc(addCtx.date) + '"></label>' +
      '<div class="row-btns"><button class="btn" data-act="mo-save">Save</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  }
  function keepFields() {
    var a = document.getElementById('mo-amt'), n = document.getElementById('mo-note'), d = document.getElementById('mo-date');
    if (a) addCtx.amt = a.value; if (n) addCtx.note = n.value; if (d) addCtx.date = d.value || addCtx.date;
  }
  A['mo-add'] = function (el) {
    var type = el.getAttribute('data-type');
    addCtx = { type: type, cat: type === 'in' ? 'business' : 'food', date: todayKey() };
    openAdd();
  };
  A['mo-cat'] = function (el) { keepFields(); addCtx.cat = el.getAttribute('data-v'); openAdd(); };
  A['mo-save'] = function () {
    keepFields();
    var v = parseFloat(addCtx.amt);
    if (!(v > 0)) { toast('Enter an amount'); return; }
    M().tx.push({ id: L.uid(), type: addCtx.type, amt: Math.round(v * 1000) / 1000, cat: addCtx.cat, note: (addCtx.note || '').trim(), date: addCtx.date || todayKey() });
    L.save(); L.closeSheet(); L.render();
    toast(addCtx.type === 'in' ? 'Income added' : 'Spending added');
  };
  A['mo-del'] = function (el) {
    if (!L.armed(el, 'Sure?')) return;
    var id = el.getAttribute('data-id'), m = M();
    m.tx = m.tx.filter(function (t) { return t.id !== id; });
    L.save(); L.render();
  };
  A['mo-prev'] = function () { viewMonth = shiftMonth(curMonth(), -1); L.render(); };
  A['mo-next'] = function () { var n = shiftMonth(curMonth(), 1); if (n <= monthKey(L.today())) { viewMonth = n === monthKey(L.today()) ? null : n; L.render(); } };
  A['mo-now'] = function () { viewMonth = null; L.render(); };

  /* ---------------- bills ---------------- */
  A['mo-bill-new'] = function () {
    L.openSheet('<h3>Add a monthly bill</h3><label class="field"><span>Name</span><input id="mb-name" maxlength="40" placeholder="e.g. Internet"></label>' +
      '<label class="field"><span>Amount each month (' + esc(cur()) + ')</span><input type="number" id="mb-amt" inputmode="decimal" min="0" step="0.01"></label>' +
      '<label class="field"><span>Category</span><select id="mb-cat">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === 'bills' ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></label>' +
      '<div class="row-btns"><button class="btn" data-act="mo-bill-save">Add bill</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  };
  A['mo-bill-save'] = function () {
    var n = document.getElementById('mb-name').value.trim(), a = parseFloat(document.getElementById('mb-amt').value);
    if (!n || !(a > 0)) { toast('Enter a name and an amount'); return; }
    M().bills.push({ id: L.uid(), name: n, amt: Math.round(a * 1000) / 1000, cat: document.getElementById('mb-cat').value });
    L.save(); L.closeSheet(); L.render();
  };
  A['mo-bill-del'] = function (el) {
    if (!L.armed(el, 'Sure?')) return;
    var id = el.getAttribute('data-id'), m = M();
    m.bills = m.bills.filter(function (b) { return b.id !== id; });
    L.save(); L.render();
  };

  /* ---------------- budgets ---------------- */
  A['mo-budgets'] = function () {
    var m = M();
    L.openSheet('<h3>Monthly budgets</h3><p class="muted small">Leave a category empty for no budget.</p>' +
      CATS.map(function (c) {
        return '<label class="setrow"><span class="st">' + esc(c[1]) + '</span><input type="number" inputmode="decimal" min="0" data-budget="' + c[0] + '" value="' + (m.budgets[c[0]] || '') + '" placeholder="' + esc(cur()) + '" style="width:110px"></label>';
      }).join('') + '<div class="row-btns"><button class="btn" data-act="mo-budgets-save">Save</button><button class="btn ghost" data-act="close-sheet">Cancel</button></div>');
  };
  A['mo-budgets-save'] = function () {
    var m = M();
    document.querySelectorAll('[data-budget]').forEach(function (i) {
      var v = parseFloat(i.value);
      if (v > 0) m.budgets[i.getAttribute('data-budget')] = v; else delete m.budgets[i.getAttribute('data-budget')];
    });
    L.save(); L.closeSheet(); L.render(); toast('Budgets saved');
  };

  document.addEventListener('change', function (e) {
    var t = e.target, m = M();
    if (t.id === 'mo-salary') { var v = parseFloat(t.value); m.salary = v > 0 ? v : 0; L.save(); L.render(); }
    else if (t.id === 'mo-target') { var p = parseInt(t.value, 10); m.target = p >= 0 && p <= 100 ? p : 70; L.save(); L.render(); }
  });

  /* =====================================================================
     DEBTS + "PAY OFF EARLY?" CALCULATOR
     A month-by-month model: fixed-total loans (Murabaha, car/appliance financing) drop by the
     installment each month; interest loans add rate/12 then subtract the installment.
     Settling early pays the balance minus any refund of unearned profit (or plus a fee).
     ===================================================================== */
  var REFUND = [['quote', 'Bank’s quote'], ['none', 'No refund'], ['even', 'Even refund (estimate)'], ['r78', 'Rule of 78 (estimate)']];
  // Balances at the start of each month (index = payments made) until the loan is paid.
  function schedule(d) {
    var b = +d.balance || 0, inst = +d.inst || 0, r = d.type === 'interest' ? (+d.rate || 0) / 1200 : 0, out = [b], paid = 0;
    if (!(inst > 0)) return { bal: out, paid: 0, n: 0 };
    for (var i = 0; i < 600 && b > 0.005; i++) {
      if (r && inst <= b * r) return { bal: out, paid: Infinity, n: Infinity };     // installment never covers the interest
      var due = b * (1 + r), pay = Math.min(inst, due);
      b = due - pay; paid += pay; out.push(b);
    }
    return { bal: out, paid: paid, n: out.length - 1 };
  }
  function monthsLeft(d) { var s = schedule(d); return isFinite(s.n) ? s.n : 0; }
  // Refund of unearned profit when settling after `s` more payments (fixed-total loans).
  function refundAt(d, s, sch) {
    if (d.type === 'interest') return -(sch.bal[s] * (+d.fee || 0) / 100);          // fee as a negative refund
    var left = sch.n - s, N = +d.totalInst || 0, P = +d.profit || 0;
    if (d.mode === 'none' || left <= 0) return 0;
    if (d.mode === 'quote') return Math.max(0, (+d.quote || 0) * (sch.n ? left / sch.n : 0));
    if (!(N > 0 && P > 0)) return 0;
    var rr = Math.min(left, N);
    return d.mode === 'r78' ? P * (rr * (rr + 1)) / (N * (N + 1)) : P * rr / N;
  }
  function payoffAt(d, s, sch) { return Math.max(0, sch.bal[s] - Math.min(sch.bal[s], refundAt(d, s, sch))); }

  // Cash over time if you keep paying, and if you settle after `s` payments.
  function cashPath(d, sch, s) {
    var P = M().plan, c = +P.cash || 0, save = +P.save || 0, g = (+P.ret || 0) / 1200, out = [c], low = c;
    for (var t = 0; t < sch.n; t++) {
      if (s != null && t === s) { c -= payoffAt(d, s, sch); low = Math.min(low, c); }
      c = c * (1 + g) + save + (s != null && t >= s && P.redirect ? +d.inst : 0);
      out.push(c); low = Math.min(low, c);
    }
    return { path: out, end: c, low: low };
  }
  function analyse(d) {
    var P = M().plan, sch = schedule(d);
    if (!isFinite(sch.n) || !sch.n) return { sch: sch, bad: true };
    var keep = cashPath(d, sch, null), earliest = null;
    for (var s = 0; s < sch.n; s++) {
      if (keep.path[s] - payoffAt(d, s, sch) >= (+P.cushion || 0)) { earliest = s; break; }
    }
    var settle = earliest == null ? null : cashPath(d, sch, earliest);
    return { sch: sch, keep: keep, earliest: earliest, settle: settle, gain: settle ? settle.end - keep.end : 0, payoff: earliest == null ? null : payoffAt(d, earliest, sch) };
  }
  function whenLabel(s) { var d = new Date(L.today().getFullYear(), L.today().getMonth() + s, 1); return L.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function debtsSection() {
    var m = M(), tot = 0, inst = 0;
    var rows = m.debts.map(function (d) {
      var sch = schedule(d), n = sch.n;
      tot += +d.balance || 0; inst += +d.inst || 0;
      return '<li data-act="debt-open" data-id="' + d.id + '" role="button"><span class="ln"><b>' + esc(d.name) + '</b><span>' +
        (isFinite(n) ? n + ' months left · debt-free ' + esc(whenLabel(n)) : 'The installment doesn’t cover the interest') + '</span></span>' +
        '<span class="lk">' + amt(+d.balance || 0) + '<br><span class="muted small">' + amt(+d.inst || 0) + '/mo</span></span></li>';
    }).join('');
    return '<section><div class="sec-h"><h2>Debts</h2>' + (m.debts.length ? '<span class="muted">' + amt(tot) + '</span>' : '') + '</div><div class="card">' +
      (rows ? '<ul class="loglist">' + rows + '</ul><p class="muted small" style="margin-top:8px">' + amt(inst) + ' a month in installments. Tap a debt to see if paying it off early makes sense.</p>' :
        '<p class="muted small">Add a loan to see its debt-free date and whether paying it off early would save you money.</p>') +
      '<div class="row-btns"><button class="btn ghost" data-act="debt-new">Add a debt</button></div></div></section>';
  }

  var debtCtx = null;      // the debt being edited (a copy until saved)
  function num(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }
  function field(id, label, val, hint) {
    return '<label class="field"><span>' + label + '</span><input type="number" inputmode="decimal" id="' + id + '" value="' + (val == null || val === '' ? '' : val) + '">' +
      (hint ? '<small class="muted">' + hint + '</small>' : '') + '</label>';
  }
  function defaultSave() {
    var st = monthStats(shiftMonth(monthKey(L.today()), -1));
    return st.income ? Math.max(0, Math.round(st.saved)) : Math.round((+M().salary || 0) * (+M().target || 70) / 100);
  }
  function openDebt() {
    var d = debtCtx, P = M().plan, fixed = d.type !== 'interest';
    if (P.cash == null) P.cash = 0;
    if (P.save == null) P.save = defaultSave();
    L.openSheet('<h3>' + (d.isNew ? 'Add a debt' : esc(d.name)) + '</h3>' +
      '<label class="field"><span>Name</span><input id="db-name" maxlength="40" value="' + esc(d.name || '') + '" placeholder="e.g. Car loan"></label>' +
      '<p class="flabel" style="margin-top:14px">Type</p><div class="choice">' +
      '<button type="button" class="chip' + (fixed ? ' on' : '') + '" data-act="db-type" data-v="fixed">Fixed total<small>Murabaha, car, appliances</small></button>' +
      '<button type="button" class="chip' + (!fixed ? ' on' : '') + '" data-act="db-type" data-v="interest">Interest on balance<small>Personal loan, mortgage, card</small></button></div>' +
      field('db-balance', 'Amount you still owe (' + esc(cur()) + ')', d.balance) +
      field('db-inst', 'Monthly installment', d.inst) +
      (fixed ? '<p class="flabel" style="margin-top:14px">If you settle early, the bank refunds</p><div class="choice">' + REFUND.map(function (r) {
        return '<button type="button" class="chip' + (d.mode === r[0] ? ' on' : '') + '" data-act="db-mode" data-v="' + r[0] + '">' + esc(r[1]) + '</button>';
      }).join('') + '</div>' +
        (d.mode === 'quote' ? field('db-quote', 'Refund in the bank’s quote, if you settled now', d.quote, 'Ask the bank for a written early-settlement quote.') : '') +
        (d.mode === 'even' || d.mode === 'r78' ? field('db-total', 'Total number of installments in the contract', d.totalInst) +
          field('db-profit', 'Total profit in the contract (' + esc(cur()) + ')', d.profit, 'Total you repay minus the price of what you bought.') : '')
        : field('db-rate', 'Annual interest rate (%)', d.rate) + field('db-fee', 'Early settlement fee (% of balance)', d.fee || 0)) +
      '<p class="flabel" style="margin-top:18px">Your money</p>' +
      field('pl-cash', 'Cash you have now (' + esc(cur()) + ')', P.cash) +
      field('pl-save', 'What you save each month, after this installment', P.save) +
      field('pl-cushion', 'Always keep at least', P.cushion, 'An emergency cushion the plan never touches.') +
      field('pl-ret', 'What your savings earn a year (%)', P.ret, 'Use 0 if the money just sits in your account.') +
      '<div id="db-out" class="db-out">' + debtResult() + '</div>' +
      '<div class="row-btns"><button class="btn" data-act="db-save">' + (d.isNew ? 'Add debt' : 'Save') + '</button>' +
      (d.isNew ? '' : '<button class="btn warn" data-act="db-del">Delete</button>') +
      '<button class="btn ghost" data-act="close-sheet">Close</button></div>' +
      '<p class="muted small" style="margin-top:10px">A planning tool, not financial, legal or religious advice. Refunds are estimates; the bank’s written figures are what count.</p>');
  }
  function readDebt() {
    var d = debtCtx, P = M().plan, v;
    var nm = document.getElementById('db-name'); if (nm) d.name = nm.value;
    [['db-balance', 'balance'], ['db-inst', 'inst'], ['db-quote', 'quote'], ['db-total', 'totalInst'], ['db-profit', 'profit'], ['db-rate', 'rate'], ['db-fee', 'fee']].forEach(function (f) {
      var e = document.getElementById(f[0]); if (e) { v = parseFloat(e.value); d[f[1]] = isNaN(v) ? '' : v; }
    });
    [['pl-cash', 'cash'], ['pl-save', 'save'], ['pl-cushion', 'cushion'], ['pl-ret', 'ret']].forEach(function (f) {
      v = num(f[0]); if (!isNaN(v)) P[f[1]] = v;
    });
  }
  function chart(a) {
    var k = a.keep.path, s = a.settle ? a.settle.path : null, all = k.concat(s || []), lo = Math.min.apply(null, all.concat([0])), hi = Math.max.apply(null, all);
    if (hi - lo < 1) hi = lo + 1;
    var W = 300, Hh = 110, n = k.length - 1 || 1;
    function line(p) { return p.map(function (v, i) { return (i ? 'L' : 'M') + (i / n * W).toFixed(1) + ' ' + (Hh - (v - lo) / (hi - lo) * Hh).toFixed(1); }).join(' '); }
    return '<svg class="db-chart" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" role="img" aria-label="Cash over time">' +
      '<path d="' + line(k) + '" class="l-keep"/>' + (s ? '<path d="' + line(s) + '" class="l-settle"/>' : '') + '</svg>' +
      '<div class="db-legend"><span><i class="k"></i>Keep paying</span>' + (s ? '<span><i class="s"></i>Settle early</span>' : '') + '</div>';
  }
  function debtResult() {
    var d = debtCtx;
    if (!(+d.balance > 0 && +d.inst > 0)) return '<p class="muted small">Enter what you owe and the monthly installment to see your plan.</p>';
    var a = analyse(d), P = M().plan;
    if (a.bad) return '<div class="card warnbox"><b>This installment never pays the loan off.</b><p class="small">At this rate the interest is bigger than the payment. Check the numbers with your bank.</p></div>';
    var cards = '<div class="rs-grid">' +
      L.statTile('Debt-free if you keep paying', esc(whenLabel(a.sch.n)), a.sch.n + ' months') +
      L.statTile('Still to pay', amt(a.sch.paid)) +
      (a.earliest != null ? L.statTile('Earliest you can settle', a.earliest === 0 ? 'Now' : esc(whenLabel(a.earliest)), 'pay ' + amt(a.payoff)) : '') +
      (a.earliest != null ? L.statTile('Settling saves you', amt(Math.max(0, a.gain)), 'by ' + esc(whenLabel(a.sch.n))) : '') + '</div>';
    var verdict;
    if (a.earliest == null) verdict = 'You can’t settle before the loan ends without going below your cushion. Keep paying the installment.';
    else if (a.gain <= 1) verdict = 'Settling early doesn’t save money with these numbers' + (d.type !== 'interest' && d.mode === 'none' ? ', because there’s no refund' : '') + '. Keep paying, unless being debt-free matters more to you than the money.';
    else verdict = (a.earliest === 0 ? 'Settle now' : 'Settle in ' + whenLabel(a.earliest)) + ': it saves about ' + amt(a.gain) + ' by the time the loan would have ended. ' +
      'Your cash would dip to ' + amt(a.settle.low) + ', still above your ' + amt(+P.cushion || 0) + ' cushion' + (P.redirect ? ', and after that the old installment goes into savings.' : '.');
    var ask = d.type === 'interest' ? '' : '<p class="flabel" style="margin-top:14px">Ask your bank</p><p class="small db-ask notr" id="db-ask">' +
      esc(window.I18N && I18N.lang() === 'ar'
        ? 'مرحبًا، أرجو تزويدي بعرض مكتوب للتسديد المبكر لـ ' + (d.name || 'القرض') + ' إذا سددته بالكامل في ' + (a.earliest ? I18N.str(whenLabel(a.earliest)) : 'هذا الشهر') + '، يوضح المبلغ المطلوب بالضبط وأي خصم للأرباح غير المستحقة وأي رسوم. وشكرًا.'
        : 'Hello, I would like a written early-settlement quote for my ' + (d.name || 'loan') + ' if I settle in full in ' + (a.earliest ? whenLabel(a.earliest) : 'this month') + ': the exact amount to pay, any refund of unearned profit, and any fees. Thank you.') +
      '</p><button class="btn ghost" data-act="db-copy">Copy message</button>';
    return '<div class="card" style="margin-top:16px"><span class="lbl">Pay it off early?</span><p style="margin-top:6px"><b>' + verdict + '</b></p>' + cards + chart(a) + ask + '</div>';
  }
  function refreshDebt() { readDebt(); var o = document.getElementById('db-out'); if (o) o.innerHTML = debtResult(); }
  document.addEventListener('input', function (e) { if (e.target.id && /^(db|pl)-/.test(e.target.id) && debtCtx) refreshDebt(); });

  A['debt-new'] = function () { debtCtx = { isNew: true, id: L.uid(), name: '', type: 'fixed', mode: 'quote', since: monthKey(L.today()) }; openDebt(); };
  A['debt-open'] = function (el) {
    var d = M().debts.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (d) { debtCtx = L.clone(d); openDebt(); }
  };
  A['db-type'] = function (el) { readDebt(); debtCtx.type = el.getAttribute('data-v'); openDebt(); };
  A['db-mode'] = function (el) { readDebt(); debtCtx.mode = el.getAttribute('data-v'); openDebt(); };
  A['db-save'] = function () {
    readDebt();
    var d = debtCtx, m = M();
    if (!String(d.name || '').trim() || !(+d.balance > 0) || !(+d.inst > 0)) { toast('Enter a name, the amount owed and the installment'); return; }
    var wasNew = d.isNew; delete d.isNew;
    d.name = d.name.trim();
    if (wasNew) m.debts.push(d); else m.debts = m.debts.map(function (x) { return x.id === d.id ? d : x; });
    debtCtx = null;
    L.save(); L.closeSheet(); L.render(); toast(wasNew ? 'Debt added' : 'Saved');
  };
  A['db-del'] = function (el) {
    if (!L.armed(el, 'Tap again to delete')) return;
    var id = debtCtx.id, m = M();
    m.debts = m.debts.filter(function (x) { return x.id !== id; });
    debtCtx = null; L.save(); L.closeSheet(); L.render();
  };
  A['db-copy'] = function () {
    var t = document.getElementById('db-ask').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('Copied'); }, function () { toast('Could not copy'); });
  };

  /* ---------------- dashboard ---------------- */
  L.HOOKS.dashTiles.push(function () {
    var st = monthStats(monthKey(L.today()));
    if (!st.income && !st.spent) return '';
    var rate = st.rate == null ? null : Math.round(st.rate * 100);
    return L.dashTile('Spent this month', amt(st.spent), rate == null ? '' : 'saving ' + rate + '%', 'money', rate != null && rate < (+M().target || 0) ? 'warn' : '');
  });
  L.HOOKS.dashCards.push(function () {
    var ds = M().debts.filter(function (d) { return +d.balance > 0 && +d.inst > 0; });
    if (!ds.length) return '';
    var last = 0, tot = 0;
    ds.forEach(function (d) { var n = schedule(d).n; if (isFinite(n)) last = Math.max(last, n); tot += +d.balance; });
    return '<section><button class="card dcard" data-tab="money"><span class="lbl">Debts</span><div class="kcal" style="margin-top:4px"><span class="big">' + amt(tot) + '</span><span class="of">left</span></div>' +
      '<p class="muted small" style="margin-top:6px">Debt-free ' + esc(whenLabel(last)) + '</p></button></section>';
  });

  /* ---------------- report + weekly review tiles ---------------- */
  L.weekTiles = function (days) {
    var s = 0; days.forEach(function (d) { s += spentOn(d.k); });
    return s ? L.statTile('Spent', amt(s), 'this week, not counting bills') : '';
  };
  L.HOOKS.reportTiles.push(function (k) {
    var s = spentOn(k);
    return s ? L.statTile('Spent', amt(s)) : '';
  });
})();
