import { describe, expect, it } from "vitest";

import { customTotal, equalTotal, personTotal } from "./split-store";

describe("equalTotal", () => {
  it("splits the subtotal evenly across all participants", () => {
    expect(equalTotal(1000, ["a", "b", "c", "d"])).toEqual({
      a: 250,
      b: 250,
      c: 250,
      d: 250,
    });
  });

  it("adds service and tax proportionally while preserving the full total", () => {
    const result = equalTotal(1000, ["a", "b"], { serviceCents: 200, taxCents: 100 });

    expect(result.a + result.b).toBe(1300);
    expect(result.a).toBe(650);
    expect(result.b).toBe(650);
  });
});

describe("customTotal", () => {
  it("allocates shares according to weights and keeps the total exact", () => {
    const result = customTotal(1000, { a: 1, b: 3 });

    expect(result).toEqual({ a: 250, b: 750 });
  });
});

describe("personTotal", () => {
  it("sums each participant's item totals and prorates service and VAT", () => {
    const result = personTotal(
      [
        { id: "i1", name: "Burger", priceCents: 500, participantId: "a" },
        { id: "i2", name: "Fries", priceCents: 300, participantId: "a" },
        { id: "i3", name: "Coffee", priceCents: 400, participantId: "b" },
      ],
      ["a", "b"],
      { serviceCents: 200, taxCents: 100 },
    );

    expect(result.a).toBe(1000);
    expect(result.b).toBe(500);
    expect(result.a + result.b).toBe(1500);
  });
});
