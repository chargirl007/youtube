/* ==========================================================================
   The DM Sales Playbook — Plug-and-Play Message Builder
   Plain JavaScript, no dependencies, no network requests.
   All data stays in memory or in this browser's localStorage.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Small DOM + storage helpers
     ------------------------------------------------------------------------ */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        toast('Couldn’t save — your browser may be blocking local storage.', 'warn');
        return false;
      }
    },
  };

  const KEYS = {
    saved: 'dmpb.saved.v1',
    planner: 'dmpb.planner.v1',
    tone: 'dmpb.tone.v1',
    anonymize: 'dmpb.anonymize.v1',
  };

  /* ------------------------------------------------------------------------
     Icons (inline SVG, stroke-based)
     ------------------------------------------------------------------------ */
  const ICON_PATHS = {
    connect: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    understand: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
    bridge: '<path d="M2 18h20"/><path d="M4 18v-3a8 8 0 0 1 16 0v3"/><path d="M8 18v-4.5"/><path d="M12 18v-6"/><path d="M16 18v-4.5"/>',
    invite: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    followup: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    save: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    stop: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  };
  const icon = (name, cls) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICON_PATHS[name] || ''}</svg>`;

  /* ------------------------------------------------------------------------
     Text helpers
     ------------------------------------------------------------------------ */

  // A missing required value: rendered as a highlighted [Token] — never invented.
  class Missing {
    constructor(label) { this.label = label; }
    toString() { return `[${this.label}]`; }
  }
  const isMissing = (v) => v instanceof Missing;

  // Tagged template that flattens strings / Missing / nested arrays into one string.
  function t(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => {
      out += s;
      if (i < vals.length) out += flat(vals[i]);
    });
    return out;
  }
  function flat(v) {
    if (v == null || v === false) return '';
    if (Array.isArray(v)) return v.map(flat).join('');
    return String(v);
  }

  function tidy(s) {
    return s
      .replace(/[ \t]+/g, ' ')
      .replace(/ +([.,!?;:)])/g, '$1')
      .replace(/\( +/g, '(')
      .replace(/([,;:])(?=[.!?])/g, '')
      .replace(/\.([!?])/g, '$1')
      .replace(/(^|[^.])\.\.(?!\.)/g, '$1.')
      .replace(/\?\./g, '?')
      .replace(/!\./g, '!')
      .replace(/—\s+/g, '—')
      .replace(/\s+—/g, '—')
      .replace(/\n /g, '\n')
      .trim();
  }

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/[\s.!?,;:]+$/, '');
  const cap = (s) => (isMissing(s) || !s ? s : s.charAt(0).toUpperCase() + s.slice(1));

  // Lower-case the first letter of a mid-sentence phrase only when it is clearly
  // a common word (so "Growing my list" → "growing my list", but "Instagram" stays).
  const COMMON_STARTS = new Set(
    ('the a an you your yours youre youve youd youll my our their they theyre theyve he she his her it its this that these those ' +
      'some more less how what when why where being having not no to for with about consistent better new first daily weekly monthly ' +
      'simple clear all each every most lots time content clients client leads sales money posting email writing finding keeping making ' +
      'just really still always never one two three few many much several other another any i’m im ive').split(' ')
  );
  function midCase(s) {
    if (!s) return s;
    const first = s.split(/\s+/)[0];
    const bare = first.toLowerCase().replace(/[^a-z’]/g, '');
    if (/^I\b/.test(s) && !/^It/.test(s)) return s; // keep "I"
    if (/^[A-Z][a-z’']/.test(first) && (COMMON_STARTS.has(bare.replace(/[’']/g, '')) || /ing$/.test(bare))) {
      return s.charAt(0).toLowerCase() + s.slice(1);
    }
    return s;
  }

  // Convert third-person notes ("they said they're busy") to second person ("you said you're busy").
  function toYou(s) {
    const map = [
      [/\bthey[’']re\b/gi, "you're"], [/\bthey[’']ve\b/gi, "you've"], [/\bthey[’']d\b/gi, "you'd"], [/\bthey[’']ll\b/gi, "you'll"],
      [/\bthey were\b/gi, 'you were'], [/\bthey was\b/gi, 'you were'], [/\bthemselves\b/gi, 'yourself'], [/\bthemself\b/gi, 'yourself'],
      [/\btheirs\b/gi, 'yours'], [/\btheir\b/gi, 'your'], [/\bthem\b/gi, 'you'], [/\bthey\b/gi, 'you'],
      [/\byou is\b/gi, 'you are'], [/\byou has\b/gi, 'you have'], [/\byou does\b/gi, 'you do'], [/\byou wants\b/gi, 'you want'],
      [/\byou needs\b/gi, 'you need'],
    ];
    let out = s;
    for (const [re, rep] of map) {
      out = out.replace(re, (m) => (m.charAt(0) === m.charAt(0).toUpperCase() && m.charAt(0) !== m.charAt(0).toLowerCase() ? cap(rep) : rep));
    }
    return out;
  }

  const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const MISSING_RE = /\[[^\]\n]{1,48}\]/g;
  const findMissing = (s) => Array.from(new Set(s.match(MISSING_RE) || []));
  const highlight = (s) => escapeHtml(s).replace(/\[[^\]\n]{1,48}\]/g, (m) => `<mark>${m}</mark>`);

  /* ------------------------------------------------------------------------
     Tones
     ------------------------------------------------------------------------ */
  const TONES = [
    { id: 'friendly', label: 'Friendly & Casual', short: 'Friendly', sub: 'warm, relaxed' },
    { id: 'professional', label: 'Professional & Confident', short: 'Professional', sub: 'polished, assured' },
    { id: 'direct', label: 'Short & Direct', short: 'Direct', sub: 'brief, clear' },
  ];
  const toneById = (id) => TONES.find((x) => x.id === id) || TONES[0];

  /* ------------------------------------------------------------------------
     Scenario helpers
     ------------------------------------------------------------------------ */
  const WATCH_TYPES = new Set(['video', 'reel', 'story', 'live stream']);
  const seenVerb = (type) => (WATCH_TYPES.has(type) ? 'watched' : type === 'podcast episode' ? 'listened to' : 'read');
  const srcPhrase = (f) => t`your ${f.sourceType}${f.where ? t` ${f.where}` : f.platform ? t` on ${f.platform}` : ''}`;

  const NEXT_STEP_ASK = {
    learn: {
      friendly: 'Would you be open to hearing how it works?',
      professional: 'Would you be open to hearing how it works?',
      direct: 'Want to hear how it works?',
    },
    details: {
      friendly: 'Want me to send over the details?',
      professional: 'Would it be helpful if I sent you the details?',
      direct: 'Want the details?',
    },
    call: {
      friendly: 'Would you be open to a quick call to see if it’s a good fit?',
      professional: 'Would you be open to a short call to see whether it’s a fit?',
      direct: 'Open to a quick call to see if it fits?',
    },
  };

  /* ------------------------------------------------------------------------
     The five scenarios
     Each template is a function of the normalized field object `f`.
     Required-but-empty fields arrive as Missing tokens, so nothing is invented.
     ------------------------------------------------------------------------ */
  const SCENARIOS = [
    {
      id: 'connect',
      name: 'Connect',
      tagline: 'Start the conversation',
      desc: 'Open a relevant, low-pressure conversation.',
      goal: 'Goal: open a relevant, low-pressure conversation.',
      tags: ['Relevance', 'Curiosity', 'Personalization', 'Low commitment'],
      fields: [
        { key: 'name', label: 'Prospect’s first name', token: 'Name', required: true, shared: true, transform: 'name', placeholder: 'e.g. Maya' },
        {
          key: 'platform', label: 'Platform', type: 'select', default: '',
          options: [['', 'Not specified'], ['Instagram', 'Instagram'], ['Facebook', 'Facebook'], ['LinkedIn', 'LinkedIn'], ['TikTok', 'TikTok'], ['YouTube', 'YouTube'], ['Threads', 'Threads'], ['X', 'X / Twitter'], ['Pinterest', 'Pinterest'], ['Substack', 'Substack']],
        },
        {
          key: 'sourceType', label: 'What you came across', type: 'select', default: 'post',
          options: [['post', 'Their post'], ['comment', 'Their comment'], ['video', 'Their video'], ['reel', 'Their reel / short'], ['story', 'Their story'], ['live stream', 'Their live stream'], ['article', 'Their article'], ['newsletter', 'Their newsletter'], ['podcast episode', 'Their podcast episode'], ['thread', 'Their thread']],
        },
        { key: 'where', label: 'Where you found them', token: 'Where', transform: 'mid', placeholder: 'e.g. in the Freelance Designers group', hint: 'Optional. Leave blank to just mention the platform.' },
        { key: 'topic', label: 'What it was about', token: 'Topic', required: true, transform: 'mid', placeholder: 'e.g. pricing your first coaching package' },
        { key: 'obs', label: 'Something specific you noticed', token: 'Specific observation', required: true, transform: 'you', placeholder: 'e.g. you mentioned you’re raising your rates next month', hint: 'Something real from their content, written as you’d say it to them (start with “you…”).', multiline: true },
        { key: 'goal', label: 'Relevant goal to ask about', token: 'Relevant goal', required: true, transform: 'mid', placeholder: 'e.g. booking more discovery calls', hint: 'Connected to what you offer. Phrase it as an activity (“growing…”, “booking…”).' },
      ],
      templates: {
        friendly: [
          { label: 'Curious opener', fn: (f) => t`Hey ${f.name}, I came across ${srcPhrase(f)} about ${f.topic}. I noticed ${f.obs}, and I was curious—are you currently working on ${f.goal}?` },
          { label: 'Warm & specific', fn: (f) => t`Hi ${f.name}! ${cap(srcPhrase(f))} about ${f.topic} caught my eye—especially that ${f.obs}. Is ${f.goal} something you’re focused on right now?` },
          { label: 'Easygoing', fn: (f) => t`Hey ${f.name} 👋 I ${seenVerb(f.sourceType)} ${srcPhrase(f)} about ${f.topic}, and the part where ${f.obs} stood out to me. Are you working on ${f.goal} at the moment?` },
        ],
        professional: [
          { label: 'Polished opener', fn: (f) => t`Hi ${f.name}, I came across ${srcPhrase(f)} about ${f.topic}. ${f.C('obs')}, which stood out to me. Are you currently focused on ${f.goal}?` },
          { label: 'Confident & curious', fn: (f) => t`Hello ${f.name}, I ${seenVerb(f.sourceType)} ${srcPhrase(f)} about ${f.topic} and noticed ${f.obs}. I’m curious—is ${f.goal} a priority for you right now?` },
          { label: 'Respectful', fn: (f) => t`Hi ${f.name}, thank you for sharing ${srcPhrase(f)} about ${f.topic}. I noticed ${f.obs}. May I ask whether ${f.goal} is something you’re working on at the moment?` },
        ],
        direct: [
          { label: 'Quick note', fn: (f) => t`Hi ${f.name}, saw ${srcPhrase(f)} about ${f.topic}—noticed ${f.obs}. Working on ${f.goal} right now?` },
          { label: 'Straight to it', fn: (f) => t`Hey ${f.name}, noticed ${f.obs} in ${srcPhrase(f)}. Is ${f.goal} a focus for you right now?` },
          { label: 'One-liner', fn: (f) => t`${f.name}, ${srcPhrase(f)} about ${f.topic} stood out—especially that ${f.obs}. Are you working on ${f.goal}?` },
        ],
      },
      explain: {
        lead: 'A good opener proves you paid attention and asks something easy to answer. It’s about them—not your offer.',
        principles: [
          ['Relevance', 'Referencing what they actually shared shows this isn’t a copy-paste blast.'],
          ['Real personalization', 'One concrete, true detail does more than a dozen vague compliments.'],
          ['Curiosity', 'A genuine question invites a reply without asking them for anything.'],
          ['Low commitment', 'No link, no pitch, no call request—just an easy question about their goal.'],
        ],
        avoid: ['Pitching your offer in the first message', 'Vague flattery (“Love your content!”)', 'Asking for a call before you know if they need help', 'Pretending you’ve followed them for ages'],
        dynamic: (f) =>
          f.has('obs')
            ? `Your detail — “${f.obs}” — is what makes this feel human. Keep it real and specific.`
            : 'Add one specific, true detail from their content. It’s what separates a personal message from a mass DM.',
      },
    },
    {
      id: 'understand',
      name: 'Understand',
      tagline: 'Discover their needs',
      desc: 'Learn about their situation without interrogating.',
      goal: 'Goal: learn about their situation without interrogating them.',
      tags: ['Active listening', 'Empathy', 'Curiosity', 'Autonomy'],
      fields: [
        { key: 'name', label: 'Prospect’s first name', token: 'Name', required: true, shared: true, transform: 'name', placeholder: 'e.g. Maya' },
        { key: 'said', label: 'What they previously said', token: 'What they said', transform: 'you', placeholder: 'e.g. you’ve been posting every day but inquiries are slow', hint: 'Paraphrase their words. “they…” is converted to “you…” automatically.', multiline: true },
        { key: 'goal', label: 'Their goal', token: 'Goal', required: true, transform: 'mid', placeholder: 'e.g. getting more consistent clients' },
        { key: 'challenge', label: 'A challenge they’ve mentioned', token: 'Challenge', transform: 'mid', placeholder: 'e.g. finding time to create content', hint: 'Only fill this in if they actually said it. Leave blank and the message asks openly instead of assuming.' },
      ],
      templates: {
        friendly: [
          { label: 'Open question', fn: (f) => (f.has('challenge')
            ? t`That makes sense, ${f.name}. You mentioned ${f.challenge} has been tough—what’s been the hardest part of that for you?`
            : t`That makes sense, ${f.name}. When it comes to ${f.goal}, what’s been the biggest challenge for you so far?`) },
          { label: 'Reflect back', fn: (f) => {
            const said = f.has('said') ? t`—sounds like ${f.said}` : '';
            return f.has('challenge')
              ? t`I hear you, ${f.name}${said}. When ${f.challenge} comes up, how are you handling it at the moment?`
              : t`I hear you, ${f.name}${said}. What would make ${f.goal} feel easier right now?`;
          } },
          { label: 'Future-focused', fn: (f) => (f.has('challenge')
            ? t`Thanks for being so open, ${f.name}! With ${f.challenge} in the mix, what have you tried so far?`
            : t`Thanks for sharing that, ${f.name}! Since ${f.goal} is the focus, what would a great result look like for you?`) },
        ],
        professional: [
          { label: 'Clarifying', fn: (f) => {
            const said = f.has('said') ? t` It sounds like ${f.said}.` : '';
            return f.has('challenge')
              ? t`Thanks for sharing that, ${f.name}.${said} You mentioned ${f.challenge}—what have you found most difficult about it?`
              : t`Thanks for sharing that, ${f.name}.${said} When it comes to ${f.goal}, what has been the biggest obstacle so far?`;
          } },
          { label: 'Priorities', fn: (f) => (f.has('challenge')
            ? t`That’s helpful context, ${f.name}. You mentioned ${f.challenge}. What have you tried so far to work through it?`
            : t`That’s helpful context, ${f.name}. To make sure I understand—what feels most important to get right with ${f.goal} right now?`) },
          { label: 'Outcome-focused', fn: (f) => (f.has('challenge')
            ? t`I appreciate you explaining that, ${f.name}. How is ${f.challenge} affecting your progress with ${f.goal}?`
            : t`I appreciate you explaining that, ${f.name}. If ${f.goal} went the way you wanted over the next few months, what would be different?`) },
        ],
        direct: [
          { label: 'Simple ask', fn: (f) => (f.has('challenge')
            ? t`Makes sense, ${f.name}. What’s been hardest about ${f.challenge}?`
            : t`Makes sense, ${f.name}. What’s been the biggest challenge with ${f.goal} so far?`) },
          { label: 'Focus check', fn: (f) => (f.has('challenge')
            ? t`Got it, ${f.name}. What have you tried so far for ${f.challenge}?`
            : t`Got it, ${f.name}. What’s your main focus with ${f.goal} right now?`) },
          { label: 'Quick reflect', fn: (f) => {
            const said = f.has('said') ? t` Sounds like ${f.said}.` : '';
            return f.has('challenge')
              ? t`Thanks, ${f.name}.${said} What would solving ${f.challenge} mean for you?`
              : t`Thanks, ${f.name}.${said} Where are you at with ${f.goal} right now?`;
          } },
        ],
      },
      explain: {
        lead: 'Now you listen. One open question lets them describe their situation in their own words—so you never have to guess.',
        principles: [
          ['Active listening', 'Reflecting what they said shows you heard them, not that you were waiting to pitch.'],
          ['Empathy', '“That makes sense” validates their experience without assuming anything new.'],
          ['Curiosity', 'Open “what/how” questions get richer answers than yes/no questions.'],
          ['Autonomy', 'They choose what to share. You don’t diagnose problems they haven’t mentioned.'],
        ],
        avoid: ['Firing several questions in one message', 'Assuming a pain point they didn’t mention', 'Jumping to your offer', 'Leading questions (“Don’t you hate when…?”)'],
        dynamic: (f) =>
          f.has('challenge')
            ? 'You’re only referencing a challenge they mentioned themselves—that keeps it honest.'
            : 'No challenge entered, so every version asks openly instead of assuming one. That’s exactly right if they haven’t named a problem.',
      },
    },
    {
      id: 'bridge',
      name: 'Bridge',
      tagline: 'Connect problem to solution',
      desc: 'Share useful insight before any offer.',
      goal: 'Goal: show understanding and offer a useful insight before introducing any offer.',
      tags: ['Trust', 'Specificity', 'Relevance', 'Value first'],
      fields: [
        { key: 'name', label: 'Prospect’s first name', token: 'Name', required: true, shared: true, transform: 'name', placeholder: 'e.g. Maya' },
        { key: 'challenge', label: 'Challenge they explicitly mentioned', token: 'Challenge', required: true, transform: 'mid', placeholder: 'e.g. finding time to create content', hint: 'Use their words. Don’t add problems they didn’t mention.' },
        { key: 'outcome', label: 'Desired outcome', token: 'Desired outcome', required: true, transform: 'mid', placeholder: 'e.g. posting consistently without it taking over your week' },
        { key: 'insight', label: 'A useful insight or tip', token: 'Useful insight', required: true, transform: 'mid', placeholder: 'e.g. batching a month of posts in one afternoon', hint: 'Something genuinely helpful they could use even if they never buy.' },
        { key: 'howHelp', label: 'How your service may help', token: 'How you help', transform: 'mid', placeholder: 'e.g. I help coaches set up simple content systems', hint: 'Optional and kept light—mentioned in one version only. The real offer comes in Invite.' },
      ],
      templates: {
        friendly: [
          { label: 'Empathy + tip', fn: (f) => t`I can see why ${f.challenge} has been frustrating, ${f.name}. One thing that can help with ${f.outcome} is ${f.insight}. Have you tried anything like that before?` },
          { label: 'Idea to try', fn: (f) => t`Totally get it, ${f.name}—${f.challenge} is a lot to juggle. One idea that might help with ${f.outcome}: ${f.insight}. Would something like that fit how you work?` },
          { label: 'Small shift', fn: (f) => t`Ah, ${f.challenge} can be such a drain, ${f.name}. A small shift that can make ${f.outcome} easier is ${f.insight}. Is that something you’ve experimented with?` },
        ],
        professional: [
          { label: 'Considered', fn: (f) => t`Thanks for explaining, ${f.name}. ${f.C('challenge')} is a real hurdle when you’re working toward ${f.outcome}. One approach worth considering is ${f.insight}. Have you explored anything similar?` },
          { label: 'Comparative', fn: (f) => t`I understand why ${f.challenge} would be frustrating, ${f.name}. If ${f.outcome} is the goal, ${f.insight} can be a useful starting point. How does that compare with what you’re doing now?` },
          { label: 'Recommendation', fn: (f) => {
            const help = f.has('howHelp') ? t` (It’s close to what I do—${f.howHelp}—so I’m happy to share more if that’s ever useful.)` : '';
            return t`${f.name}, based on what you’ve shared about ${f.challenge}, one thing worth looking at is ${f.insight}—it can make ${f.outcome} more manageable.${help} Have you tried that approach?`;
          } },
        ],
        direct: [
          { label: 'Quick tip', fn: (f) => t`Makes sense, ${f.name}. For ${f.outcome}, try ${f.insight}. Have you done anything like that?` },
          { label: 'Straight answer', fn: (f) => t`${f.C('challenge')} is tough. One quick idea: ${f.insight}. Tried that yet, ${f.name}?` },
          { label: 'Nudge', fn: (f) => t`Got it, ${f.name}. ${f.C('insight')} can help with ${f.outcome}. Worth a try?` },
        ],
      },
      explain: {
        lead: 'Give before you ask. A genuinely useful tip shows you understand their challenge and builds trust before an offer ever appears.',
        principles: [
          ['Value first', 'Helping with no strings attached earns the right to suggest more later.'],
          ['Specificity', 'A concrete tip tied to their stated challenge beats general advice.'],
          ['Relevance', 'You connect their own words to a possible path—so the conversation stays about them.'],
          ['Trust', 'Honest language (“can help”) instead of promises (“will fix”).'],
        ],
        avoid: ['Turning the tip into a pitch', 'Claiming results you can’t back up', 'Talking about problems they never mentioned', 'Burying them in a long lesson'],
        dynamic: (f) =>
          f.has('insight')
            ? 'Your tip is the value here. If they try it and it helps, you’ve built real trust—whether or not they ever buy.'
            : 'Add a tip they could genuinely use on their own. That’s what makes this message valuable rather than salesy.',
      },
    },
    {
      id: 'invite',
      name: 'Invite',
      tagline: 'Introduce the offer',
      desc: 'Invite an interested prospect to a next step.',
      goal: 'Goal: invite an interested, relevant prospect to learn more or take the next step.',
      tags: ['Permission', 'Clarity', 'Relevance', 'Freedom of choice'],
      fields: [
        { key: 'name', label: 'Prospect’s first name', token: 'Name', required: true, shared: true, transform: 'name', placeholder: 'e.g. Maya' },
        { key: 'problem', label: 'Their stated problem or goal', token: 'Problem', required: true, transform: 'you', placeholder: 'e.g. getting consistent clients from Instagram', hint: 'What they told you—in their words.' },
        { key: 'service', label: 'Your service or offer', token: 'Service', required: true, transform: 'mid', placeholder: 'e.g. my 6-week Content Confidence program' },
        { key: 'outcome', label: 'The outcome you help with', token: 'Outcome', required: true, transform: 'mid', placeholder: 'e.g. creating a simple, repeatable weekly content plan', hint: 'Be specific and realistic. No income or results guarantees.' },
        {
          key: 'nextStep', label: 'Preferred next step', type: 'select', default: 'learn',
          options: [['learn', 'Hear how it works'], ['details', 'Receive the details'], ['call', 'Book a call']],
        },
      ],
      templates: {
        friendly: [
          { label: 'Natural invite', fn: (f) => t`Thanks for sharing all that, ${f.name}. Based on what you’ve said about ${f.problem}, I think ${f.service} might be relevant—it helps with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].friendly}` },
          { label: 'Conversational', fn: (f) => t`${f.name}, I’ve enjoyed chatting about ${f.problem}! It’s actually close to what ${f.service} is built for—helping with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].friendly} Totally fine if not.` },
          { label: 'No-pressure', fn: (f) => t`No pressure at all, ${f.name}, but from what you’ve said about ${f.problem}, ${f.service} could be useful. It’s designed to help with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].friendly}` },
        ],
        professional: [
          { label: 'Clear & relevant', fn: (f) => t`${f.name}, based on what you’ve shared about ${f.problem}, I think ${f.service} might be relevant because it helps with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].professional}` },
          { label: 'Considered', fn: (f) => t`Thank you for walking me through ${f.problem}, ${f.name}. It lines up with what ${f.service} is designed for: ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].professional} Either way, I’m glad we connected.` },
          { label: 'Open door', fn: (f) => t`${f.name}, given what you’ve mentioned about ${f.problem}, ${f.service} may be worth a look—its focus is ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].professional} If it’s not the right time, no problem.` },
        ],
        direct: [
          { label: 'Straightforward', fn: (f) => t`${f.name}, ${f.service} helps with ${f.outcome}—which sounds relevant to ${f.problem}. ${NEXT_STEP_ASK[f.nextStep].direct}` },
          { label: 'Brief', fn: (f) => t`${f.name}, given what you said about ${f.problem}, ${f.service} might fit. It helps with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].direct}` },
          { label: 'Quick thought', fn: (f) => t`Quick thought, ${f.name}: since ${f.problem} came up, ${f.service} could help with ${f.outcome}. ${NEXT_STEP_ASK[f.nextStep].direct} No worries if not.` },
        ],
      },
      explain: {
        lead: 'Only invite when it’s relevant. Connect what they told you to what you offer, then ask permission to share more.',
        principles: [
          ['Permission', '“Would you be open to…” lets them say yes or no comfortably.'],
          ['Clarity', 'Name what you offer and what it helps with—no mystery, no bait.'],
          ['Relevance', 'Anchoring to their own words (“based on what you’ve shared”) shows this isn’t a generic pitch.'],
          ['Freedom of choice', 'An easy out (“totally fine if not”) lowers pressure and builds trust.'],
        ],
        avoid: ['Guaranteeing income, sales or results', 'Fake scarcity (“only 2 spots left!”) unless literally true', 'Guilt or pressure', 'Inviting someone who hasn’t shown a relevant need'],
        dynamic: (f) =>
          ({
            call: 'You’re asking for a call—the biggest commitment of the three. Make sure they’ve shown real interest first.',
            details: 'Offering to send details is low-pressure: they can read on their own time and decide.',
            learn: 'Asking if they’d like to hear how it works is the gentlest next step—easy to say yes or no to.',
          }[f.nextStep]),
      },
    },
    {
      id: 'followup',
      name: 'Follow Up',
      tagline: 'Reopen respectfully',
      desc: 'Check back without pressure. Optional, any stage.',
      goal: 'Goal: follow up without sounding desperate, pushy, or repetitive.',
      optional: true,
      tags: ['Context', 'Clarity', 'Low pressure', 'Respect'],
      fields: [
        { key: 'name', label: 'Prospect’s first name', token: 'Name', required: true, shared: true, transform: 'name', placeholder: 'e.g. Maya' },
        {
          key: 'status', label: 'Where things stand', type: 'select', default: 'quiet',
          options: [['quiet', 'They haven’t replied yet'], ['later', 'They asked me to check back later'], ['declined', 'They said no / not interested'], ['stop', 'They asked me not to contact them']],
        },
        {
          key: 'followups', label: 'Follow-ups you’ve already sent', type: 'select', default: '0',
          options: [['0', 'None — this is my first'], ['1', 'One'], ['2', 'Two or more']],
        },
        { key: 'topic', label: 'Topic of your previous conversation', token: 'Topic', required: true, transform: 'mid', placeholder: 'e.g. your plans for a spring launch' },
        { key: 'lastMessage', label: 'What you last sent', token: 'Last message', transform: 'mid', placeholder: 'e.g. the details about my coaching program', hint: 'Optional. Gives them context without making them scroll back.' },
        {
          key: 'timeSince', label: 'Time since last contact', type: 'select', default: 'about a week',
          options: [['a few days', 'A few days'], ['about a week', 'About a week'], ['a couple of weeks', 'A couple of weeks'], ['about a month', 'About a month'], ['a few months', 'A few months']],
        },
        { key: 'reason', label: 'Reason for following up', token: 'Reason', transform: 'you', placeholder: 'e.g. you said to check back after your launch', hint: 'Optional. A real reason (never fake urgency).' },
      ],
      guard(f) {
        if (f.status === 'stop') {
          return {
            kind: 'stop',
            title: 'Don’t follow up',
            body: [
              'They asked you not to contact them. The respectful—and on many platforms, required—move is to stop and remove them from your follow-up list.',
              'If you haven’t acknowledged their request yet, a single short reply is fine. Nothing more.',
            ],
            messages: [{ label: 'Optional acknowledgment (only if you haven’t replied)', text: t`Understood, ${f.name}—I won’t message again. Take care.` }],
          };
        }
        if (f.status === 'declined') {
          return {
            kind: 'stop',
            title: 'Let this one go',
            body: [
              'They’ve already said no. Following up anyway erodes trust and your reputation. If their situation changes, they know where to find you.',
              'If you haven’t replied to their “no” yet, a gracious thank-you is the best last message.',
            ],
            messages: [{ label: 'Optional gracious close (only if you haven’t replied)', text: t`Totally understand, ${f.name}—thanks for letting me know. Wishing you all the best with ${f.topic}!` }],
          };
        }
        if (f.status === 'quiet' && f.followups === '2') {
          return {
            kind: 'warn',
            title: 'Close the loop—then stop',
            body: ['You’ve already followed up twice without a reply. No response isn’t a yes. Send one final, friendly message that makes it clear you won’t keep messaging, then move on.'],
            closeLoop: true,
            messages: [
              { label: 'Friendly final note', tone: 'friendly', text: t`Hey ${f.name}, I don’t want to keep filling up your inbox, so this will be my last message about ${f.topic}. If it ever becomes useful, I’m happy to chat. Wishing you all the best!` },
              { label: 'Professional close', tone: 'professional', text: t`Hi ${f.name}, I’ll close the loop on ${f.topic} so I’m not cluttering your inbox. If it becomes relevant later, you’re always welcome to reach out. All the best.` },
              { label: 'Short & direct close', tone: 'direct', text: t`Hi ${f.name}, I’ll leave ${f.topic} here—no more follow-ups from me. Door’s open if it’s ever useful. Take care!` },
            ],
          };
        }
        return null;
      },
      prepare(f) {
        // "They asked me to check back later" is itself a legitimate reason.
        if (f.status === 'later' && !f.has('reason')) f.reason = 'you mentioned checking back around now';
        if (f.followups !== '0' && f.status === 'quiet') f.gentle = true;
        return f;
      },
      templates: {
        friendly: [
          { label: 'Gentle check-in', fn: (f) => t`Hey ${f.name}, just checking back on our conversation about ${f.topic}${f.reason ? t`—${f.reason}` : ''}. No pressure at all—if now isn’t the right time, that’s completely fine.` },
          { label: 'Warm nudge', fn: (f) => t`Hi ${f.name}! It’s been ${f.timeSince} since we talked about ${f.topic}, so I thought I’d check in. ${f.lastMessage ? t`Did you get a chance to look at ${f.lastMessage}?` : 'How’s it all going?'} Totally fine if things have changed.` },
          { label: 'Easy out', fn: (f) => t`Hey ${f.name}, hope your week’s going well! ${f.reason ? t`${cap(f.reason)}, so I` : 'I'} wanted to circle back on ${f.topic}. Still on your radar, or should I let it rest for now?` },
        ],
        professional: [
          { label: 'Courteous follow-up', fn: (f) => t`Hi ${f.name}, I wanted to follow up on our conversation about ${f.topic}${f.lastMessage ? t` and ${f.lastMessage} I sent over` : ''}. If it’s still a priority, I’m happy to pick things up. If not, no problem at all.` },
          { label: 'Timely', fn: (f) => t`Hello ${f.name}, it’s been ${f.timeSince} since we last spoke about ${f.topic}. ${f.reason ? t`${cap(f.reason)}. ` : ''}Would it be helpful to continue the conversation, or is now not the right time?` },
          { label: 'Respectful', fn: (f) => t`Hi ${f.name}, a quick follow-up on ${f.topic}${f.reason ? t`, since ${f.reason}` : ''}. Is this still something you’re exploring? If priorities have shifted, I completely understand.` },
        ],
        direct: [
          { label: 'Simple check', fn: (f) => t`Hi ${f.name}, it’s been ${f.timeSince}—checking back on ${f.topic}. Still interested, or not the right time?` },
          { label: 'Circle back', fn: (f) => t`Hey ${f.name}—circling back on ${f.topic}${f.lastMessage ? t` and ${f.lastMessage}` : ''}. Any thoughts? No worries either way.` },
          { label: 'Your call', fn: (f) => t`${f.name}, following up on ${f.topic}${f.reason ? t` (${f.reason})` : ''}. Should I keep you posted or leave it here?` },
        ],
      },
      explain: {
        lead: 'A good follow-up gives context, stays brief, and makes it genuinely easy to say “not now.”',
        principles: [
          ['Context', 'Reminding them what you discussed saves them scrolling back.'],
          ['Clarity', 'One clear purpose per message—no bundled asks.'],
          ['Low pressure', 'Explicitly allowing “no” or “later” makes replying easier than ignoring you.'],
          ['Respect', 'No reply isn’t a yes. After a couple of follow-ups, close the loop and stop.'],
        ],
        avoid: ['“Just bumping this!” with no context', 'Guilt-trips (“I guess you’re not serious…”)', 'Following up after a no or an opt-out', 'Daily follow-ups or fake deadlines'],
        dynamic: (f) => {
          if (f.status === 'stop' || f.status === 'declined') return 'They’ve made their decision. Respecting it is the most professional thing you can do—and protects your reputation.';
          if (f.status === 'later') return 'They asked you to check back, so this follow-up is welcome—mentioning that makes the context clear.';
          if (f.followups === '1') return 'This is your second follow-up. Keep it light, and if there’s still no reply, the next message should close the loop.';
          return 'A single, friendly follow-up after silence is normal—people get busy. Give context and an easy out.';
        },
      },
    },
  ];
  const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  const STAGE_ORDER = ['connect', 'understand', 'bridge', 'invite'];

  // When moving between scenarios, carry over details the user already typed (only into empty fields).
  const CARRY = {
    understand: { goal: [['connect', 'goal']] },
    bridge: { challenge: [['understand', 'challenge']], outcome: [['understand', 'goal']] },
    invite: { problem: [['bridge', 'challenge'], ['understand', 'challenge'], ['understand', 'goal']], outcome: [['bridge', 'outcome']] },
    followup: { topic: [['invite', 'problem'], ['bridge', 'challenge'], ['understand', 'goal'], ['connect', 'topic']] },
  };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */
  const state = {
    scenario: 'connect',
    tone: TONES.some((x) => x.id === store.get(KEYS.tone)) ? store.get(KEYS.tone) : 'friendly',
    shared: { name: '' },
    values: Object.fromEntries(SCENARIOS.map((s) => [s.id, {}])),
    carried: Object.fromEntries(SCENARIOS.map((s) => [s.id, {}])),
    edits: {}, // key -> edited text
    editing: new Set(),
    visited: new Set(['connect']),
    reply: null, // last analysis
    replyEdits: {},
    replyEditing: new Set(),
  };

  function getValue(scn, field) {
    if (field.shared) return state.shared[field.key] || '';
    const v = state.values[scn.id][field.key];
    if (v == null) return field.type === 'select' ? field.default : '';
    return v;
  }
  function setValue(scn, field, value) {
    if (field.shared) state.shared[field.key] = value;
    else state.values[scn.id][field.key] = value;
    delete state.carried[scn.id][field.key];
  }

  // Build the normalized field object used by templates.
  function buildFields(scn) {
    const f = {};
    const present = new Set();
    for (const fd of scn.fields) {
      const raw = getValue(scn, fd);
      if (fd.type === 'select') {
        f[fd.key] = raw || fd.default;
        continue;
      }
      let v = clean(raw);
      if (!v) {
        f[fd.key] = fd.required ? new Missing(fd.token) : '';
        continue;
      }
      present.add(fd.key);
      if (fd.transform === 'name') v = cap(v);
      if (fd.transform === 'you') v = toYou(v);
      if (fd.transform === 'you' || fd.transform === 'mid') v = midCase(v);
      f[fd.key] = v;
    }
    f.has = (k) => present.has(k);
    f.C = (k) => cap(f[k]);
    return scn.prepare ? scn.prepare(f) : f;
  }

  /* ------------------------------------------------------------------------
     Toasts + clipboard
     ------------------------------------------------------------------------ */
  function toast(msg, kind) {
    const region = $('#toastRegion');
    const el = h('div', { class: `toast${kind ? ' ' + kind : ''}`, role: 'status' });
    el.innerHTML = icon(kind === 'warn' ? 'alert' : 'check') + `<span>${escapeHtml(msg)}</span>`;
    region.append(el);
    while (region.children.length > 3) region.firstChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through to legacy path */ }
    try {
      const ta = h('textarea', { 'aria-hidden': 'true', readonly: true });
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.append(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flashButton(btn, label) {
    const original = btn.innerHTML;
    btn.classList.add('is-done');
    btn.innerHTML = icon('check') + `<span>${label}</span>`;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove('is-done');
      btn.innerHTML = original;
    }, 1600);
  }

  async function doCopy(text, btn) {
    const ok = await copyText(text);
    if (!ok) {
      toast('Couldn’t access the clipboard. Select the text and copy it manually.', 'warn');
      return;
    }
    flashButton(btn, 'Copied!');
    const missing = findMissing(text);
    if (missing.length) toast(`Copied — but it still has ${missing.length === 1 ? 'a blank' : missing.length + ' blanks'} to fill: ${missing.join(', ')}`, 'warn');
    else toast('Copied! Ready to paste.');
  }

  /* ------------------------------------------------------------------------
     Message card (shared by builder variations and reply suggestions)
     ------------------------------------------------------------------------ */
  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(120, ta.scrollHeight + 2) + 'px';
  }

  function messageCard({ key, label, tag, generated, edits, editing, scenarioId, tone, onChange }) {
    const getText = () => (key in edits ? edits[key] : generated);
    const card = h('article', { class: 'msg-card', 'aria-label': label });
    const head = h('div', { class: 'msg-head' });
    const body = h('div', { class: 'msg-body' });
    const actions = h('div', { class: 'msg-actions' });
    card.append(head, body, actions);

    function renderHead() {
      const text = getText();
      const wc = wordCount(text);
      const missing = findMissing(text);
      head.innerHTML = '';
      head.append(h('span', { class: 'msg-label', text: label }));
      if (tag) head.append(h('span', { class: 'msg-tag', text: tag }));
      if (key in edits) head.append(h('span', { class: 'msg-tag edited', text: 'Edited' }));
      head.append(h('span', { class: 'spacer' }));
      if (missing.length) head.append(h('span', { class: 'msg-tag missing', text: `${missing.length} to fill` }));
      const wcClass = wc > 60 ? 'long' : wc >= 8 ? 'ok' : '';
      head.append(h('span', { class: `msg-tag ${wcClass}`, title: 'Aim for roughly 20–60 words so it reads easily on a phone', text: `${wc} words${wc > 60 ? ' · long' : ''}` }));
    }

    function renderBody() {
      body.innerHTML = '';
      card.classList.toggle('is-editing', editing.has(key));
      if (editing.has(key)) {
        const ta = h('textarea', { 'aria-label': `Edit ${label}`, spellcheck: 'true' });
        ta.value = getText();
        ta.addEventListener('input', () => {
          edits[key] = ta.value;
          autoGrow(ta);
          renderHead();
          renderActions();
        });
        body.append(ta);
        requestAnimationFrame(() => autoGrow(ta));
        return ta;
      }
      const bubble = h('div', { class: 'bubble', tabindex: '0', role: 'button', 'aria-label': `${label}. Activate to edit.`, html: highlight(getText()) });
      bubble.addEventListener('click', () => toggleEdit(true));
      bubble.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEdit(true); }
      });
      body.append(bubble);
      return null;
    }

    function toggleEdit(on) {
      if (on) editing.add(key); else editing.delete(key);
      const ta = renderBody();
      renderActions();
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }

    function renderActions() {
      actions.innerHTML = '';
      const isEditing = editing.has(key);
      const editBtn = h('button', { type: 'button', class: `icon-btn${isEditing ? ' is-on' : ''}`, 'aria-pressed': String(isEditing), html: icon(isEditing ? 'check' : 'edit') + `<span>${isEditing ? 'Done' : 'Edit'}</span>` });
      editBtn.addEventListener('click', () => toggleEdit(!isEditing));
      actions.append(editBtn);
      if (key in edits) {
        const revert = h('button', { type: 'button', class: 'icon-btn', title: 'Discard your edits and go back to the generated version', html: icon('undo') + '<span>Revert</span>' });
        revert.addEventListener('click', () => {
          delete edits[key];
          editing.delete(key);
          renderAll();
          if (onChange) onChange();
          toast('Reverted to the generated version.');
        });
        actions.append(revert);
      }
      const saveBtn = h('button', { type: 'button', class: 'icon-btn', title: 'Save to your saved messages', html: icon('save') + '<span>Save</span>' });
      saveBtn.addEventListener('click', () => {
        if (saveMessage({ text: getText(), scenarioId, tone, label })) flashButton(saveBtn, 'Saved');
      });
      actions.append(saveBtn, h('span', { class: 'grow' }));
      const copyBtn = h('button', { type: 'button', class: 'btn btn-primary', html: icon('copy') + '<span>Copy Message</span>' });
      copyBtn.addEventListener('click', () => doCopy(getText(), copyBtn));
      actions.append(copyBtn);
    }

    function renderAll() {
      renderHead();
      renderBody();
      renderActions();
    }
    renderAll();
    return card;
  }

  /* ------------------------------------------------------------------------
     Builder rendering
     ------------------------------------------------------------------------ */
  function renderStepper() {
    const ol = $('#stepper');
    ol.innerHTML = '';
    const currentIdx = STAGE_ORDER.indexOf(state.scenario);
    STAGE_ORDER.forEach((id, i) => {
      const scn = scenarioById(id);
      const li = h('li');
      const cls = ['stage-pill', `sc-${id}`];
      if (id === state.scenario) cls.push('is-current');
      else if (state.visited.has(id) || (currentIdx > -1 && i < currentIdx)) cls.push('is-done');
      const btn = h('button', {
        type: 'button', class: cls.join(' '),
        'aria-current': id === state.scenario ? 'step' : null,
        'aria-label': `Stage ${i + 1}: ${scn.name} — ${scn.tagline}`,
        html: `<span class="dot">${i + 1}</span>${scn.name.toUpperCase()}`,
      });
      btn.addEventListener('click', () => selectScenario(id, true));
      li.append(btn);
      if (i < STAGE_ORDER.length - 1) li.append(h('span', { class: 'arrow', html: icon('arrow') }));
      ol.append(li);
    });
    const fu = scenarioById('followup');
    const li = h('li');
    li.append(h('span', { class: 'divider', 'aria-hidden': 'true' }));
    const btn = h('button', {
      type: 'button',
      class: `stage-pill optional sc-followup${state.scenario === 'followup' ? ' is-current' : ''}`,
      'aria-current': state.scenario === 'followup' ? 'step' : null,
      'aria-label': 'Optional, any stage: Follow Up',
      html: `<span class="dot">${icon('followup')}</span>FOLLOW UP <span class="opt-tag">optional · any stage</span>`,
    });
    btn.addEventListener('click', () => selectScenario(fu.id, true));
    li.append(btn);
    ol.append(li);
    $$('.stage-pill .dot svg', ol).forEach((s) => { s.style.width = '13px'; s.style.height = '13px'; });
  }

  function renderScenarioCards() {
    const grid = $('#scenarioGrid');
    grid.innerHTML = '';
    SCENARIOS.forEach((scn, i) => {
      const btn = h('button', {
        type: 'button',
        class: `scenario-card sc-${scn.id}${scn.optional ? ' optional' : ''}`,
        'aria-pressed': String(scn.id === state.scenario),
        html:
          `<span class="sc-icon">${icon(scn.id)}</span>` +
          `<span class="sc-num">${scn.optional ? 'OPTIONAL' : 'STAGE ' + (i + 1)}</span>` +
          `<span class="sc-name">${scn.name}</span>` +
          `<span class="sc-desc">${escapeHtml(scn.desc)}</span>`,
      });
      btn.addEventListener('click', () => selectScenario(scn.id, false));
      grid.append(btn);
    });
  }

  function renderTone() {
    const group = $('#toneGroup');
    group.innerHTML = '';
    TONES.forEach((tone) => {
      const input = h('input', { type: 'radio', name: 'tone', value: tone.id, checked: tone.id === state.tone, 'aria-label': tone.label });
      input.addEventListener('change', () => {
        state.tone = tone.id;
        store.set(KEYS.tone, tone.id);
        renderPreview();
        renderExplainer();
      });
      group.append(h('label', null, input, h('span', { html: `${tone.short}<small>${tone.sub}</small>` })));
    });
  }

  function renderForm() {
    const scn = scenarioById(state.scenario);
    $('#scenarioGoal').textContent = scn.goal;
    const form = $('#scenarioForm');
    form.innerHTML = '';
    scn.fields.forEach((fd) => {
      const id = `f-${scn.id}-${fd.key}`;
      const val = getValue(scn, fd);
      const label = h('span', { class: 'label' }, fd.label);
      if (fd.type !== 'select') label.append(h('span', { class: fd.required ? 'req' : 'opt', text: fd.required ? 'required' : 'optional' }));
      const carriedFrom = state.carried[scn.id][fd.key];
      if (carriedFrom) label.append(h('span', { class: 'carried', text: `from ${carriedFrom}` }));

      let control;
      if (fd.type === 'select') {
        control = h('select', { id });
        fd.options.forEach(([v, text]) => control.append(h('option', { value: v, selected: v === val, text })));
        control.addEventListener('change', () => {
          setValue(scn, fd, control.value);
          renderPreview();
          renderExplainer();
        });
      } else {
        control = h(fd.multiline ? 'textarea' : 'input', { id, placeholder: fd.placeholder || '', ...(fd.multiline ? { rows: '2' } : { type: 'text' }), autocapitalize: fd.transform === 'name' ? 'words' : 'sentences', enterkeyhint: 'next' });
        control.value = val;
        control.addEventListener('input', () => {
          setValue(scn, fd, control.value);
          const wrap = control.closest('.field');
          wrap.classList.toggle('is-missing', !!fd.required && !control.value.trim());
          const carriedTag = $('.carried', wrap);
          if (carriedTag) carriedTag.remove();
          renderPreview();
          renderExplainerDynamic();
        });
        if (!fd.multiline) {
          control.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const all = $$('input, textarea, select', form);
              const next = all[all.indexOf(control) + 1];
              if (next) next.focus(); else control.blur();
            }
          });
        }
      }
      const wrap = h('label', { class: `field${fd.required && !String(val).trim() ? ' is-missing' : ''}`, for: id }, label, control);
      if (fd.hint) wrap.append(h('span', { class: 'hint', text: fd.hint }));
      form.append(wrap);
    });

    const nextBtn = $('#nextStageBtn');
    const idx = STAGE_ORDER.indexOf(scn.id);
    if (idx > -1 && idx < STAGE_ORDER.length - 1) {
      const next = scenarioById(STAGE_ORDER[idx + 1]);
      nextBtn.innerHTML = `Next stage: ${next.name} ${icon('arrow')}`;
      nextBtn.onclick = () => selectScenario(next.id, true);
    } else if (scn.id === 'invite') {
      nextBtn.innerHTML = `Plan a follow-up ${icon('arrow')}`;
      nextBtn.onclick = () => selectScenario('followup', true);
    } else {
      nextBtn.innerHTML = `Back to Connect ${icon('arrow')}`;
      nextBtn.onclick = () => selectScenario('connect', true);
    }
  }

  const editKey = (i) => `${state.scenario}|${state.tone}|${i}`;

  function renderPreview() {
    const scn = scenarioById(state.scenario);
    const f = buildFields(scn);
    const status = $('#previewStatus');
    const list = $('#variations');
    status.innerHTML = '';
    list.innerHTML = '';

    let items;
    const guard = scn.guard ? scn.guard(f) : null;
    if (guard) {
      const cls = guard.kind === 'stop' ? 'stop' : 'warn';
      status.append(
        h('div', { class: `notice ${cls}`, role: 'note', html: icon(guard.kind === 'stop' ? 'hand' : 'alert') + `<div><h3>${escapeHtml(guard.title)}</h3>${guard.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` })
      );
      items = guard.messages.map((m) => ({ label: m.label, text: tidy(m.text), tag: m.tone ? toneById(m.tone).short : null, tone: m.tone }));
      if (guard.closeLoop) items.sort((a, b) => (a.tone === state.tone ? -1 : b.tone === state.tone ? 1 : 0));
    } else {
      items = scn.templates[state.tone].map((tp, i) => ({ label: `Version ${i + 1} · ${tp.label}`, text: tidy(tp.fn(f)), tag: toneById(state.tone).short }));
      const missingFields = scn.fields.filter((fd) => fd.required && isMissing(f[fd.key]));
      if (missingFields.length) {
        status.append(
          h('div', { class: 'notice info', role: 'note', html: icon('info') + `<div><p><strong>Add ${missingFields.length === 1 ? 'one more detail' : missingFields.length + ' details'}</strong> to finish these messages: ${missingFields.map((m) => `<mark>[${escapeHtml(m.token)}]</mark>`).join(' ')}. We never fill in details for you.</p></div>` })
        );
      }
    }

    items.forEach((it, i) => {
      const key = guard ? `${state.scenario}|guard-${guard.kind}|${i}` : editKey(i);
      list.append(
        messageCard({ key, label: it.label, tag: it.tag, generated: it.text, edits: state.edits, editing: state.editing, scenarioId: scn.id, tone: it.tone || state.tone })
      );
    });
  }

  function renderExplainer() {
    const scn = scenarioById(state.scenario);
    const f = buildFields(scn);
    const tone = toneById(state.tone);
    const toneNotes = {
      friendly: 'Friendly & Casual feels like a peer reaching out—great on Instagram, TikTok and Facebook, or with solo business owners.',
      professional: 'Professional & Confident is polished and respectful—ideal for LinkedIn, B2B, or senior decision-makers.',
      direct: 'Short & Direct respects their time—useful when they’re busy, get lots of DMs, or already prefer brief replies.',
    };
    const body = $('#explainerBody');
    body.innerHTML =
      `<p class="lead"><strong>${escapeHtml(scn.name)}:</strong> ${escapeHtml(scn.explain.lead)}</p>` +
      `<ul class="principles">${scn.explain.principles.map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></li>`).join('')}</ul>` +
      `<p class="callout" id="explainerDynamic">${escapeHtml(scn.explain.dynamic(f))}</p>` +
      `<p class="callout tone"><strong>Your tone:</strong> ${escapeHtml(toneNotes[tone.id])}</p>` +
      `<div class="avoid"><h4>Avoid</h4><ul>${scn.explain.avoid.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>`;
  }
  function renderExplainerDynamic() {
    const el = $('#explainerDynamic');
    if (!el) return;
    const scn = scenarioById(state.scenario);
    el.textContent = scn.explain.dynamic(buildFields(scn));
  }

  function selectScenario(id, scroll) {
    if (id !== state.scenario) {
      // Carry over details the user has already typed into empty fields of the new scenario.
      const rules = CARRY[id] || {};
      for (const [key, sources] of Object.entries(rules)) {
        const current = state.values[id][key];
        if (current && current.trim()) continue;
        for (const [srcId, srcKey] of sources) {
          const v = state.values[srcId][srcKey];
          if (v && v.trim()) {
            state.values[id][key] = v;
            state.carried[id][key] = scenarioById(srcId).name;
            break;
          }
        }
      }
    }
    state.scenario = id;
    state.visited.add(id);
    renderScenarioCards();
    renderStepper();
    renderForm();
    renderPreview();
    renderExplainer();
    if (scroll) {
      const target = $('.form-card');
      const top = target.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function resetBuilder() {
    state.shared = { name: '' };
    state.values = Object.fromEntries(SCENARIOS.map((s) => [s.id, {}]));
    state.carried = Object.fromEntries(SCENARIOS.map((s) => [s.id, {}]));
    state.edits = {};
    state.editing.clear();
    state.visited = new Set([state.scenario]);
    renderStepper();
    renderForm();
    renderPreview();
    renderExplainer();
    const first = $('#scenarioForm input, #scenarioForm textarea');
    if (first) first.focus({ preventScroll: true });
    toast('Cleared. Ready for your next conversation.');
  }

  /* ------------------------------------------------------------------------
     Saved messages (localStorage only)
     ------------------------------------------------------------------------ */
  let saved = store.get(KEYS.saved, []);
  if (!Array.isArray(saved)) saved = [];

  function anonymize(text) {
    if (!$('#anonymizeToggle').checked) return text;
    const names = new Set([clean(state.shared.name), clean($('#replyName') ? $('#replyName').value : '')].filter(Boolean));
    let out = text;
    names.forEach((n) => {
      const re = new RegExp(`(^|[^\\p{L}])(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}])`, 'giu');
      out = out.replace(re, '$1[Name]');
    });
    return out;
  }

  function saveMessage({ text, scenarioId, tone, label }) {
    if (!text.trim()) {
      toast('Nothing to save yet.', 'warn');
      return false;
    }
    const scn = SCENARIOS.find((s) => s.id === scenarioId);
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: `${scn ? scn.name : 'Reply'} · ${toneById(tone).short} · ${label.replace(/^Version \d · /, '')}`,
      scenarioId,
      tone,
      text: anonymize(text),
      createdAt: new Date().toISOString(),
    };
    saved.unshift(item);
    if (!store.set(KEYS.saved, saved)) {
      saved.shift();
      return false;
    }
    renderSaved();
    toast('Saved to this device.');
    return true;
  }

  function persistSaved() { store.set(KEYS.saved, saved); }

  function renderSaved() {
    const list = $('#savedList');
    list.innerHTML = '';
    $('#clearSavedBtn').hidden = saved.length === 0;
    const count = $('#navSavedCount');
    count.hidden = saved.length === 0;
    count.textContent = saved.length;

    if (!saved.length) {
      list.append(h('div', { class: 'empty-state', html: icon('save') + '<p>No saved messages yet.</p><p class="muted small">Tap <strong>Save</strong> on any message to keep it here for next time.</p>' }));
      return;
    }
    saved.forEach((item) => {
      const scn = SCENARIOS.find((s) => s.id === item.scenarioId);
      const titleInput = h('input', { type: 'text', 'aria-label': 'Saved message title' });
      titleInput.value = item.title;
      titleInput.addEventListener('input', () => { item.title = titleInput.value; persistSaved(); });

      const ta = h('textarea', { 'aria-label': `Saved message: ${item.title}` });
      ta.value = item.text;
      ta.addEventListener('input', () => { item.text = ta.value; persistSaved(); autoGrow(ta); });

      const date = new Date(item.createdAt);
      const meta = h('div', { class: 'saved-meta' },
        titleInput,
        h('span', { class: `msg-tag sc-${item.scenarioId}`, style: 'background:var(--sc-soft);color:var(--sc)', text: scn ? scn.name : 'Reply' }),
        h('span', { class: 'msg-tag', text: isNaN(date) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })
      );

      const copyBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', html: icon('copy') + '<span>Copy</span>' });
      copyBtn.addEventListener('click', () => doCopy(item.text, copyBtn));

      const useBtn = h('button', { type: 'button', class: 'btn btn-soft btn-sm', html: icon('edit') + '<span>Reuse in builder</span>', title: 'Load into the builder to edit for a new prospect' });
      useBtn.addEventListener('click', () => reuseSaved(item));

      const delBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: icon('trash') + '<span>Delete</span>' });
      delBtn.addEventListener('click', () => {
        if (!delBtn.dataset.confirm) {
          delBtn.dataset.confirm = '1';
          delBtn.className = 'btn btn-danger btn-sm';
          delBtn.innerHTML = icon('trash') + '<span>Confirm delete</span>';
          setTimeout(() => {
            if (!delBtn.isConnected) return;
            delete delBtn.dataset.confirm;
            delBtn.className = 'btn btn-ghost btn-sm';
            delBtn.innerHTML = icon('trash') + '<span>Delete</span>';
          }, 3000);
          return;
        }
        saved = saved.filter((s) => s.id !== item.id);
        persistSaved();
        renderSaved();
        toast('Deleted.');
      });

      const el = h('div', { class: 'saved-item' }, meta, ta, h('div', { class: 'saved-actions' }, copyBtn, useBtn, delBtn));
      list.append(el);
      requestAnimationFrame(() => autoGrow(ta));
    });
  }

  // If the builder has a prospect name, swap it into [Name] when copying/reusing.
  function fillName(text) {
    const n = clean(state.shared.name);
    return n ? text.replace(/\[Name\]/g, cap(n)) : text;
  }

  function reuseSaved(item) {
    const scnId = SCENARIOS.some((s) => s.id === item.scenarioId) ? item.scenarioId : 'connect';
    if (state.scenario !== scnId) selectScenario(scnId, false);
    if (state.tone !== item.tone && TONES.some((x) => x.id === item.tone)) {
      state.tone = item.tone;
      store.set(KEYS.tone, item.tone);
      renderTone();
    }
    const key = editKey(0);
    state.edits[key] = fillName(item.text);
    state.editing.add(key);
    renderPreview();
    renderExplainer();
    const target = $('#variations');
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    toast('Loaded into Version 1. Edit it for your new prospect, then copy.');
  }

  /* ------------------------------------------------------------------------
     "What do I say next?" — rule-based reply analysis
     It quotes only what the prospect actually wrote and never assumes hidden intent.
     ------------------------------------------------------------------------ */
  const SIGNALS = [
    { id: 'stop', re: /\b(stop (messaging|texting|contacting|dming|dm[’']?ing|sending) (me|us)|stop spamming|(don[’']?t|do not|dont) (message|contact|dm|text|email|pm) me|leave me alone|unsubscribe|remove me|(i[’']?ll|will|gonna) (block|report)|block(ing)? you|report(ing)? you|this is spam|you[’']?re spamming|go away|never (message|contact) me|not okay to (message|dm))/i, desc: 'They asked you to stop contacting them' },
    { id: 'decline', re: /\b(not interested|no,? thanks|no thank you|i[’']?ll pass|pass on (this|that|it)|not for me|not looking (for|to)|(i|we) don[’']?t need|not something (i|we) need|(i[’']?m|we[’']?re) all set|not a (good )?fit|nope|not at this time,? (or ever|thanks)|i[’']?m not buying)\b/i, desc: 'They declined' },
    { id: 'already', re: /\b(already (have|work(ing)? with|got|use|using|hired|signed|bought|enrolled|in a)|i have a (coach|mentor|agency|designer|va|consultant|team|someone)|working with someone|we (have|use) (an?|our own)|got (it|that) covered|have someone for (that|this))\b/i, desc: 'They mentioned they already have a solution' },
    { id: 'timing', re: /\b(not (right )?now|not at the moment|maybe later|later this (week|month|year)|next (week|month|quarter|year|season)|after (the|my|our) \w+|too busy|(so |really |super |pretty )?busy (right now|at the moment|lately|these days)|swamped|slammed|bad time|not the right time|not a good time|check back|circle back|reach out (again )?(later|in|next)|in a (few|couple( of)?) (weeks|months)|down the road|in the new year|after the holidays|not yet|someday|timing isn[’']?t)\b/i, desc: 'They mentioned timing' },
    { id: 'booking', re: /\b(book (a|the|in)|schedul\w*|hop on a call|jump on a call|get on a call|(a|quick) call (sometime|this week|next week)|when are you (free|available)|what times?|your calendar|availability|let[’']?s (talk|chat|do it|go|set it up|book)|send (me )?(the|your) (link|calendar|booking))\b/i, desc: 'They want to set up a time' },
    { id: 'priceConcern', re: /\b(too expensive|expensive|can[’']?t afford|afford|out of (my|our) (price range|budget)|too much (money|for me)|can[’']?t justify|(no|tight|small) budget|budget is tight)\b/i, desc: 'They raised a budget concern' },
    { id: 'price', re: /(\b(how much|price|pricing|cost|costs|rates?|investment|fees?|budget|payment plan|what do you charge)\b|\$)/i, desc: 'They asked about price' },
    { id: 'tried', re: /\b(tried (that|this|it|something (like|similar)|.{0,20}before)|didn[’']?t work|did not work|been burned|got burned|wasted (money|time) on)\b/i, desc: 'They mentioned past attempts that didn’t work' },
    { id: 'skeptic', re: /\b(scam|legit|guarantee[ds]?|does (it|this|that) (actually |really )?work|proof|testimonials?|skeptical|sceptical|sounds too good|what[’']?s the catch|is this real|not sure (about|if))\b/i, desc: 'They expressed doubt or asked for proof' },
    { id: 'who', re: /\b(who (is this|are you)|do (i|we) know (you|each other)|how did you find me|what (is|[’']?s) this (about|regarding)|what do you (do|offer|sell)|what are you selling|why (are you|did you) (messag|reach|contact|dm)\w*|what[’']?s this regarding)\b/i, desc: 'They asked who you are or why you reached out' },
    { id: 'interest', re: /\b(tell me more|more info(rmation)?|sounds (good|great|interesting|amazing|helpful|useful)|i[’']?m interested|i am interested|interested|how does (it|this|that) work|what does (it|this|that) (include|involve|look like|cost)|send (it|me the details|the details|details|it over|over the details)|i[’']?d love (to|that)|yes+|yeah|yep|yup|sure|absolutely|definitely|i[’']?m in|count me in|open to (it|that|hearing|learning)|that would be (great|helpful)|go ahead|please do|why not)\b/i, desc: 'They responded positively' },
    { id: 'challenge', re: /\b(struggl\w*|hard|difficult|challeng\w*|frustrat\w*|stuck|overwhelm\w*|can[’']?t seem|cannot seem|problem|issue|trouble|confus\w*|burn(ed|t)? out|burnout|not working|haven[’']?t been able|trying to (figure|work out)|no idea how|biggest (thing|hurdle)|exhausted|drowning)\b/i, desc: 'They shared a challenge' },
    { id: 'warm', re: /\b(thanks|thank you|thx|ty|appreciate (it|that|you|this)|haha|lol|hey|hi|hello|nice|cool|aww|kind of you)\b/i, desc: 'They replied in a friendly way' },
  ];

  function extractTimeframe(text) {
    const m = text.match(/\b(next (week|month|quarter|year|season)|after (the|my|our) [a-z]+|in a (few|couple( of)?) (weeks|months)|in (january|february|march|april|may|june|july|august|september|october|november|december)|in the new year|later this (week|month|year)|(this|next) (spring|summer|fall|autumn|winter)|after the holidays)\b/i);
    if (!m) return '';
    return m[0].toLowerCase().replace(/\bmy\b/g, 'your').replace(/\bour\b/g, 'your');
  }

  function sentenceWith(text, re) {
    const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\n+/);
    const hit = sentences.find((s) => re.test(s)) || '';
    const s = hit.trim();
    return s.length > 140 ? s.slice(0, 137).trim() + '…' : s;
  }

  const STAGE_META = {
    connect: { label: 'Connect', icon: 'connect', cls: 'sc-connect' },
    understand: { label: 'Understand', icon: 'understand', cls: 'sc-understand' },
    bridge: { label: 'Bridge', icon: 'bridge', cls: 'sc-bridge' },
    invite: { label: 'Invite', icon: 'invite', cls: 'sc-invite' },
    followup: { label: 'Follow Up later', icon: 'followup', cls: 'sc-followup' },
    end: { label: 'End respectfully', icon: 'leaf', cls: 'sc-end' },
    clarify: { label: 'Clarify first', icon: 'help', cls: 'sc-clarify' },
  };

  function analyzeReply(input) {
    const text = input.text.trim();
    const name = cap(clean(input.name));
    const topic = midCase(clean(input.topic));
    const offer = midCase(clean(input.offer));
    const last = input.lastStage;
    const N = (pre = ', ', post = '') => (name ? `${pre}${name}${post}` : '');
    const words = wordCount(text);
    const isQuestion = /\?/.test(text) || /^(what|how|why|when|where|who|can|could|do|does|is|are|will|would|should)\b/i.test(text);

    const found = SIGNALS.filter((s) => s.re.test(text));
    const has = (id) => found.some((s) => s.id === id);

    // What they actually communicated — quotes only, no mind-reading.
    const read = found
      .filter((s) => !(s.id === 'interest' && (has('decline') || has('stop'))))
      .filter((s) => !(s.id === 'price' && has('priceConcern')))
      .filter((s) => !(s.id === 'warm' && (has('decline') || has('stop') || has('already'))))
      .map((s) => ({ desc: s.desc, quote: sentenceWith(text, s.re) }));
    if (isQuestion && !read.some((r) => /asked/.test(r.desc))) read.push({ desc: 'They asked a question', quote: sentenceWith(text, /\?/) || text.slice(0, 140) });
    const notes = [];
    if (words <= 4) notes.push('Very short reply — there’s limited context, so avoid reading meaning into it.');
    if (has('timing') && has('challenge') && !has('stop') && !has('decline'))
      notes.push('They also shared a challenge. It’s worth acknowledging it warmly—but respect their timing before going deeper.');
    if (has('interest') && has('timing')) notes.push('Mixed signals: positive words plus a timing note. Prioritize the timing they stated.');
    notes.push('What we can’t know: their mood, budget, or intent beyond these words.');

    let r;
    const topicOr = (fallback) => topic || fallback;

    if (has('stop')) {
      r = {
        stage: 'end',
        next: 'Honor their request. Don’t pitch, explain, or follow up. A one-line acknowledgment is optional—not replying is also fine. Remove them from your outreach list.',
        replies: {
          friendly: `Understood${N()}—sorry for the bother. I won’t message again. Take care!`,
          professional: `Understood${N()}. I won’t contact you again. All the best.`,
          direct: 'Understood. I won’t message again.',
        },
        why: 'They told you directly what they want. Respecting a “stop” immediately protects their trust, your reputation, and your account. A brief acknowledgment is courteous; anything more is pressure.',
      };
    } else if (has('decline')) {
      r = {
        stage: 'end',
        next: 'Accept the no gracefully. Thank them, don’t try to change their mind, and don’t schedule a follow-up. If they want to revisit it, they’ll reach out.',
        replies: {
          friendly: `Totally understand${N()}—thanks for letting me know! Wishing you all the best${topic ? ` with ${topic}` : ''}.`,
          professional: `Thank you for the honest reply${N()}. I appreciate you letting me know, and I wish you every success${topic ? ` with ${topic}` : ''}.`,
          direct: 'Got it—thanks for letting me know. All the best!',
        },
        why: 'A clear no is useful information, not an objection to overcome. Thanking them and leaving it there ends things on a good note—people remember how you handled a no.',
      };
    } else if (has('already')) {
      r = {
        stage: 'end',
        next: 'Respect that they’re already covered. Don’t compare or criticize their current choice. Close warmly—no pitch.',
        replies: {
          friendly: `That’s great that you’ve already got support with that${N()}! Glad you’re in good hands—wishing you all the best.`,
          professional: `Good to hear you’re well supported${N()}. Thanks for letting me know, and all the best${topic ? ` with ${topic}` : ''}.`,
          direct: 'Great—glad you’re covered. All the best!',
        },
        why: 'They’ve solved this another way. Respecting that—without criticizing their current provider—keeps the relationship positive and your reputation intact.',
      };
    } else if (has('timing')) {
      const when = extractTimeframe(text);
      r = {
        stage: 'followup',
        next: when
          ? `They said “not now,” not “no,” and gave a timeframe (${when}). Acknowledge it and ask permission to check back then. Don’t pitch now.`
          : 'They said “not now,” not “no.” Acknowledge it, and let them choose whether (and when) you check back. Don’t pitch now.',
        replies: when
          ? {
              friendly: `No worries at all${N()}—totally understand! Would it be okay if I checked back ${when}?`,
              professional: `Completely understand${N()}, and thank you for letting me know. Would it be alright if I followed up ${when}?`,
              direct: `No problem! Okay to check back ${when}?`,
            }
          : {
              friendly: `No worries at all${N()}—totally understand! Is there a better time for me to check back, or would you rather reach out when you’re ready?`,
              professional: `Completely understand${N()}. Thanks for letting me know. Would you prefer I check back at a later date, or reach out when the timing’s better?`,
              direct: 'No problem! Want me to check back later, or leave it with you?',
            },
        why: 'They didn’t say no—they said not now. Asking permission to check back (or letting them choose) respects their timing and gives you a legitimate, welcome reason to follow up later.',
        open: 'followup',
      };
    } else if (has('booking')) {
      r = {
        stage: 'invite',
        next: 'They’re ready for the next step. Remove friction: share a booking link or 2–3 specific times. Keep it short.',
        replies: {
          friendly: `Great${N()}! Here’s a link to grab a time that suits you: [booking link]. If nothing works, just let me know and we’ll find another slot.`,
          professional: `Thank you${N()}. You can choose a time that works for you here: [booking link]. If none of those suit, I’m happy to suggest a few alternatives.`,
          direct: 'Great—here’s my calendar: [booking link]. Pick any time that works.',
        },
        why: 'They’re ready for the next step. The most helpful thing you can do is make it effortless: a link or specific times, nothing extra to read.',
      };
    } else if (has('priceConcern')) {
      const about = topicOr('this');
      r = {
        stage: 'end',
        next: 'Budget is a real constraint. Acknowledge it without pushing, guilt, or a reflexive discount. Offer something genuinely useful instead, and let them lead.',
        replies: {
          friendly: `Totally fair${N()}—it’s a real investment, and it isn’t right for everyone at every stage. If it’d help, I’m happy to share a few free resources on ${about} instead.`,
          professional: `That’s completely understandable${N()}. It’s important that it makes sense for your budget. If helpful, I can share a few free resources on ${about} in the meantime.`,
          direct: `Fair enough—no pressure. Want a few free resources on ${about} instead?`,
        },
        why: 'Budget is a real constraint, not something to argue with. Acknowledging it—without pushing or discounting on the spot—keeps trust intact and leaves the door open for later.',
      };
    } else if (has('price')) {
      const it = offer || 'it';
      r = {
        stage: 'invite',
        next: 'They asked a direct question—answer it directly. Share the price (or range) and what’s included, then let them decide. Don’t dodge it with “let’s hop on a call first.”',
        replies: {
          friendly: `Great question${N()}! ${cap(it)} is [your price], and that includes [what’s included]. Happy to answer anything else—no pressure either way.`,
          professional: `Of course${N()}. The investment for ${it} is [your price], which includes [what’s included]. Would it help if I shared a quick overview of how it works?`,
          direct: `${cap(it)} is [your price], including [what’s included]. Any other questions?`,
        },
        why: 'They asked a direct question, so give a direct answer. Being upfront about price builds trust; dodging it often feels evasive.',
      };
    } else if (has('tried')) {
      r = {
        stage: 'understand',
        next: 'Before suggesting anything, understand what they tried and what didn’t work. Ask one question.',
        replies: {
          friendly: `That’s really fair${N()}—it’s frustrating when something doesn’t work out. What did you try before? That’ll help me understand whether this would actually be any different for you.`,
          professional: `That makes sense${N()}—after trying something that didn’t work, caution is reasonable. What did you try previously, and what fell short? I’d rather understand that before suggesting anything.`,
          direct: 'Fair. What did you try before, and what didn’t work about it?',
        },
        why: 'Understanding what didn’t work before helps you avoid pitching more of the same—and shows you care about their situation, not just the sale.',
        open: 'understand',
      };
    } else if (has('skeptic')) {
      r = {
        stage: 'bridge',
        next: 'Answer honestly. Don’t promise or guarantee results. Offer to explain exactly how it works so they can judge for themselves.',
        replies: {
          friendly: `Totally fair question${N()}! I can’t promise specific results—it depends on a lot of factors. What I can do is walk you through how it works so you can decide if it makes sense. Want me to?`,
          professional: `That’s a reasonable question${N()}. I don’t guarantee outcomes, because results depend on each person’s situation. I’m happy to explain exactly what’s involved so you can judge for yourself. Would that be useful?`,
          direct: 'Fair question. No guarantees—results vary. Want a quick rundown of how it actually works?',
        },
        why: 'Skepticism is healthy. Honest answers—including “I can’t guarantee that”—are more trustworthy than hype, and they protect you from overpromising.',
      };
    } else if (has('who')) {
      r = {
        stage: 'connect',
        next: 'Be transparent: who you are, what you do, and why you reached out. Give them an easy out if it’s not relevant.',
        replies: {
          friendly: `Good question${N()}! I’m [your name], and I [what you do]. I reached out because ${topic ? `I saw your content about ${topic}` : '[what you noticed about them]'}. Happy to leave it there if it’s not relevant!`,
          professional: `Fair question${N()}. I’m [your name], and I [what you do]. I reached out because ${topic ? `I noticed your content about ${topic}` : '[why you reached out]'}. If it’s not relevant to you, no problem at all.`,
          direct: `I’m [your name]—I [what you do]. Reached out because of ${topic ? `your content about ${topic}` : '[what you noticed]'}. Not relevant? No worries.`,
        },
        why: 'They want to know who you are and why you’re messaging. Being transparent is the only way to earn the right to keep talking.',
      };
    } else if (has('interest')) {
      if (last === 'connect' || last === 'understand') {
        const about = topicOr('that');
        r = {
          stage: 'understand',
          next: 'They answered positively, but that’s about their situation—not your offer. Keep learning: ask one open question about their goal.',
          replies: {
            friendly: `Oh nice${N()}! What’s the main thing you’re focused on with ${about} right now?`,
            professional: `Good to hear${N()}. What would success with ${about} look like for you?`,
            direct: `Nice! What’s your main focus with ${topic || 'it'} right now?`,
          },
          why: 'They answered your question positively. Keep learning about their situation before mentioning any offer—understanding comes before inviting.',
          open: 'understand',
        };
      } else if (last === 'bridge') {
        r = {
          stage: 'invite',
          next: 'Your insight landed. It’s a natural moment to ask permission to share how you help—without assuming they want it.',
          replies: {
            friendly: `So glad that’s helpful${N()}! If you’d like, I can share how I help with ${topicOr('this')}—would that be useful?`,
            professional: `I’m glad that’s useful${N()}. ${offer ? `I work on this through ${offer}. ` : ''}Would you be open to hearing how it works?`,
            direct: `Glad it helps! Want to hear how ${offer || 'I can help with this'}${offer ? ' works' : ''}?`,
          },
          why: 'Your tip landed. This is a natural moment to ask permission to share how you help—and if they say no, the conversation still ended with value.',
          open: 'invite',
        };
      } else {
        r = {
          stage: 'invite',
          next: 'They’ve signaled interest. Give a short, concrete overview and one easy next step—let them choose the format.',
          replies: {
            friendly: `Love that${N()}! In short, ${offer || '[your offer]'} helps with ${topic || '[the outcome]'}: [how it works, in 1–2 sentences]. Want me to send the details, or would a quick call be easier?`,
            professional: `Great—thank you${N()}. Here’s a brief overview: [how it works, in 1–2 sentences]. Would you prefer the full details in writing, or a short call to talk it through?`,
            direct: 'Great! Quick version: [how it works]. Want the details or a quick call?',
          },
          why: 'They’ve signaled interest. Now clarity wins: a short, concrete overview and one easy next step. Letting them choose the format respects their preference.',
        };
        if (last === 'unsure') r.next += ' (If their “yes” was answering a question about their goals rather than your offer, set “What did you last send?” for a better suggestion.)';
      }
    } else if (has('challenge')) {
      if (last === 'understand') {
        r = {
          stage: 'bridge',
          next: 'You asked, and they shared. Now offer one genuinely useful idea related to what they said—before any mention of your offer.',
          replies: {
            friendly: `That makes total sense${N()}—thanks for sharing. One thing that can help is [one useful tip]. Have you tried anything like that?`,
            professional: `Thank you for being candid${N()}. One approach that can help with that is [one useful tip]. Have you explored anything similar?`,
            direct: 'Makes sense. One idea: [one useful tip]. Tried that yet?',
          },
          why: 'You asked, and they shared. This is the moment to offer one genuinely useful idea (Bridge) before any mention of your offer—value first builds trust.',
          open: 'bridge',
        };
      } else {
        r = {
          stage: 'understand',
          next: 'They opened up about a challenge. Reflect it back and ask one follow-up question to understand it better before offering anything.',
          replies: {
            friendly: `Thanks for sharing that${N()}—that sounds genuinely tough. What have you tried so far?`,
            professional: `I appreciate you being open about that${N()}. To make sure I understand—what have you tried so far to work through it?`,
            direct: 'That sounds tricky. What have you tried so far?',
          },
          why: 'They opened up about a challenge. Reflecting it back and asking one follow-up question shows you’re listening—and helps you understand before suggesting anything.',
          open: 'understand',
        };
      }
    } else if (isQuestion) {
      r = {
        stage: 'clarify',
        next: 'They asked something. Answer it directly first. If you’re not sure what they mean, ask a quick clarifying question instead of guessing.',
        replies: {
          friendly: `Great question${N()}! [Your direct answer]. Does that help?`,
          professional: `Thanks for asking${N()}. [Your direct answer]. Happy to clarify anything else.`,
          direct: '[Your direct answer]. Does that answer it?',
        },
        why: 'They asked something. Answering it directly before asking anything of your own is basic conversational respect—and builds trust.',
      };
    } else if (has('warm') && words <= 15) {
      r = {
        stage: 'understand',
        next: 'They replied warmly but haven’t shared much yet. Keep it light and ask one easy, relevant question. No pitch.',
        replies: {
          friendly: `Thanks for getting back to me${N()}! I’m curious—what are you focused on most ${topic ? `with ${topic} ` : ''}these days?`,
          professional: `Thanks for the reply${N()}. Out of curiosity, what’s your main priority ${topic ? `with ${topic} ` : ''}at the moment?`,
          direct: `Thanks! What’s your main focus ${topic ? `with ${topic} ` : ''}right now?`,
        },
        why: 'A short, friendly reply doesn’t tell you much yet. Keep it light and ask one easy, relevant question to learn more—no pitch.',
        open: 'understand',
      };
    } else {
      r = {
        stage: 'clarify',
        next: 'There isn’t enough context to know what they mean. Ask a simple clarifying question rather than guessing.',
        replies: {
          friendly: `Thanks for getting back to me${N()}! Just so I understand—could you tell me a bit more about what you mean?`,
          professional: `Thanks${N()}. I want to make sure I understand you correctly—could you share a little more?`,
          direct: 'Got it—can you tell me a bit more?',
        },
        why: 'There isn’t enough to go on. Guessing what they meant risks a misstep; a simple clarifying question keeps things honest and shows you’re listening.',
      };
    }
    if (!read.length) read.push({ desc: 'No clear signal (yes, no, timing, question, or challenge) in their words', quote: '' });
    return { ...r, read, notes, name, topic };
  }

  function renderAnalysis() {
    const out = $('#nextOutput');
    const a = state.reply;
    out.innerHTML = '';
    if (!a) {
      out.append(h('div', { class: 'empty-state', html: icon('help') + '<p>Your analysis will appear here.</p><p class="muted small">Tip: press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> in the reply box to analyze.</p>' }));
      return;
    }
    const meta = STAGE_META[a.stage];
    out.append(
      h('div', { class: 'analysis-head' },
        h('span', { class: 'muted small', text: 'Likely stage:' }),
        h('span', { class: `stage-chip ${meta.cls}`, html: icon(meta.icon) + escapeHtml(meta.label) })
      )
    );
    const readList = a.read.map((r) => `<li>${escapeHtml(r.desc)}${r.quote ? `: <q>${escapeHtml(r.quote)}</q>` : '.'}</li>`).join('');
    const notesList = a.notes.map((n) => `<li class="muted">${escapeHtml(n)}</li>`).join('');
    out.append(h('div', { class: 'analysis-block', html: `<h3>What they actually said</h3><ul>${readList}${notesList}</ul>` }));
    out.append(h('div', { class: `analysis-block`, html: `<h3>Suggested next step</h3><p class="next-step">${escapeHtml(a.next)}</p>` }));

    const cards = h('div', { class: 'reply-cards' });
    const labels = { friendly: 'Friendly reply', professional: 'Professional reply', direct: 'Direct reply' };
    const order = [state.tone, ...TONES.map((x) => x.id).filter((x) => x !== state.tone)];
    order.forEach((tone) => {
      cards.append(messageCard({
        key: `reply|${a.id}|${tone}`,
        label: labels[tone],
        tag: tone === state.tone ? 'Your tone' : null,
        generated: tidy(a.replies[tone]),
        edits: state.replyEdits,
        editing: state.replyEditing,
        scenarioId: SCENARIOS.some((s) => s.id === a.stage) ? a.stage : 'reply',
        tone,
      }));
    });
    out.append(cards);

    const why = h('details', { class: 'card explainer', open: true });
    why.innerHTML =
      `<summary><span class="explainer-icon" aria-hidden="true">${icon('spark')}</span><span>Why This Is the Next Best Message</span>${icon('down', 'chev')}</summary>` +
      `<div class="explainer-body"><p class="lead">${escapeHtml(a.why)}</p>${a.stage === 'end' ? '<p class="callout">Not every conversation should become a sale. Ending well is a success too.</p>' : ''}</div>`;
    out.append(why);

    if (a.open) {
      const target = scenarioById(a.open);
      const btn = h('button', { type: 'button', class: 'btn btn-soft', html: `Build a full ${target.name} message ${icon('arrow')}` });
      btn.addEventListener('click', () => {
        if (a.name && !state.shared.name) state.shared.name = a.name;
        selectScenario(target.id, true);
      });
      out.append(h('div', { class: 'form-actions' }, btn));
    }
  }

  function runAnalysis() {
    const text = $('#replyInput').value;
    if (!text.trim()) {
      toast('Paste their reply first.', 'warn');
      $('#replyInput').focus();
      return;
    }
    const result = analyzeReply({
      text,
      name: $('#replyName').value,
      topic: $('#replyTopic').value,
      offer: $('#replyOffer').value,
      lastStage: $('#replyLastStage').value,
    });
    result.id = Date.now().toString(36);
    state.reply = result;
    state.replyEdits = {};
    state.replyEditing = new Set();
    renderAnalysis();
    if (window.innerWidth < 860) {
      const out = $('#nextOutput');
      window.scrollTo({ top: out.getBoundingClientRect().top + window.scrollY - 12, behavior: 'smooth' });
    }
  }

  /* ------------------------------------------------------------------------
     Daily outreach planner
     ------------------------------------------------------------------------ */
  const PLANNER_FIELDS = [
    { key: 'prospects', label: 'Relevant prospects identified', hint: 'People who genuinely fit what you offer.' },
    { key: 'started', label: 'New conversations started', hint: 'Personalized openers you sent.' },
    { key: 'answered', label: 'Existing conversations answered', hint: 'Replies you responded to.' },
    { key: 'meaningful', label: 'Meaningful conversations', hint: 'Real back-and-forth about their goals.' },
    { key: 'nextSteps', label: 'Agreed to a next step', hint: 'Said yes to details, a call, etc.' },
    { key: 'minutes', label: 'Total time spent (minutes)', hint: 'Including research and replies.', step: 5 },
  ];
  let plannerData = store.get(KEYS.planner, {});
  if (!plannerData || typeof plannerData !== 'object') plannerData = {};

  const todayISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const dayData = (date) => plannerData[date] || {};
  const num = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

  function renderPlannerFields() {
    const grid = $('#plannerFields');
    grid.innerHTML = '';
    const date = $('#plannerDate').value;
    const data = dayData(date);
    PLANNER_FIELDS.forEach((fd) => {
      const id = `p-${fd.key}`;
      const input = h('input', { type: 'number', id, min: '0', step: String(fd.step || 1), inputmode: 'numeric', 'aria-label': fd.label });
      input.value = data[fd.key] != null ? data[fd.key] : '';
      input.placeholder = '0';
      const commit = () => {
        const d = (plannerData[date] = plannerData[date] || {});
        if (input.value === '') delete d[fd.key];
        else d[fd.key] = num(input.value);
        if (!Object.keys(d).length) delete plannerData[date];
        if (store.set(KEYS.planner, plannerData)) {
          $('#plannerSavedNote').textContent = 'Saved on this device';
          clearTimeout(renderPlannerFields._t);
          renderPlannerFields._t = setTimeout(() => ($('#plannerSavedNote').textContent = ''), 1500);
        }
        renderDashboard();
      };
      input.addEventListener('input', commit);
      const step = fd.step || 1;
      const minus = h('button', { type: 'button', 'aria-label': `Decrease ${fd.label}`, text: '−' });
      const plus = h('button', { type: 'button', 'aria-label': `Increase ${fd.label}`, text: '+' });
      minus.addEventListener('click', () => { input.value = Math.max(0, num(input.value) - step); commit(); });
      plus.addEventListener('click', () => { input.value = num(input.value) + step; commit(); });
      grid.append(
        h('div', { class: 'num-field' },
          h('label', { class: 'label', for: id, text: fd.label }),
          h('div', { class: 'stepper-input' }, minus, input, plus),
          h('span', { class: 'hint', text: fd.hint })
        )
      );
    });
  }

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

  function kpi({ label, value, sub, meter }) {
    const el = h('div', { class: 'kpi' }, h('span', { class: 'k-label', text: label }), h('span', { class: 'k-value', text: value }));
    if (meter != null) {
      const m = h('div', { class: 'meter', role: 'img', 'aria-label': `${label}: ${value}` });
      m.append(h('span', { style: `width:${Math.max(0, Math.min(100, meter))}%` }));
      el.append(m);
    }
    if (sub) el.append(h('span', { class: 'k-sub', text: sub }));
    return el;
  }

  function renderDashboard() {
    const date = $('#plannerDate').value;
    const d = dayData(date);
    const v = Object.fromEntries(PLANNER_FIELDS.map((f) => [f.key, num(d[f.key])]));
    const handled = v.started + v.answered;
    const meaningfulRate = pct(v.meaningful, handled);
    const nextRate = pct(v.nextSteps, v.meaningful);
    const followThrough = pct(v.started, v.prospects);
    const perMeaningful = v.meaningful > 0 && v.minutes > 0 ? Math.round(v.minutes / v.meaningful) : null;
    const perHour = v.minutes > 0 ? (v.nextSteps / (v.minutes / 60)) : null;

    const grid = $('#kpiGrid');
    grid.innerHTML = '';
    grid.append(
      kpi({ label: 'Conversations handled', value: String(handled), sub: `${v.started} new · ${v.answered} replies` }),
      kpi({ label: 'Meaningful conversation rate', value: meaningfulRate == null ? '—' : `${Math.min(meaningfulRate, 999)}%`, meter: meaningfulRate, sub: `${v.meaningful} of ${handled} conversations` }),
      kpi({ label: 'Next-step rate', value: nextRate == null ? '—' : `${Math.min(nextRate, 999)}%`, meter: nextRate, sub: `${v.nextSteps} of ${v.meaningful} meaningful` }),
      kpi({ label: 'Outreach follow-through', value: followThrough == null ? '—' : `${Math.min(followThrough, 999)}%`, meter: followThrough, sub: `${v.started} of ${v.prospects} prospects messaged` }),
      kpi({ label: 'Minutes per meaningful conversation', value: perMeaningful == null ? '—' : String(perMeaningful), sub: `${v.minutes} min total` }),
      kpi({ label: 'Next steps per hour', value: perHour == null ? '—' : perHour.toFixed(1), sub: 'Time well spent, not volume' })
    );

    const insights = [];
    const add = (text, warn) => insights.push({ text, warn });
    const any = Object.values(v).some((x) => x > 0);
    if (!any) {
      add('Log today’s numbers as you go. There’s no target to hit—this is just to help you notice what’s working.');
    } else {
      if (v.meaningful > handled && handled > 0) add('Meaningful conversations are higher than conversations handled—double-check the numbers.', true);
      if (v.nextSteps > v.meaningful && v.meaningful > 0) add('Next steps are higher than meaningful conversations—double-check the numbers.', true);
      if (v.started > v.prospects && v.prospects > 0) add('You started more conversations than prospects identified. Make sure each message is going to someone who’s genuinely a fit.', true);
      if (v.minutes >= 120) add('You’ve spent 2+ hours on outreach today. Consider wrapping up—consistent, focused sessions are more sustainable than marathons.', true);
      if (v.started >= 40) add('That’s a lot of new conversations for one day. If messages are starting to feel generic, fewer and more personal usually works better—and keeps you within platform limits.', true);
      if (meaningfulRate != null && meaningfulRate >= 30 && handled >= 3) add('Strong conversation quality. Whatever you’re doing to personalize is working—keep it up.');
      else if (meaningfulRate != null && handled >= 5 && meaningfulRate < 15) add('Few conversations are turning meaningful. Try more specific openers (Connect) or more open questions (Understand) rather than sending more messages.');
      if (v.nextSteps > 0) add(`${v.nextSteps} ${v.nextSteps === 1 ? 'person' : 'people'} agreed to a next step. Follow through promptly on what you promised.`);
      if (v.answered === 0 && v.started > 0) add('Remember to reply to existing conversations first—people who already responded deserve your attention before new outreach.');
      if (insights.length === 0) add('Nice steady day. Small, consistent, genuine outreach compounds over time.');
    }
    $('#plannerInsights').innerHTML = insights
      .map((i) => `<li class="${i.warn ? 'warn' : ''}">${icon(i.warn ? 'alert' : 'leaf')}<span>${escapeHtml(i.text)}</span></li>`)
      .join('');

    renderWeek(date);
  }

  function renderWeek(date) {
    const end = new Date(date + 'T12:00:00');
    if (isNaN(end)) { $('#plannerWeek').innerHTML = ''; return; }
    const rows = [];
    const totals = { handled: 0, meaningful: 0, nextSteps: 0, minutes: 0 };
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const x = dayData(iso);
      const row = { label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), handled: num(x.started) + num(x.answered), meaningful: num(x.meaningful), nextSteps: num(x.nextSteps), minutes: num(x.minutes) };
      Object.keys(totals).forEach((k) => (totals[k] += row[k]));
      rows.push(row);
    }
    $('#plannerWeek').innerHTML =
      '<h4>Last 7 days</h4><div class="table-scroll"><table class="week-table"><thead><tr><th scope="col">Day</th><th scope="col">Conversations</th><th scope="col">Meaningful</th><th scope="col">Next steps</th><th scope="col">Minutes</th></tr></thead><tbody>' +
      rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${r.handled}</td><td>${r.meaningful}</td><td>${r.nextSteps}</td><td>${r.minutes}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Total</td><td>${totals.handled}</td><td>${totals.meaningful}</td><td>${totals.nextSteps}</td><td>${totals.minutes}</td></tr></tfoot></table></div>`;
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    renderScenarioCards();
    renderStepper();
    renderTone();
    renderForm();
    renderPreview();
    renderExplainer();

    $('#resetBtn').addEventListener('click', resetBuilder);

    // Saved
    const anon = store.get(KEYS.anonymize, true);
    $('#anonymizeToggle').checked = anon !== false;
    $('#anonymizeToggle').addEventListener('change', (e) => store.set(KEYS.anonymize, e.target.checked));
    $('#clearSavedBtn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (!btn.dataset.confirm) {
        btn.dataset.confirm = '1';
        btn.textContent = `Delete all ${saved.length}? Tap again`;
        btn.className = 'btn btn-danger btn-sm';
        setTimeout(() => {
          delete btn.dataset.confirm;
          btn.textContent = 'Delete all';
          btn.className = 'btn btn-ghost btn-sm';
        }, 3000);
        return;
      }
      saved = [];
      persistSaved();
      delete btn.dataset.confirm;
      btn.textContent = 'Delete all';
      btn.className = 'btn btn-ghost btn-sm';
      renderSaved();
      toast('All saved messages deleted.');
    });
    renderSaved();

    // What do I say next?
    $('#analyzeBtn').addEventListener('click', runAnalysis);
    $('#replyInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAnalysis(); }
    });
    $('#clearReplyBtn').addEventListener('click', () => {
      ['#replyInput', '#replyName', '#replyTopic', '#replyOffer'].forEach((s) => ($(s).value = ''));
      $('#replyLastStage').value = 'unsure';
      state.reply = null;
      renderAnalysis();
      $('#replyInput').focus();
    });

    // Planner
    const dateInput = $('#plannerDate');
    dateInput.value = todayISO();
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) dateInput.value = todayISO();
      renderPlannerFields();
      renderDashboard();
    });
    $('#plannerClearBtn').addEventListener('click', () => {
      delete plannerData[dateInput.value];
      store.set(KEYS.planner, plannerData);
      renderPlannerFields();
      renderDashboard();
      toast('Cleared this day’s entries.');
    });
    renderPlannerFields();
    renderDashboard();
    if (location.hash === '#planner') $('#plannerDetails').open = true;
    $$('.top-nav a[href="#planner"]').forEach((a) => a.addEventListener('click', () => ($('#plannerDetails').open = true)));

    // Keep saved list in sync across tabs.
    window.addEventListener('storage', (e) => {
      if (e.key === KEYS.saved) {
        saved = store.get(KEYS.saved, []);
        renderSaved();
      }
    });
  }

  // Expose pure helpers for testing in the console (no side effects).
  window.DMPlaybook = { analyzeReply, toYou, midCase, tidy };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
