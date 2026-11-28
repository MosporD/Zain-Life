/* Health → Mental and Health → Spiritual.
   Mental: focus and screen time at a glance (the mood log comes from today.js) and short mind guides.
   Spiritual: faith time done this week (Faith and Ramadan come from life.js) and a one-line daily
   reflection, kept in the day record as `grat`. Arabic for the new text is merged into AR_DICT here. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var H = L.HOOKS, esc = L.esc;

  function sec(title, body) { return '<section><div class="sec-h"><h2>' + title + '</h2></div>' + body + '</section>'; }
  function lastDays(n) { var t = L.today(), out = []; for (var i = 0; i < n; i++) out.push(L.dateKey(L.addDays(t, -i))); return out; }

  /* ---------------- Mental ---------------- */
  function focusCard() {
    var k = L.todayKey(), rec = L.peekDay(k), lim = +L.st().settings.limit || 30, week = 0, urges = 0;
    lastDays(7).forEach(function (d) { var r = L.peekDay(d); week += +r.focus || 0; urges += +r.urges || 0; });
    var tiles = L.statTile('Focused today', rec.focus ? L.fmtDur(rec.focus) : '0m') +
      L.statTile('Focused this week', week ? L.fmtDur(week) : '0m', 'last 7 days') +
      L.statTile('Social media today', rec.screen != null ? rec.screen + ' min' : '–', 'limit ' + lim + ' min') +
      L.statTile('Urges beaten', urges, 'last 7 days');
    return sec('Focus and screen time', '<div class="card"><div class="rs-grid" style="margin-top:0">' + tiles + '</div>' +
      '<div class="row-btns"><button class="btn ghost" data-tab="focus">Open Focus</button></div></div>');
  }
  function mindGuides() {
    return sec('Look after your mind',
      L.acc('When stress builds up', L.ul(['Breathe in for 4 seconds and out for 6, five times.', 'Name what is bothering you in one line. Writing it down makes it smaller.', 'Step outside for a 5-minute walk.'])) +
      L.acc('Sleep and your mood', L.ul(['A short night makes everything feel heavier. Protect 7 hours.', 'Put the phone away 30 minutes before bed.', 'Get daylight in the first hour after waking.'])) +
      L.acc('Talk to someone', L.ul(['Tell a friend or family member how you really are this week.', 'If you have felt low for more than two weeks, talk to a doctor. It is a health check like any other.'])));
  }
  H.healthMental.push(function () { return focusCard() + mindGuides(); });

  /* ---------------- Spiritual ---------------- */
  // Faith blocks in the plan this week (Quran, Bible reading, church), not counting the five prayers,
  // which have their own streaks.
  function faithWeek() {
    var t = L.today(), s = L.addDays(t, -t.getDay()), planned = 0, done = 0;
    for (var i = 0; i < 7; i++) {
      var d = L.addDays(s, i), rec = L.peekDay(L.dateKey(d));
      L.blocksForDate(d).forEach(function (b) {
        if (b.cat !== 'faith' || b.prayer) return;
        planned++; if (rec.done[b.id]) done++;
      });
    }
    return { planned: planned, done: done };
  }
  function faithTimeCard() {
    var w = faithWeek();
    if (!w.planned) return '';
    var pct = Math.round(w.done * 100 / w.planned);
    return sec('Faith time this week', '<div class="card"><div class="kcal"><span class="big">' + w.done + '/' + w.planned + '</span><span class="of">faith blocks done in your plan</span></div>' +
      '<div class="track" style="margin-top:8px"><span style="width:' + pct + '%"></span></div></div>');
  }
  function reflectionCard() {
    var k = L.todayKey(), rec = L.peekDay(k);
    var rows = lastDays(7).slice(1).map(function (d) { var r = L.peekDay(d); return r.grat ? '<li><span class="muted small">' + esc(L.shortDate(d)) + '</span><span class="notr">' + esc(r.grat) + '</span></li>' : ''; }).join('');
    return sec('Reflection', '<div class="card"><label class="field"><span>One good thing about today</span>' +
      '<input type="text" id="grat-today" maxlength="200" placeholder="A person, a moment, something small" value="' + esc(rec.grat || '') + '"></label>' +
      (rows ? '<p class="flabel" style="margin-top:14px">Your last 7 days</p><ul class="loglist grat-list">' + rows + '</ul>' : '<p class="muted small" style="margin-top:8px">Nothing written yet. One line a day is enough.</p>') + '</div>');
  }
  H.healthSpiritual.push(function () { return faithTimeCard() + reflectionCard(); });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id !== 'grat-today') return;
    var r = L.dayRec(L.todayKey()), v = t.value.trim();
    if (v) r.grat = v; else delete r.grat;
    L.save(); L.toast('Saved');
  });

  /* ---------------- Arabic ---------------- */
  var AR = {
    'Physical': 'الجسدية', 'Mental': 'النفسية', 'Spiritual': 'الروحية',
    'Focus and screen time': 'التركيز ووقت الشاشة', 'Focused today': 'تركيز اليوم', 'Focused this week': 'تركيز الأسبوع',
    'Social media today': 'التواصل الاجتماعي اليوم', 'Urges beaten': 'رغبات تغلبت عليها', 'last 7 days': 'آخر 7 أيام', 'Open Focus': 'افتح التركيز',
    'Look after your mind': 'اعتنِ بعقلك', 'When stress builds up': 'عندما يتراكم التوتر', 'Sleep and your mood': 'النوم ومزاجك', 'Talk to someone': 'تحدّث مع أحد',
    'Breathe in for 4 seconds and out for 6, five times.': 'خذ شهيقًا لمدة 4 ثوانٍ وزفيرًا لمدة 6، خمس مرات.',
    'Name what is bothering you in one line. Writing it down makes it smaller.': 'سمِّ ما يزعجك في سطر واحد. الكتابة تجعله أصغر.',
    'Step outside for a 5-minute walk.': 'اخرج وامشِ 5 دقائق.',
    'A short night makes everything feel heavier. Protect 7 hours.': 'الليلة القصيرة تجعل كل شيء أثقل. احمِ 7 ساعات من النوم.',
    'Put the phone away 30 minutes before bed.': 'ضع الهاتف جانبًا قبل النوم بـ 30 دقيقة.',
    'Get daylight in the first hour after waking.': 'تعرّض لضوء النهار في الساعة الأولى بعد الاستيقاظ.',
    'Tell a friend or family member how you really are this week.': 'أخبر صديقًا أو أحد أفراد عائلتك كيف حالك فعلًا هذا الأسبوع.',
    'If you have felt low for more than two weeks, talk to a doctor. It is a health check like any other.': 'إذا شعرت بالإحباط لأكثر من أسبوعين، تحدّث مع طبيب. إنه فحص صحي مثل أي فحص آخر.',
    'Faith time this week': 'وقت العبادة هذا الأسبوع', 'faith blocks done in your plan': 'من أوقات العبادة في خطتك منجزة',
    'Reflection': 'تأمّل', 'One good thing about today': 'شيء جميل حدث اليوم', 'A person, a moment, something small': 'شخص، لحظة، شيء صغير',
    'Your last 7 days': 'آخر 7 أيام', 'Nothing written yet. One line a day is enough.': 'لم تكتب شيئًا بعد. سطر واحد في اليوم يكفي.'
  };
  if (window.AR_DICT) Object.keys(AR).forEach(function (k) { if (!window.AR_DICT[k]) window.AR_DICT[k] = AR[k]; });
})();
