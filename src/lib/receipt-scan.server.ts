import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { ScannedReceipt } from "./receipt-scan";

const ReceiptSchema = z.object({
  is_receipt: z.boolean(),
  merchant: z.string(),
  currency: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number(),
      line_total: z.number(),
    }),
  ),
  service_charge: z.number(),
  tax_added: z.number(),
  total: z.number(),
  notes: z.string(),
});

const SYSTEM_PROMPT = `You read photos of receipts and bills for Payro, a bill-splitting app used mostly in Kenya and East Africa. People split the bill item by item, so every line item matters.

Extract:
- is_receipt: false if the image is not a receipt or bill (then leave the other fields empty or zero).
- merchant: the business name as printed, in normal capitalisation.
- currency: ISO 4217 code. Receipts showing "Ksh", "KES" or no symbol from a Kenyan business are KES.
- items: one entry per purchased line. name is short and readable (expand obvious abbreviations), qty is the quantity, line_total is the amount for that whole line (qty x unit price), as printed.
- service_charge: any service charge or tip added on top of the items, else 0.
- tax_added: tax ONLY if it is added on top of the item prices. Kenyan receipts usually show VAT as already included in prices ("VAT incl." or a VAT breakdown at the bottom) - in that case tax_added is 0.
- total: the final amount payable as printed.
- notes: one short sentence about anything uncertain (unreadable lines, discounts, totals that don't add up), else empty.

Rules:
- Use plain numbers in major units (e.g. 1250.50), no currency symbols or thousands separators.
- If there is a discount, reduce the affected item's line_total (or spread it across items proportionally) so items + service_charge + tax_added equals total, and mention it in notes.
- Never invent items. If a line is unreadable, include your best reading and say so in notes.`;

async function assertSignedIn(accessToken: string) {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) throw new Error("Supabase is not configured on the server");

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
}

const toCents = (value: number) => Math.max(0, Math.round(value * 100));

export async function readReceipt(
  imageBase64: string,
  accessToken: string,
): Promise<ScannedReceipt> {
  await assertSignedIn(accessToken);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Receipt scanning is not set up: ANTHROPIC_API_KEY is missing on the server.");
  }

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { format: betaZodOutputFormat(ReceiptSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: "Extract this receipt." },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      const requestId = error.requestID ? ` Request ID: ${error.requestID}.` : "";
      throw new Error(
        `Anthropic rejected the API key used by this deployment. Verify ANTHROPIC_API_KEY is an active Anthropic Console key in this Vercel environment, then redeploy.${requestId}`,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error("Too many scans right now. Please try again in a minute.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new Error(`Couldn't read that image: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error("The receipt reader is unavailable right now. Please try again.");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new Error("This image couldn't be processed. Try a clearer photo of the receipt.");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Couldn't read the receipt. Try a clearer, well-lit photo.");
  }
  if (!parsed.is_receipt) {
    throw new Error("That doesn't look like a receipt. Try again with the full bill in frame.");
  }

  const items = parsed.items
    .map((item) => ({
      name: item.name.trim() || "Item",
      qty: Math.max(1, Math.round(item.qty) || 1),
      price_cents: toCents(item.line_total),
    }))
    .filter((item) => item.price_cents > 0);

  const service_cents = toCents(parsed.service_charge);
  const tax_cents = toCents(parsed.tax_added);
  const printed_total_cents = toCents(parsed.total);
  const computed = items.reduce((sum, i) => sum + i.price_cents, 0) + service_cents + tax_cents;

  return {
    merchant: parsed.merchant.trim(),
    currency: /^[A-Z]{3}$/.test(parsed.currency) ? parsed.currency : "KES",
    items,
    service_cents,
    tax_cents,
    printed_total_cents,
    mismatch: Math.abs(computed - printed_total_cents) > 1,
    notes: parsed.notes.trim(),
  };
}
