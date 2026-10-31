# The DM Sales Playbook — Plug-and-Play Message Builder

> Stop guessing what to say. Start better conversations. Sell without burning out.

A no-login, mobile-friendly web app that helps entrepreneurs, coaches, freelancers and creators write personalized, ethical sales DMs in seconds.

**Run it:** open `index.html` in any modern browser. No build step, no dependencies, no network requests.

## Features

- **Five scenarios:** Connect, Understand, Bridge, Invite, and an optional Follow Up. Each one has its own fields, hints and examples.
- **Three tones:** Friendly & Casual, Professional & Confident, Short & Direct. Each tone gives three different variations.
- **Live preview:** messages update as you type. Required details that are missing appear as highlighted `[Tokens]`; the app never makes up personal details.
- **Edit, copy and save:** every variation can be edited by hand, copied with a confirmation, saved, or reverted to the generated version. It also shows a word count so you can aim for 20–60 words.
- **Carry-over:** moving to the next stage brings along the details you've already typed (name, goal, challenge, and so on).
- **Why This Message Works:** an expandable explanation of the psychology behind each scenario, with notes on tone and what to avoid.
- **Respectful follow-ups:** if someone declined or opted out, the app tells you not to follow up. After two follow-ups with no reply, it offers a single "close the loop" message instead.
- **What do I say next?:** paste a prospect's reply to see the likely stage, what they actually said (quoted, with no guessing at intent), the recommended next step, three editable replies, and "Why This Is the Next Best Message". It recognizes opt-outs, declines and "not now" replies, and suggests a clarifying question when there isn't enough context.
- **Saved messages:** stored in `localStorage` with options to reuse, edit, copy and delete. Prospect names can be swapped for `[Name]` automatically when you save.
- **Daily outreach planner:** a per-day log with conversation-quality metrics, a 7-day summary, and gentle sustainability nudges instead of volume targets.

## Privacy

Everything runs in the browser. Saved messages and planner entries are kept in this device's `localStorage` only. Nothing is ever sent to a server.

## Files

- `index.html`: layout and static sections
- `styles.css`: design system and responsive layout
- `app.js`: scenarios, templates, reply analyzer, saved messages and planner logic
