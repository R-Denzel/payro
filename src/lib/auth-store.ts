export type AuthSession = {
  userId: string;
  fullName: string;
  phone: string;
  country: string;
  currency: string;
  isAuthenticated: true;
};

const STORAGE_KEY = "payro.auth.session";
const PENDING_PHONE_KEY = "payro.auth.pending_phone";

const memoryStorage = new Map<string, string>();

function getStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  if ("localStorage" in globalThis) {
    try {
      const instance = globalThis.localStorage as Storage;
      instance.getItem("__payro_probe__");
      return instance;
    } catch {
      return {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, value);
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
        },
        clear: () => {
          memoryStorage.clear();
        },
        key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
        length: memoryStorage.size,
      } as Storage;
    }
  }

  return {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
    key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
    length: memoryStorage.size,
  } as Storage;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function createMockOtp(phone: string): string {
  const digits = normalizePhone(phone).slice(-6).padStart(6, "0");
  return digits.slice(-6);
}

export function setPendingPhone(phone: string): void {
  const store = getStorage();
  if (!store) return;
  store.setItem(PENDING_PHONE_KEY, normalizePhone(phone));
}

export function getPendingPhone(): string | null {
  const store = getStorage();
  return store ? store.getItem(PENDING_PHONE_KEY) : null;
}

export function persistSession(session: AuthSession): void {
  const store = getStorage();
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession(): AuthSession | null {
  const store = getStorage();
  const raw = store ? store.getItem(STORAGE_KEY) : null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    // phone may be empty: Google sign-ins have no phone number.
    if (!parsed.userId || parsed.isAuthenticated !== true) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function isSessionActive(): boolean {
  return getStoredSession() !== null;
}

export function signOut(): void {
  const store = getStorage();
  if (!store) return;
  store.removeItem(STORAGE_KEY);
  store.removeItem(PENDING_PHONE_KEY);
}
