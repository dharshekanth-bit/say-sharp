/* Say Sharp — content: drills, role-plays, games, levels, badges */
window.CONTENT = (function () {
  'use strict';

  var DRILLS = {
    update: {name:'Update', sub:'60 sec', sec:60, lbl:'Give a clear update',
      structure:['1 · Headline','2 · Done','3 · Next','4 · Need'],
      starters:['Quick update, three points.','The headline is this:','Short version: we are on track.','Here is where we are.'],
      prompts:['Give your manager a 60-second update on your week.','Update a client on a task that is running late.','Update the CEO on a new client you are onboarding.','Give a status update on this month’s payroll runs.','Tell your team what changed in a process and what they must do.','Update your manager on a problem you found in a report.','Give a quick update on the hiring you are running.','Report the status of BAS lodgements this month.']},
    answer: {name:'Answer', sub:'45 sec', sec:45, lbl:'Answer a question',
      structure:['Point','Reason','Example','Point again'],
      starters:['Yes. Here is why.','The short answer is no.','My answer is:','Two reasons.'],
      prompts:['Tell me about yourself.','What is your biggest strength at work?','Why should we hire you for this role?','Tell me about a process you improved.','How do you handle a missed deadline?','Why is this report different from last month?','A client asks: why did our fees go up? Answer.','What would you change in your team first?']},
    line: {name:'One line', sub:'20 sec', sec:20, maxWords:25, lbl:'Say it in one sentence',
      structure:['One sentence','Under 25 words','Then stop'],
      starters:['In one line:','Simply put:','Bottom line:'],
      prompts:['What did you do today?','Why is this task late?','What do you need from your manager?','What does your job involve?','What is the main risk this month?','What is your decision?','What is the one thing the client must know?']},
    free: {name:'Free', sub:'no limit', sec:0, lbl:'Free talk',
      structure:['Point first','Short sentences','Pause, don’t fill'],
      starters:['Let me start with the main point.','Here is what happened.'],
      prompts:['Explain your job to a friend who is not in finance.','Recap your day in 2 minutes.','Tell a story about a hard client situation.','Explain a decision you made this week.','Describe a goal for next month and the plan.']}
  };

  var WALK_TOPICS = ['Recap my day','Plan tomorrow','Explain my job','Practise an interview answer','Tell a story','Talk about a decision'];

  var TIPS = [
    {h:'Start with the point', p:'Say the answer or the headline first. Background comes only if someone asks.', no:'So actually, what happened was, the client sent the file late, and then…', yes:'The BAS is two days late. The client sent the file late.'},
    {h:'Update formula: Headline · Done · Next · Need', p:'Four short parts. Each part is one or two sentences.', no:'So basically we did a lot of things this week, like, we had…', yes:'We are on track. Payroll is done. Next is the review on Friday. I need approval by Thursday.'},
    {h:'Pause instead of a filler', p:'When you feel “uh” or “so” coming, close your mouth and breathe. One second of silence sounds calm and sure.', no:'Uh, so, the next point is…', yes:'(pause) The next point is…'},
    {h:'Say it once', p:'Repeating the same point does not make it stronger. Say it once, clearly, and move on.', no:'The payroll is done… yes so the payroll is all done… it’s done.', yes:'Payroll is done.'},
    {h:'One idea, one sentence', p:'Put a full stop after each idea. Long chains of “and… and… so…” lose people.', no:'We checked it and then we found an issue and so we fixed it and…', yes:'We checked it. We found one issue. It is fixed.'},
    {h:'Land the ending', p:'Finish with a clear last line, then stop. No “so yeah, that’s it, basically”.', no:'…so yeah, that’s basically it I think.', yes:'That’s the update. Any questions?'},
    {h:'Drop the softeners', p:'“Just”, “maybe”, “I think”, “a little bit” make a clear point sound unsure.', no:'I just think maybe we could, a little bit, change the date?', yes:'I suggest we move the date to Friday.'},
    {h:'Starter lines for when you freeze', p:'Keep a few ready. They buy you a second without a filler.', no:'Uhh… so… actually…', yes:'“Quick update, three points.” · “The short answer is…” · “Two things.” · “Bottom line:”'}
  ];

  /* ---------- Role-play scenarios ---------- */
  var SCENARIOS = {
    ceo: {title:'CEO check-in', who:'The CEO', av:'CEO', color:'#13203A', turns:5,
      setup:'You meet the CEO in the corridor. They have five minutes.',
      opening:'I’ve got five minutes before my next call. Where are we this month, and is there anything I need to worry about?',
      persona:'You are the CEO of a mid-sized accounting outsourcing firm. You are busy, sharp and direct, but fair. You want the bottom line first. If the person rambles, gives background first or repeats themselves, cut in politely: "Sorry, what is the bottom line?" Ask one probing follow-up about risk or numbers. If they are clear and confident, warm up and end positively.'},
    client: {title:'Unhappy client', who:'Client (business owner)', av:'CL', color:'#8A4B2A', turns:5,
      setup:'A long-standing client calls. They are unhappy about a fee increase.',
      opening:'I saw the new invoice. The fee has gone up again, and honestly I’m not sure the service has improved. Why should I keep paying more?',
      persona:'You are an Australian small business owner, a long-standing client of the accounting firm. You are frustrated about a fee increase and a late report last quarter. You push back twice: once on value, once on a past delay. You calm down only if the person acknowledges your concern, explains clearly without excuses, and offers a concrete next step. If they sound defensive or vague, stay unconvinced.'},
    interview: {title:'Job interview', who:'Interviewer (Head of Finance)', av:'HR', color:'#2E5E8A', turns:6,
      setup:'Interview for a Finance Manager role at an international company.',
      opening:'Thanks for coming in. Let’s start simple. Tell me about yourself and why this role.',
      persona:'You are the Head of Finance interviewing a candidate for a Finance Manager role at an international company. Ask realistic interview questions one at a time: about themselves, a process they improved, managing a team, handling a missed deadline, stakeholder management. Ask a follow-up when an answer is vague ("Can you give me a specific example?" or "What was the result?"). Be professional and neutral.'},
    late: {title:'Why is it late?', who:'Your manager', av:'MG', color:'#5B3D8A', turns:4,
      setup:'Your manager asks why a client deliverable is late.',
      opening:'The client emailed me directly. They say the report is late. What happened, and when will they get it?',
      persona:'You are the person’s line manager, Head of Finance and Accounting. You are concerned but supportive. You want: what happened (briefly), the new date, and what will stop it happening again. If they blame others or over-explain, ask "What could we have done differently?". If they are clear and own it, say so.'},
    newclient: {title:'New client call', who:'New client (startup founder)', av:'NC', color:'#2E8B6A', turns:5,
      setup:'First call with a new client who knows little about accounting.',
      opening:'Hi! We’ve just signed with your firm. To be honest, I don’t really understand what you’ll do for us or what you need from me. Can you explain?',
      persona:'You are a startup founder who just became a client. You are friendly but not a finance person. You get confused by jargon and say so ("Sorry, what does that mean?"). You want to know what the firm will do, what you must send, and by when. Reward simple, clear explanations.'},
    raise: {title:'Ask for a promotion', who:'Your manager', av:'MG', color:'#5B3D8A', turns:5,
      setup:'You have booked time with your manager to ask for a promotion.',
      opening:'You wanted to talk. What’s on your mind?',
      persona:'You are the person’s manager. You are open but careful with budget. Ask what they have achieved, why now, and what would change in their role. Push back once: "Budgets are tight this year." Respond well to specific results and a confident, calm ask. Respond poorly to vague or hesitant requests.'},
    team: {title:'Team meeting', who:'A team member', av:'TM', color:'#8A6A12', turns:4,
      setup:'You announce a new process. A team member is not happy.',
      opening:'Sorry, before we move on. This new review process will add more work for us. Why are we doing this?',
      persona:'You are a hard-working but sceptical team member. You worry the new process adds workload. You raise one more concern about deadlines. You accept the change if the person explains the reason simply, shows they listened, and says how they will support the team.'},
    network: {title:'Networking event', who:'Someone at an event', av:'EV', color:'#2A7A8A', turns:5,
      setup:'Small talk at a business networking event.',
      opening:'Hi, I don’t think we’ve met. I’m with a logistics company. What brings you here tonight?',
      persona:'You are a friendly professional at a business networking event. Keep the conversation light and natural. Ask about their work, then share a little about yours. Notice if they ask you questions back. If they give long monologues, your interest drops slightly. End warmly.'}
  };
  var COACH_CHAT = {title:'Talk with your coach', who:'Coach', av:'🙂', color:'#2E8B6A', turns:12, coachMode:true, open:true,
    setup:'An open conversation on any topic. Your coach keeps it going and gently corrects you.',
    opening:'Hi! Good to see you. Let’s just talk. Tell me, how has your day been so far?',
    persona:'You are a warm, friendly English conversation partner and speaking coach for a busy finance professional. Have a natural, relaxed conversation about everyday life and work: their day, plans, interests, work challenges, news, travel, food. Ask one open question at a time and show real interest. Share a little about yourself sometimes, like a real person. Encourage them to give fuller, clearer answers. Never lecture.'};
  var CUSTOM_SCENARIO = {title:'My own scenario', who:'', av:'??', color:'#3D5A8A', turns:5, setup:'', opening:'', persona:''};

  /* ---------- Games ---------- */
  var FIGHTER_TOPICS = ['Your favourite food and why','The best trip you have taken','How you start your work day','A skill everyone should learn','What makes a great manager','Your ideal weekend','The best advice you ever got','How technology changed your job','A place in Sri Lanka you love','What you would do with an extra hour a day','A book or film you recommend','How to handle a stressful week','Your proudest moment at work','What you are learning right now','The future of accounting','How to train a new team member','A habit you want to build','What makes a client happy','Cricket or another sport you follow','Why you chose your career'];

  var TABOO = [
    {topic:'Explain what a BAS is', banned:['tax','GST','form']},
    {topic:'Explain what payroll is', banned:['salary','pay','wages']},
    {topic:'Describe your job', banned:['accounts','finance','manager']},
    {topic:'Explain what an audit is', banned:['check','auditor','review']},
    {topic:'Explain a budget', banned:['money','plan','spend']},
    {topic:'Describe a good client', banned:['happy','pays','nice']},
    {topic:'Explain what a reconciliation is', banned:['match','bank','balance']},
    {topic:'Explain what a deadline is', banned:['date','time','late']},
    {topic:'Explain what a meeting is', banned:['people','talk','discuss']},
    {topic:'Explain what an invoice is', banned:['bill','payment','amount']},
    {topic:'Describe your city', banned:['people','traffic','big']},
    {topic:'Explain what a team is', banned:['people','together','group']},
    {topic:'Explain what an MBA is', banned:['degree','business','university']},
    {topic:'Explain cash flow', banned:['money','bank','payments']},
    {topic:'Describe a laptop', banned:['computer','screen','keyboard']}
  ];

  var SQUEEZE = [
    {ramble:'So, um, basically what happened was that the client, they sent us the bank statements quite late, I think it was like on Thursday or so, and because of that, you know, we couldn’t really start the reconciliation on time, so the BAS is probably going to be a little bit late, maybe two days or so, but we are working on it.',
     facts:['BAS will be about two days late','client sent statements late (Thursday)','team is working on it']},
    {ramble:'Actually, I just wanted to say that, I mean, the team has been really busy this month, like, really busy, and there are a lot of new clients coming in, so I was thinking maybe, if possible, we could kind of look at hiring one more person, because otherwise it might be difficult to manage.',
     facts:['team is overloaded','new clients are coming in','asking to hire one more person']},
    {ramble:'So the payroll, the payroll for all the entities, it’s done, all of them are done, and, uh, we sent the payslips as well, and the only thing that’s pending is, basically, the approval from the director for the super payment, which we need, I think, by Friday.',
     facts:['payroll done for all entities','payslips sent','need director approval for super payment by Friday']},
    {ramble:'Um, so regarding the report, I looked into it and, you know, the numbers were different from last month because, actually, there was a timing difference with one large invoice, it came in early, so it is not really an error, it’s just timing, basically.',
     facts:['numbers differ from last month','cause is a timing difference','one large invoice came in early','not an error']},
    {ramble:'I just wanted to maybe let you know that, uh, I was thinking about the process, and I feel like if we kind of moved the review step earlier, like before the client call instead of after, we might, you know, catch the mistakes earlier and save some time.',
     facts:['suggest moving the review step earlier','before the client call','catches mistakes earlier and saves time']},
    {ramble:'So, basically, the new client, they signed last week, and, um, we had the first call, it went well I think, and they need to send us their Xero access and the last three months of statements, and then we can start, probably from next Monday or so.',
     facts:['new client signed last week','first call went well','need Xero access and three months of statements','start next Monday']},
    {ramble:'Actually, the thing is, the fee increase, it’s because, you know, the scope has grown a lot, like, we now do monthly reports and not quarterly, and also the payroll is bigger, so the work is more, and that’s basically why the fee has gone up.',
     facts:['fee rose because scope grew','monthly instead of quarterly reports','payroll is bigger']},
    {ramble:'Um, so for the interview, I mean, I think my biggest strength is, like, I am good with reports, and, you know, I redesigned the capacity report at my company, and now, basically, the leadership, they use it every month to make decisions, so yeah.',
     facts:['strength is reporting','redesigned the capacity report','leadership uses it monthly for decisions']},
    {ramble:'So I think, maybe, we should, kind of, set a cut-off date for clients, because, you know, they keep sending documents late, every month it’s the same, and the team has to work overtime, so a fixed date, like the fifth of every month, might help.',
     facts:['clients send documents late every month','team works overtime','propose fixed cut-off (5th of each month)']},
    {ramble:'Uh, the training session, it went quite well actually, I mean, most of the team joined, like eight out of ten people, and they asked good questions, and, basically, next week we will do the second part about the new system.',
     facts:['training went well','eight of ten joined','good questions','second part next week on new system']}
  ];

  var RAPID = ['What is the best part of your job?','How do you handle pressure?','What would you change about your company?','What makes a good update?','Describe yourself in three words.','What did you learn this week?','What is your biggest weakness?','How will AI change your work?','What is one mistake new managers make?','Why do projects run late?','What do clients value most?','How do you prioritise your day?','What is your favourite way to relax?','What does good leadership look like?','How do you give feedback to a colleague?','What would you do as CEO for a day?','What is the hardest part of payroll?','How do you build trust with a client?','What is a goal you have this year?','What skill are you improving right now?','Why is clear communication important?','What do you do when you disagree with your manager?','What is your proudest achievement?','How do you handle a difficult email?','What is one habit that makes you productive?','What would you tell a new team member on day one?','How do you explain finance to non-finance people?','What makes a meeting useful?','What did you learn from a recent mistake?','Where do you see yourself in three years?'];

  /* ---------- Levels & badges ---------- */
  var LEVELS = [
    [0,'Starter'],[120,'Warming Up'],[300,'Finding Flow'],[550,'Clear Talker'],[850,'Point Maker'],
    [1200,'Sharp Speaker'],[1650,'Confident Voice'],[2200,'Persuader'],[2850,'Leader Voice'],[3600,'Executive Presence']
  ];
  var BADGES = [
    {id:'first', icon:'🎙', name:'First words', desc:'Finish your first recording'},
    {id:'s80', icon:'⭐', name:'80 Club', desc:'Score 80 or more'},
    {id:'s90', icon:'🌟', name:'90 Club', desc:'Score 90 or more'},
    {id:'zero', icon:'🧼', name:'Clean sweep', desc:'30+ seconds with zero fillers'},
    {id:'streak3', icon:'🔥', name:'On fire', desc:'3-day streak'},
    {id:'streak7', icon:'🔥', name:'Week warrior', desc:'7-day streak'},
    {id:'streak14', icon:'🏅', name:'Habit formed', desc:'14-day streak'},
    {id:'rp1', icon:'🎭', name:'Actor', desc:'Finish a role-play'},
    {id:'cam1', icon:'📷', name:'On camera', desc:'Finish a camera session'},
    {id:'presence8', icon:'😎', name:'Presence', desc:'Score 8+ on camera presence'},
    {id:'rp5', icon:'🎬', name:'Seasoned', desc:'Finish 5 role-plays'},
    {id:'ceo', icon:'💼', name:'CEO ready', desc:'Score 80+ in the CEO role-play'},
    {id:'fighter60', icon:'🥊', name:'Survivor', desc:'Last 60 seconds in Filler Fighter'},
    {id:'taboo', icon:'🚫', name:'Taboo master', desc:'Win a Taboo round'},
    {id:'rapid40', icon:'⚡', name:'Quick thinker', desc:'40+ points in Rapid Fire'},
    {id:'squeeze', icon:'🍋', name:'Squeezer', desc:'Score 9+ in Squeeze It'},
    {id:'week1', icon:'📅', name:'Week one', desc:'Finish week 1 of Phase 1'},
    {id:'half', icon:'⛰', name:'Halfway', desc:'Finish day 14'},
    {id:'grad', icon:'🎓', name:'Graduate', desc:'Finish all 28 days'}
  ];

  return {DRILLS:DRILLS, WALK_TOPICS:WALK_TOPICS, TIPS:TIPS, SCENARIOS:SCENARIOS, COACH_CHAT:COACH_CHAT, CUSTOM_SCENARIO:CUSTOM_SCENARIO,
    FIGHTER_TOPICS:FIGHTER_TOPICS, TABOO:TABOO, SQUEEZE:SQUEEZE, RAPID:RAPID, LEVELS:LEVELS, BADGES:BADGES};
})();
