# Spaced Repetition System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed SM-2 spaced-review mode that schedules flashcards across devices and exposes deck-level review progress.

**Architecture:** Keep SM-2 scheduling in a pure, deterministic service function and isolate Supabase reads/writes in the same service module. The dashboard hook owns deck review progress and the active spaced-review deck; `AuthenticatedAppView` selects the appropriate mode, while `SpacedReviewMode` manages only its in-session card queue and rating summary.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, Supabase JS v2, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-28-spaced-repetition-design.md`

## Global Constraints

- Preserve the existing free-flip `StudyMode`, `QuizMode`, and `EditDeckPage` behavior; do not edit those components.
- Store review rows in `card_reviews`, scoped to the authenticated `user_id` and deck UUID, with the flashcard's existing string `id` in `card_id`.
- Enforce one review row per `(user_id, deck_id, card_id)`, due-card lookup support via `(user_id, deck_id, due_date)`, and owner-only RLS for every CRUD operation.
- Rating qualities are fixed: Again=1, Hard=2, Good=3, Easy=4; `ease_factor` must never fall below 1.3.
- A session includes every due review plus at most 20 new cards; it must place Again cards at the end of the current session queue.
- Treat `done` as cards reviewed on the current calendar date whose `due_date` is later than now. The service result also retains the spec-required `new`, `learning`, `due`, and `mastered` counts.
- `getDueCards` returns each card with its nullable review state, rather than a bare card, so the UI can calculate the four next-interval labels without another query.
- Do not commit existing untracked `.agents/` or `docs/` files other than the plan/spec files explicitly being worked on.

---

## File Structure

- Create: `supabase/migrations/20260829000000_card_reviews.sql` — database table, constraints, index, RLS, and grants for review persistence.
- Create: `src/services/spacedRepetitionService.ts` — review domain types, pure SM-2 calculation, Supabase due-card/upsert/progress operations, and interval-display helper.
- Create: `src/services/spacedRepetitionService.test.ts` — deterministic unit tests for scheduling, query mapping, upsert payloads, and progress calculations.
- Create: `src/components/SpacedReviewMode.tsx` — route-compatible component shell, then the load/review/requeue/completion UI.
- Create: `src/components/SpacedReviewMode.test.tsx` — user-facing flow tests with mocked service calls.
- Create: `src/test/setup.ts` — Testing Library DOM matchers cleanup.
- Modify: `package.json` — add test scripts and test-only dependencies.
- Modify: `vite.config.ts` — configure the jsdom test environment and setup module.
- Modify: `src/types/flashcard.ts` — add public `CardReview`, `ReviewStatus`, and progress types shared with UI/service code.
- Modify: `src/hooks/useDashboardState.ts` — own `spacedReviewDeck`, cached per-deck progress, and start/exit/refresh operations.
- Modify: `src/App.tsx` — pass the new hook state and callbacks into the authenticated view.
- Modify: `src/components/AuthenticatedAppView.tsx` — select between dashboard, existing study mode, editor, and spaced review mode.
- Modify: `src/components/DeckList.tsx` — render progress counters and an event-isolated Spaced Review action without changing the existing Study-card click behavior.

### Task 1: Establish test support, shared review contracts, and persistent schema

**Files:**
- Create: `src/test/setup.ts`
- Create: `supabase/migrations/20260829000000_card_reviews.sql`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/types/flashcard.ts`

**Interfaces:**
- Produces: `ReviewStatus = 'new' | 'learning' | 'review' | 'relearning'`, `CardReview`, and `DeckProgress` types available to service and components.
- Produces: `npm test` / `npm run test:watch` and a jsdom test environment for all `*.test.ts(x)` files.

- [ ] **Step 1: Add the failing type/import smoke test**

Create `src/services/spacedRepetitionService.test.ts` with the initial contract import:

