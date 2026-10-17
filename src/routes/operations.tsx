import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Paperclip, Check, FileText, Search } from "lucide-react";
import { useApp, useCurrentUser, type Movement } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { VoucherModal, TypeChip, useUnitName } from "@/components/Details";
import { OperationModal } from "@/components/OperationModal";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "العمليات — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Unified operations page for issuance, returns, deductions and reallocations." },
    ],
  }),
  component: OperationsPage,
});

function OperationsPage() {
  const { t, lang } = useT();
  const { movements, items, units, departments } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const logAction = useApp((s) => s.logAction);
  const user = useCurrentUser();
  const un = useUnitName();
  const ar = lang === "ar";
  const [f, setF] = useState({ from: "", to: "", type: "", unit: "", item: "", dept: "" });
  const [sel, setSel] = useState<Movement | null>(null);
  const [opOpen, setOpOpen] = useState(false);

  const visibleMovements = useMemo(() => {
    let list = movements;
    if (user && user.role !== "super_admin") list = list.filter((m) => m.departmentId === user.departmentId);
    return list;
  }, [movements, user]);

  const list = visibleMovements.filter((m) => {
    const d = m.date.slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.type && m.type !== f.type) return false;
    if (f.unit && m.fromUnitId !== f.unit && m.toUnitId !== f.unit) return false;
    if (f.item && m.itemId !== f.item) return false;
    if (f.dept && m.departmentId !== f.dept) return false;
    return true;
  });

  const typeOpts = [
    { v: "issue", l: t("issue") },
    { v: "add", l: t("addStock") },
    { v: "return", l: t("returnOp") },
    { v: "deduct", l: t("deductOp") },
    { v: "reallocate", l: t("reallocate") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("operations")}</h1>
        {(user?.role === "dept_head" || user?.role === "storekeeper") && (
          <button className="btn btn-primary ms-auto" onClick={() => setOpOpen(true)}>
            <FileText className="size-4" />{t("newMove")}
          </button>
        )}
      </div>

      <div className="panel grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input type="date" className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title={t("from")} />
        <input type="date" className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title={t("to")} />
        <select className="field" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="">{t("type")}: {t("all")}</option>
          {typeOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        {user?.role === "super_admin" && (
          <select className="field" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>
            <option value="">{t("department")}: {t("all")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{ar ? d.name : d.nameEn}</option>)}
          </select>
        )}
        <select className="field" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
          <option value="">{t("store")}: {t("all")}</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="field" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })}>
          <option value="">{t("itemName")}: {t("all")}</option>
          {items.map((i) => <option key={i.id} value={i.id}>{ar ? i.name : i.nameEn}</option>)}
        </select>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs">
            <tr>
              {[t("voucherNo"), t("date"), t("type"), t("itemName"), t("qty"), t("fromStore"), t("toStore"), t("recipient"), t("status"), ""].map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              return (
                <tr key={m.id} onClick={() => setSel(m)} className="cursor-pointer border-t border-border hover:bg-muted/60">
                  <td className="num whitespace-nowrap px-3 py-2 text-xs font-semibold">{m.voucherNo}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-xs">{new Date(m.date).toLocaleString(ar ? "ar-EG" : "en-GB")}</td>
                  <td className="px-3"><TypeChip m={m} /></td>
                  <td className="px-3 font-medium">{item ? (ar ? item.name : item.nameEn) : "?"}</td>
                  <td className="num px-3 font-bold">{m.qty}</td>
                  <td className="px-3 text-xs">{un(m.fromUnitId)}</td>
                  <td className="px-3 text-xs">{un(m.toUnitId)}</td>
                  <td className="px-3 text-xs">{m.recipient}</td>
                  <td className="px-3 text-xs">{m.status === "pending" ? <span className="rounded bg-warning/20 px-1.5 py-0.5">{t("pending")}</span> : t("done")}</td>
                  <td className="px-3 whitespace-nowrap">
                    {m.status === "pending" && (
                      <button className="btn py-1 text-xs" onClick={(e) => {
                        e.stopPropagation();
                        commit((d) => { const x = d.movements.find((y) => y.id === m.id)!; x.status = "done"; x.confirmedAt = new Date().toISOString(); return d; });
                        logAction("confirm", `${m.voucherNo}`);
                      }}>
                        <Check className="size-3.5" />{t("confirm")}
                      </button>
                    )}
                    {m.attachment && <Paperclip className="ms-1 inline size-3 text-muted-foreground" />}
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      <VoucherModal m={sel} onClose={() => setSel(null)} />
      <OperationModal open={opOpen} onClose={() => setOpOpen(false)} />
    </div>
  );
}
