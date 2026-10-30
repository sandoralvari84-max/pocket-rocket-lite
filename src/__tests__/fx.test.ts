// Currency conversion is deterministic math over per-USD rates — never the model. Lock it.
import { fxConvert } from "../data/fx";

describe("currency conversion (fxConvert)", () => {
  const rates: Record<string, number> = { USD: 1, EUR: 0.9, GBP: 0.8, JPY: 150 };

  it("converts through the USD base correctly", () => {
    expect(fxConvert(rates, "USD", "EUR", 100)).toBeCloseTo(90);
    expect(fxConvert(rates, "EUR", "USD", 90)).toBeCloseTo(100);
    expect(fxConvert(rates, "EUR", "GBP", 9)).toBeCloseTo(8);
    expect(fxConvert(rates, "USD", "JPY", 2)).toBeCloseTo(300);
  });

  it("is identity for same currency", () => {
    expect(fxConvert(rates, "EUR", "EUR", 42)).toBeCloseTo(42);
  });

  it("returns NaN for an unknown currency", () => {
    expect(Number.isNaN(fxConvert(rates, "USD", "XXX", 10))).toBe(true);
    expect(Number.isNaN(fxConvert(rates, "ZZZ", "USD", 10))).toBe(true);
  });
});
