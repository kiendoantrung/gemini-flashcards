import { describe, expect, it } from 'vitest';
import { buildOptions } from './quizOptions';

const card = (id: string, back: string) => ({ id, front: `Q ${id}`, back });

describe('buildOptions', () => {
  it('uses the AI distractors plus the correct answer', () => {
    const options = buildOptions(card('1', 'Paris'), [card('1', 'Paris')], ['Lyon', 'Nice', 'Lille']);
    expect(options).toHaveLength(4);
    expect(new Set(options)).toEqual(new Set(['Paris', 'Lyon', 'Nice', 'Lille']));
  });

  it('never repeats an answer when cards share the same back', () => {
    const deck = [card('1', 'Yes'), card('2', 'Yes'), card('3', 'yes '), card('4', 'No'), card('5', 'Maybe')];
    const options = buildOptions(deck[0], deck);
    const keys = options.map((option) => option.trim().toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(['yes', 'no', 'maybe']));
  });

  it('fills missing AI distractors from other cards', () => {
    const deck = [card('1', 'A'), card('2', 'B'), card('3', 'C')];
    const options = buildOptions(deck[0], deck, ['Z']);
    expect(new Set(options)).toEqual(new Set(['A', 'Z', 'B', 'C']));
  });

  it('drops an AI distractor equal to the correct answer', () => {
    const options = buildOptions(card('1', 'Paris'), [card('1', 'Paris')], ['paris', 'Lyon', 'Nice', 'Lille']);
    expect(options.filter((option) => option.toLowerCase() === 'paris')).toHaveLength(1);
    expect(options).toHaveLength(4);
  });

  it('always includes the correct answer, even in a one-card deck without AI', () => {
    expect(buildOptions(card('1', 'Only'), [card('1', 'Only')])).toEqual(['Only']);
  });
});
