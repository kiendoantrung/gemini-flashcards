<div align="center">
  <img src="./public/icon.png" alt="Gemini Flashcards icon" width="96" />
  <h1>Gemini Flashcards</h1>
  <p>Create, organize, and study AI-generated flashcards.</p>

  [![Build](https://img.shields.io/github/actions/workflow/status/kiendoantrung/gemini-flashcards/deploy.yml?branch=main&style=flat-square&label=Build)](https://github.com/kiendoantrung/gemini-flashcards/actions)
  ![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-3c873a?style=flat-square&logo=node.js)
  [![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=20232a)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

Gemini Flashcards is a React and TypeScript study app backed by Supabase. It
can generate decks from a topic, extract content from documents, and turn
question-and-answer files into study-ready cards.

## Contents

- [Features](#features)
- [Architecture](#architecture)
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
- Study with classic flashcards or AI-generated multiple-choice quizzes.
- Authenticate with email/password or Google.
- Manage personal decks and profile avatars.
- Protect user data with Supabase Row Level Security (RLS).

## Architecture

```text
React/Vite client
    |-- Supabase Auth, Database, and Storage
    |-- Supabase Edge Function: generate-flashcards
                         |-- Google Gemini API
```

The browser uses the Supabase publishable/anon key. Gemini requests go through
the Edge Function so `GOOGLE_AI_KEY` remains a server-side secret.

## Getting started

### Prerequisites

- [Node.js 20 or newer](https://nodejs.org/)
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
npm run build     # Production build
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
npx supabase functions deploy generate-flashcards
```

The function requires an authenticated Supabase session, validates its input,
and calls the `gemini-3.5-flash-lite` model. Inspect deployed functions in the
[Supabase Dashboard](https://supabase.com/dashboard/project/_/functions).

> [!CAUTION]
> Do not expose `GOOGLE_AI_KEY` in frontend code, `.env`, or a `VITE_*`
> variable. Store it only in Supabase Secrets.

## Database migrations and RLS

The current remote schema is tracked in
[`supabase/migrations/20260809151507_initial_schema.sql`](./supabase/migrations/20260809151507_initial_schema.sql).
It was pulled from the existing Supabase project.

The `decks` table has RLS enabled with separate `SELECT`, `INSERT`, `UPDATE`,
and `DELETE` policies. Each policy restricts access to rows owned by the
authenticated user with `auth.uid() = user_id`.

For a future schema or policy change, create and review a migration before
applying it to the linked project:

```bash
npx supabase migration new describe_the_change
# Add and review SQL in the generated file.
npx supabase db push
npx supabase migration list
```

Use `db pull` when importing or synchronizing an existing remote schema. Do
not use `db reset --linked`; it is destructive for the remote database. The
local `supabase/.temp/` directory is ignored because it contains project-link
metadata.

The initial schema also contains Storage policies for avatars. Public avatar
reading is intentional; write and delete operations should remain restricted
to authenticated users and their own objects.

The `deck_likes` table is reserved for a future like/share feature. It is not
used by the current application and currently has RLS enabled without
user-facing policies.

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
  components/       React components and screens
  hooks/            Application state hooks
  services/         Supabase, file, and AI services
  types/            TypeScript domain types
  lib/              Shared clients and utilities
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
