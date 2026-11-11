import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Deck } from '../types/flashcard';
import { DeckList } from './DeckList';

const deck: Deck = {
  id: 'deck-1',
  title: 'Spanish Basics',
  description: 'Learn Spanish',
  cards: [
    { id: 'c-1', front: 'Hola', back: 'Hello' },
    { id: 'c-2', front: 'Adiós', back: 'Goodbye' },
  ],
};

function renderList(onDeleteDeck: (deckId: string) => Promise<void>, onSelectDeck = vi.fn()) {
  render(
    <DeckList
      decks={[deck]}
      onSelectDeck={onSelectDeck}
      onDeleteDeck={onDeleteDeck}
      onEditDeck={vi.fn()}
      onCreateDeck={vi.fn()}
    />,
  );
}

describe('DeckList delete confirmation', () => {
  it('does not delete until the user confirms', async () => {
    const user = userEvent.setup();
    const onDeleteDeck = vi.fn().mockResolvedValue(undefined);
    renderList(onDeleteDeck);

    await user.click(screen.getByRole('button', { name: /delete spanish basics/i }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/2 cards/);
    expect(dialog).toHaveTextContent(/review history/i);
    expect(onDeleteDeck).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /delete deck/i }));

    expect(onDeleteDeck).toHaveBeenCalledWith('deck-1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancels with Escape and focuses Cancel first so Enter cannot confirm', async () => {
    const user = userEvent.setup();
    const onDeleteDeck = vi.fn().mockResolvedValue(undefined);
    renderList(onDeleteDeck);

    await user.click(screen.getByRole('button', { name: /delete spanish basics/i }));
    expect(screen.getByRole('button', { name: /^cancel$/i })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onDeleteDeck).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when the delete fails', async () => {
    const user = userEvent.setup();
    const onDeleteDeck = vi.fn().mockRejectedValue(new Error('network'));
    renderList(onDeleteDeck);

    await user.click(screen.getByRole('button', { name: /delete spanish basics/i }));
    await user.click(screen.getByRole('button', { name: /delete deck/i }));

    expect(onDeleteDeck).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('DeckList keyboard access', () => {
  it('opens a deck with Enter on the focused tile', async () => {
    const user = userEvent.setup();
    const onSelectDeck = vi.fn();
    renderList(vi.fn().mockResolvedValue(undefined), onSelectDeck);

    screen.getByRole('button', { name: /study spanish basics/i }).focus();
    await user.keyboard('{Enter}');

    expect(onSelectDeck).toHaveBeenCalledWith(deck);
  });
});
