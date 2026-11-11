import { describe, expect, it } from 'vitest';
import { nameSchema } from './validation';

describe('nameSchema', () => {
  it.each([
    'Nguyễn Văn Trung',
    'Đỗ Thị Hồng Nhung',
    'Phạm Quỳnh Anh',
    'Trần Ngọc Ỷ',
    "O'Brien",
    'Jean-Luc Picard',
    'José María',
    'Nguyễn'.normalize('NFD'),
  ])('accepts %s', (name) => {
    expect(nameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['A', '   ', 'Robert1', '<script>', 'a'.repeat(51)])('rejects %s', (name) => {
    expect(nameSchema.safeParse(name).success).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(nameSchema.parse('  Nguyễn An  ')).toBe('Nguyễn An');
  });
});
