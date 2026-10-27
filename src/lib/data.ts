import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStoredSession, persistSession } from "./auth-store";
import { getSupabase } from "./supabase";
import { uid } from "./utils";

// ---------------------------------------------------------------------------
// Types (mirror supabase/migrations)
// ---------------------------------------------------------------------------
export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  mpesa_number: string | null;
  avatar_url: string | null;
  country: string;
  currency: string;
};

export type ProfileLite = Pick<Profile, "id" | "full_name" | "phone">;

export type GroupMember = {
  user_id: string;
  role: "admin" | "member";
  profiles: ProfileLite | null;
};

export type Group = {
  id: string;
  name: string;
  emoji: string;
  created_by: string;
  created_at: string;
  group_members: GroupMember[];
};

export type Participant = {
  id: string;
  expense_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  share_weight: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  status: "pending" | "reminded" | "paid";
  profiles: ProfileLite | null;
};

export type ExpenseItem = {
  id: string;
  name: string;
  price_cents: number;
  qty: number;
  item_claims: { participant_id: string }[];
};

export type Expense = {
  id: string;
  group_id: string | null;
  restaurant_id: string | null;
  creator_id: string;
  merchant: string;
  category: string;
  currency: string;
  subtotal_cents: number;
  service_cents: number;
  tax_cents: number;
  total_cents: number;
  split_mode: "items" | "equal" | "custom";
  status: "draft" | "open" | "settled";
  receipt_url: string | null;
  created_at: string;
  creator: ProfileLite | null;
  groups: { id: string; name: string; emoji: string } | null;
  expense_participants: Participant[];
};

export type ExpenseDetail = Expense & { expense_items: ExpenseItem[] };

export type ExpenseSplitInviteItem = {
  id: string;
  name: string;
  qty: number;
  price_cents: number;
  claim_count: number;
  claimed_by_me: boolean;
};

export type ExpenseSplitInvite = {
  merchant: string;
  currency: string;
  total_cents: number;
  expires_at: string;
  participant_name: string | null;
  amount_due_cents: number | null;
  items: ExpenseSplitInviteItem[];
};

export type Payment = {
  id: string;
  expense_id: string;
  participant_id: string | null;
  payer_id: string | null;
  amount_cents: number;
  currency: string;
  provider: "mpesa" | "airtel" | "mtn" | "card" | "cash";
  provider_ref: string | null;
  status: string;
  created_at: string;
  expenses: { merchant: string; creator_id: string } | null;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
};

export type PaymentProvider = Payment["provider"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function db() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}

export function currentUserId(): string {
  const session = getStoredSession();
  if (!session) throw new Error("Not signed in");
  return session.userId;
}

function unwrap<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export function participantName(p: Participant, me: string): string {
  if (p.user_id === me) return "You";
  return personName(p.profiles) ?? p.guest_name ?? "Guest";
}

export function personName(profile: ProfileLite | null | undefined): string | null {
  if (!profile) return null;
  return profile.full_name || (profile.phone ? `+${profile.phone}` : null);
}

export function outstanding(p: Participant): number {
  return Math.max(0, p.amount_due_cents - p.amount_paid_cents);
}

// Positive = owed to me, negative = I owe.
export function summarizeBalances(expenses: Expense[], me: string) {
  let owedToMe = 0;
  let iOwe = 0;
  for (const e of expenses) {
    for (const p of e.expense_participants) {
      const left = outstanding(p);
      if (left === 0) continue;
      if (e.creator_id === me && p.user_id !== me) owedToMe += left;
      if (p.user_id === me && e.creator_id !== me) iOwe += left;
    }
  }
  return { owedToMe, iOwe, net: owedToMe - iOwe };
}

