import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Archive } from "lucide-react";
import { useApp, itemBalances, type Data } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Field, Modal, readFileAsDataURL, downloadBlob } from "@/components/kit";
import { PinPrompt } from "@/components/Onboarding";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — إدارة المخازن الهرمية" },
      { name: "description", content: "Branding, terminology, PIN, backup and fiscal year archiving." },
      { property: "og:title", content: "الإعدادات — إدارة المخازن الهرمية" },
      { property: "og:description", content: "Branding, terminology, PIN, backup and archiving." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang } = useT();
  const ar = lang === "ar";
  const data = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const replace = useApp((s) => s.replace);
  const [f, setF] = useState(data.settings);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const guarded = (fn: () => void) => (data.settings.pin ? setPending(() => fn) : fn());
  const apply = () => guarded(() => { commit((d) => { d.settings = { ...f, setupDone: true }; return d; }); toast.success(ar ? "تم حفظ وتطبيق التغييرات" : "Changes applied"); });

  const archive = () => guarded(() => {
    if (!confirm(ar ? `أرشفة السنة ${data.settings.fiscalYear} وترحيل الأرصدة الختامية كأرصدة افتتاحية؟` : `Archive FY ${data.settings.fiscalYear} and carry balances forward?`)) return;
    commit((d) => {
      const snapshotItems = structuredClone(d.items);
      d.items = d.items.map((i) => {
        const b = itemBalances(i, d.stores, d.movements);
        return { ...i, bookInitial: b.bookEnd, initial: { ...b.storeEnd } };
      });
      // pending transfers carry over unchanged (source already deducted)
      const pendingMoves = d.movements.filter((m) => m.status === "pending");
      d.archives.push({ year: d.settings.fiscalYear, archivedAt: new Date().toISOString(), items: snapshotItems, movements: d.movements.filter((m) => m.status !== "pending") });
      d.movements = pendingMoves.map((m) => ({ ...m, fromStoreId: null, type: "transfer" as const }));
      d.settings.fiscalYear += 1;
      return d;
    });
    setF((p) => ({ ...p, fiscalYear: p.fiscalYear + 1 }));
    toast.success(ar ? "تمت الأرشفة" : "Archived");
  });

  const restore = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as Data;
      if (!d.settings || !Array.isArray(d.items)) throw new Error();
      guarded(() => { replace(d); setF(d.settings); toast.success(ar ? "تمت الاستعادة" : "Restored"); });
    } catch { toast.error(ar ? "ملف غير صالح" : "Invalid file"); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold">{t("settings")}</h1>
      <section className="panel grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{ar ? "الهوية والمصطلحات" : "Branding & terminology"}</h2>
        <Field label={ar ? "اسم الشركة" : "Company name"}><input className="field" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} /></Field>
        <Field label={ar ? "الشعار" : "Logo"}>
          <div className="flex items-center gap-2">
            {f.logo && <img src={f.logo} alt="" className="size-9 object-contain" />}
            <input type="file" accept="image/*" className="field" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, logo: await readFileAsDataURL(x) }); }} />
            {f.logo && <button className="btn btn-danger" onClick={() => setF({ ...f, logo: null })}>{t("del")}</button>}
          </div>
        </Field>
        <Field label={ar ? 'مسمى "الشركة" (مثال: قطاع)' : '"Company" label (e.g. Sector)'}><input className="field" placeholder={ar ? "الشركة" : "Company"} value={f.labelCompany} onChange={(e) => setF({ ...f, labelCompany: e.target.value })} /></Field>
        <Field label={ar ? 'مسمى "الفرع" (مثال: لواء)' : '"Branch" label (e.g. Brigade)'}><input className="field" placeholder={ar ? "الفرع" : "Branch"} value={f.labelBranch} onChange={(e) => setF({ ...f, labelBranch: e.target.value })} /></Field>
        <Field label={ar ? "العملة" : "Currency"}><input className="field" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></Field>
        <Field label={ar ? "السنة المالية" : "Fiscal year"}><input type="number" className="field num" value={f.fiscalYear} onChange={(e) => setF({ ...f, fiscalYear: +e.target.value })} /></Field>
        <Field label={ar ? "الرقم السري (اتركه فارغاً للإلغاء)" : "PIN (empty = disabled)"}><input type="password" className="field num" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Field>
        <div className="flex items-end justify-end sm:col-span-2"><button className="btn btn-primary px-6 py-2.5" onClick={apply}>{t("saveApply")}</button></div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-bold">{ar ? "النسخ الاحتياطي والأرشفة" : "Backup & archiving"}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => downloadBlob(JSON.stringify(data), `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json")}><Download className="size-4" />{t("backup")}</button>
          <label className="btn cursor-pointer"><Upload className="size-4" />{t("restore")}<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
          <button className="btn btn-accent" onClick={archive}><Archive className="size-4" />{t("archiveYear")} ({data.settings.fiscalYear})</button>
        </div>
        {data.archives.length > 0 && (
          <ul className="text-sm text-muted-foreground">
            {data.archives.map((a) => <li key={a.archivedAt}>FY <span className="num">{a.year}</span> · {a.movements.length} {t("movements")} · {new Date(a.archivedAt).toLocaleDateString()}</li>)}
          </ul>
        )}
      </section>

      <Modal open={!!pending} onClose={() => setPending(null)} title={t("pin")}>
        <PinPrompt title={ar ? "أدخل الرقم السري لتأكيد التغيير" : "Enter PIN to confirm"} onCancel={() => setPending(null)} onOk={() => { pending?.(); setPending(null); }} />
      </Modal>
    </div>
  );
}
