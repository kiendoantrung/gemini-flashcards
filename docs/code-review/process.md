# Code Review Process

> This document defines the lifecycle of a change from branch to `main`:
> who reviews, what must pass, how long it takes, and how disagreements end.
>
> The judging criteria live in [`standards.md`](./standards.md).

---

## 1. Non-negotiables

1. **Nothing reaches `main` without a review.** No direct pushes, including for
   maintainers.
2. **CI must be green** before approval is meaningful. A review on a red build is
   wasted effort.
3. **Every PR is small enough to review in one sitting.** Target ≤ 400 changed
   lines across ≤ 10 files. Hard limit 800 lines — above that, split the PR or
   book a synchronous walkthrough.
4. **One approval minimum. Two for high-risk areas** (see §5).
5. **Squash merge only**, with a Conventional Commit title. History on `main`
   stays linear and readable.

---

## 2. Roles

| Role | Responsibility |
|---|---|
| **Author** | Prepares a reviewable PR, self-reviews first, responds to every blocking comment, keeps the branch current. |
| **Reviewer** | Judges against `standards.md`, responds within the SLA, distinguishes blockers from nits, approves only what they would ship. |
| **Approver / Maintainer** | Confirms the merge gate is satisfied, merges, and owns follow-up tickets created during review. |

In a single-maintainer situation, the Author role still applies, and the
"reviewer" is the CI gate plus a deliberate second pass over your own diff after
a pause (see §9).

---

## 3. Lifecycle

```
branch ──► PR (draft) ──► self-review ──► CI green ──► Ready for review
                                                          │
                                                          ▼
                                            ┌─────── Reviewer ───────┐
                                            │                        │
                                     Changes requested          Approved
                                            │                        │
                                     fix + push ──► re-review        │
                                            │                        ▼
                                            └──────────────► Merge gate ──► Squash merge ──► deploy
```

