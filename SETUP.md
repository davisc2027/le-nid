# Setup checklist

Everything here is free-tier. Do it once; any computer can repeat it from this file. Work in order.

## 1. Supabase
1. Create a project at supabase.com (free). Note its region.
2. SQL editor: run `supabase/migrations/0001` through `0009` in order (or `npx supabase link` then `npx supabase db push`; the bundled `supabase` CLI needs `supabase link` first). `0006` fixes the profile trigger; `0007` adds the sign-up allowlist and hardening. `0009` adds `vocab_cards` for French spaced repetition (end-of-lesson review and the Practice button; the app still works without it, minus those features).
3. Authentication -> Providers -> Email: keep "Allow new users to sign up" on (new accounts wait for admin approval, from `0008`), and leave the OTP length at 8 (the app's code box expects 8 digits).
4. Authentication -> Email Templates: edit **both Confirm signup and Magic Link** (new users get Confirm signup, returning users get Magic Link). Put `{{ .Token }}` in the body, for example "Your Le Nid code is {{ .Token }}". The app asks for this 8-digit code because on iPhone a link opened from Mail lands in Safari, not in the installed app.
5. Authentication -> SMTP Settings: **set a custom SMTP provider**. Supabase's built-in mail allows only a few emails per hour, which 35 people signing in will exceed. Options: Resend or Brevo (free, needs a domain), or a Gmail account with an app password (`smtp.gmail.com`, port 465; turn on 2-step verification, then create an app password and use that, not your normal password).
6. Authentication -> URL Configuration: set Site URL to your Vercel URL and add `<your url>/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
7. Project Settings -> API: copy the URL, anon key, and service_role key.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local work and add the same variables in Vercel.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Project Settings -> API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses RLS; never expose it. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | Must start with `mailto:` (for example `mailto:you@example.com`) or `https:`. |
| `CRON_SECRET` | Any long random string. The reminder endpoint rejects requests without it. |
| `DEEPL_API_KEY` | Optional. DeepL key (translate, tried first). Without it, translation uses Groq. See "DeepL setup" below. |
| `GROQ_API_KEY` | Free key from console.groq.com. Used for speech to text in Conversation mode and as the fallback translator. Server only. See "Conversation mode" below. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, for the weekly to-do summary email (Mondays). |

**Never commit `vercel-env.txt`, `.env.local` or any file holding these values.** If one was ever committed or shared, rotate the keys (especially the service-role key).

## 3. Vercel
1. Import the repo and add every variable from section 2, then deploy.
2. Project Settings -> Functions: set the function region to the one closest to your Supabase region (Hobby allows one). This cuts the latency of every page load.
3. The daily reminder job in `vercel.json` also touches the database, which keeps the free Supabase project from pausing.

## 3a. Conversation mode (live two-way translation)
Translate -> Conversation mode (`/translate/talk`) listens continuously, cuts speech into sentences, works out whether each one is English or French, and shows it with its translation.

**Keys.** These are three separate free accounts and keys; one does not replace another:
- `GROQ_API_KEY` turns speech into text (Groq's hosted Whisper, model `whisper-large-v3-turbo`).
- Translation goes through a chain (`lib/translate/providers.ts`): DeepL when `DEEPL_API_KEY` is set, then Groq `llama-3.3-70b-versatile`, then `llama-3.1-8b-instant`. If one is out of quota or fails, the next answers. With no DeepL key, Groq alone translates.
- The Bible text needs no key; it comes from ebible.org at build time (section 4).

**Create the Groq key.**
1. Sign in at console.groq.com (free, no card needed) -> API Keys -> Create API Key. Copy it.
2. Vercel -> Project Settings -> Environment Variables: add `GROQ_API_KEY` (Production and Preview), then redeploy. Locally, put it in `.env.local`.
3. Without the key, Conversation mode still opens and offers the Safari backup instead.

**What leaves the phone.** Each sentence is recorded as a short audio clip and sent to Le Nid's server, which forwards it to Groq to be turned into text, then sends that text to DeepL to be translated. Le Nid does not keep recordings or transcripts (nothing is saved to the database or logged); the conversation lives only on the screen until the page is closed or cleared. The page shows a small "AI audio processing used" line. Groq's and DeepL's own policies apply to what they receive.

**Limits (free tiers).** Groq allows about 20 transcription requests per minute and about 8 hours of audio per day **for the whole key, so for the whole group together** (it counts at least 10 seconds per request). Le Nid also limits each person to 30 sentences per minute and 300 per hour, and holds back when the group is near Groq's per-minute limit. Each sentence is also one DeepL request, so it counts toward the Translate limit of 40 per person per hour and DeepL's 500,000 characters per month. Limits are kept in memory per server instance, so they are approximate.

**Safari backup.** When Groq can't be used (limit reached, not set up, or failing), the page switches to Safari's built-in speech recognition: two big buttons, English and Français, choose the language being spoken. It doesn't use Groq at all. It only works in Safari, not in the installed Home Screen app, so in the app the page shows "Copy Safari link" instead. That link signs the person into Safari as themselves (Safari doesn't share the app's login): it is made by `/api/handoff` from the signed-in session's own email (using `SUPABASE_SERVICE_ROLE_KEY`), works once, expires with Supabase's email-link expiry (Authentication -> Providers -> Email -> Email OTP Expiration, 1 hour by default), and each person can make 5 per hour. Steps for the person: tap Copy Safari link, open Safari, paste into the address bar, tap Go. Anyone can also open the backup from "Having trouble? Use the Safari backup".

## 4. Bible text
On a computer that can reach ebible.org: `node scripts/build-bible.mjs`, spot-check a few verses (for example John 3:16, Psalm 23:1, Romans 8:38-39), commit `public/bible`, push. Without it, verse memory has no text.

## 5. First run
1. Open the site, sign in with your email, enter the code.
2. In the SQL editor: `update profiles set role = 'admin' where email in ('you@example.com', 'coleader@example.com');`
3. **Approve people on the Admin page.** Anyone can sign in with their email, but their account stays on a waiting screen until a leader taps Approve under "Access requests" (the Admin icon shows a count). Optionally pre-approve emails under "Pre-approved emails" so they skip the wait. Your own account is approved automatically if you sign up before any admin exists; otherwise run `update profiles set status = 'approved' where email = 'you@example.com';`.
4. Admin page: set the group goal, create teams, add the itinerary, a first announcement, a prep meeting, a verse set, and a to-do.

## 6. Smoke test
- Sign in with a new email: it shows the waiting screen; approve it from Admin and the screen opens up within about 20 seconds.
- Post a test announcement; the time shown is Paris time.
- Open Files and tap a file (the link is generated on tap, so it never expires).
- Translate a phrase.
- Conversation mode: Translate -> Conversation mode -> Start listening, say one English and one French sentence; both appear with translations.
- Reminders: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/cron/reminders` returns 200; without the header it returns 401.

## 7. iPhone testing checklist (do this before the group does)
- Safari -> Share -> Add to Home Screen; open the app from the Home Screen icon.
- Sign in with a code inside the installed app (not in Safari).
- Turn on notifications on the Me page, post a test announcement with push, confirm it arrives.
- Run a French lesson with sound on and the silent switch off; confirm audio plays.
- Translate: type, and dictate with the keyboard microphone.
- Conversation mode in the installed app: allow the microphone, talk in English and French, check the screen stays on, turn Read aloud on and confirm French translations are spoken (and not re-transcribed), switch to Side by side, lock the phone and confirm listening pauses.
- Safari backup: in the app tap "Having trouble? Use the Safari backup" -> Copy Safari link, paste it in Safari, confirm it opens Conversation mode signed in, tap English / Français and talk. Paste the same link into a Private tab: it should say the link was already used.
- Turn on airplane mode and check what loads.
- Check light and dark mode and the bottom nav above the home bar.

## 8. During and after the trip
- Passport copies live in the private `todo-uploads` bucket. After the trip, empty the bucket (Storage -> todo-uploads) and clear the path column: `update todo_assignments set upload_path = null;`
- Back up: Supabase Project Settings -> Database -> Backups, or `pg_dump` from the connection string.
- Content changes: lessons in `content/french/units.json`, Odile's lines in `lib/odile.ts`; push to deploy.

## Sign-in code length
Supabase sends 8-digit codes by default (Authentication -> Sign In / Providers -> Email -> **Email OTP Length**). The login screen expects exactly 8 digits, so if you change that setting, change the length in `app/login/page.tsx` too.

## DeepL setup (optional)
1. Go to deepl.com/pro-api and choose the free API plan. Read the plan shown on that page before entering anything: DeepL has changed its free offer over time (monthly characters vs a one-time pool), and a card may be requested for verification. If the page only offers paid plans or asks you to pay, skip DeepL: Groq translates without it.
2. Create or sign in to a DeepL account and finish the API plan sign-up.
3. Open your DeepL account page, then the API Keys tab, and copy the key. A free-plan key ends in `:fx`.
4. In Vercel: Project Settings -> Environment Variables -> add `DEEPL_API_KEY` (Production and Preview), then Deployments -> Redeploy.
5. Check usage any time on your DeepL account page. When the allowance runs out, translation continues on Groq automatically.
