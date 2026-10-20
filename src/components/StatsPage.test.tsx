import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Deck, ReviewStats } from '../types/flashcard';
import { StatsPage } from './StatsPage';
import * as statsService from '../services/reviewStatsService';

vi.mock('../services/reviewStatsService', () => ({
  getReviewStats: vi.fn(),
}));

const decks: Deck[] = [
  { id: 'deck-1', title: 'Spanish Basics', description: '', cards: [{ id: 'c-1', front: 'a', back: 'b' }] },
];

function dayKeyAfter(start: string, days: number): string {
  const [year, month, day] = start.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function buildStats(overrides: Partial<ReviewStats> = {}): ReviewStats {
  const today = '2026-08-29';
  return {
    totalReviews: 42,
    passedReviews: 35,
    retention: 83,
    activeDays: 12,
    currentStreak: 4,
    daily: Array.from({ length: 30 }, (_, index) => ({
      dayKey: dayKeyAfter(today, index - 29),
      total: index === 29 ? 3 : 0,
      passed: index === 29 ? 2 : 0,
      again: index === 29 ? 1 : 0,
    })),
    byDeck: [
      { deckId: 'deck-1', title: 'Spanish Basics', total: 30, passed: 27, retention: 90 },
      { deckId: 'deck-2', title: 'Biology', total: 12, passed: 6, retention: 50 },
    ],
    forecast: Array.from({ length: 7 }, (_, index) => ({
      dayKey: dayKeyAfter(today, index),
      due: index === 0 ? 4 : 0,
    })),
    ...overrides,
  };
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the summary figures, chart, forecast and per-deck retention', async () => {
    vi.mocked(statsService.getReviewStats).mockResolvedValue(buildStats());

    render(<StatsPage userId="user-1" decks={decks} onBack={vi.fn()} />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('35 of 42 recalled')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4d')).toBeInTheDocument();

    expect(screen.getByRole('img', { name: /reviews per day, last 30 days/i })).toBeInTheDocument();
    expect(screen.getByText(/next 7 days/i)).toBeInTheDocument();

    expect(screen.getByText('Spanish Basics')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Biology')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows an empty state before any review has been logged', async () => {
    vi.mocked(statsService.getReviewStats).mockResolvedValue(
      buildStats({
        totalReviews: 0,
        passedReviews: 0,
        retention: 0,
        activeDays: 0,
        currentStreak: 0,
        byDeck: [],
        daily: buildStats().daily.map((day) => ({ ...day, total: 0, passed: 0, again: 0 })),
      }),
    );

    render(<StatsPage userId="user-1" decks={decks} onBack={vi.fn()} />);

    expect(await screen.findByText(/no reviews yet/i)).toBeInTheDocument();
    // The chart must not render empty scaffolding over an empty dataset.
    expect(screen.queryByRole('img', { name: /reviews per day/i })).not.toBeInTheDocument();
  });

  it('surfaces a load failure and retries', async () => {
    vi.mocked(statsService.getReviewStats)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(buildStats());

    const user = userEvent.setup();
    render(<StatsPage userId="user-1" decks={decks} onBack={vi.fn()} />);

    expect(await screen.findByText(/unable to load statistics/i)).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(statsService.getReviewStats).toHaveBeenCalledTimes(2);
  });

  it('goes back to the dashboard', async () => {
    vi.mocked(statsService.getReviewStats).mockResolvedValue(buildStats());
    const onBack = vi.fn();

    const user = userEvent.setup();
    render(<StatsPage userId="user-1" decks={decks} onBack={onBack} />);

    await screen.findByText('42');
    await user.click(screen.getByRole('button', { name: /back to dashboard/i }));

    expect(onBack).toHaveBeenCalled();
  });

  it('loads statistics for the signed-in user only', async () => {
    vi.mocked(statsService.getReviewStats).mockResolvedValue(buildStats());

    render(<StatsPage userId="user-1" decks={decks} onBack={vi.fn()} />);

    await screen.findByText('42');
    expect(statsService.getReviewStats).toHaveBeenCalledWith('user-1', decks);
  });
});
