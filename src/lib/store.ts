import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ID = string;

/* ---------- Military Hierarchy ---------- */
export type UnitLevel = "division" | "brigade" | "battalion" | "company";
export type Unit = {
  id: ID;
  code: string;
  name: string;
  level: UnitLevel;
  parentId: ID | null;
};

/* ---------- Departments ---------- */
export type Department = {
  id: ID;
  code: string;
  name: string;
  nameEn: string;
  icon: string;
};

/* ---------- Categories (dynamic, per department) ---------- */
export type Category = {
  id: ID;
  departmentId: ID;
  name: string;
  nameEn: string;
};

/* ---------- Items ---------- */
export type Item = {
  id: ID;
  sku: string;
  name: string;
  nameEn: string;
  unit: string;
  minStock: number;
  bookInitial: number;
  initial: Record<ID, number>;
  departmentId: ID;
  categoryId: ID | null;
};

/* ---------- Users & Roles ---------- */
export type Role = "super_admin" | "dept_head" | "storekeeper";
export type User = {
  id: ID;
  name: string;
  rank: string;
  pin: string;
  role: Role;
  departmentId: ID | null;
  unitId: ID | null;
  active: boolean;
};

/* ---------- Storekeeper Permissions (set by Dept Head) ---------- */
export type Permissions = {
  canIssue: boolean;
  canReturn: boolean;
  canTransfer: boolean;
  canManualAdjust: boolean;
  canViewHistory: boolean;
  canPrintVoucher: boolean;
};
export type UserPermissions = Record<ID, Permissions>;

/* ---------- Movements / Operations ---------- */
export type MoveType = "issue" | "add" | "return" | "deduct" | "reallocate";
export type Attachment = { name: string; type: string; data: string };
export type Movement = {
  id: ID;
  voucherNo: string;
  date: string;
  type: MoveType;
  itemId: ID;
  fromUnitId: ID | null;
  toUnitId: ID | null;
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
  userId: ID;
  departmentId: ID;
  editNotes?: string;
};

/* ---------- Audit Log ---------- */
export type AuditEntry = {
  id: ID;
  userId: ID;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
};

/* ---------- Settings ---------- */
export type Settings = {
  setupDone: boolean;
  orgName: string;
  orgNameEn: string;
  currency: string;
  fiscalYear: number;
  logo: string | null;
  labelDivision: string;
  labelBrigade: string;
  labelBattalion: string;
  labelCompany: string;
  pin: string;
};

/* ---------- Archive ---------- */
export type Archive = { year: number; archivedAt: string; items: Item[]; movements: Movement[] };

/* ---------- Master Data ---------- */
export type Data = {
  settings: Settings;
  units: Unit[];
  departments: Department[];
  categories: Category[];
  items: Item[];
  movements: Movement[];
  users: User[];
  permissions: UserPermissions;
  auditLog: AuditEntry[];
  archives: Archive[];
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const defaultSettings: Settings = {
  setupDone: false,
  orgName: "",
  orgNameEn: "",
  currency: "EGP",
  fiscalYear: new Date().getFullYear(),
  logo: null,
  labelDivision: "",
  labelBrigade: "",
  labelBattalion: "",
  labelCompany: "",
  pin: "",
};

export const defaultPermissions: Permissions = {
  canIssue: true,
  canReturn: true,
  canTransfer: true,
  canManualAdjust: false,
  canViewHistory: true,
  canPrintVoucher: true,
};

export const emptyData = (): Data => ({
  settings: { ...defaultSettings },
  units: [],
  departments: [],
  categories: [],
  items: [],
  movements: [],
  users: [],
  permissions: {},
  auditLog: [],
  archives: [],
});

/* ---------- UI State ---------- */
type UI = { lang: "ar" | "en"; theme: "light" | "dark"; view: "compact" | "detailed" };

type State = {
  data: Data;
  past: Data[];
  future: Data[];
  ui: UI;
  unlocked: boolean;
  currentUserId: ID | null;
  commit: (fn: (d: Data) => Data) => void;
  replace: (d: Data) => void;
  undo: () => void;
  redo: () => void;
  setUI: (p: Partial<UI>) => void;
  setUnlocked: (v: boolean) => void;
  setCurrentUser: (id: ID | null) => void;
  logAction: (action: string, details: string) => void;
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      data: emptyData(),
      past: [],
      future: [],
      ui: { lang: "ar", theme: "light", view: "detailed" },
      unlocked: false,
      currentUserId: null,
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
      setCurrentUser: (id) => set({ currentUserId: id }),
      logAction: (action, details) => {
        const st = get();
        const user = st.data.users.find((u) => u.id === st.currentUserId);
        const entry: AuditEntry = {
          id: uid(),
          userId: st.currentUserId ?? "",
          userName: user?.name ?? "system",
          action,
          details,
          timestamp: new Date().toISOString(),
        };
        set({ data: { ...st.data, auditLog: [entry, ...st.data.auditLog].slice(0, 500) } });
      },
    }),
    {
      name: "military-inventory-v1",
      partialize: (s) => ({ data: s.data, ui: s.ui }),
    },
  ),
);

