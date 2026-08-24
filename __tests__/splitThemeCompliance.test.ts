import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getMoodColors, ThemeMoods } from '@/constants/theme';

function featureSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return featureSourceFiles(path);
    return /\.[tj]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe('split theme compliance', () => {
  it('provides semantic money tones for every mood and mode', () => {
    for (const mood of Object.keys(ThemeMoods) as (keyof typeof ThemeMoods)[]) {
      const colors = getMoodColors(mood);
      for (const mode of ['light', 'dark'] as const) {
        expect(colors[mode]).toEqual(
          expect.objectContaining({
            positive: expect.stringMatching(/^#[0-9A-F]{6}$/i),
            negative: expect.stringMatching(/^#[0-9A-F]{6}$/i),
            neutral: expect.stringMatching(/^#[0-9A-F]{6}$/i),
          })
        );
      }
    }
  });

  it('keeps literal colors out of the split feature', () => {
    const files = [
      ...featureSourceFiles(join(process.cwd(), 'components', 'split')),
      join(process.cwd(), 'app', '(tabs)', 'split.tsx'),
    ];
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const matches = source.match(/#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\)/g) ?? [];
      return matches.map((color) => `${file.replace(`${process.cwd()}/`, '')}: ${color}`);
    });

    expect(violations).toEqual([]);
  });
});
