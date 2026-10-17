import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Package, Fuel, UtensilsCrossed, Wrench, Truck, Pill, Radio, Shirt, HardHat, Search } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, nextCode, useCurrentUser, type Item } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field } from "@/components/kit";
import { ItemDrawer } from "@/components/Details";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "دليل الأصناف — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Manage items, SKUs, units, categories and opening balances." },
    ],
  }),
  component: ItemsPage,
});

const iconMap: Record<string, typeof Package> = { Package, Fuel, UtensilsCrossed, Wrench, Truck, Pill, Radio, Shirt, HardHat };

function ItemsPage() {
  const { t, lang } = useT();
  const { items, units, departments, categories } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const user = useCurrentUser();
  const [edit, setEdit] = useState<Item | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("");
  const ar = lang === "ar";

  const visibleItems = useMemo(() => {
    let list = items;
    if (user && user.role !== "super_admin") list = list.filter((i) => i.departmentId === user.departmentId);
    if (deptFilter) list = list.filter((i) => i.departmentId === deptFilter);
    if (catFilter) list = list.filter((i) => i.categoryId === catFilter);
    if (q) list = list.filter((i) => `${i.name}${i.nameEn}${i.sku}`.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [items, user, deptFilter, catFilter, q]);

  // Only show categories for the selected department
  const availableCategories = useMemo(() => {
    const targetDept = deptFilter || user?.departmentId || "";
    return targetDept ? categories.filter((c) => c.departmentId === targetDept) : [];
  }, [categories, deptFilter, user]);

  const availableDepartments = useMemo(() => {
    if (!user) return departments;
    if (user.role === "super_admin") return departments;
    return departments.filter((d) => d.id === user.departmentId);
  }, [departments, user]);

  const blank = (): Item => ({
    id: "", sku: nextCode("IT", items.map((i) => i.sku)),
    name: "", nameEn: "", unit: ar ? "قطعة" : "pcs",
    minStock: 0, bookInitial: 0, initial: {},
    departmentId: user?.departmentId || availableDepartments[0]?.id || "",
    categoryId: null,
  });

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error(t("name"));
    if (items.some((i) => i.id !== edit.id && i.sku === edit.sku)) return toast.error(ar ? "الكود مستخدم" : "SKU exists");
    commit((d) => {
      if (edit.id) d.items = d.items.map((i) => (i.id === edit.id ? edit : i));
      else d.items.push({ ...edit, id: uid() });
      return d;
    });
    setEdit(null);
  };
  const del = (id: string) => {
    if (!confirm(ar ? "حذف الصنف وكل عملياته؟" : "Delete item and its operations?")) return;
    commit((d) => { d.items = d.items.filter((i) => i.id !== id); d.movements = d.movements.filter((m) => m.itemId !== id); return d; });
  };

  // Virtualized rendering: show first 100 items for performance with 500+
  const [visibleCount, setVisibleCount] = useState(50);
  const visible = visibleItems.slice(0, visibleCount);
  const hasMore = visibleItems.length > visibleCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("items")}</h1>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="field ps-8" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {user?.role === "super_admin" && (
          <select className="field max-w-40" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCatFilter(""); }}>
            <option value="">{t("department")}: {t("all")}</option>
            {availableDepartments.map((d) => <option key={d.id} value={d.id}>{ar ? d.name : d.nameEn}</option>)}
          </select>
        )}
        {availableCategories.length > 0 && (
          <select className="field max-w-40" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">{t("category")}: {t("all")}</option>
            {availableCategories.map((c) => <option key={c.id} value={c.id}>{ar ? c.name : c.nameEn}</option>)}
          </select>
        )}
        {(user?.role === "super_admin" || user?.role === "dept_head") && (
          <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus className="size-4" />{t("add")}</button>
        )}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs">
            <tr>
              {[t("sku"), t("itemName"), t("department"), t("category"), t("unit"), t("minStock"), t("bookInitial"), ""].map((h, i) => (
                <th key={i} className="px-3 py-2 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => {
              const dept = departments.find((d) => d.id === i.departmentId);
              const cat = categories.find((c) => c.id === i.categoryId);
              const Icon = dept ? iconMap[dept.icon] || Package : Package;
              return (
                <tr key={i.id} className="border-t border-border hover:bg-muted/50">
                  <td className="num px-3 py-2">{i.sku}</td>
                  <td className="px-3"><button className="font-semibold hover:text-primary hover:underline" onClick={() => setDrawer(i.id)}>{ar ? i.name : i.nameEn || i.name}</button></td>
                  <td className="px-3"><span className="inline-flex items-center gap-1.5 text-xs"><Icon className="size-3.5" />{dept ? (ar ? dept.name : dept.nameEn) : "—"}</span></td>
                  <td className="px-3 text-xs text-muted-foreground">{cat ? (ar ? cat.name : cat.nameEn) : t("noCategory")}</td>
                  <td className="px-3">{i.unit}</td>
                  <td className="num px-3">{i.minStock}</td>
                  <td className="num px-3">{i.bookInitial}</td>
                  <td className="px-3 text-end">
                    {(user?.role === "super_admin" || user?.role === "dept_head") && (
                      <>
                        <button className="btn px-2" onClick={() => setEdit(structuredClone(i))}><Pencil className="size-3.5" /></button>
                        <button className="btn btn-danger px-2" onClick={() => del(i.id)}><Trash2 className="size-3.5" /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visible.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
        {hasMore && (
          <div className="border-t border-border p-3 text-center">
            <button className="btn" onClick={() => setVisibleCount(visibleCount + 50)}>
              {ar ? `عرض المزيد (${visibleItems.length - visibleCount} متبقي)` : `Load more (${visibleItems.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
        <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          {ar ? `${visible.length} من ${visibleItems.length} صنف` : `${visible.length} of ${visibleItems.length} items`}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("edit") : t("add")} wide>
        {edit && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("sku")}><input className="field num" value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label={t("name")}><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field></div>
              <Field label={t("nameEn")}><input className="field" value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
              <Field label={t("department")}>
                <select className="field" value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value, categoryId: null })}>
                  {availableDepartments.map((d) => <option key={d.id} value={d.id}>{ar ? d.name : d.nameEn}</option>)}
                </select>
              </Field>
              <Field label={t("category")}>
                <select className="field" value={edit.categoryId ?? ""} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}>
                  <option value="">{t("noCategory")}</option>
                  {categories.filter((c) => c.departmentId === edit.departmentId).map((c) => <option key={c.id} value={c.id}>{ar ? c.name : c.nameEn}</option>)}
                </select>
              </Field>
              <Field label={t("unit")}><input className="field" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
              <Field label={t("minStock")}><input type="number" className="field num" value={edit.minStock} onChange={(e) => setEdit({ ...edit, minStock: +e.target.value })} /></Field>
              <Field label={t("bookInitial")}><input type="number" className="field num" value={edit.bookInitial} onChange={(e) => setEdit({ ...edit, bookInitial: +e.target.value })} /></Field>
            </div>
            <p className="label-sm mt-2">{t("initial")} — {t("stores")}</p>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {units.filter((u) => u.level === "battalion" || u.level === "company").map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{u.name}</span>
                  <input type="number" className="field num w-24" value={edit.initial[u.id] ?? 0} onChange={(e) => setEdit({ ...edit, initial: { ...edit.initial, [u.id]: +e.target.value } })} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setEdit(null)}>{t("cancel")}</button>
              <button className="btn btn-primary" onClick={save}>{t("save")}</button>
            </div>
          </div>
        )}
      </Modal>
      <ItemDrawer itemId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