// Net balance with each other person (keyed by user id or "guest:<name>").
export function balancesByPerson(expenses: Expense[], me: string) {
  const map = new Map<string, { key: string; name: string; net: number }>();
  const add = (key: string, name: string, delta: number) => {
    const row = map.get(key) ?? { key, name, net: 0 };
    row.net += delta;
    map.set(key, row);
  };
  for (const e of expenses) {
    for (const p of e.expense_participants) {
      const left = outstanding(p);
      if (left === 0) continue;
      if (e.creator_id === me && p.user_id !== me) {
        add(p.user_id ?? `guest:${p.guest_name}`, participantName(p, me), left);
      } else if (p.user_id === me && e.creator_id !== me) {
        add(e.creator_id, personName(e.creator) ?? "Someone", -left);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function myShare(e: Expense, me: string): Participant | undefined {
  return e.expense_participants.find((p) => p.user_id === me);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const PROFILE_LITE = "id, full_name, phone";
const EXPENSE_SELECT = `*, creator:profiles!expenses_creator_id_fkey(${PROFILE_LITE}), groups(id, name, emoji), expense_participants(*, profiles(${PROFILE_LITE}))`;

export const keys = {
  profile: ["profile"] as const,
  groups: ["groups"] as const,
  group: (id: string) => ["group", id] as const,
  expenses: ["expenses"] as const,
  expense: (id: string) => ["expense", id] as const,
  payments: ["payments"] as const,
  notifications: ["notifications"] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () =>
      unwrap<Profile>(await db().from("profiles").select("*").eq("id", currentUserId()).single()),
  });
}

export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: async () =>
      unwrap<Group[]>(
        await db()
          .from("groups")
          .select(`*, group_members(user_id, role, profiles(${PROFILE_LITE}))`)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: keys.group(id),
    queryFn: async () =>
      unwrap<Group>(
        await db()
          .from("groups")
          .select(`*, group_members(user_id, role, profiles(${PROFILE_LITE}))`)
          .eq("id", id)
          .single(),
      ),
  });
}

// Every expense the user can see (created, participating, or in their groups).
export function useExpenses() {
  return useQuery({
    queryKey: keys.expenses,
    queryFn: async () =>
      unwrap<Expense[]>(
        await db()
          .from("expenses")
          .select(EXPENSE_SELECT)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: keys.expense(id),
    queryFn: async () =>
      unwrap<ExpenseDetail>(
        await db()
          .from("expenses")
          .select(`${EXPENSE_SELECT}, expense_items(*, item_claims(participant_id))`)
          .eq("id", id)
          .single(),
      ),
  });
}

export async function fetchExpenseSplitInvite(
  token: string,
  guestAccessToken: string | null,
): Promise<ExpenseSplitInvite | null> {
  return unwrap<ExpenseSplitInvite | null>(
    await db().rpc("get_expense_split_invite", {
      _token: token,
      _guest_access_token: guestAccessToken,
    }),
  );
}

export async function createExpenseSplitInvite(expenseId: string): Promise<string> {
  return unwrap<string>(await db().rpc("create_expense_split_invite", { _expense_id: expenseId }));
}

export async function joinExpenseSplitInvite(
  token: string,
  guestName: string,
  guestAccessToken: string,
): Promise<string> {
  return unwrap<string>(
    await db().rpc("join_expense_split_invite", {
      _token: token,
      _guest_name: guestName,
      _guest_access_token: guestAccessToken,
    }),
  );
}

export async function claimExpenseSplitInviteItem(
  token: string,
  guestAccessToken: string,
  itemId: string,
  claim: boolean,
): Promise<number> {
  return unwrap<number>(
    await db().rpc("claim_expense_split_item", {
      _token: token,
      _guest_access_token: guestAccessToken,
      _item_id: itemId,
      _claim: claim,
    }),
  );
}

export async function claimExpenseItem(itemId: string, claim: boolean): Promise<number> {
  return unwrap<number>(await db().rpc("claim_expense_item", { _item_id: itemId, _claim: claim }));
}

export function usePayments() {
  return useQuery({
    queryKey: keys.payments,
    queryFn: async () =>
      unwrap<Payment[]>(
        await db()
          .from("payments")
          .select("*, expenses(merchant, creator_id)")
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: async () =>
      unwrap<Notification[]>(
        await db()
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
}

// Signed URL for a private receipt image.
export function useReceiptUrl(path: string | null) {
  return useQuery({
    queryKey: ["receipt", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db().storage.from("receipts").createSignedUrl(path!, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useUpdateProfile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { full_name?: string; mpesa_number?: string | null }) => {
      const changes = {
        ...(input.full_name !== undefined && { full_name: input.full_name.trim() }),
        ...(input.mpesa_number !== undefined && { mpesa_number: input.mpesa_number }),
      };
      const profile = unwrap<Profile>(
        await db().from("profiles").update(changes).eq("id", currentUserId()).select("*").single(),
      );
      const session = getStoredSession();
      if (session) persistSession({ ...session, fullName: profile.full_name });
      return profile;
    },
    onSuccess: invalidate,
  });
}

export function useCreateGroup() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { name: string; emoji: string }) =>
      unwrap<Group>(
        await db()
          .from("groups")
          .insert({ name: input.name.trim(), emoji: input.emoji, created_by: currentUserId() })
          .select("*")
          .single(),
      ),
    onSuccess: invalidate,
  });
}

export function useAddMember() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { groupId: string; phone: string }) =>
      unwrap<string>(
        await db().rpc("add_group_member_by_phone", {
          _group_id: input.groupId,
          _phone: input.phone,
        }),
      ),
    onSuccess: invalidate,
  });
}

