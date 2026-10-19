# Code Review Standards

> Scope: every change that lands on `main` in this repository — application code,
> Supabase Edge Functions, SQL migrations, tests, and configuration.
>
> This document defines **what a reviewer must judge**. The companion
> [`process.md`](./process.md) defines **when and how** the review happens.

---

## 1. Principles

1. **Review is about the change, not the author.** Comment on the diff. Never on
   the person.
2. **Automate what can be automated.** Formatting, import order, unused
   variables, and type errors are not review topics — they are CI topics. If a
   reviewer is arguing about spacing, the tooling has failed.
3. **Approve means "I would ship this."** Approval is not "I have no comments."
   If you would not deploy it, do not approve it.
4. **One blocking concern at a time.** A review should surface the most
   important issue clearly rather than 40 equally-weighted comments.
5. **Consistency beats personal preference.** When a pattern already exists in
   the codebase, follow it or propose changing it repo-wide — never locally.

---

## 2. Severity levels

Every review comment MUST start with a severity prefix. This is what makes a
review actionable instead of a wall of opinion.

| Level | Prefix | Meaning | Blocks merge? |
|---|---|---|---|
| **Blocker** | `[blocker]` | Correctness bug, security hole, data loss, broken build, missing RLS policy, secret exposure | **Yes** |
| **Major** | `[major]` | Likely bug on an edge case, untested core logic, design flaw that will be expensive to reverse | **Yes** — or explicitly deferred to a linked issue |
| **Minor** | `[minor]` | Maintainability, naming, duplication, missing non-critical edge case | No |
| **Nit** | `[nit]` | Taste, micro-style, optional polish | No — explicitly non-binding |

**Rules of use**

- Only `[blocker]` and `[major]` may be used to request changes.
- A `[nit]` is a suggestion. The author may resolve it with no reply, or ignore
  it. Reviewers must not re-raise an ignored `[nit]`.
- If you cannot justify a comment as a concrete failure mode, it is a `[nit]` at
  most. "I would have written it differently" is not a `[major]`.
- Every `[blocker]`/`[major]` must include **why it matters** and **a suggested
  direction**. A comment that only says "this is wrong" is not a review.

**Comment template**

```
[severity] <what is wrong>
Why: <the failure mode this causes>
Suggestion: <concrete fix or direction>
```

---

## 3. Universal dimensions

Every PR is checked against these eight dimensions. Reviewers do not need to
comment on all of them — only where something is off.

### 3.1 Correctness
- Does the code do what the PR description claims, for the stated inputs?
- Are edge cases handled: empty arrays, `null`/`undefined` from the database,
  zero-length decks, first-run state (`repetitions === 0`)?
- Are async paths free of races and double-submits? (See the existing
  `isSubmitting` guard pattern in `SpacedReviewMode`.)
- Are dates and timezones handled explicitly? This app persists ISO timestamps
  and compares them against "today" — a missing `now` parameter is a smell.

### 3.2 Error handling
- Every `await` on a Supabase call checks `error` before using `data`.
- Errors surface to the user (toast/inline message), not only `console.error`.
- Retries are only applied to **transient** failures — reuse
  `isRetryableError` from `src/utils/retry.ts` rather than re-implementing.
- No empty `catch {}` blocks. Swallowing an error requires a comment explaining
  why the failure is acceptable.

### 3.3 Types
- `strict` is on; no new `any`, no `as unknown as T` casts to escape the type
  system.
- `unknown` + narrowing is preferred over `any` in catch blocks
  (`catch (err: unknown)` then `instanceof Error`).
- Database row types (`snake_case`) are mapped to domain types (`camelCase`) in
  one place, following the existing `mapRowToCardReview` pattern. Do not leak
  `snake_case` fields into components.
- Type-only imports use `import type`.

### 3.4 Security & data isolation
This is the highest-risk area in this codebase. Treat any miss as a `[blocker]`.

- **Secrets:** no API keys, tokens, or service-role keys in client code, `.env`,
  or any `VITE_*` variable. `GOOGLE_AI_KEY` lives only in Supabase Secrets.
