import { decodeFrame, encodeFrame, heroStyle, travel, type Frame } from '@/hooks/use-shared-element';

const transformOf = (style: ReturnType<typeof travel>) =>
  Object.assign({}, ...style.transform) as {
    translateX: number;
    translateY: number;
    scale: number;
  };

/** A 48pt icon partway down a list. */
const row: Frame = { x: 32, y: 600, width: 48, height: 48 };
/** The 112pt hero it becomes, centred near the top. */
const hero: Frame = { x: 132, y: 180, width: 112, height: 112 };

describe('frames across the route boundary', () => {
  it('round-trips', () => {
    expect(decodeFrame(encodeFrame(row))).toEqual(row);
  });

  it('rounds to whole pixels rather than carrying float noise into a URL', () => {
    expect(encodeFrame({ x: 31.6, y: 599.5, width: 48.2, height: 48.2 })).toBe('32,600,48,48');
  });

  it('refuses anything that is not four positive numbers', () => {
    // Every one of these has to mean "no transition" rather than throw, on a
    // screen the user is already looking at.
    ['', '1,2,3', '1,2,3,4,5', 'a,b,c,d', '1,2,0,4', '1,2,3,-4', '1,2,NaN,4'].forEach((bad) => {
      expect(decodeFrame(bad)).toBeNull();
    });
    expect(decodeFrame(undefined)).toBeNull();
    expect(decodeFrame(null)).toBeNull();
  });
});

describe('travel', () => {
  it('starts drawn exactly over the row it came from', () => {
    const { translateX, translateY, scale } = transformOf(travel(row, hero, 0, 'width'));

    // Centres: the row's icon is at (56, 624), the hero's at (188, 236).
    expect(translateX).toBe(-132);
    expect(translateY).toBe(388);
    // 48 into 112.
    expect(scale).toBeCloseTo(48 / 112);
  });

  it('ends as itself', () => {
    const { translateX, translateY, scale } = transformOf(travel(row, hero, 1, 'width'));

    // `toBeCloseTo` rather than `toBe`: at progress 1 the remaining distance is
    // multiplied by zero, and `-132 * 0` is `-0`, which `Object.is` says is not
    // `0`. It is the same pixel.
    expect(translateX).toBeCloseTo(0);
    expect(translateY).toBeCloseTo(0);
    expect(scale).toBe(1);
  });

  it('is halfway there at halfway', () => {
    const { translateX, translateY, scale } = transformOf(travel(row, hero, 0.5, 'width'));

    expect(translateX).toBe(-66);
    expect(translateY).toBe(194);
    expect(scale).toBeCloseTo((1 + 48 / 112) / 2);
  });

  it('scales text by height, because the two strings are different widths', () => {
    // The row says `-₹150` and the detail screen says `₹150`. A width ratio
    // scales the figure by the width of a minus sign; height is the font size,
    // which is the thing actually changing.
    const rowAmount: Frame = { x: 250, y: 600, width: 62, height: 18 };
    const heroAmount: Frame = { x: 150, y: 300, width: 96, height: 44 };

    const byHeight = transformOf(travel(rowAmount, heroAmount, 0, 'height'));
    const byWidth = transformOf(travel(rowAmount, heroAmount, 0, 'width'));

    expect(byHeight.scale).toBeCloseTo(18 / 44);
    expect(byWidth.scale).toBeCloseTo(62 / 96);
    expect(byHeight.scale).not.toBeCloseTo(byWidth.scale);
  });

  it('leaves an element that has not moved alone', () => {
    const { translateX, translateY, scale } = transformOf(travel(row, row, 0, 'width'));

    expect(translateX).toBe(0);
    expect(translateY).toBe(0);
    expect(scale).toBe(1);
  });

  it('orders the transform so the translate is not scaled by the scale', () => {
    // React Native applies these left to right against the element's own
    // origin. A `scale` ahead of the translates would multiply the distance
    // travelled by the scale factor, which lands the element short every time
    // — and the closer the two frames, the less obviously wrong it looks.
    const style = travel(row, hero, 0.5, 'width');
    const keys = style.transform.map((entry) => Object.keys(entry)[0]);

    expect(keys).toEqual(['translateX', 'translateY', 'scale']);
  });
});

/**
 * The regression these tests did not have.
 *
 * Every assertion above is about `travel` — the arithmetic — and the arithmetic
 * was never wrong. What shipped broken was the branch *around* it: the settled
 * state returned `{}`, and because an animated style does not reset a property
 * it stops naming, the `opacity: 0` from the unarmed state stayed on the native
 * view. The icon and the amount measured, armed and animated exactly as
 * intended, and were invisible on the detail screen on every row tap.
 */
describe('heroStyle', () => {
  const basis = 'width' as const;

  it('names opacity in every state, so none can strand a previous one', () => {
    const states = [
      heroStyle(row, hero, 1, 1, basis),
      heroStyle(row, hero, 0, 0, basis),
      heroStyle(row, hero, 0.5, 1, basis),
      heroStyle(row, hero, 0, 1, basis),
    ];
    states.forEach((style) => {
      expect(style.opacity).toBeDefined();
    });
  });

  it('hides the element only while it does not know where it is going', () => {
    expect(heroStyle(row, hero, 0, 0, basis).opacity).toBe(0);
    expect(heroStyle(row, hero, 0, 1, basis).opacity).toBe(1);
  });

  it('is visible once settled — the state that was stranded at zero', () => {
    expect(heroStyle(row, hero, 1, 0, basis).opacity).toBe(1);
    expect(heroStyle(row, hero, 1, 1, basis).opacity).toBe(1);
  });

  it('carries no transform once settled, and one while travelling', () => {
    expect(heroStyle(row, hero, 1, 1, basis).transform).toBeUndefined();
    expect(heroStyle(row, hero, 0.5, 1, basis).transform).toBeDefined();
  });

  it('still travels the way travel() says it does', () => {
    const style = heroStyle(row, hero, 0.5, 1, basis);
    expect(style.transform).toEqual(travel(row, hero, 0.5, basis).transform);
  });
});
