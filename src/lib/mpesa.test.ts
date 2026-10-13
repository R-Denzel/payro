import { describe, expect, it } from "vitest";
import { formatLocal, smsLink, toMsisdn, whatsappLink } from "./mpesa";

describe("toMsisdn", () => {
  it("accepts the ways Kenyans write mobile numbers", () => {
    for (const input of ["0712345678", "712 345 678", "+254 712 345 678", "254712345678"]) {
      expect(toMsisdn(input)).toBe("254712345678");
    }
    expect(toMsisdn("0110 123 456")).toBe("254110123456");
  });

  it("rejects numbers that aren't Kenyan mobiles", () => {
    for (const input of ["", "12345", "0212345678", "07123456789", "+1 415 555 0100"]) {
      expect(toMsisdn(input)).toBeNull();
    }
  });
});

describe("formatLocal", () => {
  it("formats the way people type it into M-Pesa", () => {
    expect(formatLocal("254712345678")).toBe("0712 345 678");
  });
});

describe("share links", () => {
  it("addresses WhatsApp and SMS to the payer when known", () => {
    expect(whatsappLink("Pay me", "254712345678")).toBe("https://wa.me/254712345678?text=Pay%20me");
    expect(whatsappLink("Pay me")).toBe("https://wa.me/?text=Pay%20me");
    expect(smsLink("Pay me", "254712345678")).toBe("sms:+254712345678?&body=Pay%20me");
  });
});
