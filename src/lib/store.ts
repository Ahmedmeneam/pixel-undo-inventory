import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ID = string;
export type Branch = { id: ID; code: string; name: string };
export type Store = { id: ID; code: string; name: string; branchId: ID | null };
export type Item = {
  id: ID;
  sku: string;
  name: string;
  unit: string;
  minStock: number;
  bookInitial: number; // company ledger opening balance
  initial: Record<ID, number>; // opening balance per physical store
};
export type MoveType = "in" | "out" | "transfer";
export type Attachment = { name: string; type: string; data: string };
export type Movement = {
  id: ID;
  date: string;
  type: MoveType;
  itemId: ID;
  fromStoreId: ID | null;
  toStoreId: ID | null;
  qty: number;
  invoice: string;
  recipient: string;
  phone: string;
  executor: string;
  price: number;
  notes: string;
  attachment: Attachment | null;
  status: "done" | "pending";
  confirmedAt?: string;
};
export type Settings = {
  setupDone: boolean;
  companyName: string;
  currency: string;
  fiscalYear: number;
  logo: string | null;
  labelCompany: string;
  labelBranch: string;
  pin: string;
};
export type Archive = { year: number; archivedAt: string; items: Item[]; movements: Movement[] };
export type Data = {
  settings: Settings;
  branches: Branch[];
  stores: Store[];
  items: Item[];
  movements: Movement[];
  archives: Archive[];
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const defaultSettings: Settings = {
  setupDone: false,
  companyName: "",
  currency: "EGP",
  fiscalYear: new Date().getFullYear(),
  logo: null,
  labelCompany: "",
  labelBranch: "",
  pin: "",
};

export const emptyData = (): Data => ({
  settings: { ...defaultSettings },
  branches: [],
  stores: [],
  items: [],
  movements: [],
  archives: [],
});

type UI = { lang: "ar" | "en"; theme: "light" | "dark"; view: "compact" | "detailed" };

type State = {
  data: Data;
  past: Data[];
  future: Data[];
  ui: UI;
  unlocked: boolean;
  commit: (fn: (d: Data) => Data) => void;
  replace: (d: Data) => void;
  undo: () => void;
  redo: () => void;
  setUI: (p: Partial<UI>) => void;
  setUnlocked: (v: boolean) => void;
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      data: emptyData(),
      past: [],
      future: [],
      ui: { lang: "ar", theme: "light", view: "detailed" },
      unlocked: false,
      commit: (fn) => {
        const cur = get().data;
        const next = fn(structuredClone(cur));
        set({ data: next, past: [...get().past.slice(-29), cur], future: [] });
      },
      replace: (d) => set({ data: d, past: [], future: [] }),
      undo: () => {
        const { past, data, future } = get();
        if (!past.length) return;
        set({ data: past[past.length - 1], past: past.slice(0, -1), future: [data, ...future] });
      },
      redo: () => {
        const { past, data, future } = get();
        if (!future.length) return;
        set({ data: future[0], future: future.slice(1), past: [...past, data] });
      },
      setUI: (p) => set({ ui: { ...get().ui, ...p } }),
      setUnlocked: (v) => set({ unlocked: v }),
    }),
    { name: "hier-inventory-v1", partialize: (s) => ({ data: s.data, ui: s.ui }) },
  ),
);

/* ---------- Computations ---------- */
export type Balances = {
  storeInit: Record<ID, number>;
  storeEnd: Record<ID, number>;
  bookInit: number;
  bookEnd: number;
  storesSum: number;
  diff: number;
  pendingOut: number;
};

