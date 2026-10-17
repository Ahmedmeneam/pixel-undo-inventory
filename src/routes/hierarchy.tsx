import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, GitBranch, Layers, Building2, Plus, Pencil, Trash2, Package, Fuel, UtensilsCrossed, Wrench, Truck, Pill, Radio, Shirt, HardHat } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, nextCode, unitNameTaken, useCurrentUser, type Unit, type UnitLevel, type Department, type Category } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field } from "@/components/kit";

export const Route = createFileRoute("/hierarchy")({
  head: () => ({
    meta: [
      { title: "الهيكل التنظيمي — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "Divisions, brigades, battalions, companies, departments and categories." },
    ],
  }),
  component: HierarchyPage,
});

const iconMap: Record<string, typeof Package> = { Package, Fuel, UtensilsCrossed, Wrench, Truck, Pill, Radio, Shirt, HardHat };

type Edit =
  | { kind: "unit"; id?: string; name: string; code: string; level: UnitLevel; parentId: string | null }
  | { kind: "department"; id?: string; name: string; nameEn: string; code: string; icon: string }
  | { kind: "category"; id?: string; name: string; nameEn: string; departmentId: string };

function HierarchyPage() {
  const { t, division, brigade, battalion, company, lang } = useT();
  const { units, departments, categories, items, movements } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const user = useCurrentUser();
  const [e, setE] = useState<Edit | null>(null);
  const [tab, setTab] = useState<"structure" | "departments">("structure");
  const ar = lang === "ar";

  const canEdit = user?.role === "super_admin" || user?.role === "dept_head";

  const save = () => {
    if (!e) return;
    if (e.kind === "unit") {
      if (!e.name.trim()) return;
      if (unitNameTaken(units, e.name, e.level, e.parentId, e.id)) return toast.error(ar ? "الاسم مكرر" : "Duplicate name");
      commit((d) => {
        if (e.id) d.units = d.units.map((u) => (u.id === e.id ? { ...u, name: e.name.trim(), code: e.code } : u));
        else d.units.push({ id: uid(), name: e.name.trim(), code: e.code, level: e.level, parentId: e.parentId });
        return d;
      });
    } else if (e.kind === "department") {
      if (!e.name.trim()) return;
      commit((d) => {
        if (e.id) d.departments = d.departments.map((d2) => (d2.id === e.id ? { ...d2, name: e.name, nameEn: e.nameEn, code: e.code, icon: e.icon } : d2));
        else d.departments.push({ id: uid(), name: e.name, nameEn: e.nameEn, code: nextCode("DEP", d.departments.map((x) => x.code)), icon: e.icon });
        return d;
      });
    } else if (e.kind === "category") {
      if (!e.name.trim()) return;
      commit((d) => {
        if (e.id) d.categories = d.categories.map((c) => (c.id === e.id ? { ...c, name: e.name, nameEn: e.nameEn } : c));
        else d.categories.push({ id: uid(), departmentId: e.departmentId, name: e.name, nameEn: e.nameEn });
        return d;
      });
    }
    setE(null);
  };

  const delUnit = (id: string) => {
    if (units.some((u) => u.parentId === id)) return toast.error(ar ? "احذف الوحدات التابعة أولاً" : "Remove sub-units first");
    if (movements.some((m) => m.fromUnitId === id || m.toUnitId === id) || items.some((i) => (i.initial[id] ?? 0) !== 0))
      return toast.error(ar ? "لا يمكن حذف وحدة بها أرصدة أو عمليات" : "Unit has balances or operations");
    commit((d) => { d.units = d.units.filter((u) => u.id !== id); return d; });
  };

  const delDept = (id: string) => {
    if (items.some((i) => i.departmentId === id)) return toast.error(ar ? "احذف أصناف القسم أولاً" : "Remove department items first");
    if (categories.some((c) => c.departmentId === id)) return toast.error(ar ? "احذف تصنيفات القسم أولاً" : "Remove categories first");
    commit((d) => { d.departments = d.departments.filter((dp) => dp.id !== id); return d; });
  };

  const delCat = (id: string) => {
    if (items.some((i) => i.categoryId === id)) return toast.error(ar ? "يوجد أصناف في هذا التصنيف" : "Items exist in this category");
    commit((d) => { d.categories = d.categories.filter((c) => c.id !== id); return d; });
  };

  const levelLabel = (level: UnitLevel) => level === "division" ? division : level === "brigade" ? brigade : level === "battalion" ? battalion : company;

  const divisions = units.filter((u) => u.level === "division");

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        <button className={`px-4 py-2 text-sm font-semibold ${tab === "structure" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("structure")}>{ar ? "الهيكل العسكري" : "Military Structure"}</button>
        <button className={`px-4 py-2 text-sm font-semibold ${tab === "departments" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("departments")}>{ar ? "الأقسام والتصنيفات" : "Departments & Categories"}</button>
      </div>

      {tab === "structure" && (
        <div className="mx-auto max-w-4xl space-y-3">
          {divisions.map((div) => {
            const brigades = units.filter((u) => u.parentId === div.id);
            return (
              <div key={div.id} className="panel p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="size-6 text-primary" />
                  <span className="num text-xs text-muted-foreground">{div.code}</span>
                  <span className="flex-1 text-lg font-bold">{div.name}</span>
                  {canEdit && (
                    <>
                      <button className="btn py-1" onClick={() => setE({ kind: "unit", name: "", code: nextCode("BDE", units.map((u) => u.code)), level: "brigade", parentId: div.id })}><Plus className="size-3.5" />{brigade}</button>
                      <button className="btn py-1" onClick={() => setE({ kind: "unit", id: div.id, name: div.name, code: div.code, level: "division", parentId: null })}><Pencil className="size-3.5" /></button>
                      <button className="btn btn-danger py-1" onClick={() => delUnit(div.id)}><Trash2 className="size-3.5" /></button>
                    </>
                  )}
                </div>
                {brigades.length === 0 && <p className="ms-6 text-sm text-muted-foreground">{ar ? "لا توجد ألوية" : "No brigades"}</p>}
                {brigades.map((br) => {
                  const battalions = units.filter((u) => u.parentId === br.id);
                  return (
                    <div key={br.id} className="ms-6 border-s-2 border-primary/40 ps-4">
                      <div className="mb-1.5 flex items-center gap-2">
                        <GitBranch className="size-4 text-primary" />
                        <span className="num text-xs text-muted-foreground">{br.code}</span>
                        <span className="flex-1 font-bold">{br.name}</span>
                        {canEdit && (
                          <>
                            <button className="btn py-1" onClick={() => setE({ kind: "unit", name: "", code: nextCode("BTN", units.map((u) => u.code)), level: "battalion", parentId: br.id })}><Plus className="size-3.5" />{battalion}</button>
                            <button className="btn px-2 py-1" onClick={() => setE({ kind: "unit", id: br.id, name: br.name, code: br.code, level: "brigade", parentId: div.id })}><Pencil className="size-3" /></button>
                            <button className="btn btn-danger px-2 py-1" onClick={() => delUnit(br.id)}><Trash2 className="size-3" /></button>
                          </>
                        )}
                      </div>
                      {battalions.map((btn2) => {
                        const companies = units.filter((u) => u.parentId === btn2.id);
                        return (
                          <div key={btn2.id} className="ms-4 border-s-2 border-accent/40 ps-3">
                            <div className="mb-1 flex items-center gap-2">
                              <Layers className="size-3.5 text-accent-foreground" />
                              <span className="num text-xs text-muted-foreground">{btn2.code}</span>
                              <span className="flex-1 font-semibold">{btn2.name}</span>
                              {canEdit && (
                                <>
                                  <button className="btn py-1" onClick={() => setE({ kind: "unit", name: "", code: nextCode("COY", units.map((u) => u.code)), level: "company", parentId: btn2.id })}><Plus className="size-3" />{company}</button>
                                  <button className="btn px-2 py-1" onClick={() => setE({ kind: "unit", id: btn2.id, name: btn2.name, code: btn2.code, level: "battalion", parentId: br.id })}><Pencil className="size-3" /></button>
                                  <button className="btn btn-danger px-2 py-1" onClick={() => delUnit(btn2.id)}><Trash2 className="size-3" /></button>
                                </>
                              )}
                            </div>
                            {companies.map((coy) => (
                              <div key={coy.id} className="ms-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                                <Building2 className="size-3.5 text-muted-foreground" />
                                <span className="num text-xs text-muted-foreground">{coy.code}</span>
                                <span className="flex-1">{coy.name}</span>
                                {canEdit && (
                                  <>
                                    <button className="btn px-1.5 py-0.5" onClick={() => setE({ kind: "unit", id: coy.id, name: coy.name, code: coy.code, level: "company", parentId: btn2.id })}><Pencil className="size-3" /></button>
                                    <button className="btn btn-danger px-1.5 py-0.5" onClick={() => delUnit(coy.id)}><Trash2 className="size-3" /></button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {divisions.length === 0 && (
            <div className="panel p-8 text-center">
              <p className="text-muted-foreground">{ar ? "لا توجد فرق. أنشئ فرقة للبدء." : "No divisions. Create one to start."}</p>
            </div>
          )}
          {canEdit && divisions.length === 0 && (
            <button className="btn btn-primary mx-auto" onClick={() => setE({ kind: "unit", name: "", code: nextCode("DIV", units.map((u) => u.code)), level: "division", parentId: null })}>
              <Plus className="size-4" />{division}
            </button>
          )}
        </div>
      )}

      {tab === "departments" && (
        <div className="mx-auto max-w-4xl space-y-3">
          {departments.map((d) => {
            const Icon = iconMap[d.icon] || Package;
            const cats = categories.filter((c) => c.departmentId === d.id);
            return (
              <div key={d.id} className="panel p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary"><Icon className="size-5" /></div>
                  <span className="num text-xs text-muted-foreground">{d.code}</span>
                  <span className="flex-1 font-bold">{ar ? d.name : d.nameEn}</span>
                  {canEdit && (
                    <>
                      <button className="btn py-1" onClick={() => setE({ kind: "category", name: "", nameEn: "", departmentId: d.id })}><Plus className="size-3.5" />{t("addCategory")}</button>
                      <button className="btn px-2 py-1" onClick={() => setE({ kind: "department", id: d.id, name: d.name, nameEn: d.nameEn, code: d.code, icon: d.icon })}><Pencil className="size-3.5" /></button>
                      <button className="btn btn-danger px-2 py-1" onClick={() => delDept(d.id)}><Trash2 className="size-3.5" /></button>
                    </>
                  )}
                </div>
                {cats.length > 0 && (
                  <div className="ms-6 flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {ar ? c.name : c.nameEn}
                        {canEdit && (
                          <>
                            <button onClick={() => setE({ kind: "category", id: c.id, name: c.name, nameEn: c.nameEn, departmentId: d.id })}><Pencil className="size-3" /></button>
                            <button onClick={() => delCat(c.id)} className="text-destructive"><Trash2 className="size-3" /></button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {canEdit && (
            <button className="btn btn-primary mx-auto" onClick={() => setE({ kind: "department", name: "", nameEn: "", code: "", icon: "Package" })}>
              <Plus className="size-4" />{t("department")}
            </button>
          )}
        </div>
      )}

      <Modal open={!!e} onClose={() => setE(null)} title={e?.kind === "unit" ? levelLabel(e.level) : e?.kind === "department" ? t("department") : t("addCategory")}>
        {e && (
          <div className="grid gap-3">
            {e.kind === "unit" && (
              <>
                <Field label={t("code")}><input className="field num" value={e.code} onChange={(x) => setE({ ...e, code: x.target.value })} /></Field>
                <Field label={t("name")}><input autoFocus className="field" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
              </>
            )}
            {e.kind === "department" && (
              <>
                <Field label={t("name")}><input autoFocus className="field" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
                <Field label={t("nameEn")}><input className="field" value={e.nameEn} onChange={(x) => setE({ ...e, nameEn: x.target.value })} /></Field>
                <Field label={t("code")}><input className="field num" value={e.code} onChange={(x) => setE({ ...e, code: x.target.value })} /></Field>
                <Field label={ar ? "الأيقونة" : "Icon"}>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(iconMap).map(([key, Icon]) => (
                      <button key={key} type="button" onClick={() => setE({ ...e, icon: key })} className={`grid size-9 place-items-center rounded-lg border ${e.icon === key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                        <Icon className="size-4" />
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            {e.kind === "category" && (
              <>
                <Field label={t("name")}><input autoFocus className="field" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
                <Field label={t("nameEn")}><input className="field" value={e.nameEn} onChange={(x) => setE({ ...e, nameEn: x.target.value })} /></Field>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setE(null)}>{t("cancel")}</button>
              <button className="btn btn-primary" onClick={save}>{t("save")}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
