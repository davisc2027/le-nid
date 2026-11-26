# Privacy and retention

Short operating note for the leaders (not legal advice). Background: `docs/audit-security.md`.

## What is stored, and who can see it

- **Passport copies and other to-do uploads** live in the private `todo-uploads` bucket, one file per person per to-do at `<user id>/<to-do id>`. Only the person and the leaders can open them (leaders through a 60-second link from Admin).
- **Leader files** live in the private `files` bucket.
- **Sign-in codes made by a leader** and **person/upload deletions** are written to the `admin_audit` table (migration 0020). Only leaders can read it, in the Supabase table editor.

## Retention

- **Delete all uploads after the trip.** Suggested date: **30 April 2027**. Put it in the calendar. On that date empty the `todo-uploads` bucket from the Supabase dashboard (Storage, `todo-uploads`, select all, Delete), or delete each person with Admin, People, Delete person (this also removes their uploaded files and reports how many).
- A leader can remove one file at any time: Admin, To-dos, open the to-do, Uploads, **Delete file** next to that person.
- Deleting a person removes their account, progress and uploaded files. Members cannot delete their own account; ask a leader.
- Supabase keeps daily backups for a few days (Free plan: 7), so a deleted file can survive in a backup until it ages out.
- Delete accounts, XP and votes (or pause and delete the Supabase project) by summer 2027. Purge pending and rejected sign-ups monthly.
- Keep health data (medical forms, insurance, allergies) out of to-do uploads.

## Finding orphaned uploads

An orphan is a stored file that no to-do points at any more (an old copy from before 0020, or a person deleted before this fix). Read-only query, safe to run in the SQL editor:

```sql
select o.name, o.created_at
from storage.objects o
where o.bucket_id = 'todo-uploads'
  and not exists (select 1 from public.todo_assignments a where a.upload_path = o.name)
order by o.created_at;
```

Delete what it lists through the Storage dashboard or the Storage API, **not** with `delete from storage.objects` (a SQL delete leaves the file itself in object storage).

## Upload limits (migration 0020)

- To-do uploads: up to 10 MB; PDF, JPEG, PNG, HEIC/HEIF or WebP.
- Leader files: up to 50 MB; PDF, images, Word/Excel/PowerPoint/OpenDocument, RTF, plain text, CSV, Markdown. Audio, video and zip files are not allowed; share those by link.

## Security headers: report-only plan

`next.config.ts` sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (microphone for this site only) and HSTS, plus a **report-only** `Content-Security-Policy`. Report-only means nothing is blocked; violations are written to the Vercel function log as `CSP report ...` lines (`/api/csp-report`).

To switch to enforcing:

1. Use the app normally for about a week, including Conversation mode (Safari and Home Screen app), push, file downloads, Learn audio and the Admin console.
2. Search the Vercel logs for `CSP report`. For each legitimate source that is reported, add it to the matching directive in `next.config.ts`; ignore reports from browser extensions.
3. When a few days pass with no legitimate reports, rename the header key `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `next.config.ts` and deploy. Keep an eye on the same logs for a few days; reverting is a one-word change.
4. Later, optionally, replace `'unsafe-inline'` in `script-src` with per-request nonces.