```ts
import { describe, expect, it } from 'vitest';
import type { CardReview, DeckProgress } from '../types/flashcard';

describe('spaced repetition contracts', () => {
  it('exposes the persisted review and dashboard progress shapes', () => {
    const review: CardReview = {
      id: 'review-1', userId: 'user-1', deckId: 'deck-1', cardId: 'card-1',
      status: 'new', easeFactor: 2.5, interval: 0, repetitions: 0,
      dueDate: '2026-08-29T00:00:00.000Z', lastReviewedAt: null,
      createdAt: '2026-08-29T00:00:00.000Z',
    };
    const progress: DeckProgress = { new: 3, learning: 0, due: 0, mastered: 0, done: 0 };
    expect(review.cardId).toBe('card-1');
    expect(progress.new).toBe(3);
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `npm test -- src/services/spacedRepetitionService.test.ts`

Expected: FAIL because the test command and/or exported review types do not exist.

- [ ] **Step 3: Add Vitest and Testing Library configuration**

Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` to `devDependencies`; add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Merge this test configuration into the existing `defineConfig` in `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  globals: false,
  clearMocks: true,
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [ ] **Step 4: Define the shared TypeScript contracts**

Append to `src/types/flashcard.ts`:

```ts
export type ReviewStatus = 'new' | 'learning' | 'review' | 'relearning';

export interface CardReview {
  id: string;
  userId: string;
  deckId: string;
  cardId: string;
  status: ReviewStatus;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: string;
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface DeckProgress {
  new: number;
  learning: number;
  due: number;
  mastered: number;
  done: number;
}
```

- [ ] **Step 5: Create the database migration**

Create `supabase/migrations/20260829000000_card_reviews.sql` using the project's `extensions.uuid_generate_v4()` convention:

```sql
create table public.card_reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id text not null,
  status text not null default 'new'
    check (status in ('new', 'learning', 'review', 'relearning')),
  ease_factor numeric not null default 2.5 check (ease_factor >= 1.3),
  interval integer not null default 0 check (interval >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_date timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, deck_id, card_id)
);

create index card_reviews_user_deck_due_date_idx
  on public.card_reviews (user_id, deck_id, due_date);

alter table public.card_reviews enable row level security;

create policy "Users can view their own card reviews" on public.card_reviews
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own card reviews" on public.card_reviews
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own card reviews" on public.card_reviews
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own card reviews" on public.card_reviews
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.card_reviews to authenticated;
```

- [ ] **Step 6: Run the contract test and static checks**

Run: `npm test -- src/services/spacedRepetitionService.test.ts && npx tsc --noEmit`

Expected: PASS; the contracts compile and the new test infrastructure starts successfully.

- [ ] **Step 7: Commit the foundational contracts**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/types/flashcard.ts src/services/spacedRepetitionService.test.ts supabase/migrations/20260829000000_card_reviews.sql
git commit -m "chore: add spaced repetition test and data contracts"
```

### Task 2: Implement and verify the pure SM-2 scheduler

**Files:**
- Create: `src/services/spacedRepetitionService.ts`
- Modify: `src/services/spacedRepetitionService.test.ts`

**Interfaces:**
- Consumes: `CardReview` and `ReviewStatus` from `src/types/flashcard.ts`.
- Produces: `ReviewQuality`, `ReviewState`, `calculateNextReview(currentState, quality, now?)`, and `formatNextInterval(nextState, now?)`.

- [ ] **Step 1: Write failing scheduling tests for every rating branch**

Add tests that pin the specified behavior at a fixed time:

```ts
import { calculateNextReview } from './spacedRepetitionService';

const now = new Date('2026-08-29T12:00:00.000Z');
const fresh = { status: 'new' as const, easeFactor: 2.5, interval: 0, repetitions: 0 };

it('requeues Again immediately and clamps ease at 1.3', () => {
  expect(calculateNextReview({ ...fresh, easeFactor: 1.35, repetitions: 4, interval: 10 }, 1, now))
    .toMatchObject({ status: 'relearning', repetitions: 0, interval: 0, easeFactor: 1.3, dueDate: now.toISOString() });
});

it.each([
  [2, 1, 2.35],
  [3, 1, 2.5],
  [4, 1, 2.65],
])('schedules first successful review for %i', (quality, interval, easeFactor) => {
  expect(calculateNextReview(fresh, quality as 2 | 3 | 4, now))
    .toMatchObject({ status: 'review', repetitions: 1, interval, easeFactor });
});

it('uses six days for a second success and applies the Easy modifier', () => {
  expect(calculateNextReview({ ...fresh, repetitions: 1 }, 4, now))
    .toMatchObject({ repetitions: 2, interval: 8, easeFactor: 2.65 });
});
```

