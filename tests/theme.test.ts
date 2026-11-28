import assert from "node:assert/strict";
import test from "node:test";
import { colors } from "@/theme/colors";
import { controlSize, radius, spacing, typography } from "@/theme/tokens";
import { resolveThemeMode } from "@/theme/mode";

function luminance(hex: string): number {
  const channels = hex.replace("#", "").match(/.{2}/g)!.map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("light and dark theme palettes expose the complete semantic color set", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const token of ["primary", "primaryText", "primarySoft", "onPrimary", "background", "surface", "surfaceElevated", "text", "textMuted", "border", "disabled", "income", "expense", "success", "successSoft", "dangerSoft", "warning", "warningSoft", "overlay"] as const) {
      assert.ok(colors[mode][token].length > 0, mode + " theme is missing " + token);
    }
  }
});

test("primary action labels and supporting text meet WCAG AA contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    const palette = colors[mode];
    assert.ok(contrastRatio(palette.onPrimary, palette.primary) >= 4.5, mode + " onPrimary contrast is too low");
    assert.ok(contrastRatio(palette.text, palette.surface) >= 4.5, mode + " primary text contrast is too low");
    assert.ok(contrastRatio(palette.textMuted, palette.surface) >= 4.5, mode + " muted text contrast is too low");
    assert.ok(contrastRatio(palette.primaryText, palette.primarySoft) >= 4.5, mode + " selected text contrast is too low");
  }
});

test("shared layout tokens retain comfortable Android control dimensions", () => {
  assert.equal(spacing.sm, 8);
  assert.equal(spacing.lg, 16);
  assert.ok(controlSize.minHeight >= 48);
  assert.ok(controlSize.buttonHeight >= 48);
  assert.ok(radius.md >= 12);
  assert.ok(typography.body >= 14);
});

test("saved light and dark preferences override the device appearance", () => {
  assert.equal(resolveThemeMode("light", "dark"), "light");
  assert.equal(resolveThemeMode("dark", "light"), "dark");
});

test("system appearance follows the device and defaults safely to light", () => {
  assert.equal(resolveThemeMode("system", "dark"), "dark");
  assert.equal(resolveThemeMode("system", "light"), "light");
  assert.equal(resolveThemeMode("system", null), "light");
});