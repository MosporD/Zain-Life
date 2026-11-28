/* Zain Life: wellbeing tips. A small offline bank of mind and body tips (English + Arabic), which tip
   to show when, and when in the day the tip reminders go off. No DOM or native calls here:
   wellbeing.js draws the Today card and settings and hands the reminders to app.js.
   Tips are general habits, not medical advice. Also loads in Node for tests.
   Tags: desk = only while at work, fast = hidden while fasting in Ramadan (food and drink),
   night = only in the evening (sleep habits). */
(function (root) {
  'use strict';
  var U = typeof module !== 'undefined' && module.exports ? require('./util.js') : root.ZLUtil;
  var toMin = U.toMin, dateKey = U.dateKey, addDays = U.addDays;

  // [id, category, tags, English title, English text, Arabic title, Arabic text]
  var BANK = [
    ['m1', 'mind', '', 'Box breathing', 'Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat four times.',
      'التنفس المربع', 'شهيق لأربع ثوانٍ، احبس أربعًا، زفير لأربع، واحبس أربعًا. كرّر ذلك أربع مرات.'],
    ['m2', 'mind', '', 'A longer breath out', 'Breathe in for 4 and out for 6, five times. A slow breath out helps your body settle.',
      'زفير أطول', 'شهيق لأربع ثوانٍ وزفير لست، خمس مرات. الزفير البطيء يساعد جسمك على الهدوء.'],
    ['m3', 'mind', '', 'Three good things', 'Write down three things that went well today, however small.',
      'ثلاثة أشياء جيدة', 'اكتب ثلاثة أشياء جرت بشكل جيد اليوم، مهما كانت صغيرة.'],
    ['m4', 'mind', '', 'One quiet minute', 'Close your eyes for one minute and just notice your breathing.',
      'دقيقة هادئة', 'أغمض عينيك لدقيقة واحدة ولاحظ تنفسك فقط.'],
    ['m5', 'mind', '', 'How are you, really?', 'Take a moment to name how you feel. Naming a feeling makes it easier to handle.',
      'كيف حالك فعلًا؟', 'خذ لحظة لتسمّي ما تشعر به. تسمية الشعور تجعل التعامل معه أسهل.'],
    ['m6', 'mind', '', 'Say thank you', 'Send a short thank-you message to someone who helped you this week.',
      'قل شكرًا', 'أرسل رسالة شكر قصيرة لشخص ساعدك هذا الأسبوع.'],
    ['m7', 'mind', 'desk', 'One thing at a time', 'Pick one task and close everything else for the next 25 minutes.',
      'شيء واحد في كل مرة', 'اختر مهمة واحدة وأغلق كل ما عداها خلال الدقائق الخمس والعشرين القادمة.'],
    ['m8', 'mind', '', 'Step outside', 'Five minutes of fresh air and daylight can lift your mood and your focus.',
      'اخرج قليلًا', 'خمس دقائق من الهواء الطلق وضوء النهار قد تحسّن مزاجك وتركيزك.'],
    ['m9', 'mind', '', 'Call someone', 'Call a friend or someone in your family, just to ask how they are.',
      'اتصل بأحدهم', 'اتصل بصديق أو بأحد من عائلتك، فقط لتسأل عن حاله.'],
    ['m10', 'mind', '', '5, 4, 3, 2, 1', 'Notice 5 things you see, 4 you hear, 3 you can touch, 2 you smell and 1 you taste.',
      '5، 4، 3، 2، 1', 'لاحظ 5 أشياء تراها، و4 تسمعها، و3 تلمسها، و2 تشمّها، وواحدًا تتذوقه.'],
    ['m11', 'mind', '', 'Empty your head', 'If your mind feels busy, write every worry on paper. It does not need solving right now.',
      'أفرغ ذهنك', 'إن شعرت بازدحام أفكارك، اكتب كل ما يقلقك على ورقة. لا داعي لحلّه الآن.'],
    ['m12', 'mind', '', 'Be kind to yourself', 'Talk to yourself the way you would talk to a good friend.',
      'كن لطيفًا مع نفسك', 'تحدث إلى نفسك كما تتحدث إلى صديق عزيز.'],
    ['m13', 'mind', '', 'Something to look forward to', 'Plan one small thing to enjoy this week.',
      'شيء تنتظره', 'خطّط لشيء صغير تستمتع به هذا الأسبوع.'],
    ['m14', 'mind', 'desk', 'Breaks are part of the work', 'Step away from the screen for a few minutes. You will come back sharper.',
      'الاستراحة جزء من العمل', 'ابتعد عن الشاشة لبضع دقائق. ستعود بتركيز أفضل.'],
    ['m15', 'mind', 'desk', 'Set a finish line', 'Decide when your workday ends today, and stop at that time.',
      'حدّد خط النهاية', 'قرّر متى ينتهي يوم عملك اليوم، وتوقف عند ذلك الوقت.'],
    ['m16', 'mind', '', 'Notice something good', 'Look around and find one thing you like about where you are right now.',
      'لاحظ شيئًا جميلًا', 'انظر حولك وابحث عن شيء واحد يعجبك في المكان الذي أنت فيه الآن.'],
    ['m17', 'mind', '', 'A small kindness', 'Help someone with something small today. Kindness lifts both sides.',
      'لطف صغير', 'ساعد أحدهم في أمر بسيط اليوم. اللطف يُسعد الطرفين.'],
    ['m18', 'mind', 'night', 'Phone away before sleep', 'Put your phone away 30 minutes before sleep and let your mind slow down.',
      'الهاتف بعيدًا قبل النوم', 'ضع هاتفك جانبًا قبل النوم بثلاثين دقيقة ودع ذهنك يهدأ.'],
    ['m19', 'mind', 'night', 'Park tomorrow', 'Write tomorrow’s top three tasks now, so your mind can rest tonight.',
      'جهّز الغد', 'اكتب أهم ثلاث مهام للغد الآن، ليرتاح ذهنك الليلة.'],
    ['m20', 'mind', '', 'It is fine to ask', 'Feeling stuck or overwhelmed? Talking to someone you trust is a strength.',
      'لا بأس أن تطلب المساعدة', 'تشعر بالضغط أو أنك عالق؟ الحديث مع شخص تثق به قوة لا ضعف.'],
    ['m21', 'mind', '', 'Drop your shoulders', 'Notice your jaw and shoulders. Let them drop and relax.',
      'أرخِ كتفيك', 'انتبه إلى فكّك وكتفيك. دعهما ينخفضان ويرتخيان.'],
    ['m22', 'mind', '', 'Count what you did', 'Look at what you finished today, not only at what is left.',
      'انظر إلى ما أنجزته', 'انظر إلى ما أنهيته اليوم، لا إلى ما تبقّى فقط.'],

    ['b1', 'body', 'desk', 'Rest your eyes: 20-20-20', 'Every 20 minutes, look at something 6 metres away for 20 seconds.',
      'أرح عينيك: 20-20-20', 'كل 20 دقيقة، انظر إلى شيء على بعد 6 أمتار لمدة 20 ثانية.'],
    ['b2', 'body', 'desk', 'Check how you sit', 'Feet flat, back against the chair, screen at eye level.',
      'راجع جلستك', 'القدمان على الأرض، الظهر مستند إلى الكرسي، والشاشة بمستوى العينين.'],
    ['b3', 'body', 'desk', 'Stand up for 2 minutes', 'Stand and move for two minutes. Sitting still for long is hard on your back.',
      'قف لدقيقتين', 'قف وتحرك لدقيقتين. الجلوس الطويل دون حركة متعب لظهرك.'],
    ['b4', 'body', '', 'Neck stretch', 'Slowly tilt your ear toward your shoulder, hold for 15 seconds, then switch sides.',
      'تمدد الرقبة', 'أمِل أذنك ببطء نحو كتفك، اثبت 15 ثانية، ثم بدّل الجهة.'],
    ['b5', 'body', '', 'Shoulder rolls', 'Roll your shoulders back 10 times, then forward 10 times.',
      'تدوير الكتفين', 'دوّر كتفيك للخلف 10 مرات، ثم للأمام 10 مرات.'],
    ['b6', 'body', 'fast', 'Drink some water', 'Have a glass of water now. Thirst can feel like tiredness.',
      'اشرب بعض الماء', 'اشرب كوبًا من الماء الآن. العطش قد يبدو كأنه تعب.'],
    ['b7', 'body', '', 'Take the stairs', 'Use the stairs instead of the lift on your next trip.',
      'استخدم الدرج', 'استخدم الدرج بدل المصعد في المرة القادمة.'],
    ['b8', 'body', 'desk', 'Walk and talk', 'Take your next phone call standing up or walking.',
      'امشِ وأنت تتحدث', 'أجب على مكالمتك القادمة وأنت واقف أو تمشي.'],
    ['b9', 'body', 'desk', 'Wrist stretch', 'Stretch an arm forward and gently pull your fingers back for 15 seconds. Then the other hand.',
      'تمدد المعصم', 'مدّ ذراعك للأمام واسحب أصابعك للخلف بلطف لمدة 15 ثانية. ثم اليد الأخرى.'],
    ['b10', 'body', '', 'A 10-minute walk', 'A short walk clears your head and adds to your steps.',
      'مشي 10 دقائق', 'المشي القصير يصفّي ذهنك ويزيد خطواتك.'],
    ['b11', 'body', '', 'Walk after you eat', 'A gentle walk after a meal helps you feel lighter.',
      'امشِ بعد الأكل', 'المشي الخفيف بعد الوجبة يساعدك على الشعور بالخفة.'],
    ['b12', 'body', 'fast', 'Smarter snack', 'Hungry between meals? Fruit, nuts or yoghurt beat sweets.',
      'وجبة خفيفة أذكى', 'جائع بين الوجبات؟ الفاكهة أو المكسرات أو اللبن أفضل من الحلويات.'],
    ['b13', 'body', 'desk', 'Blink slowly', 'We blink less at screens. Blink slowly 10 times to refresh your eyes.',
      'ارمش ببطء', 'نرمش أقل أمام الشاشات. ارمش ببطء 10 مرات لتنعش عينيك.'],
    ['b14', 'body', '', 'Back stretch', 'Stand, put your hands on your lower back and gently lean back for 10 seconds.',
      'تمدد الظهر', 'قف، ضع يديك أسفل ظهرك، ومِل للخلف بلطف لمدة 10 ثوانٍ.'],
    ['b15', 'body', '', 'Calf raises', 'Rise up on your toes 15 times. Good for your legs after long sitting.',
      'رفع الكعبين', 'ارتفع على أطراف أصابعك 15 مرة. مفيد لساقيك بعد الجلوس الطويل.'],
    ['b16', 'body', '', 'Get some daylight', 'Daylight during the day helps your body clock and your sleep at night.',
      'تعرّض لضوء النهار', 'ضوء النهار يساعد ساعة جسمك ونومك في الليل.'],
    ['b17', 'body', 'night', 'Same sleep, same wake', 'Try to sleep and wake at the same times every day, weekends too.',
      'نوم واستيقاظ ثابت', 'حاول أن تنام وتستيقظ في الأوقات نفسها كل يوم، حتى في العطلة.'],
    ['b18', 'body', 'night', 'Dim the lights', 'Dim the lights an hour before bed to help your body get ready for sleep.',
      'خفّف الإضاءة', 'خفّف الإضاءة قبل النوم بساعة لتساعد جسمك على الاستعداد للنوم.'],
    ['b19', 'body', 'fast desk', 'Keep water in sight', 'Put a water bottle on your desk where you can see it.',
      'الماء أمام عينيك', 'ضع قارورة ماء على مكتبك في مكان تراه.'],
    ['b20', 'body', '', 'Open your chest', 'Clasp your hands behind your back and gently open your chest for 15 seconds.',
      'افتح صدرك', 'شبّك يديك خلف ظهرك وافتح صدرك بلطف لمدة 15 ثانية.'],
    ['b21', 'body', 'fast', 'Eat slowly', 'Put the phone away at meals and eat slowly. Feeling full takes about 20 minutes.',
      'كُل ببطء', 'أبعد الهاتف أثناء الأكل وكُل ببطء. الشعور بالشبع يحتاج نحو 20 دقيقة.'],
    ['b22', 'body', 'desk', 'Move every hour', 'Once an hour, stand up, stretch your arms up high and take a few steps.',
      'تحرّك كل ساعة', 'مرة كل ساعة، قف ومدّ ذراعيك للأعلى وامشِ بضع خطوات.']
  ];
  var TIPS = BANK.map(function (r) { return { id: r[0], cat: r[1], tags: r[2] ? r[2].split(' ') : [], title: r[3], text: r[4] }; });
  var BY_ID = {};
  TIPS.forEach(function (t) { BY_ID[t.id] = t; });

  // Arabic for i18n.js: the English title and text are the keys.
  var AR = {
    'Tip for your mind': 'نصيحة لعقلك', 'Tip for your body': 'نصيحة لجسمك',
    'A minute for your mind': 'دقيقة لعقلك', 'A minute for your body': 'دقيقة لجسمك',
    'Another tip': 'نصيحة أخرى', 'Done it': 'فعلتها', 'Nice one. Back to your day.': 'أحسنت. عُد إلى يومك.',
    'Hide tips': 'إخفاء النصائح',
    'Wellbeing tips': 'نصائح العافية',
    'Tip card on Today': 'بطاقة نصيحة في اليوم',
    'A short mind or body tip on the Today screen and the dashboard': 'نصيحة قصيرة للعقل أو الجسم في شاشة اليوم ولوحة المتابعة',
    'Mind tips': 'نصائح للعقل', 'Breathing, breaks, gratitude, people': 'التنفس، الاستراحات، الامتنان، الناس',
    'Body tips': 'نصائح للجسم', 'Posture, stretches, eyes, water, sleep': 'الجلسة، التمدد، العينان، الماء، النوم',
    'Tip reminders': 'تذكير بالنصائح', 'Off': 'إيقاف', '1 a day': 'مرة يوميًا', '2 a day': 'مرتان يوميًا', '3 a day': '3 مرات يوميًا',
    'Body tips come during work hours, mind tips in the evening. Never while you sleep, pray or focus.': 'نصائح الجسم تأتي في ساعات العمل، ونصائح العقل في المساء. أبدًا أثناء النوم أو الصلاة أو التركيز.',
    'Food and water tips pause while you fast in Ramadan.': 'نصائح الأكل والماء تتوقف أثناء الصيام في رمضان.',
    'General habits, not medical advice.': 'عادات عامة، وليست نصيحة طبية.',
    'Tip reminders on': 'تذكير النصائح مفعّل', 'Tip reminders off': 'تذكير النصائح متوقف',
    'Tips done': 'نصائح منجزة',
    'Tips hidden. Turn them back on in Settings > Health.': 'تم إخفاء النصائح. أعد تشغيلها من الإعدادات > الصحة.'
  };
  BANK.forEach(function (r) { AR[r[3]] = r[5]; AR[r[4]] = r[6]; AR[r[3] + ' · ' + r[4]] = r[5] + ' · ' + r[6]; });

  function dayNum(d) { return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000); }

  // The tips that fit a moment. c: { cat, atWork, evening, fasting }
  function pool(c) {
    return TIPS.filter(function (t) {
      if (t.cat !== c.cat) return false;
      if (t.tags.indexOf('desk') >= 0 && !c.atWork) return false;
      if (t.tags.indexOf('night') >= 0 && !c.evening) return false;
      if (t.tags.indexOf('fast') >= 0 && c.fasting) return false;
      return true;
    });
  }
  // A steady pick: the same day, slot and context always give the same tip; the next day moves on.
  // n shifts to the next tip in line ("Another tip").
  function pick(c, d, slot, n) {
    var p = pool(c);
    if (!p.length) return null;
    var i = (dayNum(d) * 3 + (slot || 0) + (n || 0)) % p.length;
    return p[(i + p.length) % p.length];
  }

  // Which category a day's single card (or 1-a-day reminder) uses: alternates by day, honouring the switches.
  function catFor(d, o, slot) {
    if (!o.mind && !o.body) return null;
    if (!o.mind) return 'body';
    if (!o.body) return 'mind';
    return (dayNum(d) + (slot || 0)) % 2 ? 'mind' : 'body';
  }

  // The waking day and work hours from the plan's blocks (minutes of the day).
  function dayShape(blocks) {
    var wake = null, bed = null, ws = null, we = null;
    blocks.forEach(function (b) {
      var s = toMin(b.start), e = toMin(b.end);
      if (b.cat === 'sleep') {
        if (/^Sleep/.test(b.title) && s < e && e >= 3 * 60 && e <= 16 * 60) wake = Math.max(wake || 0, e);
        if (s >= 17 * 60 && (bed == null || s < bed)) bed = s;
      } else if (b.cat === 'work' && !b.overlay) {
        if (ws == null || s < ws) ws = s;
        if (we == null || (e > s ? e : 1440) > we) we = e > s ? e : 1440;
      }
    });
    if (wake == null) {
      blocks.forEach(function (b) { var s = toMin(b.start); if (b.cat !== 'sleep' && s >= 4 * 60 && (wake == null || s < wake)) wake = s; });
    }
    if (wake == null) wake = 7 * 60;
    if (bed == null || bed <= wake + 6 * 60) bed = 23 * 60;
    var work = ws != null && we - ws >= 4 * 60 && ws >= wake - 60 && we <= bed ? [ws, we] : null;
    return { wake: wake, bed: bed, work: work };
  }

  // Slots for a day: [minute, category, atWork]. Body tips sit inside work hours (that is where sitting
  // and screens are), mind tips in the evening; on days off they spread across the waking day.
  function slotsFor(shape, perDay) {
    var w = shape.work, a = shape.wake, z = shape.bed, len = z - a, out;
    var eve = Math.max(a + 60, Math.min(z - 150, w ? Math.max(w[1] + 90, z - 180) : z - 150));
    if (w) {
      var wl = w[1] - w[0];
      if (perDay === 1) out = [[w[0] + Math.round(wl * 0.5), 'auto', true]];
      else if (perDay === 2) out = [[w[0] + Math.round(wl * 0.45), 'body', true], [eve, 'mind', false]];
      else out = [[w[0] + 120, 'body', true], [w[0] + Math.round(wl * 0.7), 'mind', true], [eve, 'mind', false]];
    } else {
      if (perDay === 1) out = [[a + Math.round(len * 0.4), 'auto', false]];
      else if (perDay === 2) out = [[a + Math.round(len * 0.3), 'body', false], [eve, 'mind', false]];
      else out = [[a + Math.round(len * 0.25), 'body', false], [a + Math.round(len * 0.5), 'body', false], [eve, 'mind', false]];
    }
    return out;
  }

  // Moves a minute out of the way of busy times: block starts (to sit apart from task reminders),
  // prayers and meetings ([start, end] minutes), and the round :00 / :15 / :30 / :45.
  function dodge(m, busy) {
    if (m % 15 === 0) m += 7;
    for (var tries = 0; tries < 8; tries++) {
      var hit = null;
      busy.forEach(function (b) { if (m >= b[0] - 10 && m < b[1] + 10) hit = b; });
      if (!hit) return m;
      m = hit[1] + 12;
    }
    return m;
  }

  // The week's tip reminders. o: { start (Date, midnight today), now (ms), perDay, mind, body,
  //   blocksFor(date), busyFor(date) -> [[startMin, endMin]], fastFor(date) -> [fajrMin, maghribMin] or null }
  // IDs 7000 + day*5 + slot.
  function build(o) {
    var list = [];
    if (!(o.perDay > 0) || (!o.mind && !o.body)) return list;
    for (var off = 0; off < 7; off++) {
      var d = addDays(o.start, off), shape = dayShape(o.blocksFor(d)), busy = o.busyFor ? o.busyFor(d) : [], fast = o.fastFor ? o.fastFor(d) : null;
      var used = {};
      slotsFor(shape, Math.min(3, o.perDay)).forEach(function (s, i) {
        var m = dodge(s[0], busy);
        if (m >= shape.bed - 15 || m >= 1440) return;
        var cat = s[1] === 'auto' ? catFor(d, o, 0) : (o[s[1]] ? s[1] : (o.mind ? 'mind' : 'body'));
        var c = { cat: cat, atWork: s[2], evening: m >= 18 * 60, fasting: !!(fast && m >= fast[0] && m < fast[1]) };
        var t = pick(c, d, i), n = 0;
        while (t && used[t.id] && n < 5) t = pick(c, d, i, ++n);
        if (!t) return;
        used[t.id] = 1;
        var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
        if (at.getTime() <= o.now + 30000) return;
        list.push({ id: 7000 + off * 5 + i, channelId: 'wellbeing', title: cat === 'mind' ? 'A minute for your mind' : 'A minute for your body',
          body: t.title + ' · ' + t.text, extra: { type: 'tip', tip: t.id, date: dateKey(d) }, schedule: { at: at, allowWhileIdle: true } });
      });
    }
    return list;
  }

  var api = { TIPS: TIPS, byId: function (id) { return BY_ID[id] || null; }, AR: AR, pool: pool, pick: pick, catFor: catFor,
    dayShape: dayShape, slotsFor: slotsFor, dodge: dodge, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZLTips = api;
})(this);
