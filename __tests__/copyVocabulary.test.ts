import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The words the app uses for destructive and structural actions.
 *
 * This is X10 from the UX backlog, held as a test rather than as a decision
 * somebody has to remember. The screens had drifted into a second vocabulary —
 * *Tweak this* for Edit, *Forget this transaction* for Delete — and the drift
 * was not uniform, which is what made it a defect rather than a style: the same
 * transaction swiped in the list said **Edit** and **Delete**, and opened said
 * **Tweak this** and **Forget this transaction**. One object, one action, two
 * names, and the reader had to work out whether *Forget* meant deleted or
 * merely hidden.
 *
 * The rule is not "no personality". Warmth belongs in empty states, success
 * moments, onboarding and prompts, and none of those are swept here. It belongs
 * nowhere near a button that destroys something, because a playful label on a
 * destructive action is asking the user to guess what it does.
 */

/**
 * Swept out of app source entirely, comments included — a comment quoting a
 * retired label is the next person's copy-paste source.
 */
const RETIRED: { phrase: string; use: string }[] = [
  { phrase: 'Tweak this', use: 'Edit' },
  { phrase: 'Forget this', use: 'Delete' },
  { phrase: 'Forget it', use: 'Delete' },
  { phrase: 'Forgetting', use: 'Deleting' },
  { phrase: 'A Peek at Your Spend', use: 'Transaction' },
  { phrase: 'Your Money Story', use: 'Transactions' },
  { phrase: 'Time to Log Out', use: 'Log out' },
  { phrase: 'Treat yourself category', use: 'nothing — the category names itself' },
  // The footer read "FINNRI PLAYBOOK V3.1.2" on a 1.0.0 build. It is the one
  // string on the screen a user might quote back in a bug report, so it is read
  // from the manifest now rather than typed.
  { phrase: 'PLAYBOOK V', use: 'Constants.expoConfig?.version' },
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules') return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[tj]sx?$/.test(entry.name) ? [path] : [];
  });
}

const appSources = () =>
  ['app', 'components', 'lib', 'constants'].flatMap((directory) =>
    sourceFiles(join(process.cwd(), directory))
  );

describe('the vocabulary for destructive and structural actions', () => {
  it.each(RETIRED)('has retired "$phrase" in favour of $use', ({ phrase }) => {
    const violations = appSources().flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return source
        .split('\n')
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => line.includes(phrase))
        .map(({ number }) => `${file.replace(`${process.cwd()}/`, '')}:${number}`);
    });

    expect(violations).toEqual([]);
  });

  it('says Delete and Edit on the transaction detail screen', () => {
    // The positive half. The sweep above only proves the old words are gone;
    // this proves the screen the report came from says the right ones.
    const detail = readFileSync(join(process.cwd(), 'app', 'entry', '[id].tsx'), 'utf8');

    expect(detail).toContain('>Edit</ThemedText>');
    expect(detail).toContain("{isDeleting ? 'Deleting...' : 'Delete'}");
    expect(detail).toContain('Delete this transaction?');
    // A destructive confirmation has to say that it is final.
    expect(detail).toContain('This can&apos;t be undone.');
  });
});
