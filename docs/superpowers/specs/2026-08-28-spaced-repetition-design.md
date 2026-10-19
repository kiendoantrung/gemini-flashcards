# Spaced Repetition System — Design Spec

## Overview

Add a Spaced Repetition study mode using the SM-2 algorithm. Users flip a card, self-rate recall quality (Again / Hard / Good / Easy), and the system schedules the next review date automatically. Review state is persisted in Supabase so it syncs across devices.

## Database

### New table: `card_reviews`

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | uuid_generate_v4() | PK |
| user_id | uuid | — | FK → auth.users, ON DELETE CASCADE |
| deck_id | uuid | — | FK → decks, ON DELETE CASCADE |
| card_id | text | — | Matches Flashcard.id in JSONB |
| status | text | 'new' | 'new' / 'learning' / 'review' / 'relearning' |
| ease_factor | numeric | 2.5 | Min 1.3 |
| interval | integer | 0 | Days between reviews |
| repetitions | integer | 0 | Consecutive correct answers |
| due_date | timestamptz | now() | Next review date |
| last_reviewed_at | timestamptz | null | — |
| created_at | timestamptz | now() | — |

- **Unique constraint:** (user_id, deck_id, card_id)
- **Index:** (user_id, deck_id, due_date) for due-card queries
- **RLS:** user can only CRUD rows where user_id = auth.uid()

## SM-2 Algorithm

### Rating buttons

| Button | Quality | Meaning |
|---|---|---|
| Again | 1 | Forgot completely |
| Hard | 2 | Recalled with difficulty |
| Good | 3 | Recalled normally |
| Easy | 4 | Recalled effortlessly |

### Calculation logic

**If Again (quality < 2):**
- repetitions = 0
- interval = 0 (re-queue in current session)
- status = 'relearning'
- ease_factor -= 0.2 (min 1.3)
- due_date = now (will appear again this session)

**If Hard/Good/Easy (quality >= 2):**
- If repetitions = 0: interval = 1 day
- If repetitions = 1: interval = 6 days
- If repetitions >= 2: interval = round(prev_interval × ease_factor)
- repetitions += 1
- status = 'review'

Interval modifiers:
- Hard: interval × 1.2, ease -= 0.15
- Good: interval × ease_factor, ease unchanged
- Easy: interval × ease_factor × 1.3, ease += 0.15

due_date = now + interval days

### Pure function: `calculateNextReview(currentState, quality) → nextState`

Separated from database calls for testability.

## Service Layer

### File: `src/services/spacedRepetitionService.ts`

**`getDueCards(userId, deckId, allCards)`**
- Query `card_reviews` for this user+deck
- Return cards where due_date <= now(), plus cards with no review row (new cards)
- Sort: relearning first, then due reviews, then new cards
- Limit new cards per session: 20

**`reviewCard(userId, deckId, cardId, quality)`**
- Calculate next state via `calculateNextReview`
- Upsert into `card_reviews`

**`getDeckProgress(userId, deckId, totalCards)`**
- Returns `{ new, learning, due, mastered }` counts
- mastered = interval >= 21 days

## UI Components

### Dashboard DeckCard changes

Each deck card shows 3 small counters below the card count:
- 🔵 X new — cards never reviewed
- 🟡 X due — cards with due_date <= now
- 🟢 X done — cards reviewed today, not yet due

Two action buttons:
- **Study** (existing) — unchanged free-flip + quiz flow
- **Spaced Review** (new) — enters SpacedReviewMode

### New component: `SpacedReviewMode.tsx`

Flow:
1. Load due cards via `getDueCards()`
2. Show one card at a time (reuse FlashCard component for flip)
3. Before flip: show only card front
4. After flip: show card back + 4 rating buttons at bottom
5. Each button shows predicted next interval (e.g. "<1m", "3d", "7d")
6. On rate: call `reviewCard()`, advance to next card
7. "Again" cards re-queue at end of current session queue
8. When queue empty: show completion summary (cards reviewed, retention %)

### Summary screen

- Total cards reviewed this session
- Breakdown: Again / Hard / Good / Easy counts
- "Back to Dashboard" button

### Not changed

- StudyMode.tsx — untouched
- QuizMode.tsx — untouched
- EditDeckPage.tsx — untouched

## Files to create/modify

### New files
- `supabase/migrations/YYYYMMDD_card_reviews.sql`
- `src/services/spacedRepetitionService.ts`
- `src/components/SpacedReviewMode.tsx`

### Modified files
- `src/types/flashcard.ts` — add CardReview type
- `src/components/DeckList.tsx` — add progress counters + Spaced Review button
- `src/components/AuthenticatedAppView.tsx` — add spacedReviewDeck state + routing
- `src/hooks/useDashboardState.ts` — add startSpacedReview / exitSpacedReview

## Verification

- TypeScript compilation passes (`npx tsc --noEmit`)
- Production build passes (`npm run build`)
- Manual test: create deck → spaced review → rate cards → verify due dates update in Supabase
