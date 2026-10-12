import { describe, expect, it } from "vitest";

import {
  createMockOtp,
  getStoredSession,
  isSessionActive,
  persistSession,
  setPendingPhone,
} from "./auth-store";

describe("auth-store", () => {
  it("creates a valid 6-digit OTP and tracks the pending phone number", () => {
    const phone = "+254712345678";
    setPendingPhone(phone);

    const otp = createMockOtp(phone);
    expect(otp).toMatch(/^\d{6}$/);
    expect(getStoredSession()).toBeNull();
  });

  it("stores a valid session when the auth flow succeeds", () => {
    const session = {
      userId: "user-1",
      fullName: "Amara Njeri",
      phone: "+254712345678",
      country: "Kenya",
      currency: "KES",
      isAuthenticated: true as const,
    };

    persistSession(session);

    expect(isSessionActive()).toBe(true);
    expect(getStoredSession()?.userId).toBe("user-1");
  });
});
