import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Paperclip, Check } from "lucide-react";
import { useApp, type Movement } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { ReceiptModal, TypeChip, useStoreName } from "@/components/Details";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "سجل الحركات — إدارة المخازن الهرمية" },
      { name: "description", content: "Detailed, filterable audit log of all stock movements." },
      { property: "og:title", content: "سجل الحركات — إدارة المخازن الهرمية" },
      { property: "og:description", content: "Detailed, filterable audit log of all stock movements." },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  const { t, lang } = useT();
  const { movements, items, stores } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const sn = useStoreName();
  const [f, setF] = useState({ from: "", to: "", type: "", store: "", item: "" });
  const [sel, setSel] = useState<Movement | null>(null);

  const list = movements.filter((m) => {
    const d = m.date.slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.type && m.type !== f.type) return false;
    if (f.store && m.fromStoreId !== f.store && m.toStoreId !== f.store) return false;
    if (f.item && m.itemId !== f.item) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("log")}</h1>
      <div className="panel grid gap-2 p-3 sm:grid-cols-5">
        <input type="date" className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title={t("from")} />
        <input type="date" className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title={t("to")} />
        <select className="field" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="">{t("type")}: {t("all")}</option><option value="in">{t("stockIn")}</option><option value="out">{t("stockOut")}</option><option value="transfer">{t("transfer")}</option>
        </select>
        <select className="field" value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })}>
          <option value="">{t("store")}: {t("all")}</option>{stores.map((s) => <option key={s.id} value={s.id}>{sn(s.id)}</option>)}
        </select>
        <select className="field" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })}>
          <option value="">{t("itemName")}: {t("all")}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs"><tr>{[t("date"), t("type"), t("itemName"), t("qty"), t("fromStore"), t("toStore"), t("invoice"), t("recipient"), t("status"), ""].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} onClick={() => setSel(m)} className="cursor-pointer border-t border-border hover:bg-muted/60">
                <td className="num whitespace-nowrap px-3 py-2 text-xs">{new Date(m.date).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</td>
                <td className="px-3"><TypeChip m={m} /></td>
                <td className="px-3 font-medium">{items.find((i) => i.id === m.itemId)?.name}</td>
                <td className="num px-3 font-bold">{m.qty}</td>
                <td className="px-3 text-xs">{sn(m.fromStoreId)}</td>
                <td className="px-3 text-xs">{sn(m.toStoreId)}</td>
                <td className="num px-3 text-xs">{m.invoice} {m.attachment && <Paperclip className="inline size-3" />}</td>
                <td className="px-3 text-xs">{m.recipient}</td>
                <td className="px-3 text-xs">{m.status === "pending" ? <span className="rounded bg-warning/20 px-1.5 py-0.5">{t("pending")}</span> : t("done")}</td>
                <td className="px-3">{m.status === "pending" && (
                  <button className="btn py-1 text-xs" onClick={(e) => { e.stopPropagation(); commit((d) => { const x = d.movements.find((y) => y.id === m.id)!; x.status = "done"; x.confirmedAt = new Date().toISOString(); return d; }); }}>
                    <Check className="size-3.5" />{t("confirm")}
                  </button>)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      <ReceiptModal m={sel} onClose={() => setSel(null)} />
    </div>
  );
}