Add a mature-card test with `interval: 10`, `repetitions: 2`, and `easeFactor: 2.5`, asserting `Good` yields `round(10 * 2.5 * 2.5) = 63` days, which follows the spec's base interval and Good multiplier literally.

- [ ] **Step 2: Run scheduler tests to verify they fail**

Run: `npm test -- src/services/spacedRepetitionService.test.ts`

Expected: FAIL because `spacedRepetitionService.ts` and `calculateNextReview` are absent.

- [ ] **Step 3: Implement the pure state transition**

Implement the explicit domain types and calculation, with injected `now` only for deterministic tests:

```ts
export type ReviewQuality = 1 | 2 | 3 | 4;
export type ReviewState = Pick<CardReview, 'status' | 'easeFactor' | 'interval' | 'repetitions'>;

export function calculateNextReview(
  current: ReviewState,
  quality: ReviewQuality,
  now: Date = new Date(),
): ReviewState & { dueDate: string; lastReviewedAt: string } {
  if (quality === 1) {
    return { status: 'relearning', repetitions: 0, interval: 0,
      easeFactor: Math.max(1.3, current.easeFactor - 0.2),
      dueDate: now.toISOString(), lastReviewedAt: now.toISOString() };
  }
  // Determine 1/6/mature base interval, apply the rating multiplier,
  // round and keep a minimum one-day successful interval.
}
```

For quality 2/3/4, subtract 0.15/0/add 0.15 to ease respectively; use 1 day when repetitions is 0, 6 days when it is 1, otherwise `round(interval * current.easeFactor)`, then multiply that base by 1.2/current ease/`current ease * 1.3` respectively, round it, set `status: 'review'`, and increment repetitions.

- [ ] **Step 4: Implement interval labels and their test**

Add a formatter with the exact UI labels:

```ts
export function formatNextInterval(next: Pick<ReviewState, 'interval' | 'status'>): string {
  return next.status === 'relearning' && next.interval === 0 ? '<1m' : `${next.interval}d`;
}
```

Test `Again` as `<1m` and scheduled 1/6/8 day states as `1d`, `6d`, and `8d`.

- [ ] **Step 5: Run the scheduler test suite**

Run: `npm test -- src/services/spacedRepetitionService.test.ts && npx tsc --noEmit`

Expected: PASS with all rating branches, clamp behavior, future due dates, and labels covered.

- [ ] **Step 6: Commit the scheduling engine**

```bash
git add src/services/spacedRepetitionService.ts src/services/spacedRepetitionService.test.ts
git commit -m "feat: add SM-2 review scheduling"
```

### Task 3: Add Supabase review queries, writes, and deck progress

**Files:**
- Modify: `src/services/spacedRepetitionService.ts`
- Modify: `src/services/spacedRepetitionService.test.ts`

**Interfaces:**
- Consumes: `supabase`, `Deck`, `Flashcard`, the scheduler from Task 2, and `CardReview`/`DeckProgress`.
- Produces: `DueCard`, `getDueCards(userId, deckId, allCards, now?)`, `reviewCard(userId, deckId, cardId, quality, now?)`, and `getDeckProgress(userId, deckId, totalCards, now?)`.

- [ ] **Step 1: Write failing tests for database row mapping and due-card ordering**

Mock `../lib/supabase` and have the `card_reviews` select resolve these rows: one relearning due card, one normal due card, one future card. Call:

```ts
const queue = await getDueCards('user-1', 'deck-1', [
  { id: 'relearn', front: 'A', back: 'a' },
  { id: 'due', front: 'B', back: 'b' },
  ...Array.from({ length: 21 }, (_, index) => ({ id: `new-${index}`, front: 'N', back: 'n' })),
], now);

expect(queue.map(({ card }) => card.id)).toEqual(['relearn', 'due', ...Array.from({ length: 20 }, (_, index) => `new-${index}`)]);
expect(queue[0].review?.status).toBe('relearning');
```