/* ---------- Helper: current user ---------- */
export function useCurrentUser(): User | null {
  const currentUserId = useApp((s) => s.currentUserId);
  const users = useApp((s) => s.data.users);
  return users.find((u) => u.id === currentUserId) ?? null;
}

export function getUserPermissions(userId: ID): Permissions {
  const perms = useApp.getState().data.permissions[userId];
  if (perms) return perms;
  const user = useApp.getState().data.users.find((u) => u.id === userId);
  if (user?.role === "super_admin" || user?.role === "dept_head") return { ...defaultPermissions, canManualAdjust: true };
  return { ...defaultPermissions };
}

/* ---------- Unit Helpers ---------- */
export function unitName(id: ID | null, units: Unit[]): string {
  if (!id) return "—";
  const u = units.find((x) => x.id === id);
  return u ? u.name : "?";
}

export function unitsByLevel(units: Unit[], level: UnitLevel): Unit[] {
  return units.filter((u) => u.level === level);
}

export function childUnits(units: Unit[], parentId: ID): Unit[] {
  return units.filter((u) => u.parentId === parentId);
}

export function allDescendants(units: Unit[], id: ID): Unit[] {
  const children = childUnits(units, id);
  return children.concat(...children.map((c) => allDescendants(units, c.id)));
}

/* ---------- Department Helpers ---------- */
export function deptName(id: ID | null, departments: Department[], lang: "ar" | "en"): string {
  if (!id) return "—";
  const d = departments.find((x) => x.id === id);
  if (!d) return "?";
  return lang === "ar" ? d.name : d.nameEn;
}

export function categoriesByDept(categories: Category[], deptId: ID): Category[] {
  return categories.filter((c) => c.departmentId === deptId);
}

