import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `import.meta.env` is typed read-only, so assign through vi.stubEnv rather
// than writing to it directly. Only fill in what the environment does not
// already provide, so a local .env still wins.
if (!import.meta.env.VITE_SUPABASE_URL) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'mock-anon-key');
}

afterEach(() => cleanup());

// jsdom does not implement layout APIs; components call this to keep the
// active item visible.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
