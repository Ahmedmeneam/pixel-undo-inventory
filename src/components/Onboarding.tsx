import { useState } from "react";
import { Boxes, Lock } from "lucide-react";
import { useApp, demoData, emptyData } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Field, readFileAsDataURL } from "./kit";

export function SetupWizard() {
  const { lang } = useT();
  const replace = useApp((s) => s.replace);
  const setUI = useApp((s) => s.setUI);
  const setUnlocked = useApp((s) => s.setUnlocked);
  const ar = lang === "ar";
  const [f, setF] = useState({ companyName: "", currency: "EGP", fiscalYear: new Date().getFullYear(), logo: null as string | null, pin: "", demo: true });

  const finish = () => {
    if (!f.companyName.trim()) return;
    const base = { ...emptyData().settings, companyName: f.companyName.trim(), currency: f.currency, fiscalYear: f.fiscalYear, logo: f.logo, pin: f.pin, setupDone: true };
    replace(f.demo ? demoData(base) : { ...emptyData(), settings: base });
    setUnlocked(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="panel w-full max-w-lg p-7 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground"><Boxes className="size-6" /></div>
            <div>
              <h1 className="text-lg font-bold">{ar ? "إعداد النظام لأول مرة" : "First-time setup"}</h1>
              <p className="text-xs text-muted-foreground">{ar ? "إدارة المخازن الهرمية" : "Hierarchical Inventory"}</p>
            </div>
          </div>
          <button className="btn" onClick={() => setUI({ lang: ar ? "en" : "ar" })}>{ar ? "English" : "العربية"}</button>
        </div>
        <div className="grid gap-4">
          <Field label={ar ? "اسم الشركة *" : "Company name *"}><input className="field" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "العملة" : "Currency"}><input className="field" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></Field>
            <Field label={ar ? "السنة المالية" : "Fiscal year"}><input type="number" className="field num" value={f.fiscalYear} onChange={(e) => setF({ ...f, fiscalYear: +e.target.value })} /></Field>
          </div>
          <Field label={ar ? "شعار الشركة (اختياري)" : "Logo (optional)"}>
            <div className="flex items-center gap-3">
              {f.logo && <img src={f.logo} alt="" className="size-10 rounded object-contain" />}
              <input type="file" accept="image/*" className="field" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, logo: await readFileAsDataURL(file) }); }} />
            </div>
          </Field>
          <Field label={ar ? "رقم سري للدخول (اختياري)" : "Access PIN (optional)"}><input type="password" inputMode="numeric" className="field num" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((d) => (
              <button key={String(d)} onClick={() => setF({ ...f, demo: d })} className={`rounded-lg border p-3 text-start text-sm ${f.demo === d ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="font-semibold">{d ? (ar ? "تحميل بيانات تجريبية" : "Load demo data") : (ar ? "بدء نظيف" : "Start clean")}</div>
                <div className="text-xs text-muted-foreground">{d ? (ar ? "فروع ومخازن وأصناف جاهزة" : "Sample branches & items") : (ar ? "قاعدة بيانات فارغة" : "Empty database")}</div>
              </button>
            ))}
          </div>
          <button className="btn btn-primary mt-2 py-2.5" disabled={!f.companyName.trim()} onClick={finish}>{ar ? "بدء الاستخدام" : "Get started"}</button>
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
  const setUnlocked = useApp((st) => st.setUnlocked);
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="panel w-full max-w-xs p-6 shadow-xl">
        <div className="mb-4 text-center">
          {s.logo && <img src={s.logo} alt="" className="mx-auto mb-2 size-14 object-contain" />}
          <h1 className="font-bold">{s.companyName}</h1>
        </div>
        <PinPrompt onOk={() => setUnlocked(true)} />
      </div>
    </div>
  );
}
