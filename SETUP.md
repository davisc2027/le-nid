# Setup checklist

Everything here is free-tier. Do it once; any computer can repeat it from this file.

## 1. Supabase
1. Create a project at supabase.com (free).
2. SQL editor: run `supabase/migrations/0001` through `0005` in order.
3. Authentication -> Email Templates -> **Magic Link**: put `{{ .Token }}` in the body (for example "Your Le Nid code is {{ .Token }}"). The app asks for this 6-digit code because on iPhone a link opened from Mail lands in Safari, not in the installed app.
4. Authentication -> SMTP Settings: **set a custom SMTP provider**. Supabase's built-in mail is limited to a few emails per hour, which 35 people signing in will exceed. Options: Resend or Brevo (free, needs a domain), or a Gmail account with an app password (`smtp.gmail.com`, port 465).
5. Authentication -> URL Configuration: set Site URL to your Vercel URL.
6. Project Settings -> API: copy the URL, anon key, and service_role key.

## 2. Keys
- Push: `npx web-push generate-vapid-keys` (public and private key).
- `CRON_SECRET`: any long random string.
- DeepL: free API key from deepl.com/pro-api.
- Optional: Resend key and `EMAIL_FROM` for emailed reminders.

## 3. Vercel
Import the repo, add every variable from `.env.example`, deploy. The daily reminder job in `vercel.json` also touches the database, which keeps the free Supabase project from pausing.

## 4. Bible text
On a computer that can reach ebible.org: `node scripts/build-bible.mjs`, check a few verses against the printed text (the French translation is a draft), commit `public/bible`, push.

## 5. First run
1. Open the site, sign in with your email, enter the code.
2. In the Supabase SQL editor: `update profiles set role = 'admin' where email in ('you@example.com', 'coleader@example.com');`
3. Admin page: set the group goal, create teams, add the itinerary, a first announcement, a prep meeting, a verse set, and a to-do.

## 6. Test on real iPhones before the group does
- Add to Home Screen, sign in with a code inside the installed app, turn on notifications, post a test announcement with push.
- Run a lesson with sound on and silent switch off, check audio plays.
- Translate: type, and dictate with the keyboard microphone.
- Reminders: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/cron/reminders`.

## 7. During and after the trip
- Passport copies live in the private `todo-uploads` bucket. Delete them after the trip (Storage -> todo-uploads).
- Back up: Supabase Project Settings -> Database -> Backups, or `pg_dump` from the connection string.
- Content changes: lessons in `content/french/units.json`, Odile's lines in `lib/odile.ts`; push to deploy.
