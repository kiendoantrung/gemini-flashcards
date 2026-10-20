# Code Review

The review system for this repository. Three documents, one template, one gate.

| Artifact | Purpose | Read when |
|---|---|---|
| [`standards.md`](./standards.md) | What reviewers judge: severity levels, eight review dimensions, project-specific rules, accepted patterns | Before your first review; before arguing about a rule |
| [`process.md`](./process.md) | Who reviews, in what order, within what time, and how the merge gate is satisfied | Before opening or reviewing any PR |
| [`.github/pull_request_template.md`](../../.github/pull_request_template.md) | The checklist authors and reviewers actually fill in | Every PR |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Automated gate: lint, typecheck, test, build | Configured once; runs always |

---

## The 60-second version

1. **Small PRs.** ≤ 400 changed lines, one logical change. Big PRs get rubber-stamped.
2. **Green before review.** `npm run lint && npm run typecheck && npm test && npm run build`.
3. **Prefix every comment** with `[blocker]`, `[major]`, `[minor]`, or `[nit]`.
   Only blockers and majors request changes. Nits are explicitly optional.
4. **One approval** (two for migrations, the Edge Function, auth, and secrets).
5. **Approve means "I would ship this."** Not "I have no comments."
6. **Two rounds maximum.** A third round means a call, not another comment thread.
7. **Squash merge**, Conventional Commit title, linear history.

---

## Why this exists

The problem is not that people review carelessly — it is that there is no shared
definition of "done", so each review optimizes for whatever the reviewer happened
to notice. The result is inconsistent quality and unpredictable review latency.

This system fixes that with three mechanisms:

- **A shared rubric** (`standards.md`) so two reviewers looking at the same diff
  reach the same verdict.
- **A predictable lifecycle** (`process.md`) so authors know what to expect and
  reviewers know what is expected of them.
- **An automated gate** (`ci.yml`) so humans never spend review time on things a
  machine can decide.

---

## Current baseline

| Check | Status | Note |
|---|---|---|
| `npm run lint` | ✅ Passes (0 problems) | Blocking |
| `npm run typecheck` | ✅ Passes (0 errors) | Blocking since the baseline was cleared |
| `npm test` | ✅ 82/82 passing | Blocking |
| `npm run build` | ✅ Passes | Does **not** typecheck — that is why the step above exists |

When the gate was introduced this table read `29/29` tests and 6 type errors,
and the typecheck step was non-blocking. The build succeeding while `tsc` fails
is the clearest symptom of the original problem: quality checks existed, but
nothing enforced them. Both are now fixed and every step blocks.

---

## Rollout

Phase 0 (baseline fixes) → Phase 1 (template + branch protection) →
Phase 2 (calibration) → Phase 3 (quarterly review). Details and the exact
task list are in [`process.md` §10](./process.md#10-adoption-roadmap).
