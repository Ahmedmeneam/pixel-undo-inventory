import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Archive as ArchiveIcon } from "lucide-react";
import { useApp, itemBalances, useCurrentUser, type Data } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Field, Modal, readFileAsDataURL, downloadBlob } from "@/components/kit";
import { PinPrompt } from "@/components/Onboarding";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Branding, terminology, PIN, backup and fiscal year archiving." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, division, brigade, battalion, company } = useT();
  const ar = lang === "ar";
  const data = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const replace = useApp((s) => s.replace);
  const user = useCurrentUser();
  const [f, setF] = useState(data.settings);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const isSuperAdmin = user?.role === "super_admin";

  const guarded = (fn: () => void) => (data.settings.pin ? setPending(() => fn) : fn());
  const apply = () => guarded(() => {
    commit((d) => { d.settings = { ...f, setupDone: true }; return d; });
    toast.success(ar ? "تم حفظ وتطبيق التغييرات" : "Changes applied");
  });

  const archive = () => guarded(() => {
    if (!confirm(ar ? `أرشفة السنة ${data.settings.fiscalYear} وترحيل الأرصدة الختامية كأرصدة افتتاحية؟` : `Archive FY ${data.settings.fiscalYear} and carry balances forward?`)) return;
    commit((d) => {
      const snapshotItems = structuredClone(d.items);
      d.items = d.items.map((i) => {
        const b = itemBalances(i, d.units, d.movements);
        return { ...i, bookInitial: b.bookEnd, initial: { ...b.unitEnd } };
      });
      const pendingMoves = d.movements.filter((m) => m.status === "pending");
      d.archives.push({ year: d.settings.fiscalYear, archivedAt: new Date().toISOString(), items: snapshotItems, movements: d.movements.filter((m) => m.status !== "pending") });
      d.movements = pendingMoves;
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

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const itemsSheet = data.items.map((i) => {
      const dept = data.departments.find((d) => d.id === i.departmentId);
      const cat = data.categories.find((c) => c.id === i.categoryId);
      const b = itemBalances(i, data.units, data.movements);
      return {
        SKU: i.sku, Name: ar ? i.name : i.nameEn, Department: dept?.name || "", Category: cat?.name || "",
        Unit: i.unit, MinStock: i.minStock, BookInitial: b.bookInit, BookEnd: b.bookEnd,
        UnitsSum: b.storesSum, Diff: b.diff,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsSheet), "Items");
    const movesSheet = data.movements.map((m) => {
      const item = data.items.find((i) => i.id === m.itemId);
      return { Voucher: m.voucherNo, Date: m.date, Type: m.type, Item: item?.name || "", Qty: m.qty, Status: m.status, Recipient: m.recipient };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movesSheet), "Operations");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.users.map((u) => ({ Name: u.name, Rank: u.rank, Role: u.role, PIN: u.pin }))), "Users");
    XLSX.writeFile(wb, `inventory-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold">{t("settings")}</h1>

      <section className="panel grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{t("generalSettings")}</h2>
        <Field label={t("orgName")}><input className="field" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} /></Field>
        <Field label={t("orgNameEn")}><input className="field" value={f.orgNameEn} onChange={(e) => setF({ ...f, orgNameEn: e.target.value })} /></Field>
        <Field label={ar ? "الشعار" : "Logo"}>
          <div className="flex items-center gap-2">
            {f.logo && <img src={f.logo} alt="" className="size-9 object-contain" />}
            <input type="file" accept="image/*" className="field" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, logo: await readFileAsDataURL(x) }); }} />
            {f.logo && <button className="btn btn-danger" onClick={() => setF({ ...f, logo: null })}>{t("del")}</button>}
          </div>
        </Field>
        <Field label={ar ? "العملة" : "Currency"}><input className="field" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></Field>
        <Field label={t("financialYear")}><input type="number" className="field num" value={f.fiscalYear} onChange={(e) => setF({ ...f, fiscalYear: +e.target.value })} /></Field>
        {isSuperAdmin && (
          <Field label={ar ? "الرقم السري (اتركه فارغاً للإلغاء)" : "PIN (empty = disabled)"}><input type="password" className="field num" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Field>
        )}
        <div className="flex items-end justify-end sm:col-span-2"><button className="btn btn-primary px-6 py-2.5" onClick={apply}>{t("saveApply")}</button></div>
      </section>

      {isSuperAdmin && (
        <section className="panel grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">{t("terminology")}</h2>
          <Field label={t("labelDivision")}><input className="field" placeholder={ar ? "الفرقة" : "Division"} value={f.labelDivision} onChange={(e) => setF({ ...f, labelDivision: e.target.value })} /></Field>
          <Field label={t("labelBrigade")}><input className="field" placeholder={ar ? "اللواء" : "Brigade"} value={f.labelBrigade} onChange={(e) => setF({ ...f, labelBrigade: e.target.value })} /></Field>
          <Field label={t("labelBattalion")}><input className="field" placeholder={ar ? "الكتيبة" : "Battalion"} value={f.labelBattalion} onChange={(e) => setF({ ...f, labelBattalion: e.target.value })} /></Field>
          <Field label={t("labelCompany")}><input className="field" placeholder={ar ? "السرية" : "Company"} value={f.labelCompany} onChange={(e) => setF({ ...f, labelCompany: e.target.value })} /></Field>
          <div className="flex items-end justify-end sm:col-span-2"><button className="btn btn-primary px-6 py-2.5" onClick={apply}>{t("saveApply")}</button></div>
        </section>
      )}

      <section className="panel space-y-3 p-5">
        <h2 className="font-bold">{t("backupArchive")}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => downloadBlob(JSON.stringify(data), `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json")}><Download className="size-4" />{t("backup")}</button>
          <label className="btn cursor-pointer"><Upload className="size-4" />{t("restore")}<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
          <button className="btn" onClick={exportExcel}><Download className="size-4" />{t("exportExcel")}</button>
          <button className="btn btn-accent" onClick={archive}><ArchiveIcon className="size-4" />{t("archiveYear")} ({data.settings.fiscalYear})</button>
        </div>
        {data.archives.length > 0 && (
          <ul className="text-sm text-muted-foreground">
            {data.archives.map((a) => <li key={a.archivedAt}>FY <span className="num">{a.year}</span> · {a.movements.length} {t("movements")} · {new Date(a.archivedAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</li>)}
          </ul>
        )}
      </section>

      <Modal open={!!pending} onClose={() => setPending(null)} title={t("pin")}>
        <PinPrompt title={ar ? "أدخل الرقم السري لتأكيد التغيير" : "Enter PIN to confirm"} onCancel={() => setPending(null)} onOk={() => { pending?.(); setPending(null); }} />
      </Modal>
    </div>
  );
}
