import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Deck } from '../types/flashcard';
import { EditDeckPage } from './EditDeckPage';

const deck: Deck = {
  id: 'deck-1',
  title: 'Spanish',
  description: 'Basics',
  cards: [{ id: 'c-1', front: 'Hola', back: 'Hello' }],
};

describe('EditDeckPage', () => {
  it('reports a failed save instead of showing "Saved"', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('network'));
    render(<EditDeckPage deck={deck} onSave={onSave} onCancel={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: /save/i })[0]);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
  });

  it('leaves immediately when nothing changed', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<EditDeckPage deck={deck} onSave={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /back to decks/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding unsaved edits', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<EditDeckPage deck={deck} onSave={vi.fn()} onCancel={onCancel} />);

    await user.type(screen.getByPlaceholderText(/answer or definition/i), '!');
    await user.click(screen.getByRole('button', { name: /back to decks/i }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/not been saved/i);
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
