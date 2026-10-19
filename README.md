<div align="center">
  <img src="./public/icon.png" alt="Gemini Flashcards icon" width="96" />
  <h1>Gemini Flashcards</h1>
  <p>Create, organize, and study AI-generated flashcards with Spaced Repetition (SM-2-style).</p>

  [![Build](https://img.shields.io/github/actions/workflow/status/kiendoantrung/gemini-flashcards/deploy.yml?branch=main&style=flat-square&label=Build)](https://github.com/kiendoantrung/gemini-flashcards/actions)
  ![Node.js](https://img.shields.io/badge/Node.js-24-3c873a?style=flat-square&logo=node.js)
  [![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=20232a)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

Gemini Flashcards is a React and TypeScript study app backed by Supabase. It
can generate decks from a topic, extract content from documents, turn
question-and-answer files into study-ready cards, and schedule long-term memory
reviews with an SM-2-inspired spaced repetition scheduler.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Spaced Repetition](#spaced-repetition)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Database migrations and RLS](#database-migrations-and-rls)
- [File processing](#file-processing)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Resources](#resources)

## Features

- Generate flashcard decks from a topic with Google Gemini.
- Generate decks from PDF, DOC, DOCX, and TXT documents.
- Import Q&A data from CSV, XLS, XLSX, or JSON files.
- **Spaced Repetition Mode** powered by an SM-2-inspired, four-grade scheduler.
- Dashboard progress badges per deck showing `new`, `due`, and `done` card counts.
- Classic free-flip study mode and AI-generated multiple-choice quizzes.
- Authenticate with email/password or Google.
- Manage personal decks and profile avatars.
- Protect user data with Supabase Row Level Security (RLS).
- Automated test coverage with Vitest and React Testing Library.

## Architecture

```text
React/Vite client
    |-- Supabase Auth, Database (decks, card_reviews), and Storage
    |-- Supabase Edge Function: generate-flashcards
                         |-- Google Gemini API
```

The browser uses the Supabase publishable/anon key. Gemini requests go through
the Edge Function so `GOOGLE_AI_KEY` remains a server-side secret.

## Spaced Repetition

The app uses an **SM-2-inspired, four-grade scheduler**. It borrows SM-2's core
idea — an ease factor that rises and falls with recall quality, and an interval
that grows by that factor — but it is not the textbook SuperMemo 2 formula, and
the differences are deliberate:

| | Textbook SM-2 | This app |
|---|---|---|
| Grades | 0–5 | 1–4 (Again / Hard / Good / Easy) |
| Ease update | `EF' = EF + (0.1 − (5−q)(0.08 + (5−q)0.02))` | Fixed steps: Again −0.2, Hard −0.15, Easy +0.15 |
| Hard / Easy | No effect on the interval beyond ease | Hard stretches by 1.2×, Easy by 1.3× on top of ease |
| Bounds | None | Ease 1.3–3.0, interval ≤ 365 days |
| Jitter | None | ±5% on intervals of 2+ days |

### Recall Ratings & Scheduling

During a Spaced Review session, cards are flipped to reveal the answer, and users rate their recall quality:

| Rating | Quality | Action / Interval |
|---|---|---|
| **Again** | 1 | Forgot completely; ease factor decreases by 0.2 (min 1.3). Card is **re-queued at the end of the current session** (`<1m`). |
| **Hard** | 2 | Recalled with difficulty; ease factor decreases by 0.15. Interval multiplier is 1.2x. |
| **Good** | 3 | Recalled normally; ease factor unchanged. Interval expands by the deck's ease factor. |
| **Easy** | 4 | Recalled effortlessly; ease factor increases by 0.15. Interval expands with a 1.3x bonus. |

### Learning Steps

A card that has never graduated is in the `learning` state; a card that had a real
interval and then failed is `relearning`. Both are re-queued in the same session
(once per card) and show `<1m` on the rating buttons.

The first grade on a new card is where the four buttons differ most:

| First grade | Result |
|---|---|
| **Again** | Stays in `learning`, due immediately |
| **Hard** | Stays in `learning`, due immediately |
| **Good** | Graduates to `review`, 1 day |
| **Easy** | Graduates to `review`, 4 days |

### Interval Ceiling and Fuzz

Ease is capped at **3.0** and the interval at **365 days**, so a card answered Easy
repeatedly cannot drift out to multi-year gaps.

Intervals of 2 days or more are then randomised by up to **5%** (at least one day)
when they are saved, so cards learned on the same day do not come due as one clump
forever. The rating buttons show the un-fuzzed interval; only the stored schedule is
jittered.

### Day Boundary

The study day rolls over at **04:00 local time**, not midnight. Reviewing at 01:00
still counts as the previous day, so the `done` counter keeps climbing and the
daily new-card budget does not refresh mid-session.

Due dates are aligned to that boundary rather than being "the same clock time N
days later": a card rated at 23:00 with a 1-day interval becomes due at 04:00 the
next morning, not at 23:00 the following evening.

### Dashboard Progress Indicators

Each deck displays five status counters:
- 🔵 **`new`**: Cards that have never been reviewed.
- 🟣 **`learning`**: Cards in their first learning steps, or cards that lapsed and are
  being relearned. They come back inside the current session.
- 🟡 **`due`**: Cards whose review date is due today or earlier.
- 🟢 **`done`**: Cards reviewed today whose next scheduled review is in the future.
- 🟦 **`mastered`**: Cards whose current interval has reached
  `MASTERED_INTERVAL_DAYS` (21 days), i.e. scheduled a month or more out.

`mastered` is a subset of the scheduled cards rather than a separate pile — a card
counted as mastered also counts as `done` once reviewed today.

### Statistics

The **Statistics** button on the dashboard opens a page built from `review_logs`,
covering the last 30 study days:

- **Reviews / Retention / Active days / Streak** summary tiles. Retention counts a
  rating as recalled when it was not *Again*, matching the session summary so the two
  screens never disagree.
- **Reviews per day** — a stacked bar chart splitting recalled ratings from *Again*.
  Days are bucketed with the same 04:00 boundary as scheduling.
- **Next 7 days** — cards becoming due, with anything overdue folded onto today
  rather than hidden. Cards whose deck entry was deleted are skipped, since cards live
  in the deck's JSONB column and their `card_reviews` rows outlive them.
- **Retention by deck** — per-deck retention bars, coloured green ≥ 80%, amber ≥ 60%,
  red below. Decks deleted after their reviews were logged are filtered out.

The streak does not break just because today has no reviews yet — it starts counting
from yesterday in that case, so the number does not read `0` every morning. The walk
stops at the oldest day in the window, so a streak longer than 30 days is reported as
a lower bound.

Aggregation runs in JavaScript over a bounded window rather than in SQL. A heavy user
produces a few thousand rows per month, which is a small response; if that changes,
this should move into an RPC.

### Session Summary

Upon completing a session, the app presents a summary report including:
- Total cards reviewed.
- Breakdown count of ratings (Again / Hard / Good / Easy).
- Calculated **Retention Rate** percentage.
- An **Undo** action that reverts the last rating and restores the card to its prior
  state.

## Getting started

### Prerequisites

- [Node.js 24](https://nodejs.org/)
- npm
- A [Supabase](https://supabase.com/) project
- A [Google AI](https://ai.google.dev/) API key
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Configure environment variables

Copy `.env.example` to `.env` in the project root, then fill in the values:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

`VITE_TURNSTILE_SITE_KEY` is needed when Cloudflare Turnstile is enabled for
the authentication screens. Never put `GOOGLE_AI_KEY` in `.env` or in any
`VITE_*` variable.

### Install and run

Clone the repository and install dependencies:

```bash
git clone https://github.com/kiendoantrung/gemini-flashcards.git
cd gemini-flashcards
npm install
```

Then start the development server:

```bash
npm run dev
```

Available scripts:

```bash
npm test          # Run unit and integration test suite with Vitest
npm run test:watch # Run Vitest in interactive watch mode
npm run build     # Production build (Vite)
npm run lint      # ESLint
npm run preview   # Preview the production build
```

## Supabase setup

This repository includes the Supabase CLI as a development dependency, so the
commands below can be run with `npx`:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase secrets set GOOGLE_AI_KEY=your_google_ai_api_key
npx supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app
npx supabase functions deploy generate-flashcards
npx supabase db push
```

`ALLOWED_ORIGINS` is a comma-separated allowlist of browser origins. For local
development, use `http://localhost:5173`; do not use `*`. The function requires
an authenticated Supabase session, validates its input, and calls the
`gemini-3.5-flash-lite` model. Inspect deployed functions in the
[Supabase Dashboard](https://supabase.com/dashboard/project/_/functions).

> [!CAUTION]
> Do not expose `GOOGLE_AI_KEY` in frontend code, `.env`, or a `VITE_*`
> variable. Store it only in Supabase Secrets.

## Database migrations and RLS

The database schema and migrations are tracked in `supabase/migrations/`:
- [`20260809151507_initial_schema.sql`](./supabase/migrations/20260809151507_initial_schema.sql): Initial tables (`decks`, `profiles`, `deck_likes`, avatars storage).
- [`20260829000000_card_reviews.sql`](./supabase/migrations/20260829000000_card_reviews.sql): Table for spaced repetition state (`card_reviews`), indexing on `(user_id, deck_id, due_date)`, unique constraints on `(user_id, deck_id, card_id)`, and Row Level Security (RLS) policies.

Both `decks` and `card_reviews` tables have RLS enabled with separate `SELECT`, `INSERT`, `UPDATE`,
and `DELETE` policies, restricting access to rows owned by `auth.uid() = user_id`.

To apply pending migrations to your linked Supabase project:

```bash
npx supabase db push
```

## File processing

- PDF files are limited to 50 MB in the client and Edge Function before being
  sent to Gemini.
- Gemini document processing supports up to 1,000 pages; provider-side limits
  still apply.
- DOC and DOCX files are parsed in the browser.
- CSV parsing supports quoted fields and commas inside quoted values.
- JSON imports must be an array of objects with non-empty string `question` and
  `answer` fields.

## Deployment

The GitHub Actions workflow runs on pushes to `main`:

1. Install dependencies and build the Vite application.
2. Deploy the application to Vercel using the `VERCEL_TOKEN` repository secret.
3. Deploy Supabase Edge Functions separately with `npx supabase functions deploy`.

> [!NOTE]
> The Vercel workflow only runs after `VERCEL_TOKEN` is configured in the
> repository secrets. Supabase function deployment is not part of that workflow.

## Project structure

```text
src/
  components/       React components, study modes, and SpacedReviewMode
  hooks/            Application state hooks (useDashboardState)
  services/         SM-2-inspired scheduler, Supabase queries, file, and AI services
  types/            TypeScript domain types (Flashcard, CardReview, DeckProgress)
  lib/              Shared clients and utilities
  test/             Vitest test setup and DOM matchers
supabase/
  functions/
    generate-flashcards/  Gemini Edge Function
  migrations/             Database schema and RLS migrations
public/                   Static assets and app icon
```

## Resources

- [Google Gemini document processing](https://ai.google.dev/gemini-api/docs/document-processing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel deployment](https://vercel.com/docs/deployments)
