import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Search, Archive as ArchiveIcon, FileText } from "lucide-react";
import { useApp, useCurrentUser } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { VoucherModal, TypeChip, useUnitName } from "@/components/Details";
import { downloadBlob } from "@/components/kit";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "الأرشيف الذكي — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Multi-year archive search and full audit trail." },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { t, lang } = useT();
  const { movements, items, units, departments, archives, auditLog, users, settings } = useApp((s) => s.data);
  const user = useCurrentUser();
  const un = useUnitName();
  const ar = lang === "ar";
  const [tab, setTab] = useState<"archive" | "audit">("archive");
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sel, setSel] = useState<typeof movements[0] | null>(null);

  const visibleMovements = useMemo(() => {
    let list = movements;
    if (user && user.role !== "super_admin") list = list.filter((m) => m.departmentId === user.departmentId);
    return list;
  }, [movements, user]);

  // Include archived movements in search
  const archivedMovements = useMemo(() => {
    const all: typeof movements = [];
    for (const a of archives) all.push(...a.movements);
    return all;
  }, [archives]);

  const allMovements = [...visibleMovements, ...archivedMovements];

  const filtered = useMemo(() => {
    let list = allMovements;
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((m) => {
        const item = items.find((i) => i.id === m.itemId);
        return (
          m.voucherNo.toLowerCase().includes(ql) ||
          m.invoice.toLowerCase().includes(ql) ||
          (item?.sku.toLowerCase().includes(ql) ?? false) ||
          (item?.name.toLowerCase().includes(ql) ?? false) ||
          (item?.nameEn.toLowerCase().includes(ql) ?? false) ||
          m.recipient.toLowerCase().includes(ql) ||
          un(m.fromUnitId).toLowerCase().includes(ql) ||
          un(m.toUnitId).toLowerCase().includes(ql)
        );
      });
    }
    if (yearFilter) {
      list = list.filter((m) => new Date(m.date).getFullYear().toString() === yearFilter);
    }
    return list;
  }, [allMovements, q, yearFilter, items, un]);

  const years = useMemo(() => {
    const set = new Set<number>();
    allMovements.forEach((m) => set.add(new Date(m.date).getFullYear()));
    archives.forEach((a) => set.add(a.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [allMovements, archives]);

  const exportArchive = () => {
    const head = [t("voucherNo"), t("date"), t("type"), t("itemName"), t("qty"), t("fromStore"), t("toStore"), t("recipient"), t("status")];
    const lines = filtered.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      return [m.voucherNo, m.date, m.type, item?.name || "", m.qty, un(m.fromUnitId), un(m.toUnitId), m.recipient, m.status];
    });
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob("\uFEFF" + csv, `archive-export-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  };

  const roleLabel = (r: string) => r === "super_admin" ? t("superAdmin") : r === "dept_head" ? t("departmentHead") : t("storekeeper");

  const visibleAudit = useMemo(() => {
    if (user && user.role === "super_admin") return auditLog;
    return auditLog.filter((e) => {
      const u = users.find((usr) => usr.id === e.userId);
      return u && (u.role !== "super_admin" || user?.role === "super_admin");
    });
  }, [auditLog, users, user]);

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        <button className={`px-4 py-2 text-sm font-semibold ${tab === "archive" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("archive")}>{ar ? "الأرشيف" : "Archive"}</button>
        <button className={`px-4 py-2 text-sm font-semibold ${tab === "audit" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("audit")}>{t("auditTrail")}</button>
      </div>

      {tab === "archive" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="field ps-8" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field max-w-32" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">{t("financialYear")}: {t("all")}</option>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <button className="btn" onClick={exportArchive}><FileText className="size-4" />{t("exportCsv")}</button>
          </div>

          {archives.length > 0 && (
            <div className="panel flex flex-wrap gap-2 p-3">
              {archives.map((a) => (
                <div key={a.archivedAt} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
                  <ArchiveIcon className="size-3.5 text-primary" />
                  <span className="font-semibold">FY {a.year}</span>
                  <span className="text-muted-foreground">{a.movements.length} {t("movements")}</span>
                  <span className="text-muted-foreground">{new Date(a.archivedAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</span>
                </div>
              ))}
            </div>
          )}

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs">
                <tr>
                  {[t("voucherNo"), t("date"), t("type"), t("itemName"), t("qty"), t("fromStore"), t("toStore"), t("recipient"), t("status")].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-2 text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((m) => {
                  const item = items.find((i) => i.id === m.itemId);
                  return (
                    <tr key={m.id + m.voucherNo} onClick={() => setSel(m)} className="cursor-pointer border-t border-border hover:bg-muted/60">
                      <td className="num px-3 py-2 text-xs font-semibold">{m.voucherNo}</td>
                      <td className="num px-3 py-2 text-xs">{new Date(m.date).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</td>
                      <td className="px-3"><TypeChip m={m} /></td>
                      <td className="px-3 font-medium">{item ? (ar ? item.name : item.nameEn) : "?"}</td>
                      <td className="num px-3 font-bold">{m.qty}</td>
                      <td className="px-3 text-xs">{un(m.fromUnitId)}</td>
                      <td className="px-3 text-xs">{un(m.toUnitId)}</td>
                      <td className="px-3 text-xs">{m.recipient}</td>
                      <td className="px-3 text-xs">{m.status === "pending" ? t("pending") : t("done")}</td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {ar ? `عرض 200 من ${filtered.length} نتيجة — استخدم البحث للتصفية` : `Showing 200 of ${filtered.length} results — refine search to narrow`}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "audit" && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs">
              <tr>
                {[t("timestamp"), t("user2"), t("action"), t("details")].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleAudit.map((e) => {
                const u = users.find((usr) => usr.id === e.userId);
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/50">
                    <td className="num px-3 py-2 text-xs whitespace-nowrap">{new Date(e.timestamp).toLocaleString(ar ? "ar-EG" : "en-GB")}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{u ? `${u.rank} ${u.name}` : e.userName}</div>
                      {u && <div className="text-xs text-muted-foreground">{roleLabel(u.role)}</div>}
                    </td>
                    <td className="px-3 py-2"><span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{e.action}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.details}</td>
                  </tr>
                );
              })}
              {!visibleAudit.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <VoucherModal m={sel} onClose={() => setSel(null)} />
    </div>
  );
}
