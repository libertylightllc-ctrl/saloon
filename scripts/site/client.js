/* The home page's small script (website brief 4.1): the visitor's price, today's prices, the phone's sticky bar,
   sideways rows, the video, and the hand-over to the app (salon type and language, as the app stores them).
   window.SQ is written by page.mjs. Everything here is optional: the page works without it. */
(function () {
  var SQ = window.SQ;
  var doc = document.documentElement;
  var store = null;
  try {
    store = window.localStorage;
  } catch (e) {}
  var track = function (name, data) {
    if (window.va) window.va('event', data ? { name: name, data: data } : { name: name });
  };
  var keepLanguage = function (code) {
    try {
      if (store) store.setItem('settings.language', code || SQ.lang);
    } catch (e) {}
  };

  // Where the visitor is: by IP (Vercel's /api/geo), else the time zone guess already made in <head>.
  if (window.fetch && window.AbortController) {
    var stop = new AbortController();
    setTimeout(function () { stop.abort(); }, 1500);
    fetch('/api/geo', { signal: stop.signal })
      .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
      .then(function (g) { if (g && /^[A-Z]{2}$/.test(g.country || '')) doc.setAttribute('data-uae', g.country === 'AE' ? '1' : '0'); })
      .catch(function () {});
  }

  // Today's prices (the terms charge "the price shown on our website"): the page was built with them; if they have
  // changed since, the price texts are written again.
  var money = function (minor, currency) {
    return currency + ' ' + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var fill = function (template, values) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, k) {
      return SQ.rtl ? '⁨' + values[k] + '⁩' : String(values[k]);
    });
  };
  if (SQ.prices && window.fetch) {
    var base = !SQ.supabase || SQ.supabase === 'auto' ? 'http://' + location.hostname + ':54321' : SQ.supabase.replace(/\/$/, '');
    fetch(base + '/rest/v1/platform_settings?select=price_per_branch_minor,currency,intl_price_per_branch_minor,intl_currency,included_people,extra_person_minor,intl_extra_person_minor', { headers: { apikey: SQ.key } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var p = rows && rows[0];
        if (!p || JSON.stringify(p) === JSON.stringify(SQ.prices)) return;
        var sets = {
          uae: { minor: p.price_per_branch_minor, extra: p.extra_person_minor, currency: p.currency },
          intl: { minor: p.intl_price_per_branch_minor, extra: p.intl_extra_person_minor, currency: p.intl_currency },
        };
        document.querySelectorAll('[data-price]').forEach(function (el) {
          var s = sets[el.className];
          if (!s) return;
          var price = money(s.minor, s.currency);
          var extra = money(s.extra, s.currency);
          var perDay = money(Math.ceil(s.minor / 30), s.currency);
          var kind = el.getAttribute('data-price');
          el.textContent = kind === 'price' ? price : fill(SQ.texts[kind], { price: price, extra: extra, people: p.included_people });
        });
        document.querySelectorAll('[data-people]').forEach(function (el) {
          el.textContent = fill(SQ.texts.per, { people: p.included_people });
        });
      })
      .catch(function () {});
  }

  // Someone who already picked a salon type on this device goes straight to the sign-up (as the app's home page).
  var type = store && store.getItem('device.salonType');
  if (['gents', 'ladies', 'unisex', 'wellness'].indexOf(type) >= 0) {
    document.querySelectorAll('[data-start]').forEach(function (a) { a.setAttribute('href', '/sign-up'); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a,button');
    if (!a) return;
    if (a.hasAttribute('data-start')) {
      track('cta_start_free', { position: a.getAttribute('data-start') });
      keepLanguage();
    }
    if (a.hasAttribute('data-event')) track(a.getAttribute('data-event'));
    if (a.hasAttribute('data-type')) {
      try {
        if (store) store.setItem('device.salonType', a.getAttribute('data-type'));
      } catch (err) {}
      keepLanguage();
    }
    if (a.hasAttribute('data-keep-lang')) keepLanguage();
    if (a.hasAttribute('data-lang')) keepLanguage(a.getAttribute('data-lang'));
    if (a.hasAttribute('data-video')) {
      var frame = document.createElement(a.getAttribute('data-kind') === 'file' ? 'video' : 'iframe');
      frame.src = a.getAttribute('data-video');
      if (frame.tagName === 'VIDEO') {
        frame.controls = true;
        frame.autoplay = true;
        frame.playsInline = true;
      } else {
        frame.title = a.getAttribute('data-title');
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
      }
      a.replaceWith(frame);
      track('video_play');
    }
  });

  document.querySelectorAll('details[data-faq]').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('faq_open', { question: d.getAttribute('data-faq') }); });
  });
  // The language menu closes when tapping elsewhere.
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.lang[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });

  // Sideways rows: the dot of the card in view.
  document.querySelectorAll('[data-swipe]').forEach(function (row) {
    var dots = row.parentNode.querySelectorAll('.dots i');
    row.addEventListener('scroll', function () {
      var first = row.children[0];
      var step = first ? first.getBoundingClientRect().width + 12 : 1;
      var index = Math.min(dots.length - 1, Math.round(Math.abs(row.scrollLeft) / step));
      dots.forEach(function (dot, i) { dot.className = i === index ? 'on' : ''; });
    }, { passive: true });
  });

  // The sticky bar (phones): once the hero's button has scrolled away, never over the price or the last call.
  var bar = document.getElementById('sticky');
  var cta = document.getElementById('hero-cta');
  var pricing = document.getElementById('pricing');
  var final = document.getElementById('final');
  var onScreen = function (el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };
  var queued = false;
  var update = function () {
    queued = false;
    var show = window.innerWidth < 640 && cta.getBoundingClientRect().bottom < 0 && !onScreen(pricing) && !onScreen(final);
    if (bar.hidden === show) bar.hidden = !show;
  };
  var later = function () {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  if (bar && cta) {
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    update();
  }
})();
