// M-Pesa helpers for payment requests. Payro doesn't move money: the payer sends it
// with their own M-Pesa (app or SIM menu) to the requester's number.

const MPESA_APP_PACKAGE = "com.safaricom.mpesa.lifestyle";

/** "0712 345 678", "712345678", "+254712345678" -> "254712345678"; null if not a Kenyan mobile. */
export function toMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("254") ? digits.slice(3) : digits.replace(/^0/, "");
  return /^[17]\d{8}$/.test(local) ? `254${local}` : null;
}

/** "254712345678" -> "0712 345 678" (the form people type into M-Pesa). */
export function formatLocal(msisdn: string): string {
  const local = `0${msisdn.replace(/^254/, "")}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

export function requestUrl(token: string): string {
  return `${window.location.origin}/r/${token}`;
}

/** WhatsApp chat (to a specific number when known) with the message pre-filled. */
export function whatsappLink(text: string, msisdn?: string | null): string {
  return `https://wa.me/${msisdn ?? ""}?text=${encodeURIComponent(text)}`;
}

/** SMS composer; "?&body=" is understood by both Android and iOS. */
export function smsLink(text: string, msisdn?: string | null): string {
  return `sms:${msisdn ? `+${msisdn}` : ""}?&body=${encodeURIComponent(text)}`;
}

export function platform(): "android" | "ios" | "other" {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

/**
 * Android: launch the M-PESA app (Chrome offers the Play Store if it isn't installed).
 * Safaricom publishes no link that pre-fills number and amount, so the pay page copies
 * the number for the payer to paste.
 */
export function mpesaAppIntent(): string {
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${MPESA_APP_PACKAGE};end`;
}

/** Opens the dialer with the M-Pesa SIM menu (works on any Safaricom line). */
export function simMenuLink(): string {
  return "tel:*334%23";
}
