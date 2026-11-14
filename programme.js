/* Say Sharp — 12-week programme (60 weekday sessions, ~30 min each) */
window.PROGRAMME = (function () {
  'use strict';

  // Read-aloud warm-up lines: clear consonants, word endings, tricky work words (no numbers)
  var WARM = [
    'Red lorry, yellow lorry, red lorry, yellow lorry.',
    'The reconciliation was completed thoroughly and on time.',
    'She sells sea shells on the sea shore.',
    'Please review the attached statements before Thursday.',
    'Particularly in February, the figures fluctuate significantly.',
    'Unique New York, unique New York, you know you need unique New York.',
    'We specifically asked for the supporting documents.',
    'The sixth sick sheikh’s sixth sheep is sick.',
    'Our superannuation obligations were met in full.',
    'A proper copper coffee pot.',
    'Comfortable clients come back for consistent service.',
    'The entrepreneur explained the strategy clearly and calmly.',
    'Fresh fried fish, fish fresh fried, fried fish fresh.',
    'Accurate accounts build trust with every stakeholder.',
    'Betty bought a bit of better butter.',
    'The auditor asked about the accruals and the adjustments.',
    'Truly rural, truly rural, truly rural.',
    'We will prioritise the outstanding payroll queries first.',
    'Three free throws, three free throws.',
    'The variance was caused by a timing difference.',
    'Six slippery snails slid slowly seaward.',
    'I would appreciate your approval by the end of the week.',
    'Clear words, calm voice, complete sentences.',
    'The statistics were presented at the strategy meeting.',
    'Lesser leather never weathered wetter weather better.',
    'Each entity has its own payroll calendar and deadlines.',
    'Kind kittens knit knotted knickers.',
    'The client confirmed the change in writing yesterday.',
    'How can a clam cram in a clean cream can?',
    'Our responsibility is to deliver reliable reports.',
    'Six thick thistle sticks.',
    'The deadline is tight, but the plan is realistic.',
    'Good blood, bad blood, good blood, bad blood.',
    'Let me walk you through the main findings.',
    'A big black bug bit a big black bear.',
    'The process improvement saved the team several hours each month.',
    'Strategic decisions require accurate, timely information.',
    'Which witch wished which wicked wish?',
    'I recommend we finalise the figures before the review.',
    'Clean clams crammed in clean cans.',
    'The management accounts are ready for your review.',
    'Rolling red wagons rattled down the road.',
    'Thank you for raising that. Here is what we will do.',
    'The quick brown fox jumps over the lazy dog.',
    'Payroll, bookkeeping and tax lodgements are all on track.'
  ];

  // One read-aloud passage per week. "/" = pause. *word* = stress it.
  var BENCH_PASSAGE = 'Good morning everyone. / Here is a quick update on this month. / Payroll has been processed for every entity, / and all lodgements were submitted on time. / We found one issue in the client reports, / and it has already been fixed. / Next week, / we will start the review of the new client files. / I need one decision from you: / whether we hire one more person this quarter. / Thank you.';

  var W = [
    { n: 1, phase: 'Clean speech', title: 'Know your fillers',
      why: 'Fillers are your brain buying time. You can’t fix what you don’t notice. This week, every buzz is just information.',
      rule: 'Notice your fillers. Don’t fight them yet.',
      no: 'So, uh, actually, basically what happened was…', yes: 'What happened was…',
      focus: ['Check-in day. Speak naturally so we get a true starting point.',
        'Count your buzzes. Which filler comes most?',
        'Notice when fillers appear: at the start, or between ideas?',
        'Speak a little slower than normal. Notice what changes.',
        'Look back at your week. Pick the one filler you will attack first.'],
      drill: { name: 'Answer', sec: 45, structure: ['Answer', 'Reason', 'Example'], starters: ['My answer is this.', 'Two things.', 'Here is what I think.'],
        prompts: ['What did you work on yesterday?', 'What is the best part of your job?', 'What is one thing you would change at work?', 'Describe your team in 45 seconds.', 'What made this week busy?', 'What is a skill you are proud of?', 'How do you plan your day?', 'What is a common mistake new staff make?', 'Describe a client you enjoy working with.', 'What are you learning in your MBA right now?'] },
      passage: 'Every morning, / I plan the day in five minutes. / First, / I check what is due today. / Then, / I pick the one task that matters most. / I do that task before I open my email. / It sounds simple, / but it changes the whole day. / The urgent work still gets done, / and the important work gets done first.',
      talk: ['Recap your day so far. Notice every filler.', 'Explain what you do at work to a friend.', 'Talk about a recent decision and why you made it.', 'Describe how you would train a new team member.', 'Talk about your goals for the next three months.'] },

    { n: 2, phase: 'Clean speech', title: 'Pause instead of a filler',
      why: 'A pause feels long to you but sounds calm to others. Silence makes you look sure. A filler makes you look unsure.',
      rule: 'When a filler comes, close your mouth, breathe, then continue.',
      no: 'Uh, so, the next point is, um…', yes: '(pause) The next point is…',
      focus: ['Pause for one full second at the end of every sentence.',
        'Before you start, breathe in. Start on the out-breath. No “so”.',
        'When you lose your thread, stop. Silence is allowed.',
        'Try to finish a full answer with zero buzzes.',
        'Pause before your most important point.'],
      drill: { name: 'Answer', sec: 45, structure: ['Breathe', 'Answer', 'Pause', 'Reason'], starters: ['(breathe) The answer is…', '(breathe) Simply put…'],
        prompts: ['Why did you choose finance as a career?', 'What do you do when you are stuck on a problem?', 'How do you handle a busy month-end?', 'What makes a good manager?', 'How do you check your work for mistakes?', 'What would your team say about you?', 'What is the hardest part of payroll?', 'How do you deal with a difficult email?', 'What does a good week look like for you?', 'How do you prepare for an important call?'] },
      passage: 'When I feel a filler coming, / I stop. / I close my mouth. / I take a small breath. / Then I say the next word. / At first, / the silence feels long. / But the listener does not hear a problem. / They hear someone who is thinking. / They hear someone who is in control. / A pause is not a mistake. / A pause is a tool.',
      talk: ['Explain your weekend plans, pausing instead of filling.', 'Talk about a book, show or film you liked.', 'Describe your ideal working day.', 'Talk about a time you solved a problem at work.', 'Explain how BAS or payroll works to someone new.'] },

    { n: 3, phase: 'Clean speech', title: 'Start with the point',
      why: 'Busy people decide in the first ten seconds if you are worth listening to. Give them the answer first. Background only if they ask.',
      rule: 'Your first sentence is the answer or the headline.',
      no: 'So, actually, last week the client sent the file, and then we had some issues, and…', yes: 'The BAS will be two days late. The client sent the file late.',
      focus: ['Say the answer in your first sentence, every time.',
        'Use a starter line: “Short answer:” then the point.',
        'Stop after the point. Add detail only if it is needed.',
        'Test: could someone stop listening after sentence one and still know the answer?',
        'Mix it up: one-line answers and short updates, all point-first.'],
      drill: { name: 'One line', sec: 20, maxWords: 25, structure: ['One sentence', 'Answer first', 'Then stop'], starters: ['Short answer:', 'Bottom line:', 'In one line:'],
        prompts: ['Why is this task late?', 'Are we on track for month-end?', 'What do you need from me?', 'What is the main risk this month?', 'Should we take on this new client?', 'What did the client decide?', 'What is your recommendation?', 'Why did the numbers change?', 'Is the report ready?', 'What is blocking you?', 'What went well this week?', 'What is the next step?'] },
      passage: 'Here is the short answer. / Yes, / we can finish by Friday. / There is one condition. / We need the bank statements by Wednesday. / If they arrive late, / the deadline moves by one day. / I will send a reminder to the client today. / That is all you need to know for now. / I can share the detail if you want it.',
      talk: ['Give three point-first answers about your week.', 'Explain one problem at work: point first, then reason.', 'Talk about a recent news story: headline first.', 'Recommend a place to visit: answer first, then why.', 'Describe a change you want at work: point first.'] },

    { n: 4, phase: 'Clean speech', title: 'Say it once, one idea per sentence',
      why: 'Repeating a point does not make it stronger. It makes it weaker. Long chains of “and… and… so…” lose people.',
      rule: 'One idea, one sentence. Say it once, then move on.',
      no: 'The payroll is done… yes so the payroll is all done, it’s done and then we…', yes: 'Payroll is done. Next is the review.',
      focus: ['Full stop after every idea. No “and then… and then…”.',
        'Watch the Repeats box. Aim for zero.',
        'Count your points on your fingers. One finger, one sentence.',
        'Say each point once. If you repeat it, stop and move on.',
        'Check-in day. Compare with Day 1.'],
      drill: { name: 'Explain', sec: 60, structure: ['Point 1', 'Point 2', 'Point 3', 'Stop'], starters: ['Three points.', 'There are two steps.', 'Here is how it works.'],
        prompts: ['Explain how you process a payroll run.', 'Explain how you check a BAS before lodging.', 'Explain how you onboard a new client.', 'Explain how you prepare a monthly report.', 'Explain how you handle a client query.', 'Explain how you review a junior’s work.', 'Explain how you plan a busy week.', 'Explain how you prepare for an interview.', 'Explain how you reconcile a bank account.', 'Explain how you train a new staff member.'] },
      passage: 'There are three steps. / First, / we collect the documents. / Second, / we check them against last month. / Third, / we send the report for review. / Each step has one owner. / Each step has one deadline. / When a step is late, / we flag it on the same day. / That is the whole process.',
      talk: ['Explain a process you know well, one idea per sentence.', 'Tell a short story from work in five sentences.', 'Talk about your MBA: what, why, and what next.', 'Explain your career so far in short sentences.', 'Check-in talk: your week, short and clean.'] },

    { n: 5, phase: 'Structure', title: 'Updates: Headline · Done · Next · Need',
      why: 'A good update answers four questions before anyone asks. Where are we? What is done? What is next? What do you need?',
      rule: 'Headline, done, next, need. One or two sentences each.',
      no: 'So basically we did a lot of things this week, like, we had the meeting and…', yes: 'We are on track. Payroll is done. The review is Friday. I need approval by Thursday.',
      focus: ['Use all four parts: headline, done, next, need.',
        'Your headline is one line: on track, at risk, or late.',
        '“Need” can be “nothing needed”. Say it anyway.',
        'Keep each update under 60 seconds.',
        'Give the same update twice. Make the second one shorter.'],
      drill: { name: 'Update', sec: 60, structure: ['Headline', 'Done', 'Next', 'Need'], starters: ['Quick update, three points.', 'The headline is: we are on track.', 'Short version: one risk, one ask.'],
        prompts: ['Give your manager an update on your week.', 'Update a client on a task that is running late.', 'Update the CEO on a new client you are onboarding.', 'Give a status update on this month’s payroll runs.', 'Update your team on a process change.', 'Report the status of BAS lodgements this month.', 'Update your manager on the hiring you are running.', 'Update a client on missing documents.', 'Give an update on a problem you found in a report.', 'Update your manager on a team member’s progress.'] },
      passage: 'Quick update. / We are on track. / This week, / all payroll runs were completed, / and two new clients were set up. / Next week, / we will finish the quarterly review. / One risk: / a client has not sent their documents. / I need your help to follow up with them. / That is the update.',
      talk: ['Give a full weekly update, out loud, as if to your manager.', 'Update an imaginary client on their account.', 'Give an update on your MBA progress.', 'Give an update on a personal goal.', 'Give the same work update in 60, then 30 seconds.'] },

    { n: 6, phase: 'Structure', title: 'Answers: Point · Reason · Example · Point',
      why: 'In interviews and meetings, a structured answer sounds prepared even when it isn’t. PREP gives you a path so you don’t wander.',
      rule: 'Point, reason, example, then the point again in one line.',
      no: 'Well, that’s a good question, I think, I mean, there are many things…', yes: 'My biggest strength is improving reports. For example, I redesigned our capacity report. Leaders now decide faster.',
      focus: ['Start with your point. No “that’s a good question”.',
        'Give one example only. Make it real and specific.',
        'Finish by repeating your point in one short line.',
        'Keep interview answers under 60 seconds.',
        'Answer the hardest prompts twice. Tighter the second time.'],
      drill: { name: 'Answer', sec: 60, structure: ['Point', 'Reason', 'Example', 'Point'], starters: ['My answer is…', 'The short answer is…', 'I would say…'],
        prompts: ['Tell me about yourself.', 'What is your biggest strength?', 'Why should we hire you?', 'Tell me about a process you improved.', 'How do you handle a missed deadline?', 'Describe a time you led a team through change.', 'What is your biggest weakness?', 'Why are you looking for a new role?', 'How do you manage stakeholders?', 'Where do you see yourself in three years?', 'Tell me about a mistake you made.', 'How do you handle pressure?'] },
      passage: 'My main strength is making reports useful. / The reason is simple. / Leaders do not need more numbers. / They need clear decisions. / For example, / I redesigned our capacity report. / It now shows the risk on one page. / The leadership team uses it every month. / So my strength is turning data into decisions.',
      talk: ['Answer “Tell me about yourself” three different ways.', 'Talk through your proudest work achievement using PREP.', 'Explain why you chose your MBA using PREP.', 'Answer “Why should we hire you?” for your dream job.', 'Answer a tough question you fear in interviews.'] },

    { n: 7, phase: 'Structure', title: 'Explain it simply',
      why: 'If you can explain it to someone outside finance, you really understand it. Simple is not basic. Simple is clear.',
      rule: 'What it is. Why it matters. One example.',
      no: 'So basically the GST component gets reconciled against the BAS liability and then…', yes: 'BAS is a tax report we send every quarter. It matters because late reports mean fines. For example…',
      focus: ['Imagine you are explaining to a friend who is not in finance.',
        'No jargon. If you use a term, explain it in five words.',
        'Use one everyday example.',
        'Check: what it is, why it matters, one example.',
        'Explain the same thing in 90, then 45 seconds.'],
      drill: { name: 'Explain', sec: 90, structure: ['What it is', 'Why it matters', 'Example'], starters: ['In simple words,', 'Think of it like this.', 'Here is what it means.'],
        prompts: ['Explain what a BAS is.', 'Explain what payroll tax is.', 'Explain what a reconciliation is.', 'Explain what cash flow means.', 'Explain what an accrual is.', 'Explain what a budget variance is.', 'Explain what superannuation is.', 'Explain what a balance sheet shows.', 'Explain what outsourcing accounting means.', 'Explain what an audit is.'] },
      passage: 'A reconciliation is a simple check. / It makes sure two records agree. / Think of your bank app / and your own list of spending. / If they match, / you are fine. / If they do not match, / something is missing / or something is wrong. / In business, / we do this every month, / so nobody gets a surprise later.',
      talk: ['Explain your job to a ten-year-old.', 'Explain a finance idea to a friend, with one example.', 'Explain your company’s services simply.', 'Explain a news topic simply.', 'Explain something you learned in your MBA simply.'] },

    { n: 8, phase: 'Structure', title: 'Meeting moments: issue · impact · ask',
      why: 'The moments that build your reputation are short: raising a problem, asking for help, disagreeing politely. Each needs a clear shape.',
      rule: 'Issue, impact, ask. Calm, short, specific.',
      no: 'Sorry, I just wanted to maybe mention, if that’s okay, there might be a small issue…', yes: 'One issue: the client files are late. That risks the deadline. Can we follow up today?',
      focus: ['Drop “sorry, just, maybe”. Say the issue plainly.',
        'Always say the impact. Why should they care?',
        'End with a clear ask or a clear next step.',
        'Disagree politely: “I see it differently, here is why.”',
        'Check-in day. Compare with Days 1 and 20.'],
      drill: { name: 'Meeting', sec: 45, structure: ['Issue', 'Impact', 'Ask'], starters: ['One issue to flag.', 'I see it differently. Here is why.', 'I need one thing.'],
        prompts: ['Raise an issue: a client keeps sending files late.', 'Ask your manager for one more team member.', 'Disagree politely with a deadline you think is unrealistic.', 'Ask a colleague to fix an error in their work.', 'Push back on extra work when your team is full.', 'Ask for a decision that has been delayed.', 'Raise a risk in a meeting with senior leaders.', 'Ask the CEO for approval on a new process.', 'Tell a client their request is out of scope.', 'Ask for feedback on your performance.'] },
      passage: 'I want to raise one issue. / The client documents are arriving late every month. / The impact is clear. / We work overtime, / and the risk of mistakes goes up. / My suggestion is simple. / We set a firm cut-off date / and share it with the client in writing. / Can we agree on that today?',
      talk: ['Practise raising a real issue you have at work.', 'Practise asking for something you want.', 'Practise disagreeing with an idea politely.', 'Practise saying no to a request, kindly and clearly.', 'Check-in talk: your week, structured.'] },

    { n: 9, phase: 'Voice', title: 'Clear words, steady pace',
      why: 'People trust a voice they can follow. Clear word endings and a steady pace make you sound calm and senior.',
      rule: 'Finish every word. Slow down by ten percent.',
      no: 'Rushing: wegotthereportdoneandsentit', yes: 'We got the report done. / And sent it.',
      focus: ['Finish the last sound of each word: “report-T”, “sent-T”.',
        'Aim for 120–150 words per minute. Check your pace.',
        'Open your mouth more. Clear vowels, clear words.',
        'Slow down most on names, numbers and key points.',
        'Read the passage three times. Beat your clarity score.'],
      drill: { name: 'One line', sec: 30, maxWords: 35, structure: ['Slow', 'Clear endings', 'Full stop'], starters: ['Let me be clear.', 'Simply put:'],
        prompts: ['State today’s top priority clearly.', 'Tell a client their report is ready.', 'Introduce yourself to a new client.', 'Thank a colleague for their help.', 'State the deadline and what you need.', 'Summarise a meeting in two sentences.', 'Welcome a new team member.', 'Confirm the next steps after a call.', 'State one result you achieved this month.', 'Close a meeting clearly.'] },
      passage: 'Thank you all for joining today. / I will be brief. / The project is complete, / the client is satisfied, / and the final invoice has been sent. / I want to thank the team / for their effort and their patience. / Particularly the reviewers, / who checked every detail thoroughly. / Well done, everyone.',
      talk: ['Talk slowly and clearly about your day.', 'Introduce yourself as if to a new client.', 'Describe your hometown, finishing every word.', 'Explain your weekly routine at a steady pace.', 'Give a short thank-you speech to your team.'] },

    { n: 10, phase: 'Voice', title: 'Pause and stress for impact',
      why: 'A pause before a key point makes people lean in. Stressing the right word tells them what matters.',
      rule: 'Pause before the key point. Stress one word per sentence.',
      no: 'Flat: we saved time and money and the client is happy', yes: 'We saved *time*. / We saved *money*. / And the client is *happy*.',
      focus: ['Pause before your most important word.',
        'Stress one word per sentence. Bold words in the passage show where.',
        'Lower your voice at the end of a sentence. Rising sounds unsure.',
        'Use a pause after a question, before you answer.',
        'Deliver your update like a short speech. Land the ending.'],
      drill: { name: 'Update', sec: 60, structure: ['Headline', 'Pause', 'Key point', 'Land it'], starters: ['The headline is… (pause) good news.', 'One thing matters this week.'],
        prompts: ['Announce a good result to your team.', 'Tell the CEO about a risk.', 'Share a win with a client.', 'Present a recommendation to your manager.', 'Open a team meeting with energy.', 'Close a presentation with one strong line.', 'Share bad news calmly with a client.', 'Present this month’s key number and what it means.', 'Motivate your team before a busy month-end.', 'Summarise a project’s success.'] },
      passage: 'This month, / we did something *different*. / Instead of working *harder*, / we worked *smarter*. / We changed *one* step in the process. / The result? / We saved *ten hours* a week. / That is *time* back for the team, / and *better* service for every client. / Small changes. / *Big* results.',
      talk: ['Give a two-minute team talk with pauses for impact.', 'Tell a story with a pause before the ending.', 'Present a recommendation, stressing the key words.', 'Give a short speech for a company event.', 'Share your proudest achievement with impact.'] },

    { n: 11, phase: 'Pressure', title: 'Think on your feet',
      why: 'Surprise questions are where fillers come back. A simple frame gives you a path in two seconds.',
      rule: 'Pause. Pick a frame. Point first.',
      no: 'Uh, that’s, um, a big question, so, I mean…', yes: '(pause) Two things. First… Second…',
      focus: ['The prompt is hidden until you tap Start. Pause two seconds, then go.',
        'Use the “Two things” frame: First… Second…',
        'Use “Past, present, future” for open questions.',
        'Don’t apologise for thinking. Just pause.',
        'Mix all frames. Answer every surprise point-first.'],
      drill: { name: 'Surprise', sec: 60, hidden: true, structure: ['Pause', 'Point', 'Reason', 'Example'], starters: ['Two things.', 'Good question. In short…', 'Past, present, future.'],
        prompts: ['What would you do if you were CEO for a day?', 'What is the biggest challenge in your industry?', 'How would you cut costs by ten percent?', 'What advice would you give your younger self?', 'How will AI change accounting?', 'What makes a team succeed?', 'What would you improve about your city?', 'What is the most important skill for a leader?', 'Why do projects fail?', 'How do you build trust with a new client?', 'What did you learn from your biggest failure?', 'What is one thing most people get wrong about finance?'] },
      passage: 'When someone asks a hard question, / I do not rush. / I pause. / I think of two points. / Then I answer the first one, / clearly and briefly. / Then the second. / If I do not know the answer, / I say so, / and I tell them when I will find out. / Honest and calm / beats fast and confused.',
      talk: ['Talk for three minutes on a surprise topic: tap a random prompt.', 'Answer five quick-fire questions from the prompt list.', 'Talk about a topic you know nothing about, calmly.', 'Explain your view on a current work issue.', 'Free talk: whatever comes up, point-first.'] },

    { n: 12, phase: 'Pressure', title: 'Pushback and presence',
      why: 'When someone challenges you, a calm, structured answer shows leadership. Don’t defend. Acknowledge, answer, move forward.',
      rule: 'Acknowledge. Answer. Next step.',
      no: 'No, no, actually that’s not right, so basically what happened was…', yes: 'I understand the concern. The fee rise covers the extra reporting. I can walk you through it this week.',
      focus: ['Start by acknowledging the concern in one line.',
        'Answer with facts, not feelings.',
        'Always end with a clear next step.',
        'Keep your voice low and slow when challenged.',
        'Final check-in. Compare Day 1 with Day 60.'],
      drill: { name: 'Pushback', sec: 45, structure: ['Acknowledge', 'Answer', 'Next step'], starters: ['I understand the concern.', 'Fair question.', 'I see why you ask.'],
        prompts: ['Client: “Your fees went up again. Why should we pay more?”', 'CEO: “Why is this report late again?”', 'Manager: “Your team is making too many mistakes.”', 'Client: “Another firm offered us a cheaper price.”', 'Colleague: “That process change will never work.”', 'Interviewer: “You don’t have enough experience for this role.”', 'Client: “We sent the documents, you lost them.”', 'CEO: “Why do we need another hire?”', 'Manager: “Why didn’t you raise this earlier?”', 'Client: “We are not happy with the service.”'] },
      passage: 'I understand your concern, / and it is a fair question. / The fee has increased / because the scope has grown. / We now prepare monthly reports, / not quarterly ones. / That means more work, / but also better decisions for you. / I would like to walk you through the detail. / Can we book thirty minutes this week?',
      talk: ['Practise answering the toughest pushback you expect at work.', 'Handle three challenges in a row, calmly.', 'Give a confident update to an imaginary CEO.', 'Talk about how you have grown over these 12 weeks.', 'Final talk: your week, with everything you learned.'] }
  ];

  var CHECKIN_DAYS = [1, 20, 40, 60];
  var ROLEPLAY_BY_WEEK = {2:'network',3:'ceo',4:'late',5:'ceo',6:'interview',7:'newclient',8:'raise',9:'network',10:'team',11:'interview',12:'client'};
  var BENCH = [
    { key: 'update', prompt: 'Give a 2-minute update on your work this week.', sec: 120, structure: ['Headline', 'Done', 'Next', 'Need'] },
    { key: 'answer', prompt: 'Tell me about yourself.', sec: 90, structure: ['Point', 'Reason', 'Example', 'Point'] }
  ];

  function hash(n) { n = (n * 2654435761) >>> 0; return n; }
  function pickN(arr, n, seed) {
    var out = [], used = {}, i = 0;
    while (out.length < Math.min(n, arr.length) && i < 200) { var k = hash(seed * 31 + i) % arr.length; if (!used[k]) { used[k] = 1; out.push(arr[k]); } i++; }
    return out;
  }

  // Build the plan for a given day (1..60)
  function day(d) {
    var w = W[Math.floor((d - 1) / 5)], dw = (d - 1) % 5;
    var checkin = CHECKIN_DAYS.indexOf(d) >= 0;
    var warm = pickN(WARM, 3, d);
    var steps = [];
    if (checkin) {
      steps.push({ k: 'lesson', min: 2 });
      BENCH.forEach(function (b) { steps.push({ k: 'bench', bench: b.key, prompt: b.prompt, sec: b.sec, structure: b.structure, min: 3 }); });
      steps.push({ k: 'warm', lines: warm, min: 3 });
      steps.push({ k: 'read', text: BENCH_PASSAGE, bench: 'passage', min: 3 });
      if (d !== 1) steps.push({ k: 'drill', reps: 2, prompts: pickN(w.drill.prompts, 2, d * 7), min: 6 });
      steps.push({ k: 'talk', topic: w.talk[dw], sec: 180, min: 4 });
    } else {
      var talkSec = w.n <= 4 ? 180 : 240;
      var rp = ROLEPLAY_BY_WEEK[w.n];
      steps.push({ k: 'warm', lines: warm, min: 3 });
      steps.push({ k: 'lesson', min: 2 });
      if (dw === 0) {
        steps.push({ k: 'drill', reps: 4, prompts: pickN(w.drill.prompts, 4, d * 7), min: 12 });
        steps.push({ k: 'read', text: w.passage, min: 4 });
        steps.push({ k: 'talk', topic: w.talk[dw], sec: talkSec, min: 6 });
      } else if (dw === 1) {
        steps.push({ k: 'game', game: 'fighter', min: 3 });
        steps.push({ k: 'drill', reps: 3, prompts: pickN(w.drill.prompts, 3, d * 7), min: 9 });
        steps.push({ k: 'read', text: w.passage, min: 4 });
        steps.push({ k: 'talk', topic: w.talk[dw], sec: talkSec, min: 6 });
      } else if (dw === 2) {
        steps.push({ k: 'drill', reps: 3, prompts: pickN(w.drill.prompts, 3, d * 7), min: 9 });
        steps.push({ k: 'read', text: w.passage, min: 4 });
        if (rp) steps.push({ k: 'roleplay', scn: rp, topic: w.talk[dw], sec: talkSec, min: 9 });
        else steps.push({ k: 'talk', topic: w.talk[dw], sec: talkSec, min: 6 });
      } else if (dw === 3) {
        steps.push({ k: 'game', game: w.n % 2 ? 'taboo' : 'squeeze', min: 4 });
        steps.push({ k: 'drill', reps: 3, prompts: pickN(w.drill.prompts, 3, d * 7), min: 9 });
        steps.push({ k: 'read', text: w.passage, min: 4 });
        steps.push({ k: 'talk', topic: w.talk[dw], sec: talkSec, min: 6 });
      } else {
        steps.push({ k: 'game', game: 'rapid', min: 5 });
        steps.push({ k: 'drill', reps: 2, prompts: pickN(w.drill.prompts, 2, d * 7), min: 6 });
        steps.push({ k: 'read', text: w.passage, min: 4 });
        steps.push({ k: 'talk', topic: w.talk[dw], sec: talkSec, min: 6 });
      }
    }
    steps.push({ k: 'wrap', min: 1 });
    return { day: d, week: w, dayOfWeek: dw + 1, focus: w.focus[dw], checkin: checkin, steps: steps };
  }

  return { weeks: W, days: 60, day: day, checkinDays: CHECKIN_DAYS, benchPassage: BENCH_PASSAGE };
})();
