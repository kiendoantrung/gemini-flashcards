import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@supabase/supabase-js';
import type { Deck, CardReview } from '../types/flashcard';
import { AuthenticatedAppView } from './AuthenticatedAppView';
import { DeckList } from './DeckList';
import { SpacedReviewMode } from './SpacedReviewMode';
import * as spacedService from '../services/spacedRepetitionService';

vi.mock('../services/spacedRepetitionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/spacedRepetitionService')>();
  return {
    ...actual,
    calculateNextReview: vi.fn((current, quality) =>
      actual.calculateNextReview(current, quality, new Date('2026-08-29T12:00:00.000Z'))
    ),
    getDueCards: vi.fn(),
    reviewCard: vi.fn(),
  };
});

describe('AuthenticatedAppView routing for spaced review', () => {
  const dummyDeck: Deck = {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn Spanish',
    cards: [{ id: 'c-1', front: 'Hola', back: 'Hello' }],
  };

  const baseProps = {
    user: { id: 'user-1', email: 'test@example.com' } as unknown as User,
    decks: [dummyDeck],
    selectedDeck: null,
    editingDeck: null,
    onLogout: vi.fn(),
    onRefreshUser: vi.fn(),
    onDeckCreated: vi.fn(),
    onDeckUpdate: vi.fn(),
    onDeckDelete: vi.fn(),
    onSelectDeck: vi.fn(),
    onEditDeck: vi.fn(),
    onStopEditing: vi.fn(),
    onExitStudyMode: vi.fn(),
    onStartSpacedReview: vi.fn(),
    onExitSpacedReview: vi.fn(),
  };

  it('renders SpacedReviewMode when spacedReviewDeck is set', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([]);
    render(<AuthenticatedAppView {...baseProps} spacedReviewDeck={dummyDeck} />);
    expect(await screen.findByRole('heading', { name: /spaced review: spanish basics/i })).toBeInTheDocument();
  });
});

describe('DeckList spaced review actions and progress counters', () => {
  const deck: Deck = {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn Spanish',
    cards: [{ id: 'c-1', front: 'Hola', back: 'Hello' }],
  };

  it('renders progress counters and handles spaced review click independently', async () => {
    const onSelectDeck = vi.fn();
    const onStartSpacedReview = vi.fn();
    const user = userEvent.setup();

    render(
      <DeckList
        decks={[deck]}
        deckProgressById={{
          'deck-1': { new: 2, learning: 0, due: 3, mastered: 0, done: 4 },
        }}
        onStartSpacedReview={onStartSpacedReview}
        onSelectDeck={onSelectDeck}
        onDeleteDeck={vi.fn()}
        onUpdateDeck={vi.fn()}
        onEditDeck={vi.fn()}
        onCreateDeck={vi.fn()}
      />
    );

    expect(screen.getByText(/2\s*new/i)).toBeInTheDocument();
    expect(screen.getByText(/3\s*due/i)).toBeInTheDocument();
    expect(screen.getByText(/4\s*done/i)).toBeInTheDocument();

    const spacedReviewBtn = screen.getByRole('button', { name: /spaced review/i });
    await user.click(spacedReviewBtn);

    expect(onStartSpacedReview).toHaveBeenCalledWith(deck);
    expect(onSelectDeck).not.toHaveBeenCalled();
  });
});

