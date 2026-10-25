/* The home page's small script (website brief 4.1; full update brief): the visitor's currency (and the footer's
   AED | USD switch), the price calculator, the menus, sideways rows, the video, the tour, and the hand-over to the app (salon
   type and language, as the app stores them).
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

  // Where the visitor is: by IP (Vercel's /api/geo), else the time zone guess already made in <head> — unless the
  // visitor picked a currency in the footer (remembered; it wins).
  if (!doc.hasAttribute('data-cur') && window.fetch && window.AbortController) {
    var stop = new AbortController();
    setTimeout(function () { stop.abort(); }, 1500);
    fetch('/api/geo', { signal: stop.signal })
      .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
      .then(function (g) {
        if (g && /^[A-Z]{2}$/.test(g.country || '') && !doc.hasAttribute('data-cur')) {
          doc.setAttribute('data-uae', g.country === 'AE' ? '1' : '0');
          calc();
          pictures();
        }
      })
      .catch(function () {});
  }

  // The price calculator (full update brief, Phase 2): branches × (the base for up to N people + each extra person),
  // for the billing length picked, in the visitor's currency.
  var price = function (minor, currency) {
    var whole = minor % 100 === 0;
    return currency + '\u00a0' + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  };
  var fill = function (template, value) {
    return template.replace(/\{\{\s*price\s*\}\}/, SQ.rtl ? '\u2068' + value + '\u2069' : value);
  };
  var form = document.querySelector('[data-calc-form]');
  function calc() {
    if (!form || !SQ.sets) return;
    var set = SQ.sets[doc.getAttribute('data-uae') === '1' ? 'uae' : 'intl'];
    // One branch while salons have one (no branch count on the page).
    var count = form.querySelector('[data-calc="branches"]');
    var branches = count ? Number(count.value) : 1;
    var people = Number(form.querySelector('[data-calc="people"]').value);
    var months = Number(form.querySelector('[data-calc="months"]').value);
    var length = SQ.lengths.filter(function (l) { return l.months === months; })[0] || SQ.lengths[0];
    var monthly = set.base + Math.max(0, people - SQ.people) * set.extra;
    var total = Math.round((branches * monthly * length.payTenths) / 10);
    form.querySelector('[data-calc-total]').textContent = fill(SQ.texts.total, price(total, set.currency));
    form.querySelector('[data-calc-each]').textContent = fill(SQ.texts.perBranch, price(Math.round(total / branches / months), set.currency));
  }
  if (form) {
    form.addEventListener('change', calc);
    form.querySelector('[data-calc="people"]').value = String(SQ.people);
    calc();
  }

  // AED | USD in the footer: overrides where the visitor is, remembered on this device.
  var markCurrency = function () {
    var aed = doc.getAttribute('data-uae') === '1';
    document.querySelectorAll('[data-currency]').forEach(function (b) {
      b.setAttribute('aria-pressed', String((b.getAttribute('data-currency') === 'AED') === aed));
    });
  };
  markCurrency();
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-currency]');
    if (!b) return;
    var cur = b.getAttribute('data-currency');
    doc.setAttribute('data-uae', cur === 'AED' ? '1' : '0');
    doc.setAttribute('data-cur', cur);
    try {
      if (store) store.setItem('sq.currency', cur);
    } catch (err) {}
    markCurrency();
    calc();
    pictures();
    track('currency', { currency: cur });
  });

  // The hero's pictures load at once, so they carry only the visitor's currency set (shots.mjs); this swaps the set.
  function pictures() {
    var cur = doc.getAttribute('data-uae') === '1' ? 'aed' : 'usd';
    document.querySelectorAll('img[data-src]').forEach(function (img) {
      var set = img.getAttribute('data-srcset');
      if (set) img.srcset = set.split('{cur}').join(cur);
      img.src = img.getAttribute('data-src').split('{cur}').join(cur);
    });
  }

  // The pilot (full update, Phase 6; pilot.mjs): the places left from the database, and the application form.
  var pilot = SQ && SQ.pilot;
  var call = function (fn, body) {
    return fetch(pilot.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: pilot.key, Authorization: 'Bearer ' + pilot.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : null; });
  };
  if (pilot && window.fetch) {
    call('pilot_status', {}).then(function (s) {
      if (!s) return;
      var left = Number(s.places_left);
      document.querySelectorAll('[data-pilot-places]').forEach(function (el) {
        el.textContent = (left === 1 ? pilot.texts.placesOne : pilot.texts.placesOther).replace(/\{\{\s*count\s*\}\}/, String(left));
      });
      document.querySelectorAll('[data-pilot-open]').forEach(function (el) { el.hidden = left <= 0; });
      document.querySelectorAll('[data-pilot-full]').forEach(function (el) { el.hidden = left > 0; });
    }).catch(function () {});
  }
  // A UAE number typed the local way (050…, 50…) gets +971; 00 becomes +.
  var phone = function (v) {
    var d = String(v || '').replace(/[^\d+]/g, '');
    if (/^00/.test(d)) return '+' + d.slice(2);
    if (/^0/.test(d)) return '+971' + d.slice(1);
    return d.charAt(0) === '+' ? d : '+971' + d;
  };
  document.querySelectorAll('[data-pilot-form]').forEach(function (form) {
    var out = form.querySelector('[data-pilot-out]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pilot || !form.reportValidity()) return;
      var f = form.elements;
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      call('apply_for_pilot', { p: {
        name: f.name.value.trim(), salon_name: f.salon_name.value.trim(), emirate: f.emirate.value, area: f.area.value.trim(),
        salon_type: f.salon_type.value, staff_count: Number(f.staff_count.value), whatsapp: phone(f.whatsapp.value),
        language: f.language.value, whatsapp_ok: f.whatsapp_ok.checked, website: f.website.value
      } }).then(function (r) {
        if (r && r.ok) {
          out.textContent = pilot.texts.thanks;
          form.querySelectorAll('input, select, button').forEach(function (el) { el.disabled = true; });
          track('pilot_apply');
        } else {
          out.textContent = r && r.reason === 'too_many' ? pilot.texts.tooMany : pilot.texts.error;
          button.disabled = false;
        }
      }).catch(function () {
        out.textContent = pilot.texts.error;
        button.disabled = false;
      });
    });
  });

  // "See how it works": three steps in a dialog (shots.mjs). Without <dialog> the link goes to the features.
  var tour = document.getElementById('tour');
  if (tour && tour.showModal) {
    var steps = tour.querySelectorAll('.tour-step');
    var back = tour.querySelector('[data-tour-back]');
    var next = tour.querySelector('[data-tour-next]');
    var start = tour.querySelector('[data-start="tour"]');
    var at = 0;
    var opener = null;
    var show = function (n, focus) {
      at = Math.max(0, Math.min(steps.length - 1, n));
      var last = at === steps.length - 1;
      steps.forEach(function (s, i) { s.hidden = i !== at; });
      tour.querySelectorAll('.tour-dots i').forEach(function (d, i) { d.className = i === at ? 'on' : ''; });
      back.disabled = at === 0;
      next.hidden = last;
      start.hidden = !last;
      if (focus) (last ? start : next).focus();
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-tour],[data-tour-next],[data-tour-back],[data-tour-close],#tour a[href^="#"]');
      if (!a) return;
      if (a.hasAttribute('data-tour')) {
        e.preventDefault();
        opener = a;
        // All three steps' pictures in the visitor's set, so the next step shows at once.
        tour.querySelectorAll(doc.getAttribute('data-uae') === '1' ? 'img.uae' : 'img.intl').forEach(function (img) { img.loading = 'eager'; });
        show(0);
        tour.showModal();
        next.focus();
        track('tour_open');
      } else if (a.hasAttribute('data-tour-next')) show(at + 1, true);
      else if (a.hasAttribute('data-tour-back')) show(at - 1, true);
      else tour.close();
    });
    tour.addEventListener('keydown', function (e) {
      var ahead = doc.getAttribute('dir') === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      var behind = ahead === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === ahead) show(at + 1, true);
      else if (e.key === behind) show(at - 1, true);
    });
    // A tap on the dimmed page around it closes it too (Esc is the dialog's own).
    tour.addEventListener('click', function (e) { if (e.target === tour) tour.close(); });
    tour.addEventListener('close', function () { if (opener) opener.focus(); });
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
  // The language menu and the header's menu close when tapping elsewhere, and the menu after following a link.
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.lang[open], details.menu[open]').forEach(function (d) {
      if (!d.contains(e.target) || (e.target.closest && e.target.closest('details.menu a'))) d.open = false;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('details.lang[open], details.menu[open]').forEach(function (d) { d.open = false; });
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

})();