export function itemBalances(item: Item, stores: Store[], movements: Movement[]): Balances {
  const storeInit: Record<ID, number> = {};
  const storeEnd: Record<ID, number> = {};
  for (const s of stores) {
    storeInit[s.id] = item.initial[s.id] ?? 0;
    storeEnd[s.id] = storeInit[s.id];
  }
  let bookEnd = item.bookInitial;
  let pendingOut = 0;
  for (const m of movements) {
    if (m.itemId !== item.id) continue;
    if (m.type === "in") {
      if (m.toStoreId) storeEnd[m.toStoreId] = (storeEnd[m.toStoreId] ?? 0) + m.qty;
      bookEnd += m.qty;
    } else if (m.type === "out") {
      if (m.fromStoreId) storeEnd[m.fromStoreId] = (storeEnd[m.fromStoreId] ?? 0) - m.qty;
      bookEnd -= m.qty;
    } else {
      if (m.fromStoreId) storeEnd[m.fromStoreId] = (storeEnd[m.fromStoreId] ?? 0) - m.qty;
      if (m.status === "done" && m.toStoreId) storeEnd[m.toStoreId] = (storeEnd[m.toStoreId] ?? 0) + m.qty;
      else pendingOut += m.qty;
    }
  }
  const storesSum = Object.values(storeEnd).reduce((a, b) => a + b, 0);
  return { storeInit, storeEnd, bookInit: item.bookInitial, bookEnd, storesSum, diff: storesSum - bookEnd, pendingOut };
}

export function nextCode(prefix: string, existing: string[]) {
  let n = existing.length + 1;
  const set = new Set(existing);
  while (set.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** Uniqueness rules: branches unique; direct stores unique among direct; branch stores unique within branch. */
export function storeNameTaken(stores: Store[], name: string, branchId: ID | null, exceptId?: ID) {
  const n = name.trim().toLowerCase();
  return stores.some((s) => s.id !== exceptId && s.branchId === branchId && s.name.trim().toLowerCase() === n);
}
export function branchNameTaken(branches: Branch[], name: string, exceptId?: ID) {
  const n = name.trim().toLowerCase();
  return branches.some((b) => b.id !== exceptId && b.name.trim().toLowerCase() === n);
}

export function demoData(base: Settings): Data {
  const b1: Branch = { id: uid(), code: "BR-001", name: "الفرع الشمالي" };
  const b2: Branch = { id: uid(), code: "BR-002", name: "الفرع الجنوبي" };
  const stores: Store[] = [
    { id: uid(), code: "ST-001", name: "المخزن المركزي", branchId: null },
    { id: uid(), code: "ST-002", name: "مخزن أ", branchId: b1.id },
    { id: uid(), code: "ST-003", name: "مخزن ب", branchId: b1.id },
    { id: uid(), code: "ST-004", name: "مخزن أ", branchId: b2.id },
    { id: uid(), code: "ST-005", name: "مخزن الطوارئ", branchId: b2.id },
  ];
  const names = ["خوذة واقية", "قفازات عمل", "مولد كهربائي", "خيمة ميدانية", "بطانية صوف", "مصباح يدوي", "حقيبة إسعافات", "جهاز لاسلكي"];
  const items: Item[] = names.map((name, i) => {
    const initial: Record<ID, number> = {};
    let sum = 0;
    stores.forEach((s, j) => {
      const v = ((i + 3) * (j + 2) * 7) % 60;
      initial[s.id] = v;
      sum += v;
    });
    const book = i % 3 === 0 ? sum + 5 : i % 4 === 1 ? sum - 4 : sum;
    return { id: uid(), sku: `IT-${String(i + 1).padStart(3, "0")}`, name, unit: "قطعة", minStock: 40, bookInitial: book, initial };
  });
  const now = new Date();
  const movements: Movement[] = [
    { id: uid(), date: now.toISOString(), type: "in", itemId: items[0].id, fromStoreId: null, toStoreId: stores[0].id, qty: 20, invoice: "INV-1001", recipient: "أحمد علي", phone: "01000000000", executor: "مدير المخزن", price: 150, notes: "توريد جديد", attachment: null, status: "done" },
    { id: uid(), date: now.toISOString(), type: "transfer", itemId: items[1].id, fromStoreId: stores[0].id, toStoreId: stores[2].id, qty: 10, invoice: "TR-2001", recipient: "محمود حسن", phone: "01100000000", executor: "مدير المخزن", price: 0, notes: "", attachment: null, status: "pending" },
  ];
  return { settings: { ...base, setupDone: true }, branches: [b1, b2], stores, items, movements, archives: [] };
}