Also assert the chained query calls `.eq('user_id', userId)`, `.eq('deck_id', deckId)`, and selects review columns only; filtering of due/new cards remains deterministic in TypeScript so new cards can be combined with review rows.

- [ ] **Step 2: Run the data-access tests to verify they fail**

Run: `npm test -- src/services/spacedRepetitionService.test.ts`

Expected: FAIL because the queue and review persistence APIs are not exported.

- [ ] **Step 3: Implement safe database-row conversion and `getDueCards`**

Create a private snake_case-to-camelCase mapper and an exported queue item:

```ts
export interface DueCard {
  card: Flashcard;
  review: CardReview | null;
}
```

Fetch every existing review row for the user/deck, map rows by `cardId`, discard rows whose IDs no longer exist in deck JSON, then build: relearning records due at/before `now`, other due records, then the first 20 unreviewed deck cards. Sort the two reviewed groups by `dueDate` ascending and preserve the source deck order for new cards.

- [ ] **Step 4: Write the failing upsert and progress tests**

For `reviewCard`, mock a pre-existing row, rate it Good, and assert an `upsert` on `card_reviews` with:

```ts
{
  user_id: 'user-1', deck_id: 'deck-1', card_id: 'card-1',
  status: 'review', ease_factor: 2.5, interval: 1, repetitions: 1,
  due_date: '2026-08-30T12:00:00.000Z', last_reviewed_at: '2026-08-29T12:00:00.000Z'
}
```

For `getDeckProgress`, supply 5 total cards and rows representing one due review, one learning/relearning row, one 21-day review, and one reviewed-today/not-due row. Assert:

```ts
expect(progress).toEqual({ new: 1, learning: 1, due: 1, mastered: 1, done: 1 });
```

- [ ] **Step 5: Implement `reviewCard` and `getDeckProgress`**

`reviewCard` must fetch the one current row using user/deck/card filters, use the default fresh state when no row exists, calculate the next state, and upsert with `{ onConflict: 'user_id,deck_id,card_id' }`. Throw Supabase errors rather than swallowing them.

`getDeckProgress` must fetch the user's rows for the deck once, calculate `new` as `max(totalCards - uniqueKnownCardIds.size, 0)`, `learning` from `learning` or `relearning` status, `due` from non-new rows due at/before `now`, `mastered` from interval >= 21, and `done` from `lastReviewedAt` on the same UTC calendar day with a future due date. Return zero counts for an empty deck/review result.

- [ ] **Step 6: Run service tests and project checks**

Run: `npm test -- src/services/spacedRepetitionService.test.ts && npm run lint && npx tsc --noEmit`

Expected: PASS; mocks demonstrate the user/deck scope, deterministic ordering, 20-new-card cap, payload shape, and progress buckets.

- [ ] **Step 7: Commit the review service layer**

```bash
git add src/services/spacedRepetitionService.ts src/services/spacedRepetitionService.test.ts
git commit -m "feat: persist and query spaced reviews"
```

### Task 4: Wire review progress and navigation into dashboard state

**Files:**
- Create: `src/components/SpacedReviewMode.tsx`
- Modify: `src/hooks/useDashboardState.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AuthenticatedAppView.tsx`

**Interfaces:**
- Consumes: `getDeckProgress(userId, deckId, totalCards)`, `DeckProgress`, and the authenticated user/deck data already held in the hook.
- Produces: `spacedReviewDeck`, `deckProgressById`, `startSpacedReview(deck)`, `exitSpacedReview()`, and `refreshDeckProgress()` from `useDashboardState`.

- [ ] **Step 1: Write a failing view test for spaced-mode routing**

Create a minimal render test in `src/components/SpacedReviewMode.test.tsx` that first imports `AuthenticatedAppView` and asserts a deck passed via the new `spacedReviewDeck` prop displays the spaced-review heading rather than `StudyMode`.

