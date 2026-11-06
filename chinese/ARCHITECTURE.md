# Chinese Lab — architecture and progress

## Current state

- Static website: `/chinese/index.html` on GitHub Pages.
- Curriculum: `data/manifest.json` lists available lesson JSON files. The curriculum describes two parts, 10 lessons each; only published lesson files are included in `lessons`.
- Lesson content, readings and vocabulary live in standalone JSON in `data/`. Add a lesson by creating `lessonN.json` and adding its filename to `manifest.lessons` (with a stable numeric `id` in the lesson file).
- No user account or remote database yet. The app's SRS/review scope can include all lessons, individual lessons, or custom words.
- Progress remains stored under `sonya-chinese-lab-progress-v1` in localStorage to preserve existing user data, using `js/progress-store.js`.
- The **МОЙ ПРОГРЕСС** section exports/imports progress as a versioned JSON backup. Import explicitly replaces local progress after confirmation.

## Stable progress shape

The current progress object contains `xp`, `correct`, `attempts`, `stories`, `weak`, `questWords`, `srs` (per-Hanzi review intervals), `saved` (custom dictionary), `ciDone` (reading chapters), `reviewScope`, `reviewDir`, `sound`, `rate`, and `lastLessonId`. Never change the existing key or remove legacy fields without a migration.

## Future Supabase integration (NOT activated)

1. Create a Supabase project. Keep the project's **publishable/anon** key in browser configuration; **never** expose `service_role` or other server secrets in GitHub Pages. Enable email authentication.
2. Create the user-owned table and RLS policies (example SQL below). No SQL has been run against a live database.
3. Add a cloud adapter behind the existing `ChineseLabProgress` interface: after login, read remote progress and offer explicit **merge or choose local/remote** when both exist. Do not silently overwrite existing offline progress.
4. Save locally immediately on each exercise; enqueue cloud updates with revision/conflict handling and offline retries. De-duplicate SRS by Hanzi; keep chapter completion identifiers stable.
5. Test account deletion, logout, two-device synchronization and a full export→import before enabling auth publicly.

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
