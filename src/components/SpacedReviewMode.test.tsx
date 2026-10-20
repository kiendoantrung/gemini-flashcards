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
    undoLastReview: vi.fn(),
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
          'deck-1': { new: 2, learning: 1, due: 3, mastered: 5, done: 4 },
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
    expect(screen.getByText(/1\s*learning/i)).toBeInTheDocument();
    expect(screen.getByText(/3\s*due/i)).toBeInTheDocument();
    expect(screen.getByText(/4\s*done/i)).toBeInTheDocument();
    expect(screen.getByText(/5\s*mastered/i)).toBeInTheDocument();

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
    // Again leaves a card in relearning; anything else graduates it. The mock
    // has to mirror the real service here, because the session decides whether
    // to requeue from the returned status.
    vi.mocked(spacedService.reviewCard).mockImplementation(async (_userId, _deckId, cardId, quality) => {
      const staysInLearning = quality === 1;
      return {
        id: `rev-${cardId}`,
        userId: 'user-1',
        deckId: 'deck-1',
        cardId,
        status: staysInLearning ? 'relearning' : 'review',
        easeFactor: 2.5,
        interval: staysInLearning ? 0 : 1,
        repetitions: staysInLearning ? 0 : 1,
        dueDate: '2026-08-29T12:00:00.000Z',
        lastReviewedAt: '2026-08-29T12:00:00.000Z',
        createdAt: '2026-08-29T12:00:00.000Z',
      };
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

  it('shows distinct previews for a brand new card', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
    ]);

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));

    // Again and Hard repeat the learning step; Good graduates to 1 day and Easy
    // skips ahead to 4. Before the learning-step change all four showed "1d".
    expect(screen.getByRole('button', { name: /again/i })).toHaveTextContent('<1m');
    expect(screen.getByRole('button', { name: /hard/i })).toHaveTextContent('<1m');
    expect(screen.getByRole('button', { name: /good/i })).toHaveTextContent('1d');
    expect(screen.getByRole('button', { name: /easy/i })).toHaveTextContent('4d');
  });

  it('requeues a new card rated Hard because it stays in learning', async () => {
    vi.mocked(spacedService.getDueCards).mockResolvedValue([
      { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
    ]);
    vi.mocked(spacedService.reviewCard).mockImplementation(async (_userId, _deckId, cardId, quality) => ({
      id: `rev-${cardId}`,
      userId: 'user-1',
      deckId: 'deck-1',
      cardId,
      status: quality === 2 ? 'learning' : 'review',
      easeFactor: 2.35,
      interval: quality === 2 ? 0 : 1,
      repetitions: quality === 2 ? 0 : 1,
      dueDate: '2026-08-30T04:00:00.000Z',
      lastReviewedAt: '2026-08-29T12:00:00.000Z',
      createdAt: '2026-08-29T12:00:00.000Z',
    }));

    const user = userEvent.setup();
    render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

    await user.click(await screen.findByText('Hola'));
    await user.click(screen.getByRole('button', { name: /hard/i }));

    // Back at the same card, not on the summary.
    expect(await screen.findByText('Hola')).toBeInTheDocument();
    expect(screen.queryByText(/session complete/i)).not.toBeInTheDocument();

    // The second Hard is persisted but ends the card's work for this session.
    await user.click(screen.getByText('Hola'));
    await user.click(screen.getByRole('button', { name: /hard/i }));

    expect(await screen.findByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByText(/hard:\s*2/i)).toBeInTheDocument();
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

  describe('undo', () => {
    it('hides the undo affordance until something has been rated', async () => {
      vi.mocked(spacedService.getDueCards).mockResolvedValue([
        { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
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
        dueDate: '2026-08-30T04:00:00.000Z',
        lastReviewedAt: '2026-08-29T12:00:00.000Z',
        createdAt: '2026-08-29T12:00:00.000Z',
      });

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await screen.findByText('Hola');
      expect(screen.queryByRole('button', { name: /^undo$/i })).not.toBeInTheDocument();

      await user.click(screen.getByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));

      expect(await screen.findByRole('button', { name: /undo last rating/i })).toBeInTheDocument();
    });

    it('reverts the last rating from the summary screen and returns to the card', async () => {
      vi.mocked(spacedService.getDueCards).mockResolvedValue([
        { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      ]);
      vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);
      vi.mocked(spacedService.undoLastReview).mockResolvedValue({ cardId: 'c-1', review: null });

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await user.click(await screen.findByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));
      expect(await screen.findByText(/1 cards? reviewed/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /undo last rating/i }));

      expect(spacedService.undoLastReview).toHaveBeenCalledWith('user-1', 'deck-1');
      // Back on the card, with the counters rolled back.
      expect(await screen.findByText('Hola')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '0');
      expect(screen.queryByText(/session complete/i)).not.toBeInTheDocument();
    });

    it('undoes from the session top bar and steps back one card', async () => {
      vi.mocked(spacedService.getDueCards).mockResolvedValue([
        { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
        { card: { id: 'c-2', front: 'Gracias', back: 'Thank you' }, review: null },
      ]);
      vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);
      vi.mocked(spacedService.undoLastReview).mockResolvedValue({ cardId: 'c-1', review: null });

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await user.click(await screen.findByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));

      expect(await screen.findByText('Gracias')).toBeInTheDocument();
      expect(screen.getByText(/card 2 of 2/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^undo$/i }));

      expect(await screen.findByText('Hola')).toBeInTheDocument();
      expect(screen.getByText(/card 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /review progress/i })).toHaveAttribute('aria-valuenow', '0');
    });

    it('resyncs from the server when the log is already gone', async () => {
      vi.mocked(spacedService.getDueCards)
        .mockResolvedValueOnce([{ card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null }])
        .mockResolvedValueOnce([]);
      vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);
      vi.mocked(spacedService.undoLastReview).mockResolvedValue(null);

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await user.click(await screen.findByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));
      await user.click(await screen.findByRole('button', { name: /undo last rating/i }));

      expect(await screen.findByText(/no cards are due/i)).toBeInTheDocument();
      expect(spacedService.getDueCards).toHaveBeenCalledTimes(2);
    });

    it('resyncs from the server when the card was deleted from the deck', async () => {
      // Undo cannot restore state for a card that no longer exists, so the
      // session should reload rather than pretend the card came back.
      vi.mocked(spacedService.getDueCards)
        .mockResolvedValueOnce([{ card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null }])
        .mockResolvedValueOnce([]);
      vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);
      vi.mocked(spacedService.undoLastReview).mockResolvedValue({
        cardId: 'c-1',
        review: null,
        cardMissing: true,
      });

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await user.click(await screen.findByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));
      await user.click(await screen.findByRole('button', { name: /undo last rating/i }));

      expect(await screen.findByText(/no cards are due/i)).toBeInTheDocument();
      expect(spacedService.getDueCards).toHaveBeenCalledTimes(2);
    });

    it('surfaces an error when the undo call fails', async () => {
      vi.mocked(spacedService.getDueCards).mockResolvedValue([
        { card: { id: 'c-1', front: 'Hola', back: 'Hello' }, review: null },
      ]);
      vi.mocked(spacedService.reviewCard).mockResolvedValue({} as CardReview);
      vi.mocked(spacedService.undoLastReview).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<SpacedReviewMode deck={dummyDeck} userId="user-1" onExit={vi.fn()} />);

      await user.click(await screen.findByText('Hola'));
      await user.click(screen.getByRole('button', { name: /good/i }));
      await user.click(await screen.findByRole('button', { name: /undo last rating/i }));

      expect(await screen.findByText(/failed to undo/i)).toBeInTheDocument();
    });
  });
});