```tsx
render(<AuthenticatedAppView {...baseProps} spacedReviewDeck={deck} />);
expect(screen.getByRole('heading', { name: /spaced review/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the routing test to verify it fails**

Run: `npm test -- src/components/SpacedReviewMode.test.tsx`

Expected: FAIL because the view has no spaced-review props or branch.

- [ ] **Step 3: Create the route-compatible review component shell**

Create `src/components/SpacedReviewMode.tsx` with the final public props and a compilable loading-safe placeholder that will be expanded in Task 6:

```tsx
interface SpacedReviewModeProps {
  deck: Deck;
  userId: string;
  onExit: () => void;
  onComplete: () => void;
}

export function SpacedReviewMode({ deck, onExit }: SpacedReviewModeProps) {
  return <section><h2>Spaced Review: {deck.title}</h2><button onClick={onExit}>Back to Dashboard</button></section>;
}
```

- [ ] **Step 4: Extend `useDashboardState` without disturbing study/edit state**

Add states:

```ts
const [spacedReviewDeck, setSpacedReviewDeck] = useState<Deck | null>(null);
const [deckProgressById, setDeckProgressById] = useState<Record<string, DeckProgress>>({});
```

Implement `refreshDeckProgress` with `Promise.all` over the current decks and authenticated user; call it after deck load, after a deck is created/updated/deleted, and after a spaced session exits. Clear both review mode and progress cache in logout and unauthenticated state transitions. `startSpacedReview` sets the review deck and clears `selectedDeck`; `exitSpacedReview` clears only the review deck then refreshes progress.

- [ ] **Step 5: Pass the new hook contract through `App.tsx`**

Destructure and supply the values/callbacks, preserving the existing `onSelectDeck` and `onExitStudyMode` props:

```tsx
<AuthenticatedAppView
  {...existingProps}
  spacedReviewDeck={spacedReviewDeck}
  deckProgressById={deckProgressById}
  onStartSpacedReview={startSpacedReview}
  onExitSpacedReview={exitSpacedReview}
  onRefreshDeckProgress={refreshDeckProgress}
