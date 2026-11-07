# Chinese Lab — architecture and progress

## Current state

- Static website: `/chinese/index.html` on GitHub Pages.
- Curriculum: `data/manifest.json` lists available lesson JSON files. The curriculum describes two parts, 10 lessons each; only published lesson files are included in `lessons`.
- Lesson content, readings and vocabulary live in standalone JSON in `data/`. Add a lesson by creating `lessonN.json` and adding its filename to `manifest.lessons` (with a stable numeric `id` in the lesson file).
- Google OAuth frontend and cloud sync adapter are implemented but inactive until Supabase/Google credentials and RLS are configured. Setup steps: [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md). The app's SRS/review scope can include all lessons, individual lessons, or custom words.
- Progress remains stored under `sonya-chinese-lab-progress-v1` in localStorage to preserve existing user data, using `js/progress-store.js`.
- The **МОЙ ПРОГРЕСС** section exports/imports progress as a versioned JSON backup. Import explicitly replaces local progress after confirmation.

## Stable progress shape

The current progress object contains `xp`, `correct`, `attempts`, `stories`, `weak`, `questWords`, `srs` (per-Hanzi review intervals), `saved` (custom dictionary), `ciDone` (reading chapters), `reviewScope`, `reviewDir`, `sound`, `rate`, `lastLessonId`, `lastMode`, and `sessions`. Never change the existing key or remove legacy fields without a migration.

`js/exercise-sessions.js` saves a versioned snapshot of the current exercise for each lesson and mode (quest, pairs, two quiz directions, word builder, sentence builder). Both the shuffled order and partial answers are saved on clicks, so switching tabs and reloading resumes the current round. Only the explicit **НАЧАТЬ ЗАНОВО** action resets a round; XP, SRS and completed vocabulary remain untouched. Exercise snapshots are included in local backups and the same Supabase JSONB progress payload—no additional database table is required.

## Supabase integration (frontend prepared; service not yet configured)

1. Create a Supabase project. Keep the **publishable/anon** key in `config/supabase.js`; **never** expose `service_role`, Google Client Secret, or other server secrets in GitHub Pages. Configure Google OAuth, not email authentication.
2. Create the user-owned table and RLS policies from `supabase/schema.sql`. No SQL has been run against a live database.
3. The cloud adapter is in `js/google-auth.js`; after login it selects local/cloud if both exist and differ. No silent overwrite. There is currently no automatic per-item merge.
4. Each exercise saves locally and queues a cloud write with optimistic `revision` checks. The initial implementation pauses on conflict; it does not silently merge.
5. Test sign-in, two accounts' isolation, logout, two-device synchronization, conflict resolution, full export→import and account deletion support before enabling auth publicly.

```sql
create table public.chinese_lab_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.chinese_lab_progress enable row level security;
create policy "read own progress" on public.chinese_lab_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own progress" on public.chinese_lab_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own progress" on public.chinese_lab_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

For a production backend add a reliable `updated_at` trigger and optimistic versioning or per-item conflict resolution. RLS protects per-user rows but is not a substitute for validation and abuse prevention.

## Publishing and validation

- GitHub Pages serves static data; test `/chinese/data/manifest.json` and all listed lesson files after deploy.
- Verify existing lesson quests, reading chapters, lesson-specific Anki scopes, local progress, and export→import on both desktop and mobile.
- Check the browser console for missing assets or JavaScript errors before merging.
