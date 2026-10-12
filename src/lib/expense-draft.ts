import type { ScannedReceipt } from "./receipt-scan";

// Hand-off from the scan screen to the new-expense screen (in-memory, one use).
export type ExpenseDraft = ScannedReceipt & { receiptPath: string | null };

let draft: ExpenseDraft | null = null;

export function setExpenseDraft(next: ExpenseDraft) {
  draft = next;
}

export function takeExpenseDraft(): ExpenseDraft | null {
  const current = draft;
  draft = null;
  return current;
}
