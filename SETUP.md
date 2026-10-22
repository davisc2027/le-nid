# Setup checklist

Everything here is free-tier. Do it once; any computer can repeat it from this file. Work in order.

## 1. Supabase
1. Create a project at supabase.com (free). Note its region.
2. SQL editor: run `supabase/migrations/0001` through `0007` in order (or `npx supabase link` then `npx supabase db push`; the bundled `supabase` CLI needs `supabase link` first). `0006` fixes the profile trigger; `0007` adds the sign-up allowlist and hardening.
3. Authentication -> Providers -> Email: keep "Allow new users to sign up" on (the allowlist in `0007` blocks anyone not on the trip list), and set the OTP length to **6** to match the app's code box.
4. Authentication -> Email Templates: edit **both Confirm signup and Magic Link** (new users get Confirm signup, returning users get Magic Link). Put `{{ .Token }}` in the body, for example "Your Le Nid code is {{ .Token }}". The app asks for this 6-digit code because on iPhone a link opened from Mail lands in Safari, not in the installed app.
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
| `DEEPL_API_KEY` | Free key from deepl.com/pro-api (translate). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, for emailed reminders. |

**Never commit `vercel-env.txt`, `.env.local` or any file holding these values.** If one was ever committed or shared, rotate the keys (especially the service-role key).

## 3. Vercel
1. Import the repo and add every variable from section 2, then deploy.
2. Project Settings -> Functions: set the function region to the one closest to your Supabase region (Hobby allows one). This cuts the latency of every page load.
3. The daily reminder job in `vercel.json` also touches the database, which keeps the free Supabase project from pausing.

## 4. Bible text
On a computer that can reach ebible.org: `node scripts/build-bible.mjs`, spot-check a few verses (for example John 3:16, Psalm 23:1, Romans 8:38-39), commit `public/bible`, push. Without it, verse memory has no text.

## 5. First run
1. Open the site, sign in with your email, enter the code. (The first admin must be able to sign up: if the allowlist is already active, insert your email into `allowed_emails` in the SQL editor first.)
2. In the SQL editor: `update profiles set role = 'admin' where email in ('you@example.com', 'coleader@example.com');`
3. **Add every trip member's email on the Admin page (allowed emails) BEFORE they sign in.** The admin's own email must be on the list too, or already signed up. Anyone not listed sees "This email isn't on the trip list. Ask a leader." Remove unknown accounts that signed up earlier.
4. Admin page: set the group goal, create teams, add the itinerary, a first announcement, a prep meeting, a verse set, and a to-do.

## 6. Smoke test
- Sign in with an allowed email; an unlisted email is refused.
- Post a test announcement; the time shown is Paris time.
- Open Files and tap a file (the link is generated on tap, so it never expires).
- Translate a phrase.
- Reminders: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-SITE/api/cron/reminders` returns 200; without the header it returns 401.

## 7. iPhone testing checklist (do this before the group does)
- Safari -> Share -> Add to Home Screen; open the app from the Home Screen icon.
- Sign in with a code inside the installed app (not in Safari).
- Turn on notifications on the Me page, post a test announcement with push, confirm it arrives.
- Run a French lesson with sound on and the silent switch off; confirm audio plays.
- Translate: type, and dictate with the keyboard microphone.
- Turn on airplane mode and check what loads.
- Check light and dark mode and the bottom nav above the home bar.

## 8. During and after the trip
- Passport copies live in the private `todo-uploads` bucket. After the trip, empty the bucket (Storage -> todo-uploads) and clear the path column: `update todo_assignments set upload_path = null;`
- Back up: Supabase Project Settings -> Database -> Backups, or `pg_dump` from the connection string.
- Content changes: lessons in `content/french/units.json`, Odile's lines in `lib/odile.ts`; push to deploy.