### Step 1 — Author prepares
- Branch from `main`: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- Keep the diff scoped. Separate refactors from features.
- Run the local gate before opening the PR:
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build
  ```
- Fill in the PR template completely. A PR with an empty "How to verify" section
  will be returned.

### Step 2 — Self-review (mandatory, 5 minutes)
Open the **Files changed** tab and read your own diff top to bottom before
requesting review. This catches the majority of avoidable comments: leftover
`console.log`, commented-out code, debug flags, accidental formatting churn,
files that should not be committed.

### Step 3 — Request review
- Open as **Draft** while CI is running or the change is incomplete.
- Mark **Ready for review** only when CI is green.
- Assign a reviewer. If you do not know who, assign the maintainer; if they are
  the author, request review from the second most familiar contributor.

### Step 4 — Reviewer responds
- **SLA: first response within 1 business day.** Hotfixes: within 4 hours.
- If you cannot review in time, say so immediately and reassign. Silence is the
  most expensive review outcome.
- Review against the eight dimensions in `standards.md`, using severity prefixes.
- Submit one of three verdicts:
  - **Approve** — you would ship this.
  - **Comment** — non-blocking observations only.
  - **Request changes** — at least one `[blocker]` or `[major]`.

### Step 5 — Author responds
- Reply to **every** blocking comment — either with a fix or with a reasoned
  disagreement.
- Do not resolve a reviewer's thread yourself; let the reviewer resolve it.
- Push fixes as new commits during review (easier to re-read). Squash happens at
  merge time.

### Step 6 — Re-review
- Re-reviews cover **only the delta** plus any unresolved threads, unless the
  change altered the approach.
- **Maximum two review rounds.** If a third round is needed, switch to a 15-minute
  call or pair session and record the outcome in the PR.

### Step 7 — Merge
The merge gate is all of:
- [ ] CI green (lint, typecheck, test, build)
- [ ] Required approvals present
- [ ] No unresolved `[blocker]` / `[major]` threads
- [ ] PR description matches what the diff actually does
- [ ] Branch up to date with `main`
- [ ] Squash-merge title is a valid Conventional Commit

Delete the branch after merge.

---

## 4. Review states and what they mean

| GitHub state | Meaning | Author action |
|---|---|---|
| Draft | Not ready; expect no review | Finish the work |
| Ready, no review | Waiting in queue | Wait for SLA, ping after 1 business day |
| Changes requested | Blocking issue exists | Fix or argue, then re-request |
| Approved | Reviewer would ship it | Merge when CI is green |
| Approved + new commits | Approval is stale | Re-request review |

**Approval is invalidated by any push after approval.** This is intentional.

---

## 5. High-risk changes — two reviewers required

These areas have outsized blast radius. Two approvals, and the second reviewer
must be someone other than the author's pair:

- SQL migrations in `supabase/migrations/` (schema, RLS policies, indexes)
- `supabase/functions/generate-flashcards/index.ts` (secrets, CORS, input limits)
- `src/services/authService.ts` and anything touching session/token handling
- Changes to `ALLOWED_ORIGINS`, secrets, or deployment configuration
- Dependency upgrades that cross a major version

The PR description must additionally state, for these areas:
- **Migrations:** tables/columns touched, RLS impact, rollback plan.
- **Edge Function:** what input limits apply, what the error contract is.
- **Auth:** which flows were manually exercised.

---

## 6. Disagreement and escalation

1. **Restate the concern as a failure mode.** "This will break when the deck has
   zero cards" is resolvable; "I don't like this" is not.
2. **Check `standards.md` §5** — if the pattern is an accepted decision, the
   reviewer withdraws the comment.
3. **Timebox to one round.** If two rounds do not converge, the reviewer and
   author have a 15-minute call. The outcome is posted as a PR comment.
4. **The author decides on style, the reviewer decides on risk.** A reviewer may
   block on correctness, security, data integrity, and test coverage. They may
   not block on structure they merely prefer, once the author has justified it.
5. **The maintainer breaks ties**, and records the decision. If the tie-break
   establishes a new rule, it goes into `standards.md` in a follow-up PR.

---

## 7. Hotfix path

For production incidents only:

1. Branch `fix/<incident>` from `main`.
2. Minimum one reviewer, reviewed within 4 hours. CI still must pass — no
   exceptions, no `--no-verify`.
3. If the fix cannot be made safe in time, prefer a revert of the offending
   commit over a rushed patch.
4. Within 48 hours, open a follow-up PR containing the regression test and any
   cleanup deferred during the incident. **A hotfix without a follow-up issue is
   an incomplete hotfix.**

---

## 8. Metrics that tell you if this is working

Track monthly, in a lightweight table — no tooling required beyond the GitHub
API or a saved search.

| Metric | Definition | Healthy target |
|---|---|---|
| Time to first review | PR ready → first review | < 1 business day (median) |
| Review rounds | Rounds per merged PR | ≤ 2 for 80% of PRs |
| PR size | Changed lines per PR | ≤ 400 (median) |
| Escaped defects | Bugs found in prod that a review should have caught | Declining quarter over quarter |
| Revert rate | Reverts / merges | < 5% |
| Review coverage | Merged PRs with ≥ 1 approval | 100% |

**Warning signs**
- Time to first review climbing → reviews are batched; assign on open, not on
  request.
- PR size climbing → authors are batching work; enforce the split rule.
- Review rounds climbing → standards are ambiguous; amend `standards.md` rather
  than arguing case by case.
- Escaped defects flat while rounds climb → reviewers are focused on style, not
  risk. Re-read §3 of the standards.

---

## 9. Solo / small-team mode

The process degrades gracefully rather than being abandoned:

- **Self-review is the review.** Open the PR, then review your own diff after a
  minimum 30-minute pause (or the next morning). Reading a diff cold catches
  what re-reading code in your editor does not.
- **CI is the second reviewer.** This is precisely why the gate in §3 exists and
  why type errors must not be tolerated — they are the only automated check
  standing between you and `main`.
- **Keep the PR description honest.** It is the only durable record of intent.
- **Never merge a red build**, even alone. The gate is the mechanism.

---

## 10. Adoption roadmap

### Phase 0 — Normalize the baseline (this week, before enabling the gate)

The repository currently has quality debt that must be cleared, otherwise the new
gate is red on day one and gets ignored.

| ID | Task | Detail |
|---|---|---|
| CR-1 | Fix pre-existing type errors | `npx tsc -b` reports 6 errors: `src/components/Home.tsx:180`, `:315` (motion variant shape mismatch), `src/services/spacedRepetitionService.test.ts:137` (TS2589 excessive instantiation), `src/test/setup.ts:6`, `:9` (read-only `import.meta.env` assignment — use `Object.defineProperty` or a cast), `vite.config.ts:7` (`test` key requires importing `defineConfig` from `vitest/config`) |
| CR-2 | Add `typecheck` script | `"typecheck": "tsc -b"` — done, so `npm run build` can no longer mask type errors |
| CR-3 | Adopt a formatter | Add Prettier with a committed config; run one repo-wide formatting PR **on its own**, so the diff is mechanical and reviewable. Without this, style comments will keep appearing in feature reviews. |
| CR-4 | Enable CI gate | `.github/workflows/ci.yml` runs lint, typecheck, test, build on every PR |
| CR-5 | Turn on branch protection | See §11 |

**Typecheck is non-blocking in the initial workflow** and flips to blocking in
the same PR that closes CR-1. Do not leave it non-blocking past this phase.

### Phase 1 — Week 1–2: make it real
- Adopt `.github/pull_request_template.md` for all new PRs.
- Enable branch protection; verify a red PR cannot merge.
- Announce the severity-prefix convention — it is the single highest-leverage
  habit in this system.

### Phase 2 — Week 3–4: calibrate
- Review every merged PR's comment distribution. If `[nit]` outnumbers
  `[blocker]`, reviewers are over-indexing on style.
- Confirm the two-reviewer rule is actually applied to migrations and the Edge
  Function.
- Run a 30-minute team calibration: three reviewers independently rate the same
  small PR. Divergence reveals where the standards are ambiguous.

### Phase 3 — Ongoing
- Quarterly standards review (§8 of `standards.md`).
- Add a rule only after a real dispute or defect.
- Track the six metrics monthly; act on the warning signs.

---

## 11. Repository configuration (one-time setup)

In **Settings → Branches → Add branch protection rule** for `main`:

- [x] Require a pull request before merging
- [x] Require approvals: **1** (raise to 2 once a second regular contributor exists)
- [x] Dismiss stale approvals when new commits are pushed
- [x] Require review from Code Owners *(only if a `CODEOWNERS` file is added)*
- [x] Require status checks to pass before merging
  - Required checks: `Lint, typecheck, test, build` (from `ci.yml`)
  - [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging
- [x] Require linear history
- [ ] Allow force pushes — **keep disabled**
- [ ] Allow deletions — **keep disabled**

Repository settings:
- **Merge button:** allow *Squash merging* only. Disable merge commits and
  rebase merging.
- **Automation:** delete head branches on merge.

> Note: the existing `deploy.yml` deploys on push to `main`. With the gate above,
> every push to `main` is necessarily a reviewed, green merge — that is the point
> of putting the gate on the PR rather than on deploy.