/* ---------- Voucher Number Generation ---------- */
export function nextVoucherNo(type: MoveType, movements: Movement[]): string {
  const prefix =
    type === "issue" ? "ISS" :
    type === "add" ? "ADD" :
    type === "return" ? "RET" :
    type === "deduct" ? "DED" :
    "REA";
  const year = new Date().getFullYear();
  const count = movements.filter((m) => m.voucherNo.startsWith(`${prefix}-${year}`)).length + 1;
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

export function nextCode(prefix: string, existing: string[]): string {
  let n = existing.length + 1;
  const set = new Set(existing);
  while (set.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/* ---------- Name uniqueness ---------- */
export function unitNameTaken(units: Unit[], name: string, level: UnitLevel, parentId: ID | null, exceptId?: ID): boolean {
  const n = name.trim().toLowerCase();
  return units.some((u) => u.id !== exceptId && u.level === level && u.parentId === parentId && u.name.trim().toLowerCase() === n);
}

/* ---------- Ledger Balance Computations ---------- */
export type Balances = {
  unitInit: Record<ID, number>;
  unitEnd: Record<ID, number>;
  bookInit: number;
  bookEnd: number;
  unitsSum: number;
  diff: number;
  pendingOut: number;
};

export function itemBalances(item: Item, units: Unit[], movements: Movement[]): Balances {
  const unitInit: Record<ID, number> = {};
  const unitEnd: Record<ID, number> = {};
  for (const u of units) {
    unitInit[u.id] = item.initial[u.id] ?? 0;
    unitEnd[u.id] = unitInit[u.id];
  }
  let bookEnd = item.bookInitial;
  let pendingOut = 0;
  for (const m of movements) {
    if (m.itemId !== item.id) continue;
    if (m.type === "add") {
      if (m.toUnitId) unitEnd[m.toUnitId] = (unitEnd[m.toUnitId] ?? 0) + m.qty;
      bookEnd += m.qty;
    } else if (m.type === "issue") {
      if (m.fromUnitId) unitEnd[m.fromUnitId] = (unitEnd[m.fromUnitId] ?? 0) - m.qty;
      bookEnd -= m.qty;
    } else if (m.type === "deduct") {
      if (m.fromUnitId) unitEnd[m.fromUnitId] = (unitEnd[m.fromUnitId] ?? 0) - m.qty;
      bookEnd -= m.qty;
    } else if (m.type === "return") {
      if (m.fromUnitId) unitEnd[m.fromUnitId] = (unitEnd[m.fromUnitId] ?? 0) + m.qty;
      bookEnd += m.qty;
    } else if (m.type === "reallocate") {
      if (m.fromUnitId) unitEnd[m.fromUnitId] = (unitEnd[m.fromUnitId] ?? 0) - m.qty;
      if (m.status === "done" && m.toUnitId) unitEnd[m.toUnitId] = (unitEnd[m.toUnitId] ?? 0) + m.qty;
      else pendingOut += m.qty;
    }
  }
  const unitsSum = Object.values(unitEnd).reduce((a, b) => a + b, 0);
  return { unitInit, unitEnd, bookInit: item.bookInitial, bookEnd, unitsSum, diff: unitsSum - bookEnd, pendingOut };
}

/* ---------- Aggregated Balance for a parent unit (division/brigade) ---------- */
export function aggregatedBalance(item: Item, units: Unit[], movements: Movement[], rootUnitId: ID): {
  totalReceived: number;
  distributedSum: number;
  reserveStock: number;
  diff: number;
} {
  const descendants = allDescendants(units, rootUnitId);
  const descendantIds = new Set(descendants.map((u) => u.id));
  const bal = itemBalances(item, units, movements);
  let distributedSum = 0;
  let reserveStock = 0;
  for (const u of units) {
    if (descendantIds.has(u.id)) distributedSum += bal.unitEnd[u.id] ?? 0;
  }
  // Reserve = stock at the root unit itself
  reserveStock = bal.unitEnd[rootUnitId] ?? 0;
  const totalReceived = distributedSum + reserveStock;
  return { totalReceived, distributedSum, reserveStock, diff: totalReceived - bal.bookEnd };
}

/* ---------- Demo Data ---------- */
export function demoData(base: Settings): Data {
  const div: Unit = { id: uid(), code: "DIV-001", name: "الفرقة الأولى", level: "division", parentId: null };
  const br1: Unit = { id: uid(), code: "BDE-001", name: "اللواء الأول", level: "brigade", parentId: div.id };
  const br2: Unit = { id: uid(), code: "BDE-002", name: "اللواء الثاني", level: "brigade", parentId: div.id };
  const bat1: Unit = { id: uid(), code: "BTN-001", name: "الكتيبة الأولى", level: "battalion", parentId: br1.id };
  const bat2: Unit = { id: uid(), code: "BTN-002", name: "الكتيبة الثانية", level: "battalion", parentId: br1.id };
  const bat3: Unit = { id: uid(), code: "BTN-003", name: "الكتيبة الثالثة", level: "battalion", parentId: br2.id };
  const coy1: Unit = { id: uid(), code: "COY-001", name: "السرية الأولى", level: "company", parentId: bat1.id };
  const coy2: Unit = { id: uid(), code: "COY-002", name: "السرية الثانية", level: "company", parentId: bat1.id };
  const coy3: Unit = { id: uid(), code: "COY-003", name: "السرية الثالثة", level: "company", parentId: bat2.id };

  const units = [div, br1, br2, bat1, bat2, bat3, coy1, coy2, coy3];

  const deptMuh: Department = { id: uid(), code: "DEP-001", name: "المهمات", nameEn: "Equipment", icon: "Package" };
  const deptFuel: Department = { id: uid(), code: "DEP-002", name: "الوقود", nameEn: "Fuel", icon: "Fuel" };
  const deptRat: Department = { id: uid(), code: "DEP-003", name: "التعيينات", nameEn: "Rations", icon: "UtensilsCrossed" };
  const departments = [deptMuh, deptFuel, deptRat];

  const cat1: Category = { id: uid(), departmentId: deptMuh.id, name: "استعداد قتالي", nameEn: "Combat Readiness" };
  const cat2: Category = { id: uid(), departmentId: deptMuh.id, name: "قشلاق", nameEn: "Barracks" };
  const cat3: Category = { id: uid(), departmentId: deptMuh.id, name: "ملبوسات", nameEn: "Clothing" };
  const cat4: Category = { id: uid(), departmentId: deptFuel.id, name: "وقود الديزل", nameEn: "Diesel Fuel" };
  const cat5: Category = { id: uid(), departmentId: deptFuel.id, name: "وقود البنزين", nameEn: "Petrol Fuel" };
  const cat6: Category = { id: uid(), departmentId: deptRat.id, name: "تعيينات جافة", nameEn: "Dry Rations" };
  const categories = [cat1, cat2, cat3, cat4, cat5, cat6];

  const itemNames = [
    { ar: "خوذة واقية", en: "Protective Helmet", dept: deptMuh.id, cat: cat1.id, unit: "قطعة" },
    { ar: "سترة واقية", en: "Bulletproof Vest", dept: deptMuh.id, cat: cat1.id, unit: "قطعة" },
    { ar: "بذلة قتالية", en: "Combat Uniform", dept: deptMuh.id, cat: cat3.id, unit: "طقم" },
    { ar: "حذاء عسكري", en: "Military Boots", dept: deptMuh.id, cat: cat3.id, unit: "زوج" },
    { ar: "خيمة ميدانية", en: "Field Tent", dept: deptMuh.id, cat: cat2.id, unit: "خيمة" },
    { ar: "بطانية صوف", en: "Wool Blanket", dept: deptMuh.id, cat: cat2.id, unit: "قطعة" },
    { ar: "مصباح يدوي", en: "Flashlight", dept: deptMuh.id, cat: cat1.id, unit: "قطعة" },
    { ar: "حقيبة إسعافات", en: "First Aid Kit", dept: deptMuh.id, cat: cat1.id, unit: "حقيبة" },
    { ar: "جهاز لاسلكي", en: "Radio Set", dept: deptMuh.id, cat: cat1.id, unit: "جهاز" },
    { ar: "كشاف ضوئي", en: "Searchlight", dept: deptMuh.id, cat: cat1.id, unit: "جهاز" },
    { ar: "وقود ديزل", en: "Diesel Fuel", dept: deptFuel.id, cat: cat4.id, unit: "لتر" },
    { ar: "وقود بنزين", en: "Petrol Fuel", dept: deptFuel.id, cat: cat5.id, unit: "لتر" },
    { ar: "زيت محرك", en: "Engine Oil", dept: deptFuel.id, cat: cat4.id, unit: "لتر" },
    { ar: "تعيينات جافة", en: "Dry Rations", dept: deptRat.id, cat: cat6.id, unit: "وجبة" },
    { ar: "تعيينات إفطار", en: "Breakfast Rations", dept: deptRat.id, cat: cat6.id, unit: "وجبة" },
  ];

  const items: Item[] = itemNames.map((n, i) => {
    const initial: Record<ID, number> = {};
    let sum = 0;
    // Only battalion and company level units hold physical stock
    [bat1, bat2, bat3, coy1, coy2, coy3].forEach((u, j) => {
      const v = ((i + 3) * (j + 2) * 7) % 80;
      initial[u.id] = v;
      sum += v;
    });
    // Division reserve
    initial[div.id] = (i + 5) * 10;
    sum += initial[div.id];
    const book = i % 3 === 0 ? sum + 5 : i % 4 === 1 ? sum - 4 : sum;
    return {
      id: uid(),
      sku: `IT-${String(i + 1).padStart(4, "0")}`,
      name: n.ar,
      nameEn: n.en,
      unit: n.unit,
      minStock: 20,
      bookInitial: book,
      initial,
      departmentId: n.dept,
      categoryId: n.cat,
    };
  });

  // Users
  const superAdmin: User = {
    id: uid(), name: "العقيد أحمد محمد", rank: "عقيد", pin: "1234",
    role: "super_admin", departmentId: null, unitId: div.id, active: true,
  };
  const deptHead: User = {
    id: uid(), name: "النقيب خالد إبراهيم", rank: "نقيب", pin: "2345",
    role: "dept_head", departmentId: deptMuh.id, unitId: div.id, active: true,
  };
  const storekeeper: User = {
    id: uid(), name: "الرقيب أول محمود سعيد", rank: "رقيب أول", pin: "3456",
    role: "storekeeper", departmentId: deptMuh.id, unitId: bat1.id, active: true,
  };
  const users = [superAdmin, deptHead, storekeeper];
  const permissions: UserPermissions = {
    [storekeeper.id]: { ...defaultPermissions },
  };

  const now = new Date().toISOString();
  const movements: Movement[] = [
    {
      id: uid(), voucherNo: nextVoucherNo("add", []), date: now, type: "add",
      itemId: items[0].id, fromUnitId: null, toUnitId: div.id, fromStoreId: null, toStoreId: null,
      qty: 50, invoice: "INV-1001", recipient: "أحمد علي", phone: "01000000000", executor: "مدير المخزن",
      price: 150, notes: "توريد جديد", attachment: null, status: "done", userId: deptHead.id, departmentId: deptMuh.id,
    },
    {
      id: uid(), voucherNo: nextVoucherNo("issue", []), date: now, type: "issue",
      itemId: items[1].id, fromUnitId: div.id, toUnitId: bat1.id, fromStoreId: null, toStoreId: null,
      qty: 10, invoice: "ISS-2001", recipient: "محمود حسن", phone: "01100000000", executor: "أمين العُهدة",
      price: 0, notes: "صرف للكتيبة الأولى", attachment: null, status: "done", userId: storekeeper.id, departmentId: deptMuh.id,
    },
    {
      id: uid(), voucherNo: nextVoucherNo("reallocate", []), date: now, type: "reallocate",
      itemId: items[3].id, fromUnitId: bat1.id, toUnitId: bat3.id, fromStoreId: null, toStoreId: null,
      qty: 15, invoice: "REA-3001", recipient: "سامي عبد الله", phone: "01200000000", executor: "أمين العُهدة",
      price: 0, notes: "سحب وتوجيه للكتيبة الثالثة", attachment: null, status: "pending", userId: storekeeper.id, departmentId: deptMuh.id,
    },
  ];

  const auditLog: AuditEntry[] = [
    { id: uid(), userId: superAdmin.id, userName: superAdmin.name, action: "setup", details: "System initialized", timestamp: now },
  ];

  return {
    settings: { ...base, setupDone: true },
    units, departments, categories, items, movements, users, permissions, auditLog, archives: [],
  };
}

/* ---------- Department Icon Mapping ---------- */
export const deptIcons = ["Package", "Fuel", "UtensilsCrossed", "Wrench", "Truck", "Pill", "Ammo", "Radio", "Shirt", "HardHat"] as const;
