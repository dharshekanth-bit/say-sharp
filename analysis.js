/* Say Sharp — speech analysis engine (pure functions, no DOM) */
(function (root) {
  'use strict';

  var DEFAULT_FILLERS = ['um', 'uh', 'uhm', 'umm', 'er', 'erm', 'ah', 'hmm', 'mm',
    'so', 'actually', 'basically', 'literally', 'like', 'you know', 'i mean', 'you see'];
  var DEFAULT_SOFTENERS = ['just', 'i think', 'maybe', 'probably', 'i guess', 'kind of',
    'sort of', 'i feel like', 'a little bit', 'a bit'];

  var STOP = new Set(('a an the and or but if then of to in on at for with from by is are was were be been ' +
    'it its this that these those i we you he she they me us him her them my our your their ' +
    'do does did have has had will would can could should not no yes there here what which who ' +
    'as up out about into so just also very really').split(' '));

  // "so" is fine in these spots: "so much", "so that", "or so", "I think so"
  var SO_OK_NEXT = new Set(('much many far that long good bad well often quickly hard big important sorry ' +
    'nice glad happy busy few little high low late early close fast slow simple easy difficult tired').split(' '));
  var SO_OK_PREV = new Set('or think hope said guess believe do did not if'.split(' '));
  // "like" is fine after these: "I like", "would like", "looks like"
  var LIKE_OK_PREV = new Set(('i you we they would d look looks looked feel feels felt seem seems seemed sound ' +
    'sounds sounded something anything nothing don\'t didn\'t do does did really also just exactly more ' +
    'most much things thing people not').split(' '));
  var LIKE_OK_NEXT = new Set('to a an the this that it him her them me you us these those'.split(' '));
  var YK_OK_PREV = new Set('do did if would don\'t didn\'t you\'d'.split(' '));
  var DUP_OK = new Set('had that very bye no yes ha'.split(' '));

  function norm(w) {
    return String(w).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '');
  }
  function tokenize(text) {
    var raw = String(text || '').split(/\s+/).filter(Boolean);
    return raw.map(function (r) { return { raw: r, w: norm(r), tag: null }; }).filter(function (t) { return t.w; });
  }
  function phraseList(list) {
    return list.map(function (p) { return { p: p, parts: p.split(/\s+/).map(norm) }; })
      .sort(function (a, b) { return b.parts.length - a.parts.length; });
  }

  function fillerAllowed(phrase, toks, i, len) {
    var prev = i > 0 ? toks[i - 1].w : '';
    var next = i + len < toks.length ? toks[i + len].w : '';
    if (phrase === 'so') return !(SO_OK_NEXT.has(next) || SO_OK_PREV.has(prev));
    if (phrase === 'like') return !(LIKE_OK_PREV.has(prev) || LIKE_OK_NEXT.has(next));
    if (phrase === 'you know') return !(YK_OK_PREV.has(prev) || next === 'what' || next === 'how' || next === 'that');
    if (phrase === 'i mean') return !(prev === 'what' || next === 'it');
    return true;
  }

  // Tag each token as filler (f) / softener (s); returns tokens + counts
  function markText(text, fillers, softeners) {
    var toks = tokenize(text);
    var F = phraseList(fillers || DEFAULT_FILLERS), S = phraseList(softeners || DEFAULT_SOFTENERS);
    var fc = {}, sc = {};
    for (var i = 0; i < toks.length;) {
      var hit = null;
      var lists = [[F, 'f'], [S, 's']];
      for (var L = 0; L < lists.length && !hit; L++) {
        var arr = lists[L][0];
        for (var k = 0; k < arr.length; k++) {
          var parts = arr[k].parts, ok = true;
          if (i + parts.length > toks.length) continue;
          for (var j = 0; j < parts.length; j++) if (toks[i + j].w !== parts[j]) { ok = false; break; }
          if (!ok) continue;
          if (lists[L][1] === 'f' && !fillerAllowed(arr[k].p, toks, i, parts.length)) continue;
          hit = { tag: lists[L][1], p: arr[k].p, len: parts.length };
          break;
        }
      }
      if (hit) {
        for (var m = 0; m < hit.len; m++) toks[i + m].tag = hit.tag;
        toks[i].start = true; toks[i].len = hit.len;
        var c = hit.tag === 'f' ? fc : sc; c[hit.p] = (c[hit.p] || 0) + 1;
        i += hit.len;
      } else i++;
    }
    return { toks: toks, fillers: fc, softeners: sc };
  }

  function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
  function sortedCounts(o) {
    return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }

  // Repeated phrases (4+ words said twice or more) and restarts ("I I", "the the")
  function findRepeats(toks) {
    var words = toks.filter(function (t) { return t.tag !== 'f'; }).map(function (t) { return t.w; });
    var restarts = {};
    for (var i = 1; i < words.length; i++) {
      if (words[i] === words[i - 1] && !DUP_OK.has(words[i])) restarts[words[i]] = (restarts[words[i]] || 0) + 1;
    }
    var N = 4, grams = {}, first = {};
    for (var a = 0; a + N <= words.length; a++) {
      var g = words.slice(a, a + N);
      var content = g.filter(function (w) { return !STOP.has(w); }).length;
      if (content < 2) continue;
      var key = g.join(' ');
      grams[key] = (grams[key] || 0) + 1;
      if (!(key in first)) first[key] = a;
    }
    var reps = Object.keys(grams).filter(function (k) { return grams[k] >= 2; })
      .sort(function (x, y) { return first[x] - first[y]; });
    // merge overlapping grams into longer phrases
    var merged = [];
    reps.forEach(function (k) {
      var last = merged[merged.length - 1];
      if (last) {
        var lw = last.text.split(' '), kw = k.split(' ');
        if (lw.slice(-3).join(' ') === kw.slice(0, 3).join(' ') && last.n === grams[k]) {
          last.text += ' ' + kw[3]; return;
        }
      }
      merged.push({ text: k, n: grams[k] });
    });
    return { phrases: merged.slice(0, 5), restarts: restarts };
  }

  function splitSegments(text) {
    return String(text || '').split(/(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* Hesitation-sound detector: finds held, flat-pitch voiced sounds ("uhhh", "mmm", "sooo").
     Works on raw samples. Returns {events:[{t,d}], speechSec}. It is an estimate. */
  function detectHesitations(x, sr) {
    var step = Math.max(1, Math.round(sr / 8000));
    var n = Math.floor(x.length / step), y = new Float32Array(n), i, k, s;
    for (i = 0; i < n; i++) { s = 0; for (k = 0; k < step; k++) s += x[i * step + k]; y[i] = s / step; }
    var fs = sr / step, win = Math.round(0.04 * fs), hop = Math.round(0.02 * fs);
    var minLag = Math.floor(fs / 350), maxLag = Math.ceil(fs / 75);
    var nf = Math.max(0, Math.floor((n - win - maxLag) / hop));
    var rms = new Float32Array(nf), f0 = new Float32Array(nf);
    for (i = 0; i < nf; i++) {
      var o = i * hop, e = 0;
      for (k = 0; k < win; k++) e += y[o + k] * y[o + k];
      rms[i] = Math.sqrt(e / win);
    }
    var sortedR = Array.prototype.slice.call(rms).sort(function (a, b) { return a - b; });
    var pct = function (p) { return sortedR.length ? sortedR[Math.min(sortedR.length - 1, Math.floor(p * sortedR.length))] : 0; };
    var thr = Math.max(pct(0.15) * 3, pct(0.95) * 0.12, 0.003);
    var speechFrames = 0;
    for (i = 0; i < nf; i++) {
      if (rms[i] < thr) continue;
      speechFrames++;
      var o2 = i * hop, best = 0, bestLag = 0, e0 = 0;
      for (k = 0; k < win; k++) e0 += y[o2 + k] * y[o2 + k];
      for (var lag = minLag; lag <= maxLag; lag++) {
        var c = 0, e1 = 0;
        for (k = 0; k < win; k++) { var b = y[o2 + k + lag]; c += y[o2 + k] * b; e1 += b * b; }
        var r = c / Math.sqrt(e0 * e1 + 1e-12);
        if (r > best) { best = r; bestLag = lag; }
      }
      if (best > 0.72 && bestLag) f0[i] = fs / bestLag;
    }
    var events = [], hopSec = hop / fs, runStart = -1, gap = 0;
    function closeRun(end) {
      var len = end - runStart + 1, dur = len * hopSec;
      if (dur >= 0.4 && dur <= 1.6) {
        var vals = [], rv = [];
        for (var q = runStart; q <= end; q++) if (f0[q]) { vals.push(f0[q]); rv.push(rms[q]); }
        if (vals.length >= len * 0.8) {
          vals.sort(function (a, b) { return a - b; });
          var med = vals[Math.floor(vals.length / 2)];
          var spread = (vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)]) / med;
          var mean = rv.reduce(function (a, b) { return a + b; }, 0) / rv.length;
          var sd = Math.sqrt(rv.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / rv.length);
          if (spread < 0.08 && sd / mean < 0.5) events.push({ t: +(runStart * hopSec).toFixed(2), d: +dur.toFixed(2) });
        }
      }
    }
    for (i = 0; i < nf; i++) {
      if (f0[i]) { if (runStart < 0) runStart = i; gap = 0; }
      else if (runStart >= 0) {
        gap++;
        if (gap > 1) { closeRun(i - gap); runStart = -1; gap = 0; }
      }
    }
    if (runStart >= 0) closeRun(nf - 1 - gap);
    return { events: events, speechSec: +(speechFrames * hopSec).toFixed(1) };
  }

  /* Build the full report for one session */
  function analyse(opts) {
    var segments = (opts.segments || []).filter(Boolean);
    var text = segments.join(' ');
    var m = markText(text, opts.fillers, opts.softeners);
    var words = m.toks.length;
    var dur = Math.max(1, opts.durationSec || 1), mins = Math.max(dur / 60, 0.25);
    var fillerN = sum(m.fillers), softN = sum(m.softeners);
    var hes = opts.hesitations ? opts.hesitations.length : 0;
    var reps = findRepeats(m.toks);
    var restartN = sum(reps.restarts);
    var segWords = segments.map(function (s) { return tokenize(s).length; });
    var longSegs = segWords.filter(function (n) { return n > 35; }).length;
    var wpm = Math.round(words / (dur / 60));

    // Start check: first 6 words
    var firstToks = m.toks.slice(0, 6);
    var startFiller = null;
    for (var i = 0; i < firstToks.length; i++) if (firstToks[i].tag === 'f' && firstToks[i].start) { startFiller = firstToks[i].w; if (firstToks[i].len > 1) startFiller = m.toks.slice(i, i + firstToks[i].len).map(function (t) { return t.w; }).join(' '); break; }
    var startHes = opts.hesitations && opts.hesitations.some(function (h) { return h.t < 2.5; });

    var fpm = (fillerN + 0.7 * hes) / mins;
    var pen = {
      fillers: Math.min(45, fpm * 7),
      repeats: Math.min(15, reps.phrases.length * 4 + restartN * 2),
      long: Math.min(10, longSegs * 3),
      overtime: 0,
      softeners: softN / mins > 3 ? 5 : 0,
      start: (startFiller || startHes) ? 5 : 0
    };
    if (opts.maxWords && words > opts.maxWords) pen.overtime = Math.min(15, Math.round((words / opts.maxWords - 1) * 40) + 4);
    if (opts.targetSec && dur > opts.targetSec * 1.2) pen.overtime = Math.min(15, Math.round((dur / opts.targetSec - 1) * 30));
    var score = words < 12 ? null : Math.max(0, Math.round(100 - pen.fillers - pen.repeats - pen.long - pen.overtime - pen.softeners - pen.start));

    var tip = pickTip(pen, m, reps, startFiller, opts, dur, words);
    return {
      score: score, words: words, durationSec: Math.round(dur), wpm: wpm,
      fillerCount: fillerN, fillerPerMin: +(fillerN / mins).toFixed(1), fillers: sortedCounts(m.fillers),
      softenerCount: softN, softeners: sortedCounts(m.softeners),
      hesitationCount: hes, repeats: reps.phrases, restarts: sortedCounts(reps.restarts),
      longSentences: longSegs, startFiller: startFiller, startHesitation: !!startHes,
      tip: tip
    };
  }

  function pickTip(pen, m, reps, startFiller, opts, dur, words) {
    if (words < 12) return 'Too short to score. Talk for at least 20 seconds.';
    var order = Object.keys(pen).sort(function (a, b) { return pen[b] - pen[a]; });
    var top = order[0];
    if (pen[top] < 4) return 'Clean and clear. Next round: say the same thing in fewer words.';
    var topF = sortedCounts(m.fillers)[0];
    switch (top) {
      case 'fillers':
        return 'Your filler was "' + (topF ? topF[0] : 'uh') + '". When you feel it coming, close your mouth and pause for one second. A pause sounds confident.';
      case 'repeats':
        return reps.phrases[0] ? 'You said "' + reps.phrases[0].text + '" ' + reps.phrases[0].n + ' times. Say it once, then move to the next point.'
          : 'You restarted words. Slow your first sentence down, then keep going.';
      case 'long': return 'Some sentences ran past 35 words. One idea, then a full stop.';
      case 'overtime': return opts.maxWords && words > opts.maxWords ? 'You used ' + words + ' words. Target is ' + opts.maxWords + ' or fewer. Say the point, then stop.' : 'You went over time. Start with the point and drop the background.';
      case 'softeners': return 'Too many "just / I think / maybe". State it plainly.';
      case 'start': return 'You opened with "' + (startFiller || 'uh') + '". Use a starter line instead, for example "Quick update, three points."';
    }
    return '';
  }

  /* Read-aloud clarity: how much of the target text the phone understood (word-level LCS) */
  var NUMW = {zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',
    twenty:'20',thirty:'30',forty:'40',fifty:'50',hundred:'100',first:'1st',second:'2nd',third:'3rd',ok:'okay'};
  function readWords(text) {
    return String(text || '').replace(/[\/*]/g, ' ').replace(/-/g, ' ').split(/\s+/).map(norm).filter(Boolean)
      .map(function (w) { return NUMW[w] || w.replace(/'s$/, 's'); });
  }
  function readScore(target, spoken) {
    var t = readWords(target), s = readWords(spoken), n = t.length, m = s.length;
    if (!n) return { clarity: 0, matched: [], missed: [] };
    var dp = [], i, j;
    for (i = 0; i <= n; i++) { dp.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var matched = new Array(n).fill(false); i = 0; j = 0;
    while (i < n && j < m) { if (t[i] === s[j]) { matched[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    var missed = []; for (i = 0; i < n; i++) if (!matched[i]) missed.push(t[i]);
    // clarity is judged on the part they reached (so stopping early doesn't count as unclear)
    var last = -1; for (i = 0; i < n; i++) if (matched[i]) last = i;
    var reached = Math.max(1, last + 1), got = 0; for (i = 0; i <= last; i++) if (matched[i]) got++;
    return { clarity: Math.round(100 * got / reached), coverage: Math.round(100 * reached / n), matched: matched, missed: missed, targetWords: n };
  }

  var api = { readScore: readScore, readWords: readWords, DEFAULT_FILLERS: DEFAULT_FILLERS, DEFAULT_SOFTENERS: DEFAULT_SOFTENERS, markText: markText,
    findRepeats: findRepeats, detectHesitations: detectHesitations, analyse: analyse, splitSegments: splitSegments, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TTP = api;
})(this);
