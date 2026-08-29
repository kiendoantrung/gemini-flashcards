import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Deck } from '../types/flashcard';
import { AuthenticatedAppView } from './AuthenticatedAppView';
import { DeckList } from './DeckList';

describe('AuthenticatedAppView routing for spaced review', () => {
  const dummyDeck: Deck = {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn Spanish',
    cards: [
      { id: 'c-1', front: 'Hola', back: 'Hello' },
    ],
  };

  const baseProps = {
    user: { id: 'user-1', email: 'test@example.com' } as any,
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
    onRefreshDeckProgress: vi.fn(),
  };

  it('renders SpacedReviewMode when spacedReviewDeck is set', async () => {
    render(<AuthenticatedAppView {...baseProps} spacedReviewDeck={dummyDeck} />);
    expect(await screen.findByRole('heading', { name: /spaced review: spanish basics/i })).toBeInTheDocument();
  });
});

describe('DeckList spaced review actions and progress counters', () => {
  const deck: Deck = {
    id: 'deck-1',
    title: 'Spanish Basics',
    description: 'Learn Spanish',
    cards: [
      { id: 'c-1', front: 'Hola', back: 'Hello' },
    ],
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