/>
```

- [ ] **Step 6: Add the view-level mode branch and loading-safe props**

Give `AuthenticatedAppView` the corresponding typed props, including `onRefreshDeckProgress: () => Promise<void>`, and prioritize `editingDeck`, then `spacedReviewDeck`, then `selectedDeck`, then dashboard. Import `SpacedReviewMode` lazily like `EditDeckPage`; pass `user.id`, selected deck, `onExitSpacedReview`, and a completion callback that refreshes progress. Pass `deckProgressById` and `onStartSpacedReview` through to `DeckList`.

- [ ] **Step 7: Run routing/static checks**

Run: `npm test -- src/components/SpacedReviewMode.test.tsx && npx tsc --noEmit`

Expected: PASS; the Task 4 component shell makes the new route independently testable and compilable before Task 6 fills out its UI.

- [ ] **Step 8: Commit dashboard state wiring**

```bash
git add src/components/SpacedReviewMode.tsx src/hooks/useDashboardState.ts src/App.tsx src/components/AuthenticatedAppView.tsx src/components/SpacedReviewMode.test.tsx
git commit -m "feat: add spaced review dashboard state"
```

### Task 5: Render deck progress and expose the Spaced Review action

**Files:**
- Modify: `src/components/DeckList.tsx`
- Modify: `src/components/SpacedReviewMode.test.tsx`

**Interfaces:**
- Consumes: `deckProgressById: Record<string, DeckProgress>` and `onStartSpacedReview(deck)` from Task 4.
- Produces: deck cards with new/due/done counters and an independent spaced-review button.

- [ ] **Step 1: Write a failing dashboard-card interaction test**

Render `DeckList` with one deck and:

```ts
deckProgressById: { 'deck-1': { new: 2, learning: 0, due: 3, mastered: 0, done: 4 } }
```

Assert visible text `2 new`, `3 due`, and `4 done`. Use `userEvent.click(screen.getByRole('button', { name: /spaced review/i }))`; assert `onStartSpacedReview` receives the deck and `onSelectDeck` was not called.

- [ ] **Step 2: Run the deck-card test to verify it fails**

Run: `npm test -- src/components/SpacedReviewMode.test.tsx`

Expected: FAIL because `DeckList` does not accept progress/action props or render the counters/button.

- [ ] **Step 3: Add progress props and zero-safe counters to `DeckList`**

Add:

```ts
deckProgressById: Record<string, DeckProgress>;
onStartSpacedReview: (deck: Deck) => void;
```

For each deck, set `const progress = deckProgressById[deck.id] ?? { new: 0, learning: 0, due: 0, mastered: 0, done: 0 };` and render compact blue/yellow/green labels below its card count. Ensure the dashboard remains usable while progress is loading by showing zeros, not a blocking spinner.

- [ ] **Step 4: Add the event-isolated review button**

Replace the text-only practice footer with distinct buttons: a `Study` button that calls `onSelectDeck(deck)`, and a `Spaced Review` button that calls `event.stopPropagation()` then `onStartSpacedReview(deck)`. Keep Edit/Delete propagation handling and accessible button labels intact.

- [ ] **Step 5: Run component checks**

Run: `npm test -- src/components/SpacedReviewMode.test.tsx && npm run lint && npx tsc --noEmit`

Expected: PASS; click propagation and all three counters are verified.

- [ ] **Step 6: Commit dashboard presentation**

```bash
git add src/components/DeckList.tsx src/components/SpacedReviewMode.test.tsx
git commit -m "feat: show spaced review progress on decks"
```

### Task 6: Build the spaced-review session and completion summary

**Files:**
- Create: `src/components/SpacedReviewMode.tsx`
- Modify: `src/components/SpacedReviewMode.test.tsx`
- Modify: `src/components/AuthenticatedAppView.tsx`

**Interfaces:**
- Consumes: `Deck`, `getDueCards`, `reviewCard`, `calculateNextReview`, `formatNextInterval`, user ID, and an exit callback.
- Produces: a flip-before-rating review flow that displays summary data `{ reviewed, ratings }` at session completion.

- [ ] **Step 1: Write the failing empty-session and rating-flow tests**

Mock `getDueCards` and `reviewCard`. Add tests that assert:

```tsx
render(<SpacedReviewMode deck={deck} userId="user-1" onExit={onExit} onComplete={onComplete} />);
expect(await screen.findByText(/no cards are due/i)).toBeInTheDocument();
```

For a one-card queue, click the `FlashCard` to reveal it, assert the four buttons have `Again`, `Hard`, `Good`, and `Easy` labels plus predicted intervals, click Good, then assert `reviewCard('user-1', 'deck-1', 'card-1', 3)` and the summary's `1 cards reviewed` and `Good: 1` text.

- [ ] **Step 2: Run the session tests to verify they fail**

Run: `npm test -- src/components/SpacedReviewMode.test.tsx`

Expected: FAIL because `SpacedReviewMode` does not exist.

- [ ] **Step 3: Implement loading, empty, and active-card states**

Use `useEffect` keyed by `userId` and `deck.id` to call `getDueCards(userId, deck.id, deck.cards)`. Keep `queue`, `currentIndex`, `isSubmitting`, `loadError`, and `ratings` state. Render a loading spinner while loading, a retry/back panel on load failure, and a no-due-cards panel with a Back to Dashboard button for an empty queue. Render the active `FlashCard` with `showAnswer={false}`; track flip state locally via a wrapper click state so rating controls are not rendered until the card has been flipped.

- [ ] **Step 4: Implement rating controls and predicted labels**

For the current item's nullable review, supply fresh `{ status: 'new', easeFactor: 2.5, interval: 0, repetitions: 0 }` when null. Precompute each next state with qualities 1–4 and render four buttons:

```tsx
{RATINGS.map(({ quality, label, className }) => (
  <button key={quality} disabled={isSubmitting} onClick={() => void handleRate(quality)} className={className}>
    <span>{label}</span><span>{formatNextInterval(previews[quality])}</span>
  </button>
))}
```

Use error handling that leaves the current card in place and presents a retryable message if `reviewCard` rejects.

- [ ] **Step 5: Implement queue advancement, Again requeue, and summary**

After a successful `reviewCard`, increment the rating count and reviewed total. For Again, append the current `DueCard` to the queue and advance; for other ratings, only advance. When the next index reaches the queue length, render a completion panel showing total reviewed, each rating count (Again/Hard/Good/Easy), retention percentage `round(((Hard + Good + Easy) / reviewed) * 100)`, and a Back to Dashboard button. Invoke `onComplete` exactly once before returning to dashboard so progress counters refresh.

- [ ] **Step 6: Add requeue and failure tests**

Use a two-card initial queue. Rate first card Again, second card Good, and assert the first card appears after the second. Make `reviewCard` reject once; assert controls re-enable, the same card remains visible, and no summary/rating increment occurs until a successful retry.

- [ ] **Step 7: Connect the completed component to the authenticated view**

Replace the Task 4 temporary branch/import with the lazy `SpacedReviewMode` import and render:

```tsx
<SpacedReviewMode
  deck={spacedReviewDeck}
  userId={user?.id ?? ''}
  onExit={onExitSpacedReview}
  onComplete={() => void refreshDeckProgress()}
