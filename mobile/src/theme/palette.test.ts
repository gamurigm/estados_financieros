import assert from 'node:assert/strict';
import test from 'node:test';
import { palettes } from './palette';

type Rgb = [number, number, number];

function channels(value: string): [number, number, number, number] {
  if (value.startsWith('#')) return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 1];
  const values = value.match(/[\d.]+/g)!.map(Number);
  return [values[0], values[1], values[2], values[3] ?? 1];
}

function composite(value: string, background: Rgb): Rgb {
  const [r, g, b, alpha] = channels(value);
  return [r * alpha + background[0] * (1 - alpha), g * alpha + background[1] * (1 - alpha), b * alpha + background[2] * (1 - alpha)];
}

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: Rgb) {
  const a = luminance(composite(foreground, background));
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const [mode, colors] of Object.entries(palettes)) {
  test(`${mode}: financial text stays readable through frosted panels`, () => {
    const canvas = composite(colors.background, [0, 0, 0]);
    // Check glass over the glow extremes as well as the plain canvas.
    const backgrounds = [canvas, composite(colors.cyanGlow, canvas), composite(colors.violetGlow, canvas), composite(colors.cyanGlow, composite(colors.violetGlow, canvas))];
    if (mode === 'dark') backgrounds.push([255, 255, 255]);
    for (const background of backgrounds) {
      for (const [label, text, surface] of [
        ['body', colors.ink, colors.surface],
        ['secondary', colors.muted, colors.surface],
        ['balance', colors.accent, colors.hero],
        ['input', colors.ink, colors.input],
      ]) {
        const ratio = contrast(text, composite(surface, background));
        assert.ok(ratio >= 4.5, `${mode} ${label}: contrast ${ratio.toFixed(2)} must be at least 4.5:1`);
      }
    }
  });

  test(`${mode}: buttons, selections and errors keep readable labels`, () => {
    const canvas = composite(colors.background, [0, 0, 0]);
    for (const [label, text, background] of [
      ['primary button', colors.onPrimary, colors.primary],
      ['selection', colors.primary, colors.tint],
      ['error', colors.expense, colors.expenseTint],
    ]) {
      const ratio = contrast(text, composite(background, canvas));
      assert.ok(ratio >= 4.5, `${mode} ${label}: contrast ${ratio.toFixed(2)} must be at least 4.5:1`);
    }
  });
}
