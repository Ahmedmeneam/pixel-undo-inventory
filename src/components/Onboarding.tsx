import { useState } from "react";
import { Boxes, Lock, Shield, ChevronRight, UserPlus } from "lucide-react";
import { useApp, demoData, emptyData, uid, type Role, type User, defaultPermissions } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Field, readFileAsDataURL } from "./kit";

export function SetupWizard() {
  const { lang } = useT();
  const replace = useApp((s) => s.replace);
  const setUI = useApp((s) => s.setUI);
  const setUnlocked = useApp((s) => s.setUnlocked);
  const setCurrentUser = useApp((s) => s.setCurrentUser);
  const ar = lang === "ar";
  const [f, setF] = useState({
    orgName: "",
    orgNameEn: "",
    currency: "EGP",
    fiscalYear: new Date().getFullYear(),
    logo: null as string | null,
    adminName: "",
    adminRank: "",
    pin: "1234",
    demo: true,
  });

  const finish = () => {
    if (!f.orgName.trim() || !f.adminName.trim() || !f.pin.trim()) return;
    const base = {
      ...emptyData().settings,
      orgName: f.orgName.trim(),
      orgNameEn: f.orgNameEn.trim() || f.orgName.trim(),
      currency: f.currency,
      fiscalYear: f.fiscalYear,
      logo: f.logo,
      pin: f.pin,
      setupDone: true,
    };
    const data = f.demo ? demoData(base) : { ...emptyData(), settings: base };
    if (!f.demo) {
      const superAdmin: User = {
        id: uid(), name: f.adminName.trim(), rank: f.adminRank.trim() || "عقيد",
        pin: f.pin, role: "super_admin" as Role, departmentId: null, unitId: null, active: true,
      };
      data.users = [superAdmin];
    } else {
      data.settings = base;
    }
    replace(data);
    const firstUser = data.users[0];
    if (firstUser) setCurrentUser(firstUser.id);
    setUnlocked(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="panel w-full max-w-lg p-7 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground"><Shield className="size-6" /></div>
            <div>
              <h1 className="text-lg font-bold">{ar ? "إعداد النظام لأول مرة" : "Initial System Setup"}</h1>
              <p className="text-xs text-muted-foreground">{ar ? "نظام إدارة العُهد العسكرية" : "Military Custody Management"}</p>
            </div>
          </div>
          <button className="btn" onClick={() => setUI({ lang: ar ? "en" : "ar" })}>{ar ? "English" : "العربية"}</button>
        </div>

        <div className="mb-4 rounded-lg bg-primary/10 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Shield className="size-4" /> {ar ? "إنشاء حساب المدير العام (رئيس فرع الشؤون الإدارية)" : "Create Super Admin (Head of Admin Branch)"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ar ? "سيتم إنشاء حساب بمطلق الصلاحيات للاطلاع على جميع الأقسام والمخازن والسجلات" : "Full access to all departments, warehouses, and ledgers"}
          </p>
        </div>

        <div className="grid gap-4">
          <Field label={ar ? "اسم الفرقة / التشكيل *" : "Division / Formation name *"}>
            <input className="field" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} placeholder={ar ? "الفرقة الأولى" : "1st Division"} />
          </Field>
          <Field label={ar ? "الاسم (إنجليزي)" : "Name (English)"}>
            <input className="field" value={f.orgNameEn} onChange={(e) => setF({ ...f, orgNameEn: e.target.value })} placeholder="1st Division" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "العملة" : "Currency"}><input className="field" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></Field>
            <Field label={ar ? "السنة المالية" : "Fiscal year"}><input type="number" className="field num" value={f.fiscalYear} onChange={(e) => setF({ ...f, fiscalYear: +e.target.value })} /></Field>
          </div>
          <Field label={ar ? "شعار (اختياري)" : "Logo (optional)"}>
            <div className="flex items-center gap-3">
              {f.logo && <img src={f.logo} alt="" className="size-10 rounded object-contain" />}
              <input type="file" accept="image/*" className="field" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, logo: await readFileAsDataURL(file) }); }} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "اسم رئيس فرع الشؤون الإدارية *" : "Head of Admin Branch *"}>
              <input className="field" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} placeholder={ar ? "العقيد أحمد محمد" : "Col. Ahmed Mohamed"} />
            </Field>
            <Field label={ar ? "الرتبة العسكرية" : "Military Rank"}>
              <input className="field" value={f.adminRank} onChange={(e) => setF({ ...f, adminRank: e.target.value })} placeholder={ar ? "عقيد" : "Colonel"} />
            </Field>
          </div>
          <Field label={ar ? "الرقم السري للدخول *" : "Access PIN *"}>
            <input type="password" inputMode="numeric" className="field num" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((d) => (
              <button key={String(d)} onClick={() => setF({ ...f, demo: d })} className={`rounded-lg border p-3 text-start text-sm ${f.demo === d ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="font-semibold">{d ? (ar ? "تحميل بيانات تجريبية" : "Load demo data") : (ar ? "بدء نظيف" : "Start clean")}</div>
                <div className="text-xs text-muted-foreground">{d ? (ar ? "فرق، ألوية، كتائب، أقسام، أصناف" : "Divisions, brigades, departments") : (ar ? "قاعدة بيانات فارغة" : "Empty database")}</div>
              </button>
            ))}
          </div>
          <button className="btn btn-primary mt-2 py-2.5" disabled={!f.orgName.trim() || !f.adminName.trim() || !f.pin.trim()} onClick={finish}>
            {ar ? "بدء الاستخدام" : "Get started"} <ChevronRight className="size-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PinPrompt({ onOk, onCancel, title }: { onOk: () => void; onCancel?: () => void; title?: string }) {
  const { t } = useT();
  const pin = useApp((s) => s.data.settings.pin);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v === pin) onOk();
    else { setErr(true); setV(""); }
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><Lock className="size-5" /></div>
      {title && <p className="text-center text-sm font-semibold">{title}</p>}
      <input autoFocus type="password" inputMode="numeric" className="field num text-center text-lg tracking-[0.5em]" value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} />
      {err && <p className="text-center text-xs text-destructive">{t("wrongPin")}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" className="btn flex-1" onClick={onCancel}>{t("cancel")}</button>}
        <button className="btn btn-primary flex-1">{t("unlock")}</button>
      </div>
    </form>
  );
}

export function LockScreen() {
  const s = useApp((st) => st.data.settings);
  const users = useApp((st) => st.data.users);
  const setUnlocked = useApp((st) => st.setUnlocked);
  const setCurrentUser = useApp((st) => st.setCurrentUser);
  const { t, lang } = useT();
  const ar = lang === "ar";
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const activeUsers = users.filter((u) => u.active);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (pin === selectedUser.pin) {
      setCurrentUser(selectedUser.id);
      setUnlocked(true);
    } else {
      setErr(true);
      setPin("");
    }
  };

  const roleLabel = (role: string) =>
    role === "super_admin" ? t("superAdmin") : role === "dept_head" ? t("departmentHead") : t("storekeeper");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="panel w-full max-w-sm p-6 shadow-xl">
        <div className="mb-5 text-center">
          {s.logo && <img src={s.logo} alt="" className="mx-auto mb-2 size-14 object-contain" />}
          <div className="flex items-center justify-center gap-2">
            <Shield className="size-5 text-primary" />
            <h1 className="font-bold">{ar ? s.orgName : s.orgNameEn || s.orgName}</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("appName")}</p>
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <Field label={ar ? "اختر المستخدم" : "Select user"}>
            <div className="grid max-h-52 gap-1.5 overflow-y-auto">
              {activeUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelectedUserId(u.id); setErr(false); setPin(""); }}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-start text-sm transition ${selectedUserId === u.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{u.rank} {u.name}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel(u.role)}</div>
                  </div>
                </button>
              ))}
              {!activeUsers.length && <p className="p-3 text-center text-sm text-muted-foreground">{t("noData")}</p>}
            </div>
          </Field>

          {selectedUser && (
            <>
              <Field label={t("pin")}>
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  className="field num text-center text-lg tracking-[0.5em]"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setErr(false); }}
                />
              </Field>
              {err && <p className="text-center text-xs text-destructive">{t("wrongPin")}</p>}
              <button className="btn btn-primary py-2.5" type="submit">{t("login")}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
