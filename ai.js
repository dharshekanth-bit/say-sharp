/* Say Sharp — AI coach (Google Gemini, called directly from the phone with the user's own free key) */
window.AI = (function () {
  'use strict';
  var BASE = 'https://generativelanguage.googleapis.com';
  var cfg = { key: '', model: '', models: [] };
  function setConfig(c) { for (var k in c) cfg[k] = c[k]; }
  // fetch with a time limit so nothing can hang forever
  function fetchT(url, opts, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 60000) : null;
    var o = Object.assign({}, opts || {}); if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) { clearTimeout(t); return r; }, function (e) {
      clearTimeout(t);
      var err = new Error(e && e.name === 'AbortError' ? 'timeout' : 'network');
      err.user = e && e.name === 'AbortError' ? 'The AI took too long to answer. Check your internet and try again.' : 'No internet connection. The AI coach needs internet.';
      err.net = true; throw err;
    });
  }
  function ready() { return !!cfg.key; }

  /* ---------- schema helpers (Gemini response_schema, OpenAPI subset) ---------- */
  var S = {
    str: function (d) { return { type: 'STRING', description: d || '' }; },
    int: function (d) { return { type: 'INTEGER', description: d || '' }; },
    bool: function (d) { return { type: 'BOOLEAN', description: d || '' }; },
    arr: function (items, d) { return { type: 'ARRAY', items: items, description: d || '' }; },
    obj: function (props, req) { return { type: 'OBJECT', properties: props, required: req || Object.keys(props) }; }
  };

  /* ---------- audio ---------- */
  function pcmToWav(pcm, sr) {
    var n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function w(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0, o = 44; i < n; i++, o += 2) { var x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7FFF, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(blob);
    });
  }
  // Turn 16 kHz PCM into a Gemini part. Big files go through the File API.
  async function audioPart(pcm) {
    var wav = pcmToWav(pcm, 16000);
    if (wav.size < 12 * 1024 * 1024) return { inline_data: { mime_type: 'audio/wav', data: await blobToB64(wav) } };
    try { var f = await uploadFile(wav); return { file_data: { mime_type: 'audio/wav', file_uri: f.uri } }; }
    catch (e) {
      // fallback: downsample to 8 kHz and trim to fit inline
      var half = new Float32Array(Math.min(Math.floor(pcm.length / 2), 8000 * 60 * 12));
      for (var i = 0; i < half.length; i++) half[i] = (pcm[2 * i] + pcm[2 * i + 1]) / 2;
      return { inline_data: { mime_type: 'audio/wav', data: await blobToB64(pcmToWav(half, 8000)) } };
    }
  }
  async function uploadFile(blob) {
    var start = await fetchT(BASE + '/upload/v1beta/files', { method: 'POST', headers: {
      'x-goog-api-key': cfg.key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size), 'X-Goog-Upload-Header-Content-Type': blob.type, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: { display_name: 'talk-' + Date.now() } }) });
    var url = start.headers.get('x-goog-upload-url');
    if (!start.ok || !url) throw new Error('upload start failed');
    var up = await fetchT(url, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: blob });
    var info = await up.json(); var f = info.file;
    for (var t = 0; t < 20 && f.state === 'PROCESSING'; t++) {
      await new Promise(function (r) { setTimeout(r, 1500); });
      f = await (await fetchT(BASE + '/v1beta/' + f.name, { headers: { 'x-goog-api-key': cfg.key } })).json();
    }
    if (f.state === 'FAILED') throw new Error('upload processing failed');
    return f;
  }

  /* ---------- models ---------- */
  function rankModels(names) {
    var all = names.map(function (n) { return n.replace(/^models\//, ''); });
    var bad = /(tts|image|live|audio|thinking|exp|robotics|computer|embed|aqa|veo|imagen|lyria|gemma|learnlm)/;
    var latest = all.filter(function (n) { return /^gemini-flash-latest$/.test(n); }).concat(all.filter(function (n) { return /^gemini-flash-lite-latest$/.test(n); }));
    var c = all
      .filter(function (n) { return /^gemini-\d+(\.\d+)?-flash(-lite)?(-preview[-\w]*)?$/.test(n) && !/(tts|image|live|audio|thinking|exp|robotics|computer)/.test(n); });
    function ver(n) { return parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)[1]); }
    c.sort(function (a, b) {
      var la = /lite/.test(a), lb = /lite/.test(b); if (la !== lb) return la ? 1 : -1;
      var pa = /preview/.test(a), pb = /preview/.test(b); if (pa !== pb) return pa ? 1 : -1;
      return ver(b) - ver(a);
    });
    var out = latest.length ? [latest[0]].concat(c).concat(latest.slice(1)) : c;
    if (!out.length) out = all.filter(function (n) { return /^gemini/.test(n) && !bad.test(n) && !/pro/.test(n); });
    return out.filter(function (n, i) { return out.indexOf(n) === i; });
  }
  async function discover() {
    var r = await fetchT(BASE + '/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': cfg.key } }, 20000);
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw friendly(r.status, j);
    var names = (j.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0; }).map(function (m) { return m.name; });
    var ranked = rankModels(names);
    if (!ranked.length) ranked = ['gemini-2.5-flash'];
    return ranked;
  }
  function modelOrder() {
    var list = [];
    if (cfg.model) list.push(cfg.model);
    (cfg.models && cfg.models.length ? cfg.models : ['gemini-2.5-flash', 'gemini-2.5-flash-lite']).forEach(function (m) { if (list.indexOf(m) < 0) list.push(m); });
    return list.slice(0, 5);
  }

  function friendly(status, j) {
    var msg = (j && j.error && j.error.message) || '';
    var e = new Error(msg || ('Error ' + status)); e.status = status;
    if (status === 400 && /api key/i.test(msg)) e.user = 'Your AI key is not valid. Check it in Settings.';
    else if (status === 403) e.user = 'Your AI key does not have access. Create a new key in Google AI Studio.';
    else if (status === 429) e.user = 'Free AI limit reached for now. Wait a minute and try again.';
    else if (status >= 500) e.user = 'The AI service is busy. Try again in a moment.';
    else e.user = 'AI error: ' + (msg || status);
    return e;
  }

  /* ---------- fallback when Google rejects the answer format ---------- */
  function skeleton(sc) {
    if (!sc) return '';
    if (sc.type === 'OBJECT') { var o = {}; for (var k in sc.properties) o[k] = skeleton(sc.properties[k]); return o; }
    if (sc.type === 'ARRAY') return [skeleton(sc.items)];
    if (sc.type === 'INTEGER') return '<whole number' + (sc.description ? ': ' + sc.description : '') + '>';
    if (sc.type === 'BOOLEAN') return '<true or false>';
    return '<text' + (sc.description ? ': ' + sc.description : '') + '>';
  }
  function withHint(contents, schema) {
    var c = contents.slice(), last = Object.assign({}, c[c.length - 1]);
    last.parts = last.parts.concat([{ text: 'Reply with ONLY a JSON object, no other text, in exactly this shape (replace each <...> with a real value):\n' + JSON.stringify(skeleton(schema)) }]);
    c[c.length - 1] = last; return c;
  }
  function coerce(v, sc) {
    if (!sc) return v;
    if (sc.type === 'ARRAY') return Array.isArray(v) ? v.map(function (x) { return coerce(x, sc.items); }) : [];
    if (v == null) return v;
    if (sc.type === 'OBJECT') { if (typeof v !== 'object') return undefined; for (var k in sc.properties) v[k] = coerce(v[k], sc.properties[k]); return v; }
    if (sc.type === 'INTEGER') { var n = parseInt(v, 10); return isNaN(n) ? undefined : n; }
    if (sc.type === 'BOOLEAN') return v === true || v === 'true';
    return String(v);
  }

  /* ---------- core call ---------- */
  async function call(opts) {
    if (!cfg.key) { var e0 = new Error('no key'); e0.user = 'Add your free AI key in Settings to use the AI coach.'; throw e0; }
    var models = modelOrder(), lastErr = null;
    for (var mi = 0; mi < models.length; mi++) {
      var model = models[mi];
      var gen = { temperature: opts.temperature == null ? 0.4 : opts.temperature, max_output_tokens: opts.maxTokens || 8192 };
      var fellBack = false;
      if (opts.schema) { gen.response_mime_type = 'application/json'; if (!cfg.noSchema) gen.response_schema = opts.schema; }
      var withThinking = /^gemini-2\.5-flash/.test(model) && opts.fast;
      if (withThinking) gen.thinking_config = { thinking_budget: 0 };
      var body = { contents: (opts.schema && cfg.noSchema) ? withHint(opts.contents, opts.schema) : opts.contents, generation_config: gen };
      if (opts.system) body.system_instruction = { parts: [{ text: opts.system }] };
      for (var attempt = 0; attempt < 3; attempt++) {
        var r, j;
        try {
          if (cfg.onTry) cfg.onTry(model);
          r = await fetchT(BASE + '/v1beta/models/' + model + ':generateContent', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body) }, opts.timeout || 120000);
          j = await r.json().catch(function () { return {}; });
        } catch (netErr) { lastErr = netErr; if (netErr.message === 'timeout') break; throw netErr; }
        if (r.ok) {
          var cand = j.candidates && j.candidates[0];
          var text = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
          if (!text && opts.allowEmpty) { if (cfg.onModel) cfg.onModel(model); return { text: '', model: model }; }
          if (!text) { lastErr = new Error('empty'); lastErr.user = 'The AI returned nothing (' + ((cand && cand.finishReason) || (j.promptFeedback && j.promptFeedback.blockReason) || 'unknown') + '). Try again.'; break; }
          if (!opts.schema) { if (cfg.onModel) cfg.onModel(model); return { text: text, model: model }; }
          try {
            var t2 = text.replace(/^```(json)?|```$/g, '').trim(), a0 = t2.indexOf('{'), b0 = t2.lastIndexOf('}');
            if (a0 >= 0 && b0 > a0) t2 = t2.slice(a0, b0 + 1);
            var data = coerce(JSON.parse(t2), opts.schema); data._model = model;
            if (fellBack) cfg.noSchema = true;
            if (cfg.onModel) cfg.onModel(model); return data; }
          catch (pe) { lastErr = new Error('parse'); lastErr.user = 'The AI reply was cut off. Try a shorter recording.'; break; }
        }
        lastErr = friendly(r.status, j);
        if (r.status === 400 && gen.thinking_config) { delete gen.thinking_config; continue; }
        if (r.status === 400 && gen.response_schema && !/api key/i.test(lastErr.message)) { delete gen.response_schema; body.contents = withHint(opts.contents, opts.schema); fellBack = true; continue; }
        if (r.status === 503 && attempt === 0) { await new Promise(function (x) { setTimeout(x, 1500); }); continue; }
        break;
      }
      if (lastErr && lastErr.status === 400 && /api key/i.test(lastErr.message)) throw lastErr;
      if (lastErr && lastErr.status === 403) throw lastErr;
      // 404 (model gone), 429 (model quota), 5xx, parse: try the next model
    }
    throw lastErr || new Error('AI failed');
  }

  async function test(onStep) {
    if (onStep) onStep('Checking your key…');
    var models = await discover();
    cfg.models = models;
    var prevTry = cfg.onTry; cfg.onTry = function (m) { if (onStep) onStep('Testing ' + m + '…'); };
    try {
      var r = await call({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ready' }] }], fast: true, maxTokens: 1024, allowEmpty: true, timeout: 30000 });
      return { models: models, model: r.model };
    } finally { cfg.onTry = prevTry; }
  }

  /* ---------- prompts ---------- */
  var COACH = 'You are an expert executive speaking coach. The speaker is a finance professional who uses English as a working language with international clients. ' +
    'Judge how clear and effective the speaking is for a business audience. Do not judge the accent itself, only whether words are clear. ' +
    'Be honest, specific and kind. Use plain, simple English and short sentences. Quote the speaker’s exact words when giving feedback.';

  var VERBATIM = 'TRANSCRIBE VERBATIM. Write exactly what was said, including every filler sound and word (um, uh, er, ah, hmm, mm), ' +
    'every repeated word ("I I", "the the"), false starts and self-corrections (write cut-off words with a dash, e.g. "we sen- we sent"), ' +
    'and words like so, actually, basically, like, you know, I mean, maybe, just, kind of. Do NOT clean up, correct grammar, or remove anything. ' +
    'Use punctuation to mark sentence ends and pauses. If something is unclear, write your best guess.';

  var DIMS = ['fluency', 'clarity', 'conciseness', 'structure', 'relevance', 'confidence', 'grammar'];
  var DIM_HELP = {
    fluency: 'Flow: fillers, hesitations, restarts, broken sentences. 9-10 = under 1 filler per minute and smooth. 6 = about 4 fillers per minute or several restarts. 3 = fillers in most sentences.',
    clarity: 'Can every word be understood? Clear word endings, no mumbling or rushing. Easy to follow.',
    conciseness: 'Says it once, no padding, no repeated ideas, gets to the point quickly. Penalise repetition and long background.',
    structure: 'Clear start, logical order, follows the requested structure, clear ending. No wandering.',
    relevance: 'Actually answers the question or task asked.',
    confidence: 'Firm, steady delivery. Few softeners (maybe, just, I think, kind of, a little bit). Statements, not questions. Calm pace.',
    grammar: 'Correct spoken English grammar: tenses, subject-verb agreement, articles (a/the), prepositions, plurals, word order. 9-10 = no real errors. Ignore normal spoken informality.'
  };
  var scoresSchema = S.obj({ fluency: S.int(DIM_HELP.fluency), clarity: S.int(DIM_HELP.clarity), conciseness: S.int(DIM_HELP.conciseness),
    structure: S.int(DIM_HELP.structure), relevance: S.int(DIM_HELP.relevance), confidence: S.int(DIM_HELP.confidence), grammar: S.int(DIM_HELP.grammar) });
  var grammarSchema = S.arr(S.obj({ said: S.str('exact words as spoken, containing the mistake'), correct: S.str('the corrected version'), rule: S.str('the rule in plain words, max 12 words') }),
    'every real grammar mistake (not fillers, not style), most important first, max 6. Empty if none.');
  var pronSchema = S.arr(S.obj({ word: S.str('the word'), issue: S.str('what was wrong, max 10 words, e.g. "stress on wrong syllable", "last sound dropped"'), say_it: S.str('simple respelling with the stressed part in CAPITALS, e.g. THUH-ruh-lee, ak-YOO-rit') }),
    'words pronounced in a way that could confuse an international business listener, or with clearly wrong stress or dropped endings. Do not flag accent alone. Max 6. Empty if none.');
  var fixSchema = S.obj({ said: S.str('exact quote of what they said'), why: S.str('why it weakens the message, max 12 words'), better: S.str('a sharper way to say it') });

  var TALK_SCHEMA = S.obj({
    transcript: S.str('verbatim transcript'),
    headline: S.str('one honest verdict, max 10 words'),
    scores: scoresSchema,
    repetitions: S.arr(S.str(), 'ideas or phrases said more than once, or restarts, quoted. Empty if none.'),
    delivery: S.str('what you HEARD in the audio: pace, pauses, tone, volume, energy, hesitation. 1-2 short sentences.'),
    grammar: grammarSchema,
    pronunciation: pronSchema,
    strengths: S.arr(S.str(), '1-2 specific things done well'),
    fixes: S.arr(fixSchema, 'the 2-3 most important fixes, most important first'),
    better_version: S.str('how a sharp, confident speaker would say the same content: same facts, point first, about half the words, natural spoken English'),
    skill_check: S.obj({ score: S.int('1-10: how well they applied the specific skill being practised (if one is given), otherwise overall effectiveness'), note: S.str('what they did or missed for that skill, max 20 words') }),
    next_step: S.str('one concrete thing to do differently next time, max 20 words')
  });
  var PRESENCE_SCHEMA = S.obj({
    eye_contact: S.int('1-10: looking at the camera lens most of the time, not down or away'),
    expression: S.int('1-10: natural, engaged, friendly face; smiles where right; not frozen, tense or flat'),
    posture: S.int('1-10: upright, steady, open; not slumped, swaying or too close/far'),
    energy: S.int('1-10: looks alert and confident; visible energy that matches the message'),
    notes: S.str('what you SAW in the frames, 1-2 short sentences, specific'),
    habits: S.arr(S.str(), 'visible habits that weaken presence, e.g. looking down, touching face, fidgeting, frozen face, head tilt, reading notes. Empty if none.'),
    best: S.str('one thing that looked confident, max 15 words')
  });
  var TALK_VIDEO_SCHEMA = JSON.parse(JSON.stringify(TALK_SCHEMA));
  TALK_VIDEO_SCHEMA.properties.presence = PRESENCE_SCHEMA; TALK_VIDEO_SCHEMA.required.push('presence');

  function ctxText(o) {
    var t = [];
    if (o.task) t.push('Task: ' + o.task);
    if (o.prompt) t.push('Question / prompt given to the speaker: "' + o.prompt + '"');
    if (o.structure && o.structure.length) t.push('Structure they should follow: ' + o.structure.join(' → '));
    if (o.targetSec) t.push('Time target: ' + o.targetSec + ' seconds. Actual: ' + Math.round(o.dur) + ' seconds.');
    if (o.maxWords) t.push('Word limit: ' + o.maxWords + ' words.');
    if (o.focus) t.push('Skill they are practising this week: ' + o.focus);
    return t.join('\n');
  }

  async function analyseTalk(pcm, o, frames) {
    var part = await audioPart(pcm);
    var hasVid = frames && frames.length;
    var prompt = ctxText(o) + '\n\nListen to the recording.\n1. ' + VERBATIM +
      '\n2. Score each area from 1 to 10 (be strict and realistic; 10 is rare, 7 is good).\n3. List real grammar mistakes exactly as spoken with corrections, and any unclear or wrongly stressed words.\n4. Give feedback as specified.' +
      (o.dur < 8 ? '\nThe recording is very short; score it, but say so in the headline.' : '') +
      '\nAlso score how well they applied the skill being practised (skill_check).' +
      (hasVid ? '\n5. You also get low-resolution still frames from the front camera taken during the talk (the image is mirrored like a selfie). Judge visible presence: eye contact with the lens, facial expression, posture and energy. Image quality is low on purpose; do not comment on lighting or camera quality unless the face cannot be seen.' : '');
    var parts = [{ text: prompt }, part];
    if (hasVid) {
      parts.push({ text: 'Camera frames in time order (' + frames.length + ' frames):' });
      frames.forEach(function (f) { parts.push({ text: 'at ' + f.t + 's' }); parts.push({ inline_data: { mime_type: 'image/jpeg', data: f.data } }); });
    }
    return call({ system: COACH, schema: hasVid ? TALK_VIDEO_SCHEMA : TALK_SCHEMA, contents: [{ role: 'user', parts: parts }], maxTokens: 12000, timeout: 150000 });
  }

  var READ_SCHEMA = S.obj({
    transcript: S.str('verbatim transcript of what was read'),
    headline: S.str('max 10 words'),
    clarity: S.int('1-10: how clearly each word was pronounced, especially word endings'),
    pacing: S.int('1-10: steady pace, not rushed, sensible pauses at the marked places'),
    expression: S.int('1-10: natural intonation, stress on key words, not monotone'),
    pace_label: S.str('one of: too slow, good, too fast'),
    unclear_words: S.arr(S.obj({ word: S.str(), note: S.str('what went wrong, max 8 words'), say_it: S.str('simple respelling with the stressed part in CAPITALS') }), 'words that were swallowed, mispronounced, wrongly stressed or unclear. Empty if none.'),
    skipped_words: S.arr(S.str(), 'words from the text that were skipped or changed'),
    tip: S.str('one practical tip for the next read, max 20 words')
  });
  async function analyseRead(pcm, target) {
    var part = await audioPart(pcm);
    var prompt = 'The speaker is reading this text aloud to practise clear speech. "/" marks a pause. Words in *asterisks* should be stressed.\n\nTEXT:\n' + target +
      '\n\nListen carefully. ' + VERBATIM + '\nThen rate clarity, pacing and expression from 1 to 10 (7 = good, 10 = rare), list any unclear or swallowed words and skipped words, and give one tip.';
    return call({ system: COACH, schema: READ_SCHEMA, contents: [{ role: 'user', parts: [{ text: prompt }, part] }] });
  }

  var TURN_SCHEMA = S.obj({
    heard: S.str('verbatim transcript of the user’s latest reply'),
    reply: S.str('your next line, in character, 1-3 short spoken sentences'),
    coach_note: S.str('private coaching tip on the user’s latest reply, max 15 words'),
    turn_score: S.int('1-10 how effective the latest reply was'),
    clarity: S.int('1-10 how clearly it was spoken'),
    grammar_fix: S.obj({ said: S.str('exact words with the most important grammar mistake, or empty string'), correct: S.str('corrected version, or empty string') }),
    pron_fix: S.obj({ word: S.str('one unclear or wrongly stressed word, or empty string'), say_it: S.str('simple respelling with CAPITALS for stress, or empty string') }),
    end: S.bool('true if the conversation has reached a natural end')
  });
  async function roleplayTurn(pcm, scn, history, turnNo) {
    var part = await audioPart(pcm);
    var sys = 'You are role-playing in a speaking practice app. ' + scn.persona +
      '\nStay fully in character. Speak naturally, like a real person in a real conversation, 1 to 3 short sentences. React to HOW they said it as well as what they said: if they ramble, hesitate a lot or are vague, react as a real person would. ' +
      'The conversation should last about ' + scn.turns + ' replies from the user. This is user reply number ' + turnNo + '. ' + (turnNo >= scn.turns ? 'Wrap up the conversation naturally now and set end to true.' : '') +
      (scn.coachMode ? '\nYou are also their speaking coach: if their latest reply had a clear grammar mistake or an unclear word, START your reply with one short, friendly correction (for example: "Small tip: we say \'he doesn\'t\', not \'he don\'t\'."), then carry on the conversation naturally. Do not correct every small thing. Keep it encouraging.' : '') +
      '\nAlso act as a silent coach: give a short private coaching note, the most important grammar fix and pronunciation fix (empty strings if none), and scores for the latest reply.';
    var conv = history.map(function (h) { return (h.who === 'them' ? scn.who + ': ' : 'User: ') + h.text; }).join('\n');
    var prompt = 'Scenario: ' + scn.setup + '\n\nConversation so far:\n' + conv + '\n\nNow listen to the user’s latest reply. ' + VERBATIM + '\nThen give your next line in character.';
    return call({ system: sys, schema: TURN_SCHEMA, fast: true, temperature: 0.8, timeout: 60000, contents: [{ role: 'user', parts: [{ text: prompt }, part] }] });
  }

  var RP_FINAL_SCHEMA = S.obj({
    headline: S.str('one honest verdict, max 10 words'),
    scores: scoresSchema,
    outcome: S.str('how the other person would feel after this conversation, 1 sentence'),
    best_moment: S.str('quote the user’s strongest line and why, max 25 words'),
    grammar: grammarSchema,
    missed_moment: S.str('one moment they could have handled better and how, max 30 words'),
    strengths: S.arr(S.str(), '1-2 strengths'),
    fixes: S.arr(fixSchema, '2-3 most important fixes'),
    better_version: S.str('a stronger version of the user’s weakest reply'),
    next_step: S.str('one concrete thing to practise next, max 20 words')
  });
  async function roleplayScore(scn, history) {
    var conv = history.map(function (h) { return (h.who === 'them' ? scn.who + ': ' : 'User: ') + h.text + (h.who === 'you' && h.clarity ? '  [spoken clarity ' + h.clarity + '/10]' : ''); }).join('\n');
    var prompt = 'Role-play scenario: ' + scn.setup + '\nThe user was speaking to: ' + scn.who + '.\n\nFull conversation (user replies are verbatim, including fillers):\n' + conv +
      '\n\nScore the USER’s speaking across the whole conversation from 1 to 10 in each area (7 = good, 10 = rare). For clarity use the spoken clarity ratings shown. Then give feedback.';
    return call({ system: COACH, schema: RP_FINAL_SCHEMA, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  }

  var RAPID_SCHEMA = S.obj({ answers: S.arr(S.obj({ transcript: S.str('verbatim'), score: S.int('1-10 overall: point-first, clear, no fillers, answered the question'), note: S.str('max 12 words') })),
    headline: S.str('max 10 words'), tip: S.str('one tip, max 20 words') });
  async function rapidScore(items) {
    var parts = [{ text: 'Rapid-fire practice: the speaker answered ' + items.length + ' surprise questions, 20 seconds each, with no preparation. For each recording in order: ' + VERBATIM + ' Then score it 1-10 and give a short note.' }];
    for (var i = 0; i < items.length; i++) { parts.push({ text: 'Question ' + (i + 1) + ': "' + items[i].q + '"' }); parts.push(await audioPart(items[i].pcm)); }
    return call({ system: COACH, schema: RAPID_SCHEMA, contents: [{ role: 'user', parts: parts }] });
  }

  var SQUEEZE_SCHEMA = S.obj({ transcript: S.str('verbatim'), kept: S.arr(S.str(), 'key facts they kept'), missed: S.arr(S.str(), 'key facts they missed'),
    score: S.int('1-10: kept the key facts, very short, point first, no fillers'), note: S.str('max 20 words'), model_answer: S.str('an ideal version in 20 words or fewer') });
  async function squeezeScore(pcm, item, dur) {
    var part = await audioPart(pcm);
    var prompt = 'Game "Squeeze It": the speaker had to say this rambling message again in 20 words or fewer, keeping the key facts.\n\nRAMBLING ORIGINAL:\n' + item.ramble +
      '\n\nKEY FACTS:\n- ' + item.facts.join('\n- ') + '\n\nThey spoke for ' + Math.round(dur) + ' seconds. ' + VERBATIM + ' Then check which key facts they kept and score it.';
    return call({ system: COACH, schema: SQUEEZE_SCHEMA, contents: [{ role: 'user', parts: [{ text: prompt }, part] }] });
  }

  return { setConfig: setConfig, ready: ready, test: test, discover: discover, rankModels: rankModels, pcmToWav: pcmToWav,
    analyseTalk: analyseTalk, analyseRead: analyseRead, roleplayTurn: roleplayTurn, roleplayScore: roleplayScore,
    rapidScore: rapidScore, squeezeScore: squeezeScore, DIMS: DIMS, _call: call };
})();
