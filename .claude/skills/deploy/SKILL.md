---
name: deploy
description: Deploy qazbot-kanban to production by landing work on the GitHub main branch. Use when the user says "deploy", "ship to prod", "release", "push to main", "merge and deploy", asks why production did not update, or wants to redeploy or roll back.
---

# Deploy through main

Production (https://qazbot-kanban.vercel.app) changes only one way: a push to `main` on
`howardat/qazbot-kanban`. That runs `.github/workflows/deploy.yml`:

1. `check` — reuses `ci.yml`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
2. `deploy` — `pnpm db:migrate` against `PROD_DATABASE_URL`, then `vercel deploy --prod` (Vercel builds it,
   because the production env vars are Sensitive), then a smoke test: `/login` and `/workers` must return 200.

Vercel Git deploys are off (`vercel.json` → `git.deploymentEnabled: false`). Never run `vercel deploy --prod`
by hand: it skips the migrations and the checks.

## Before you start

Pushing to `main` deploys to real users and runs migrations on the production database. Confirm with the user
before merging or pushing to `main`, every time, unless they asked for the deploy in this same request.

## Steps

1. **Check the branch.** `git status` must be clean, and the branch pushed. Note what will ship:
   `git log --oneline origin/main..HEAD`.

2. **Check migrations.** If `src/db/schema.ts` changed, the matching migration must be in `drizzle/`
   (`pnpm db:generate`, then commit the SQL and `drizzle/meta`). Read each new `drizzle/*.sql` file. Flag anything
   destructive (`DROP`, `ALTER ... TYPE`, `NOT NULL` without default on a filled table) to the user before
   going on: migrations run before the new code is live, and there is no automatic down-migration.

3. **Run checks locally** (optional but fast feedback):
   `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

4. **Write patch notes.** People see them in the Updates dialog (sidebar, above the user card). They live in
   `src/lib/updates.ts` as `RELEASES`, newest first. `LATEST_RELEASE` is `RELEASES[0].id`, and a new id gives
   everyone the unread dot.
   - Find what is not yet announced: compare `git log --oneline origin/main..HEAD` with the ids on main
     (`git show origin/main:src/lib/updates.ts | grep 'id:'`).
   - Nothing a user would notice (refactors, CI, tests, internal tools)? Skip this step; no new release.
   - Otherwise add one release at the **top** of `RELEASES`:
     ```ts
     {
       id: "2026-10-29-short-slug",   // YYYY-MM-DD-slug of the deploy day; unique
       date: "2026-10-29",
       title: { en: "…", ru: "…" },   // the headline of this update, a few words
       changes: [
         { kind: "new", text: { en: "…", ru: "…" } },
       ],
     },
     ```
   - `kind`: `new` (a feature people did not have), `improved` (something they had works or looks better),
     `fixed` (a bug they could hit). Order: new, improved, fixed.
   - Write for the people using the board, not developers: one sentence per change, say what they can now do
     and where. No file names, library names, PR numbers or jargon. Match the tone of existing entries.
   - Both `en` and `ru` are required (the type enforces it). Write the Russian naturally, not word for word.
   - If the top release's id is not on main yet (a release prepared earlier on this branch), extend it
     instead of adding a second one. Never change an id that is already on main: it is stored in
     `profiles.updates_seen`.
   - Show the user the draft notes, then commit (`Patch notes: <title>`) and push.

5. **Land on main.** Prefer a PR:
   ```bash
   git push -u origin HEAD
   gh pr create --base main --fill        # or reuse the open PR: gh pr view
   gh pr checks --watch                   # wait for CI to go green
   gh pr merge --merge --delete-branch=false
   ```
   If the user wants it without a PR and `main` is an ancestor of the branch:
   `git push origin HEAD:main` (fast-forward only — never force-push `main`).

6. **Watch the deploy.**
   ```bash
   gh run list --workflow=deploy.yml --branch=main --limit=1
   gh run watch <run-id> --exit-status
   ```
   On failure: `gh run view <run-id> --log-failed`.

7. **Verify.** The workflow's smoke test passing means `/login` and `/workers` return 200. Report to the user
   the merged commit, the run URL and the production URL.

## When something fails

| Failed step | What to do |
| --- | --- |
| `check` | Fix on a branch and land again. Nothing reached production. |
| Migrate | Production DB may be partly migrated; old code still live. Read the log, fix the migration forward. Do not edit an already applied migration file. |
| Vercel deploy | Migrations already applied. Check the build log in Vercel (`vercel inspect`, or the Vercel MCP `get_deployment` / build logs). Fix and land again. |
| Smoke test | New code is live and broken. Roll back (below), then fix. |

## Redeploy and roll back

- **Redeploy current main** (e.g. after changing a Vercel env var): `gh workflow run deploy.yml --ref main`.
- **Fast rollback of code:** `vercel rollback` (or promote an earlier deployment in the Vercel dashboard).
  This does not undo migrations, and the next push to `main` will deploy again — so follow with a
  `git revert` on `main` that lands through the normal steps.

## Secrets the workflow needs

Repository secrets: `PROD_DATABASE_URL` (Supabase session pooler, port 5432), `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID` (the last two from `.vercel/project.json`). Check with `gh secret list`. Never print them.
