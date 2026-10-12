import { createServerFn } from "@tanstack/react-start";

export type ScannedReceipt = {
  merchant: string;
  currency: string;
  items: { name: string; qty: number; price_cents: number }[];
  service_cents: number;
  tax_cents: number;
  printed_total_cents: number;
  // True when items + service + tax doesn't match the printed total - user should review.
  mismatch: boolean;
  notes: string;
};

type ScanInput = { imageBase64: string; accessToken: string };

const MAX_BASE64_LENGTH = 7_000_000; // ~5 MB image, Claude's per-image limit

export const scanReceipt = createServerFn({ method: "POST" })
  .inputValidator((input: ScanInput) => {
    if (!input?.imageBase64 || typeof input.imageBase64 !== "string") {
      throw new Error("No image provided");
    }
    if (input.imageBase64.length > MAX_BASE64_LENGTH) {
      throw new Error("Image is too large. Try a closer, smaller photo.");
    }
    if (!input.accessToken) throw new Error("Not signed in");
    return input;
  })
  .handler(async ({ data }): Promise<ScannedReceipt> => {
    // Server-only modules are loaded lazily so they never reach the client bundle.
    const { readReceipt } = await import("./receipt-scan.server");
    return readReceipt(data.imageBase64, data.accessToken);
  });
