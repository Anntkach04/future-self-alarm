import type { BubbleOption } from '../data/onboardingOptions';
import { mutedColorForLabel, mutedPalette } from '../theme';

export function colorsForLabels(
  items: string[],
  options: readonly BubbleOption[]
) {
  return items.map((item) => {
    const match = options.find((option) => option.label === item);
    return match?.color ?? mutedColorForLabel(item);
  });
}

/** Dashboard / edit recap — no two pills share the same colour. */
export function colorsForRecapSections(
  sections: { items: string[]; options: readonly BubbleOption[] }[]
): string[][] {
  const used = new Set<string>();

  const pickDistinct = (preferred: string): string => {
    if (!used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    for (const color of mutedPalette) {
      if (!used.has(color)) {
        used.add(color);
        return color;
      }
    }
    used.add(preferred);
    return preferred;
  };

  return sections.map(({ items, options }) =>
    items.map((item) => {
      const match = options.find((option) => option.label === item);
      const preferred = match?.color ?? mutedColorForLabel(item);
      return pickDistinct(preferred);
    })
  );
}
