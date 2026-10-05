import { describe, expect, it } from "vitest";

import { createInitialState, ensureUserProfile, upsertGroup } from "./payro-store";

describe("payro-store", () => {
  it("creates an empty, typed backend state for the app", () => {
    const state = createInitialState();

    expect(state.profiles).toEqual([]);
    expect(state.groups).toEqual([]);
    expect(state.expenses).toEqual([]);
  });

  it("stores a normalized profile and keeps the user record consistent", () => {
    const state = createInitialState();
    const profile = ensureUserProfile(state, {
      id: "user-1",
      fullName: "Amara Njeri",
      phone: "+254712345678",
      country: "Kenya",
      currency: "KES",
    });

    expect(profile.fullName).toBe("Amara Njeri");
    expect(profile.id).toBe("user-1");
    expect(profile.phone).toBe("254712345678");
  });

  it("creates a group with members and role metadata", () => {
    const state = createInitialState();
    const next = upsertGroup(state, {
      id: "group-1",
      name: "Nairobi Flat",
      createdBy: "user-1",
      members: [
        { userId: "user-1", role: "admin" },
        { userId: "user-2", role: "member" },
      ],
    });

    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].members).toHaveLength(2);
    expect(next.groups[0].members[0].role).toBe("admin");
  });
});
