# WhatsApp To-Dos

A personal to-do manager. Send messages from WhatsApp, manage everything from the web dashboard.

**Stack:** Next.js · Supabase · Twilio · Anthropic Claude API · Vercel

---

## How to use it

### From WhatsApp

Send any of these to the Twilio sandbox number (`+1 415 523 8886`):

| What you want | Example message |
|---|---|
| Add a to-do | `add call João on Friday high priority` |
| See today's list | `what's on today` |
| See this week | `this week` |
| Mark done (by name) | `done call João` |
| Mark done (by number) | `done 2` |
| Set a deadline | `set deadline review proposal next Monday` |
| Change priority | `make review proposal high priority` |
| Delete | `delete pay invoice` |

The bot understands natural language — you don't need to follow the exact phrasing above.

### From the web dashboard

Open [project-tygma.vercel.app](https://project-tygma.vercel.app) to:

- View all open to-dos sorted by priority and deadline
- Filter by **All / Today / This Week / Done**
- Click the checkbox to mark done (or undo)
- Edit priority and deadline inline
- Add to-dos directly without WhatsApp
- Delete to-dos (hover → ×)

Overdue items are highlighted in red.

---

## Local development

### Prerequisites

- Node.js 18+
- A Supabase project with the schema below
- A Twilio account with WhatsApp sandbox
- An Anthropic API key

### Setup

```bash
git clone git@github.com:pilomeida/whatsapp_to-dos.git
cd whatsapp_to-dos
npm install
cp .env.example .env.local
# fill in .env.local with your values
npm run dev
```

To test the webhook locally, use [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# set the ngrok URL as your Twilio sandbox webhook: https://xxxx.ngrok.io/api/whatsapp
```

### Database schema (Supabase)

```sql
create table todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  deadline date,
  done boolean default false,
  done_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Environment variables

See `.env.example` for all required variables. Set the same values in Vercel → Settings → Environment Variables.

---

## Deployment

Pushes to `main` deploy automatically to Vercel. No action needed.

After deploying, make sure the Twilio sandbox webhook points to:
```
https://project-tygma.vercel.app/api/whatsapp
```

---

## Forgot your password?

The dashboard password is stored as the `APP_PASSWORD` environment variable in Vercel.
To reset it: Vercel → Settings → Environment Variables → edit `APP_PASSWORD` → Save → Redeploy.

---

## Notes

- Only messages from the configured `MY_WHATSAPP_NUMBER` are processed
- Timezone is always Europe/Lisbon
- Twilio sandbox sessions expire — if the bot stops responding, re-send `join person-sign` to `+1 415 523 8886` from WhatsApp
- The Twilio free trial sandbox may occasionally have issues delivering to international numbers