- **Authorization:** every new table ships with RLS enabled **and** policies for
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` scoped to `auth.uid() = user_id`. A
  migration that creates a table without RLS is a `[blocker]`.
- **Defense in depth:** queries still filter by `user_id` even though RLS exists.
- **Input validation:** user input crossing a trust boundary is validated with
  Zod (`src/utils/validation.ts`) on the client and re-validated in the Edge
  Function. Client-side validation alone is never sufficient.
- **Untrusted content:** AI-generated or file-imported text is rendered as text,
  never as HTML. No `dangerouslySetInnerHTML` on model output.
- **CORS:** `ALLOWED_ORIGINS` must be an explicit allowlist. Never `*`.
- **Payload limits:** new upload or request paths define a maximum size and
  reject oversize input before processing (see the `MAX_*_BYTES` constants).

### 3.5 Tests
- New pure logic in `src/services/` has unit tests. The SM-2 scheduler is the
  reference standard: table-driven `it.each`, explicit `now`, boundary coverage
  (ease floor at 1.3, `repetitions` 0/1/2).
- Bug fixes include a test that fails before the fix. If a regression test is
  genuinely impractical, the PR description must say why.
- Tests assert behavior and observable output, not internal call order.
- Tests must not depend on the real clock, network, or a live Supabase project.

### 3.6 Performance
- No unbounded loops over user data or AI calls inside render.
- Batch/chunk external calls (the `chunkSize = 10` pattern in `aiService`) rather
  than firing N requests.
- Expensive derived values are memoized; `useEffect` dependencies are correct and
  complete (a missing dependency is a `[major]`, not a `[nit]`).
- New heavy dependencies are justified in the PR description — bundle size is a
  reviewed concern, not an afterthought.

### 3.7 Accessibility & UX
- Interactive elements are real `<button>`/`<a>` elements, keyboard reachable.
- State is not conveyed by color alone.
- Loading, empty, and error states all exist for new async views.
- Progress indicators expose `role` and `aria-value*` (see the existing review
  progress bar).

### 3.8 Maintainability
- The change is understandable without reading the PR description.
- Names describe intent (`dueCount`, not `d1`).
- Duplication is removed only when the abstraction is already clear — do not
  introduce a generic helper for two call sites.
- Comments explain **why**, not **what**. Dead code is deleted, not commented out.
- Files stay under ~400 lines. `Home.tsx` (725) and the Edge Function (876) are
  existing outliers — do not add new ones; prefer extracting a module when a file
  crosses the threshold.

---

## 4. Area-specific rules

### 4.1 React components
- Components are function components with explicit prop interfaces
  (`export interface XProps`).
- Side effects live in `useEffect`; data fetching lives in a hook or service, not
  inline in JSX.
- Callbacks passed to `useEffect` dependencies are wrapped in `useCallback`
  (existing precedent: `fetchDueCards`).
- No business logic in components. Scheduling math belongs in
  `src/services/spacedRepetitionService.ts`.
- Conditional rendering does not hide a broken state — prefer explicit
  loading/error/empty branches.

### 4.2 Services & data access
- One module per concern: `supabaseService`, `authService`, `storageService`,
  `aiService`, `fileService`, `spacedRepetitionService`.
- Services throw typed errors; components decide how to present them.
- Never `select('*')` into a component. Select the columns you need, map to a
  domain type at the boundary.
- `console.error` is not error handling. Logging is acceptable **in addition to**
  surfacing the error, never instead of it.

### 4.3 Database migrations
- Migrations are immutable once merged. Fix forward with a new migration.
- Every migration is idempotent-safe where practical (`if not exists`).
- New columns are nullable or carry a default — no breaking change without a
  backfill plan.
- A migration PR states: tables touched, RLS impact, rollback plan.
- **Requires two reviewers.**

### 4.4 Edge Functions & AI integration
- The function validates and size-limits its input before calling Gemini.
- Structured output is validated against a schema; malformed model output
  returns a controlled `502`, never an unhandled throw.
- Failures return the `FunctionError` shape (`status` + `code`) so the client can
  distinguish retryable from terminal errors.
- Prompt changes are reviewed as behavior changes: the PR states what output
  shape is now guaranteed.
- **Requires two reviewers.**

### 4.5 Auth
- Auth flows never log credentials, tokens, or session objects.
- New auth paths have explicit tests for the failure case (invalid credentials,
  expired session, cancelled OAuth).
- **Requires two reviewers.**

### 4.6 Tests
- Test names read as behavior: `requeues Again cards to the end of the session
  queue`, not `test1`.
- Arrange–Act–Assert, with the assertion on the observable result.
- Mocks are scoped to the module under test; do not mock the thing you are
  testing.

### 4.7 Commits & PR scope
- Conventional Commits: `feat|fix|refactor|test|docs|chore(scope): summary`.
  Scope is the area (`spaced-review`, `auth`, `dashboard`).
- One logical change per PR. A refactor and a feature are two PRs.
- **No drive-by reformatting.** Reformatting unrelated files makes the real diff
  unreviewable and is a `[major]`.

---

## 5. Accepted patterns — do not flag these

These are deliberate decisions in this codebase. Reviewers should not reopen
them without a repo-wide proposal.

| Pattern | Why it is accepted |
|---|---|
| `snake_case` in DB rows, `camelCase` in domain types | The boundary mapper isolates the naming difference; mixing is intentional. |
| Pure functions take `now: Date = new Date()` | Makes scheduling deterministic and testable. Do not "simplify" it away. |
| Tailwind class strings stored in config objects (`RATING_BUTTONS`) | Keeps variant styling declarative and colocated. |
| `USE_EDGE_FUNCTION` constant in `aiService` | Explicit kill-switch for the direct-API path; documented security posture. |
| Long `MAX_*` constant block in the Edge Function | Centralized limits are easier to audit than scattered magic numbers. |
| No global state library | App state is small enough for hooks; do not propose Redux/Zustand without a concrete problem. |
| `console.warn` in retry paths | Retry diagnostics are intentionally noisy in dev and captured in function logs. |

---

## 6. What reviewers must NOT do

- Do not request changes for style that a formatter or linter should own.
- Do not rewrite the author's solution to match your own approach when theirs is
  correct and consistent.
- Do not leave more than ~10 comments on a single PR without offering a call —
  beyond that, a synchronous review is faster for everyone.
- Do not approve "to unblock" while a `[blocker]` is open.
- Do not use review comments to raise unrelated pre-existing issues. File a
  follow-up issue and link it.
- Do not comment on lines outside the diff unless the change makes them wrong.

---

## 7. Worked examples

### Example A — missing null guard (real class of issue)

```ts
// Flag as [major]: data is Deck[] | null, so this throws at runtime
// when the query returns no rows.
const { data, error } = await supabase.from('decks').select('*').eq('user_id', userId);
if (error) throw error;
return data.map((deck) => ({ ...deck, id: deck.id.toString() }));

// Preferred
if (error) throw error;
return (data ?? []).map((deck) => ({ ...deck, id: String(deck.id) }));
```

### Example B — non-deterministic logic

```ts
// Flag as [major]: untestable and timezone-dependent
function nextDue(interval: number) {
  return new Date(Date.now() + interval * 864e5).toISOString();
}

// Preferred: clock is a parameter, matching calculateNextReview
function nextDue(interval: number, now: Date = new Date()) {
  return new Date(now.getTime() + interval * 86_400_000).toISOString();
}
```

### Example C — authorization assumed from the client

```ts
// Flag as [blocker]: client-side check only. RLS is the actual boundary.
if (deck.userId === currentUser.id) {
  await supabase.from('decks').delete().eq('id', deckId);
}

// Preferred: filter server-side as well, and rely on RLS
await supabase.from('decks').delete().eq('id', deckId).eq('user_id', userId);
```

---

## 8. Amending these standards

- Proposals go in a PR touching this file only, with a one-paragraph rationale.
- A rule is added only after it has caused at least one real review dispute or
  defect. Standards are a record of decisions, not a wishlist.
- Standards are reviewed quarterly; rules that no reviewer has cited in a quarter
  are candidates for deletion.