export type NewExpenseInput = {
  expense: {
    group_id: string | null;
    merchant: string;
    category: string;
    currency: string;
    subtotal_cents: number;
    service_cents: number;
    tax_cents: number;
    total_cents: number;
    split_mode: "items" | "equal" | "custom";
    receipt_url: string | null;
  };
  items: { name: string; price_cents: number; qty: number }[];
  participants: {
    user_id: string | null;
    guest_name: string | null;
    guest_phone?: string | null;
    share_weight: number;
    amount_due_cents: number;
    item_indexes: number[];
  }[];
};

export function useCreateExpense() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: NewExpenseInput) =>
      unwrap<string>(
        await db().rpc("create_expense", {
          _expense: input.expense,
          _items: input.items,
          _participants: input.participants,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRecordPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: {
      participantId: string;
      provider: PaymentProvider;
      amountCents?: number;
      reference?: string;
    }) =>
      unwrap<string>(
        await db().rpc("record_payment", {
          _participant_id: input.participantId,
          _provider: input.provider,
          _amount_cents: input.amountCents ?? null,
          _provider_ref: input.reference ?? null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useInitiatePayHeroPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { participantId: string; phoneNumber: string }) => {
      const { data, error } = await db().functions.invoke("payhero-initiate", {
        body: { participantId: input.participantId, phoneNumber: input.phoneNumber },
      });
      if (error) {
        let detail = error.message;
        if (error.context instanceof Response) {
          const payload = await error.context
            .clone()
            .json()
            .catch(() => null);
          if (payload?.error) detail = String(payload.error);
        }
        throw new Error(detail || "Could not start the M-Pesa payment.");
      }
      if (!data?.paymentId) throw new Error("PayHero did not return a payment request.");
      return data.paymentId as string;
    },
    onSuccess: invalidate,
  });
}

export function usePayHeroPaymentStatus(paymentId: string | null) {
  return useQuery({
    queryKey: ["payhero-payment-status", paymentId],
    enabled: Boolean(paymentId),
    refetchInterval: (query) => (query.state.data === "pending" ? 2500 : false),
    queryFn: async () => {
      const { data, error } = await db()
        .from("payments")
        .select("status")
        .eq("id", paymentId!)
        .single();
      if (error) throw new Error(error.message);
      return data.status as "pending" | "success" | "failed" | "cancelled";
    },
  });
}

// Returns the pay-link token for one person's share (reused while it's still valid).
export function useCreatePaymentRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (participantId: string) =>
      unwrap<string>(await db().rpc("create_payment_request", { _participant_id: participantId })),
    onSuccess: invalidate,
  });
}

// Quick request: records "they owe me X for Y" as a one-person expense, then makes its pay link.
export function useRequestMoney() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string | null;
      amountCents: number;
      currency: string;
      reason: string;
    }) => {
      const expenseId = unwrap<string>(
        await db().rpc("create_expense", {
          _expense: {
            group_id: null,
            merchant: input.reason,
            category: "Other",
            currency: input.currency,
            subtotal_cents: input.amountCents,
            service_cents: 0,
            tax_cents: 0,
            total_cents: input.amountCents,
            split_mode: "custom",
            receipt_url: null,
          },
          _items: [],
          _participants: [
            {
              user_id: null,
              guest_name: input.name,
              guest_phone: input.phone,
              share_weight: 1,
              amount_due_cents: input.amountCents,
              item_indexes: [],
            },
          ],
        }),
      );
      const participant = unwrap<{ id: string }>(
        await db().from("expense_participants").select("id").eq("expense_id", expenseId).single(),
      );
      const token = unwrap<string>(
        await db().rpc("create_payment_request", { _participant_id: participant.id }),
      );
      return { expenseId, token };
    },
    onSuccess: invalidate,
  });
}

export type PaymentRequest = {
  requester: string;
  mpesa_number: string | null;
  payer: string;
  amount_cents: number;
  currency: string;
  reason: string;
  expired: boolean;
  reported: boolean;
};

// Public: works without signing in (the person paying may not have an account).
export async function fetchPaymentRequest(token: string): Promise<PaymentRequest | null> {
  return unwrap<PaymentRequest | null>(await db().rpc("get_payment_request", { _token: token }));
}

export async function reportRequestPaid(token: string, mpesaRef: string): Promise<void> {
  unwrap(await db().rpc("report_request_paid", { _token: token, _mpesa_ref: mpesaRef || null }));
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async () => {
      unwrap(
        await db()
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .is("read_at", null)
          .eq("user_id", currentUserId()),
      );
    },
    onSuccess: invalidate,
  });
}

export async function uploadReceipt(image: Blob): Promise<string> {
  const path = `${currentUserId()}/${uid()}.jpg`;
  const { error } = await db()
    .storage.from("receipts")
    .upload(path, image, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function getAccessToken(): Promise<string> {
  const { data } = await db().auth.getSession();
  if (!data.session) throw new Error("Your session expired. Please sign in again.");
  return data.session.access_token;
}
