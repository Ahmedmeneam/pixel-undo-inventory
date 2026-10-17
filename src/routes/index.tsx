import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Package, TrendingDown, TrendingUp, AlertTriangle, Download, Printer, Search, Check } from "lucide-react";
import { useApp, itemBalances, allDescendants, useCurrentUser } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { DiffBadge, downloadBlob } from "@/components/kit";
import { ItemDrawer, useUnitName } from "@/components/Details";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Military inventory ledger across divisions, brigades, battalions and companies with discrepancy tracking." },
      { property: "og:title", content: "لوحة التحكم — نظام إدارة العُهد العسكرية" },
    ],
  }),
  component: Dashboard,
});

type Filter = "all" | "shortage" | "excess" | "low";
const W = { serial: 48, name: 200, diff: 130, bal: 80 };

function Dashboard() {
  const { t, division, brigade, battalion, company, lang } = useT();
  const { items, units, movements, departments } = useApp((s) => s.data);
  const view = useApp((s) => s.ui.view);
  const setUI = useApp((s) => s.setUI);
  const commit = useApp((s) => s.commit);
  const user = useCurrentUser();
  const un = useUnitName();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("");
  const detailed = view === "detailed";
  const ar = lang === "ar";

  // Filter items by user's department
  const visibleItems = useMemo(() => {
    if (!user) return items;
    if (user.role === "super_admin") return items;
    return items.filter((i) => i.departmentId === user.departmentId);
  }, [items, user]);

  const rows = useMemo(() => visibleItems.map((i) => ({ item: i, b: itemBalances(i, units, movements) })), [visibleItems, units, movements]);
  const stats = {
    all: rows.length,
    shortage: rows.filter((r) => r.b.diff < 0).length,
    excess: rows.filter((r) => r.b.diff > 0).length,
    low: rows.filter((r) => r.b.storesSum < r.item.minStock).length,
  };
  const shown = rows.filter((r) => {
    if (q && !`${r.item.name} ${r.item.nameEn} ${r.item.sku}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (deptFilter && r.item.departmentId !== deptFilter) return false;
    if (filter === "shortage") return r.b.diff < 0;
    if (filter === "excess") return r.b.diff > 0;
    if (filter === "low") return r.b.storesSum < r.item.minStock;
    return true;
  });

  // Build unit groups: division -> brigades -> battalions -> companies
  const divisions = units.filter((u) => u.level === "division");

  // For the table, we group units by division
  const groups = divisions.map((d) => {
    const descendants = allDescendants(units, d.id);
    return { id: d.id, name: `${division}: ${d.name}`, units: descendants.length ? descendants : [d] };
  }).filter((g) => g.units.length || true);

  // Flatten all units for column display
  const allUnits = units.filter((u) => u.level === "battalion" || u.level === "company");

  const balCols = detailed ? 2 : 1;
  const stickyBase = [0, W.serial, W.serial + W.name, W.serial + W.name + W.diff];
  const st = (i: number, w: number) => ({ insetInlineStart: stickyBase[i], minWidth: w, width: w });
  const pending = movements.filter((m) => m.status === "pending");

  const exportCsv = () => {
    const head = ["#", "SKU", t("itemName"), t("diff"), `Book ${t("initial")}`, `Book ${t("ending")}`, ...allUnits.flatMap((u) => [`${u.name} ${t("initial")}`, `${u.name} ${t("ending")}`])];
    const lines = shown.map((r, i) => [i + 1, r.item.sku, ar ? r.item.name : r.item.nameEn, r.b.diff, r.b.bookInit, r.b.bookEnd, ...allUnits.flatMap((u) => [r.b.unitInit[u.id] ?? 0, r.b.unitEnd[u.id] ?? 0])]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob("\uFEFF" + csv, "inventory.csv", "text/csv;charset=utf-8");
  };

  const kpis: { k: Filter; label: string; icon: typeof Package; cls: string }[] = [
    { k: "all", label: t("totalItems"), icon: Package, cls: "text-primary" },
    { k: "shortage", label: t("shortage"), icon: TrendingDown, cls: "text-destructive" },
    { k: "excess", label: t("excess"), icon: TrendingUp, cls: "text-info" },
    { k: "low", label: t("lowStock"), icon: AlertTriangle, cls: "text-warning" },
  ];

  const cellB = "border-e border-border px-2 py-1.5 text-center num";
  const levelLabel = (level: string) => level === "division" ? division : level === "brigade" ? brigade : level === "battalion" ? battalion : company;

  return (
    <div className="space-y-4">
      <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <button key={k.k} onClick={() => setFilter(filter === k.k && k.k !== "all" ? "all" : k.k)}
            className={`panel flex items-center gap-3 p-4 text-start transition ${filter === k.k ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}>
            <div className={`grid size-10 place-items-center rounded-lg bg-muted ${k.cls}`}><k.icon className="size-5" /></div>
            <div><div className="num text-2xl font-bold">{stats[k.k]}</div><div className="text-xs text-muted-foreground">{k.label}</div></div>
          </button>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="no-print panel border-warning/50 p-3">
          <h3 className="mb-2 text-sm font-bold">{t("pendingTransfers")} ({pending.length})</h3>
          <div className="space-y-1.5">
            {pending.map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-warning/10 px-3 py-2 text-sm">
                  <span><b>{item ? (ar ? item.name : item.nameEn) : "?"}</b> · <span className="num">{m.qty}</span> · {un(m.fromUnitId)} → {un(m.toUnitId)} · <span className="num text-muted-foreground">{m.voucherNo}</span></span>
                  <button className="btn btn-primary py-1" onClick={() => {
                    commit((d) => { const x = d.movements.find((y) => y.id === m.id)!; x.status = "done"; x.confirmedAt = new Date().toISOString(); return d; });
                    toast.success(t("confirm"));
                  }}>
                    <Check className="size-4" />{t("confirm")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="field ps-8" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {user?.role === "super_admin" && (
          <select className="field max-w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">{t("department")}: {t("all")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{ar ? d.name : d.nameEn}</option>)}
          </select>
        )}
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          <button className={`px-3 py-2 text-xs font-semibold ${!detailed ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setUI({ view: "compact" })}>{t("compact")}</button>
          <button className={`px-3 py-2 text-xs font-semibold ${detailed ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setUI({ view: "detailed" })}>{t("detailed")}</button>
        </div>
        <button className="btn" onClick={() => setOpen(Object.fromEntries(divisions.map((d) => [d.id, !Object.values(open).some(Boolean)])))}>
          {ar ? "توسيع/طي الكل" : "Expand/collapse all"}
        </button>
        <button className="btn" onClick={exportCsv}><Download className="size-4" />{t("exportCsv")}</button>
        <button className="btn" onClick={() => window.print()}><Printer className="size-4" />{t("print")}</button>
      </div>

      <div className="panel max-h-[70vh] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-secondary">
              <th rowSpan={2} className="sticky z-30 border-b border-e border-border bg-secondary px-2" style={st(0, W.serial)}>{t("serial")}</th>
              <th rowSpan={2} className="sticky z-30 border-b border-e border-border bg-secondary px-2 text-start" style={st(1, W.name)}>{t("itemName")}</th>
              <th rowSpan={2} className="sticky z-30 border-b border-e border-border bg-secondary px-2" style={st(2, W.diff)}>{t("diff")} (+/−)</th>
              <th colSpan={balCols} className="sticky z-30 border-b border-e-2 border-e-primary border-border bg-primary/15 px-2 py-1.5" style={{ ...st(3, W.bal * balCols), background: "var(--color-secondary)" }}>{ar ? "الدفاتر" : "Ledger"}</th>
              {divisions.map((d) => {
                const desc = allDescendants(units, d.id);
                const unitCount = desc.filter((u) => u.level === "battalion" || u.level === "company").length;
                return (
                  <th key={d.id} colSpan={(open[d.id] ? unitCount * balCols : 0) + balCols} className="border-b border-e-2 border-border bg-secondary px-2 py-1.5">
                    <button className="inline-flex items-center gap-1 font-bold text-primary hover:underline" onClick={() => setOpen({ ...open, [d.id]: !open[d.id] })}>
                      {open[d.id] ? <ChevronDown className="size-4" /> : ar ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                      {division}: {d.name} <span className="text-xs font-normal text-muted-foreground">({unitCount})</span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-secondary text-xs text-muted-foreground">
              {detailed && <th className="sticky z-30 border-b border-e border-border bg-secondary px-2 py-1" style={{ insetInlineStart: stickyBase[3], minWidth: W.bal }}>{t("initial")}</th>}
              <th className="sticky z-30 border-b border-e-2 border-border bg-secondary px-2 py-1" style={{ insetInlineStart: stickyBase[3] + (detailed ? W.bal : 0), minWidth: W.bal }}>{detailed ? t("ending") : t("current")}</th>
              {divisions.map((d) => {
                const desc = allDescendants(units, d.id).filter((u) => u.level === "battalion" || u.level === "company");
                return (
                  <Fragment key={d.id}>
                    {open[d.id] && desc.map((u) => (
                      <th key={u.id} colSpan={balCols} className="border-b border-e border-border bg-surface px-2 py-1 font-semibold text-foreground">
                        <div className="min-w-[70px]">{levelLabel(u.level).charAt(0)} · {u.name}</div>
                        {detailed && <div className="flex justify-around font-normal text-muted-foreground"><span>{t("initial")}</span><span>{t("ending")}</span></div>}
                      </th>
                    ))}
                    <th colSpan={balCols} className="border-b border-e-2 border-border bg-secondary px-2 py-1">
                      Σ {detailed && <div className="flex justify-around gap-2"><span>{t("initial")}</span><span>{t("ending")}</span></div>}
                    </th>
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr key={r.item.id} className="group">
                <td className="sticky z-10 border-b border-e border-border bg-card px-2 text-center num text-muted-foreground group-hover:bg-muted" style={st(0, W.serial)}>{idx + 1}</td>
                <td className="sticky z-10 border-b border-e border-border bg-card px-2 group-hover:bg-muted" style={st(1, W.name)}>
                  <button className="block w-full truncate text-start font-semibold hover:text-primary hover:underline" onClick={() => setDrawer(r.item.id)}>{ar ? r.item.name : r.item.nameEn}</button>
                  <span className="num text-[10px] text-muted-foreground">{r.item.sku}</span>
                </td>
                <td className="sticky z-10 border-b border-e border-border bg-card px-2 text-center group-hover:bg-muted" style={st(2, W.diff)}>
                  <DiffBadge diff={r.b.diff} labels={{ matched: t("matched"), shortage: t("shortage"), excess: t("excess") }} />
                </td>
                {detailed && <td className="sticky z-10 border-b border-e border-border bg-card px-2 text-center num group-hover:bg-muted" style={{ insetInlineStart: stickyBase[3], minWidth: W.bal }}>{r.b.bookInit}</td>}
                <td className="sticky z-10 border-b border-e-2 border-border bg-card px-2 text-center num font-bold group-hover:bg-muted" style={{ insetInlineStart: stickyBase[3] + (detailed ? W.bal : 0), minWidth: W.bal }}>{r.b.bookEnd}</td>
                {divisions.map((d) => {
                  const desc = allDescendants(units, d.id).filter((u) => u.level === "battalion" || u.level === "company");
                  const si = desc.reduce((a, u) => a + (r.b.unitInit[u.id] ?? 0), 0);
                  const se = desc.reduce((a, u) => a + (r.b.unitEnd[u.id] ?? 0), 0);
                  return (
                    <Fragment key={d.id}>
                      {open[d.id] && desc.map((u) => (
                        <Fragment key={u.id}>
                          {detailed && <td className={`${cellB} border-b bg-surface/50 text-muted-foreground`}>{r.b.unitInit[u.id]}</td>}
                          <td className={`${cellB} border-b bg-surface/50 ${(r.b.unitEnd[u.id] ?? 0) < 0 ? "text-destructive" : ""}`}>{r.b.unitEnd[u.id]}</td>
                        </Fragment>
                      ))}
                      {detailed && <td className={`${cellB} border-b text-muted-foreground`}>{si}</td>}
                      <td className={`${cellB} border-b border-e-2 font-bold`}>{se}</td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={99} className="p-8 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
      </div>
      <ItemDrawer itemId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