/>
```

Guard against a null `user` by returning the dashboard/loading-safe branch rather than making Supabase calls with an empty ID. The completion summary remains visible; its Back to Dashboard action calls `onExit`, which clears the mode and refreshes progress.

- [ ] **Step 8: Run all focused review tests**

Run: `npm test -- src/services/spacedRepetitionService.test.ts src/components/SpacedReviewMode.test.tsx && npx tsc --noEmit`

Expected: PASS; session loading, flip gate, ratings, prediction labels, persistence calls, requeue, error recovery, and summary are all covered.

- [ ] **Step 9: Commit the review experience**

```bash
git add src/components/SpacedReviewMode.tsx src/components/SpacedReviewMode.test.tsx src/components/AuthenticatedAppView.tsx
git commit -m "feat: add spaced review session mode"
```

### Task 7: Perform full verification and Supabase manual acceptance

**Files:**
- Modify: only files required to correct failures found in verification.

**Interfaces:**
- Consumes: the complete feature from Tasks 1–6 and the configured Supabase project.
- Produces: evidence that the migration, build, lint, TypeScript, automated tests, and intended user flow work together.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`

Expected: every command exits 0; Vite emits a production `dist/` build with no TypeScript or lint errors.

- [ ] **Step 2: Apply the migration to the target Supabase project**

Run: `npx supabase db push`

Expected: the `card_reviews` migration is applied. Verify in the Supabase SQL editor as the authenticated test user that a direct `select * from public.card_reviews` returns only that user's rows.

- [ ] **Step 3: Exercise the browser acceptance path**

Run: `npm run dev`

Manually verify: create or select a deck with at least two cards; dashboard counters begin with new cards; select Spaced Review; flip/rate one card Good; confirm its `card_reviews` row has interval 1 and a due date roughly one day ahead; rate another Again; confirm it returns at the end of the current queue with `relearning`, interval 0, and immediate due date; complete the queue; return to dashboard and confirm counters refresh.

- [ ] **Step 4: Verify cross-device persistence**

Open the same account in a second browser profile/device, reload the dashboard, enter Spaced Review, and confirm the Good-rated card is excluded until its stored due date while the immediate Again card is included. This proves state is read from Supabase rather than local component memory.

- [ ] **Step 5: Commit any verification fixes**

```bash
git status --short
git add <only-files-corrected-during-verification>
git commit -m "fix: address spaced review verification findings"
```

Only create this commit when verification required source changes; otherwise leave the worktree unchanged.

## Plan Self-Review

- Spec coverage: migration/RLS/index are Task 1; SM-2 calculation and interval labels are Task 2; service queries/upserts/progress are Task 3; state routing is Task 4; dashboard counters/action are Task 5; flip/rate/requeue/summary are Task 6; compiler/build/manual/cross-device checks are Task 7.
- Ambiguities resolved: queue entries include nullable review state for prediction labels; `done` is an additive progress property matching the dashboard copy; SM-2 mature Good behavior follows the literal two-stage multiplier wording in the supplied spec.
- Placeholder scan: no deferred implementation placeholders; every task names its files, interfaces, commands, and test behavior.
- Type consistency: all review persistence is represented as camelCase `CardReview` in application code and mapped only at the Supabase boundary to snake_case columns.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-29-spaced-repetition.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
