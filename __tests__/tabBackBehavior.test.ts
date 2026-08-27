import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Back goes to Home, and the layout has to say so out loud.
 *
 * The tab router's default `backBehavior` is `firstRoute`, which returns to
 * `routes[0]` — whichever screen the layout declares first. In most tab apps
 * that is the home tab and the default is invisible. Here it is **Insights**,
 * because the bar is ordered Insights · Money · Home · Splits · Profile to put
 * Home under the thumb. So the first tab and the home tab are different routes,
 * the default cannot be right, and the device back button from Money, Splits or
 * Profile landed on a tab the user had not asked for.
 *
 * The assertion is on the source rather than on behaviour because the behaviour
 * is React Navigation's — `getRouteHistory` inside its `TabRouter`, which is
 * not exported and which a test here would only be re-implementing. What is
 * ours, and what regressed, is the two props.
 */
const layout = () =>
  readFileSync(join(process.cwd(), 'app', '(tabs)', '_layout.tsx'), 'utf8');

/** The `name` of each `Tabs.Screen`, in the order the layout declares them. */
const declaredTabs = () =>
  Array.from(layout().matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)).map((match) => match[1]);

describe('where the device back button goes', () => {
  it('is a real problem here, because Home is not the first tab', () => {
    // If this ever fails, the bar has been reordered and the default would now
    // be correct on its own — at which point the two props below are
    // redundant rather than load-bearing, and this file should say so.
    const [first] = declaredTabs();

    expect(first).not.toBe('index');
    expect(declaredTabs()).toContain('index');
  });

  it('returns to the initial route rather than the first one', () => {
    expect(layout()).toContain('backBehavior="initialRoute"');
  });

  it('names Home as that initial route', () => {
    // Without this, `initialRoute` is indistinguishable from `firstRoute`: the
    // router resolves the name with `findIndex` and falls back to index 0 —
    // Insights again — when it matches nothing.
    expect(layout()).toContain('initialRouteName="index"');
  });
});
