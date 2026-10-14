import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, nextCode, type Item } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field } from "@/components/kit";
import { ItemDrawer } from "@/components/Details";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "الأصناف — إدارة المخازن الهرمية" },
      { name: "description", content: "Manage items, SKUs, units and opening balances." },
      { property: "og:title", content: "الأصناف — إدارة المخازن الهرمية" },
      { property: "og:description", content: "Manage items, SKUs, units and opening balances." },
    ],
  }),
  component: ItemsPage,
});

function ItemsPage() {
  const { t, company, lang } = useT();
  const { items, stores, branches } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const [edit, setEdit] = useState<Item | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const blank = (): Item => ({ id: "", sku: nextCode("IT", items.map((i) => i.sku)), name: "", unit: lang === "ar" ? "قطعة" : "pcs", minStock: 0, bookInitial: 0, initial: {} });

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error(t("name"));
    if (items.some((i) => i.id !== edit.id && i.sku === edit.sku)) return toast.error(lang === "ar" ? "الكود مستخدم" : "SKU exists");
    commit((d) => {
      if (edit.id) d.items = d.items.map((i) => (i.id === edit.id ? edit : i));
      else d.items.push({ ...edit, id: uid() });
      return d;
    });
    setEdit(null);
  };
  const del = (id: string) => {
    if (!confirm(lang === "ar" ? "حذف الصنف وكل حركاته؟" : "Delete item and its movements?")) return;
    commit((d) => { d.items = d.items.filter((i) => i.id !== id); d.movements = d.movements.filter((m) => m.itemId !== id); return d; });
  };
  const sname = (id: string) => { const s = stores.find((x) => x.id === id)!; const b = branches.find((x) => x.id === s.branchId); return `${b ? b.name : company} / ${s.name}`; };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("items")}</h1>
        <input className="field ms-auto max-w-xs" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus className="size-4" />{t("add")}</button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs"><tr>{[t("sku"), t("name"), t("unit"), t("minStock"), t("bookInitial"), ""].map((h, i) => <th key={i} className="px-3 py-2 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {items.filter((i) => `${i.name}${i.sku}`.toLowerCase().includes(q.toLowerCase())).map((i) => (
              <tr key={i.id} className="border-t border-border hover:bg-muted/50">
                <td className="num px-3 py-2">{i.sku}</td>
                <td className="px-3"><button className="font-semibold hover:text-primary hover:underline" onClick={() => setDrawer(i.id)}>{i.name}</button></td>
                <td className="px-3">{i.unit}</td>
                <td className="num px-3">{i.minStock}</td>
                <td className="num px-3">{i.bookInitial}</td>
                <td className="px-3 text-end"><button className="btn px-2" onClick={() => setEdit(structuredClone(i))}><Pencil className="size-3.5" /></button> <button className="btn btn-danger px-2" onClick={() => del(i.id)}><Trash2 className="size-3.5" /></button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("edit") : t("add")} wide>
        {edit && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("sku")}><input className="field num" value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label={t("name")}><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field></div>
              <Field label={t("unit")}><input className="field" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
              <Field label={t("minStock")}><input type="number" className="field num" value={edit.minStock} onChange={(e) => setEdit({ ...edit, minStock: +e.target.value })} /></Field>
              <Field label={t("bookInitial")}><input type="number" className="field num" value={edit.bookInitial} onChange={(e) => setEdit({ ...edit, bookInitial: +e.target.value })} /></Field>
            </div>
            <p className="label-sm mt-2">{t("initial")} — {t("stores")}</p>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{sname(s.id)}</span>
                  <input type="number" className="field num w-24" value={edit.initial[s.id] ?? 0} onChange={(e) => setEdit({ ...edit, initial: { ...edit.initial, [s.id]: +e.target.value } })} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>{t("cancel")}</button><button className="btn btn-primary" onClick={save}>{t("save")}</button></div>
          </div>
        )}
      </Modal>
      <ItemDrawer itemId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
