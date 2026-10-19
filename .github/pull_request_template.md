## What changed

<!-- One or two sentences. What is different after this PR is merged? -->

## Why

<!-- Link the issue or describe the problem. "Because it was asked for" is not a reason. -->

Closes #

## How to verify

<!-- Reviewer-facing steps. Be specific: which screen, which data, which command. -->

1.
2.

## Risk areas

<!-- Check any that apply. These require a second reviewer (see docs/code-review/process.md §5). -->

- [ ] SQL migration (schema / RLS / index)
- [ ] Edge Function or AI integration
- [ ] Auth / session / token handling
- [ ] Secrets, CORS, or deployment configuration
- [ ] Major dependency upgrade
- [ ] None of the above

If any box above is checked, state the impact:

- **Data / schema impact:**
- **Rollback plan:**

---

## Author checklist

<!-- Complete before marking Ready for review. Unchecked boxes are a valid reason to return the PR. -->

- [ ] Scoped to one logical change — no drive-by refactors or reformatting
- [ ] Diff is ≤ 400 changed lines (or split, or a walkthrough is booked)
- [ ] Self-reviewed the diff in the Files changed tab
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] New logic has tests; bug fixes have a regression test
- [ ] No secrets, keys, or `.env` values added
- [ ] No `console.log`, commented-out code, or debug flags left behind
- [ ] PR title follows Conventional Commits (`feat|fix|refactor|test|docs|chore(scope): summary`)
- [ ] UI changes include a screenshot or short recording

---

## Reviewer checklist

<!-- For the reviewer. Judge against docs/code-review/standards.md; prefix every comment with [blocker] / [major] / [minor] / [nit]. -->

- [ ] The diff does what the description claims
- [ ] Edge cases handled: empty data, `null` from the database, first-run state
- [ ] Every Supabase call checks `error` before using `data`
- [ ] No new `any` or type-system escape hatches
- [ ] New tables have RLS policies scoped to `auth.uid()` *(if applicable)*
- [ ] User input validated at the trust boundary (Zod / Edge Function)
- [ ] Tests assert behavior, not implementation details
- [ ] No unrelated changes smuggled into the diff

**Verdict:** approve only if you would ship this.