describe('SpacedReviewMode session flow', () => {
  const dummyDeck: Deck = {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn Spanish',
    cards: [
      { id: 'c-1', front: 'Hola', back: 'Hello' },
      { id: 'c-2', front: 'Gracias', back: 'Thank you' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no cards are due', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([]);
    const onExit = vi.fn();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={onExit} />);

    expect(await screen.findByText(/no cards are due/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /back to dashboard/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it('flips card, displays predictions, rates Good, and shows completion summary', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      {
        card: { id: 'c-1', front: 'Hola', back: 'Hello' },
        review: null,
      },
    ]);
    vi.mocked(spacedService.reviewCard).mockResolvedValue({
      id: 'rev-1',
      userId: 'user-1',
      deckId: 'deck-1',
      cardId: 'c-1',
      status: 'review',
      easeFactor: 2.5,
      interval: 1,
      repetitions: 1,
      dueDate: '2026-08-30T12:00:00.000Z',
      lastReviewedAt: '2026-08-29T12:00:00.000Z',
      createdAt: '2026-08-29T12:00:00.000Z',
    });

    const onExit = vi.fn();
    const user = userEvent.setup();

    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={onExit} />);

    expect(await screen.findByText('Hola')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '0');

    // Rating buttons should not be visible before flip
    expect(screen.queryByRole('button', { name: /good/i })).not.toBeInTheDocument();

    // Flip the card
    await user.click(screen.getByText('Hola'));

    // Rating buttons appear with predicted intervals
    expect(await screen.findByRole('button', { name: /again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /good/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument();

    // Click Good
    await user.click(screen.getByRole('button', { name: /good/i }));

    expect(spacedService.reviewCard).toHaveBeenCalledWith('user-1', 'deck-1', 'c-1', 3);

    // Summary screen
    expect(await screen.findByText(/1 cards? reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/good:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/retention:\s*100%/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '100');
  });

  it('reveals the rating bar when the card is flipped with the keyboard', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
    ]);

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    const card = await screen.findByRole('button', { name: /question: hola/i });
    card.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('button', { name: /good/i })).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('reports completed unique cards after a successful review and never reaches 100 before the final rating', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      { card: { id: 'c-2', front: 'Gracias', back: 'Thank you' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /good/i }));

    expect(await screen.findByText('Gracias')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '50');

    await user.click(screen.getByText('Gracias'));
    await user.click(screen.getByRole('button', { name: /good/i }));

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '100');
  });

  it('does not decrease progress when Again requeues a card', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      { card: { id: 'c-2', front: 'Gracias', back: 'Thank you' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard)
      .mockResolvedValueOnce({} as CardReview)
      .mockResolvedValueOnce({
        id: 'rev-2',
        userId: 'user-1',
        deckId: 'deck-1',
        cardId: 'c-2',
        status: 'relearning',
        easeFactor: 2.3,
        interval: 0,
        repetitions: 0,
        dueDate: '2026-08-29T12:00:00.000Z',
        lastReviewedAt: '2026-08-29T12:00:00.000Z',
        createdAt: '2026-08-29T12:00:00.000Z',
      });

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /good/i }));
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '50');

    await user.click(screen.getByText('Gracias'));
    await user.click(screen.getByRole('button', { name: /again/i }));
    expect(await screen.findByText('Gracias')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '50');
  });

  it('requeues a card at most once after repeated Again ratings', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard).mockResolvedValue({
      id: 'rev-1',
      userId: 'user-1',
      deckId: 'deck-1',
      cardId: 'c-1',
      status: 'relearning',
      easeFactor: 2.3,
      interval: 0,
      repetitions: 0,
      dueDate: '2026-08-29T12:00:00.000Z',
      lastReviewedAt: '2026-08-29T12:00:00.000Z',
      createdAt: '2026-08-29T12:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /again/i }));
    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /again/i }));

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByText(/again:\s*2/i)).toBeInTheDocument();
  });

  it('requeues Again cards to the end of the session queue', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      { card: { id: 'c-2', front: 'Gracias', back: 'Thank you' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard).mockResolvedValue({
      id: 'rev-1',
      userId: 'user-1',
      deckId: 'deck-1',
      cardId: 'c-1',
      status: 'relearning',
      easeFactor: 2.3,
      interval: 0,
      repetitions: 0,
      dueDate: '2026-08-29T12:00:00.000Z',
      lastReviewedAt: '2026-08-29T12:00:00.000Z',
      createdAt: '2026-08-29T12:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    // Card 1 (Hola) - Rate Again
    expect(await screen.findByText('Hola')).toBeInTheDocument();
    await user.click(screen.getByText('Hola'));
    await user.click(await screen.findByRole('button', { name: /again/i }));

    // Card 2 (Gracias) - Rate Good
    expect(await screen.findByText('Gracias')).toBeInTheDocument();
    await user.click(screen.getByText('Gracias'));
    await user.click(await screen.findByRole('button', { name: /good/i }));

    // Requeued Card 1 (Hola) reappears!
    expect(await screen.findByText('Hola')).toBeInTheDocument();
    await user.click(screen.getByText('Hola'));
    await user.click(await screen.findByRole('button', { name: /easy/i }));

    // Summary
    // Summary counts cards, not rating events: Hola (Again then Easy) is one card.
    expect(await screen.findByText(/2 cards? reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/again:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/good:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/easy:\s*1/i)).toBeInTheDocument();
    // Both cards ended on a passing grade, so retention is per card, not per event.
    expect(screen.getByText(/retention:\s*100%/i)).toBeInTheDocument();
  });

  it('uses the persisted review state when an Again card is requeued', async () => {
    const updatedReview: CardReview = {
      id: 'rev-1',
      userId: 'user-1',
      deckId: 'deck-1',
      cardId: 'c-1',
      status: 'relearning',
      repetitions: 0,
      interval: 0,
      easeFactor: 2.3,
      dueDate: '2026-08-29T12:00:00.000Z',
      lastReviewedAt: '2026-08-29T12:00:00.000Z',
      createdAt: '2026-08-29T12:00:00.000Z',
    };
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      { card: { id: 'c-2', front: 'Gracias', back: 'Thank you' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard).mockResolvedValue(updatedReview);
    const calculateSpy = vi.spyOn(spacedService, 'calculateNextReview');

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /again/i }));
    await user.click(await screen.findByText('Gracias'));
    await user.click(screen.getByRole('button', { name: /good/i }));
    await user.click(await screen.findByText('Hola'));

    expect(calculateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'relearning',
        repetitions: 0,
        interval: 0,
        easeFactor: 2.3,
      }),
      expect.any(Number)
    );
  });

  it('handles review failure gracefully and allows retry without losing card', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({} as unknown as CardReview);

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    expect(await screen.findByText('Hola')).toBeInTheDocument();
    await user.click(screen.getByText('Hola'));
    await user.click(await screen.findByRole('button', { name: /good/i }));

    // Error message is displayed, card is still visible
    expect(await screen.findByText(/failed to save review/i)).toBeInTheDocument();
    expect(screen.getByText('Hola')).toBeInTheDocument();

    // Retry Good rating
    await user.click(screen.getByRole('button', { name: /good/i }));

    // Reaches summary on successful retry
    expect(await screen.findByText(/1 cards? reviewed/i)).toBeInTheDocument();
  });
});
