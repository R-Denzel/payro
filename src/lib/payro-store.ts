export type UserRole = "admin" | "member";

export type ProfileRecord = {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl?: string | null;
  country?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupMember = {
  userId: string;
  role: UserRole;
};

export type GroupRecord = {
  id: string;
  name: string;
  createdBy: string;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
};

export type ExpenseRecord = {
  id: string;
  groupId?: string;
  creatorId: string;
  merchant: string;
  subtotalCents: number;
  serviceCents: number;
  taxCents: number;
  totalCents: number;
  splitMode: "equal" | "custom" | "items";
  status: "draft" | "open" | "settled";
  createdAt: string;
  updatedAt: string;
};

export type PayroState = {
  profiles: ProfileRecord[];
  groups: GroupRecord[];
  expenses: ExpenseRecord[];
};

export function createInitialState(): PayroState {
  return {
    profiles: [],
    groups: [],
    expenses: [],
  };
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function ensureUserProfile(
  state: PayroState,
  input: {
    id: string;
    fullName: string;
    phone: string;
    avatarUrl?: string | null;
    country?: string;
    currency?: string;
  },
): ProfileRecord {
  const now = new Date().toISOString();
  const normalizedPhone = normalizePhone(input.phone);

  const existing = state.profiles.find((profile) => profile.id === input.id);
  if (existing) {
    const updated: ProfileRecord = {
      ...existing,
      fullName: input.fullName,
      phone: normalizedPhone,
      avatarUrl: input.avatarUrl ?? existing.avatarUrl ?? null,
      country: input.country ?? existing.country,
      currency: input.currency ?? existing.currency,
      updatedAt: now,
    };

    state.profiles = state.profiles.map((profile) => (profile.id === input.id ? updated : profile));
    return updated;
  }

  const profile: ProfileRecord = {
    id: input.id,
    fullName: input.fullName,
    phone: normalizedPhone,
    avatarUrl: input.avatarUrl ?? null,
    country: input.country,
    currency: input.currency,
    createdAt: now,
    updatedAt: now,
  };

  state.profiles = [...state.profiles, profile];
  return profile;
}

export function upsertGroup(
  state: PayroState,
  input: {
    id: string;
    name: string;
    createdBy: string;
    members: GroupMember[];
  },
): PayroState {
  const now = new Date().toISOString();
  const existing = state.groups.find((group) => group.id === input.id);

  if (existing) {
    const updated: GroupRecord = {
      ...existing,
      name: input.name,
      createdBy: input.createdBy,
      members: input.members,
      updatedAt: now,
    };

    return {
      ...state,
      groups: state.groups.map((group) => (group.id === input.id ? updated : group)),
    };
  }

  const group: GroupRecord = {
    id: input.id,
    name: input.name,
    createdBy: input.createdBy,
    members: input.members,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    groups: [...state.groups, group],
  };
}
