import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, GitBranch, Warehouse, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, nextCode, storeNameTaken, branchNameTaken } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field } from "@/components/kit";

export const Route = createFileRoute("/hierarchy")({
  head: () => ({
    meta: [
      { title: "الهيكل التنظيمي — إدارة المخازن الهرمية" },
      { name: "description", content: "Company, main branches and physical sub-stores hierarchy." },
      { property: "og:title", content: "الهيكل التنظيمي — إدارة المخازن الهرمية" },
      { property: "og:description", content: "Company, main branches and physical sub-stores hierarchy." },
    ],
  }),
  component: HierarchyPage,
});

type Edit = { kind: "branch" | "store"; id?: string; branchId: string | null; name: string; code: string };

function HierarchyPage() {
  const { t, company, branch, lang } = useT();
  const { branches, stores, movements, items, settings } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const [e, setE] = useState<Edit | null>(null);
  const ar = lang === "ar";

  const save = () => {
    if (!e || !e.name.trim()) return;
    if (e.kind === "branch") {
      if (branchNameTaken(branches, e.name, e.id)) return toast.error(ar ? `اسم ${branch} مكرر` : `Duplicate ${branch} name`);
      commit((d) => { if (e.id) d.branches = d.branches.map((b) => (b.id === e.id ? { ...b, name: e.name.trim(), code: e.code } : b)); else d.branches.push({ id: uid(), name: e.name.trim(), code: e.code }); return d; });
    } else {
      if (storeNameTaken(stores, e.name, e.branchId, e.id)) return toast.error(ar ? "اسم المخزن مكرر في نفس المستوى" : "Duplicate store name at this level");
      commit((d) => { if (e.id) d.stores = d.stores.map((s) => (s.id === e.id ? { ...s, name: e.name.trim(), code: e.code } : s)); else d.stores.push({ id: uid(), name: e.name.trim(), code: e.code, branchId: e.branchId }); return d; });
    }
    setE(null);
  };
  const delStore = (id: string) => {
    if (movements.some((m) => m.fromStoreId === id || m.toStoreId === id) || items.some((i) => (i.initial[id] ?? 0) !== 0))
      return toast.error(ar ? "لا يمكن حذف مخزن به أرصدة أو حركات" : "Store has balances or movements");
    commit((d) => { d.stores = d.stores.filter((s) => s.id !== id); return d; });
  };
  const delBranch = (id: string) => {
    if (stores.some((s) => s.branchId === id)) return toast.error(ar ? "احذف المخازن التابعة أولاً" : "Remove its stores first");
    commit((d) => { d.branches = d.branches.filter((b) => b.id !== id); return d; });
  };
  const newStore = (branchId: string | null) => setE({ kind: "store", branchId, name: "", code: nextCode("ST", stores.map((s) => s.code)) });

  const StoreRow = ({ id }: { id: string }) => {
    const s = stores.find((x) => x.id === id)!;
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
        <Warehouse className="size-4 text-accent-foreground" />
        <span className="num text-xs text-muted-foreground">{s.code}</span>
        <span className="flex-1 font-medium">{s.name}</span>
        <span className="rounded bg-muted px-1.5 text-[10px]">ك</span>
        <button className="rounded p-1 hover:bg-muted" onClick={() => setE({ kind: "store", id: s.id, branchId: s.branchId, name: s.name, code: s.code })}><Pencil className="size-3.5" /></button>
        <button className="rounded p-1 text-destructive hover:bg-muted" onClick={() => delStore(s.id)}><Trash2 className="size-3.5" /></button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="panel flex items-center gap-3 p-4">
        <Building2 className="size-8 text-primary" />
        <div className="flex-1"><div className="text-xs text-muted-foreground">{company} · L1</div><div className="text-lg font-bold">{settings.companyName}</div></div>
        <button className="btn" onClick={() => newStore(null)}><Plus className="size-4" />{ar ? "مخزن مباشر" : "Direct store"}</button>
        <button className="btn btn-primary" onClick={() => setE({ kind: "branch", branchId: null, name: "", code: nextCode("BR", branches.map((b) => b.code)) })}><Plus className="size-4" />{branch}</button>
      </div>
      <div className="ms-6 space-y-2 border-s-2 border-border ps-4">
        <h3 className="text-sm font-bold text-muted-foreground">{t("directStores")}</h3>
        {stores.filter((s) => !s.branchId).map((s) => <StoreRow key={s.id} id={s.id} />)}
      </div>
      {branches.map((b) => (
        <div key={b.id} className="ms-6 border-s-2 border-primary/40 ps-4">
          <div className="panel p-3">
            <div className="mb-2 flex items-center gap-2">
              <GitBranch className="size-5 text-primary" />
              <span className="num text-xs text-muted-foreground">{b.code}</span>
              <span className="flex-1 font-bold">{branch}: {b.name} <span className="rounded bg-primary/10 px-1.5 text-[10px] text-primary">ل</span></span>
              <button className="btn py-1" onClick={() => newStore(b.id)}><Plus className="size-3.5" />{ar ? "مخزن" : "Store"}</button>
              <button className="rounded p-1 hover:bg-muted" onClick={() => setE({ kind: "branch", id: b.id, branchId: null, name: b.name, code: b.code })}><Pencil className="size-3.5" /></button>
              <button className="rounded p-1 text-destructive hover:bg-muted" onClick={() => delBranch(b.id)}><Trash2 className="size-3.5" /></button>
            </div>
            <div className="space-y-1.5">{stores.filter((s) => s.branchId === b.id).map((s) => <StoreRow key={s.id} id={s.id} />)}</div>
          </div>
        </div>
      ))}
      <Modal open={!!e} onClose={() => setE(null)} title={e?.kind === "branch" ? branch : ar ? "مخزن فعلي (ك)" : "Physical store"}>
        {e && (
          <div className="grid gap-3">
            <Field label={t("code")}><input className="field num" value={e.code} onChange={(x) => setE({ ...e, code: x.target.value })} /></Field>
            <Field label={t("name")}><input autoFocus className="field" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setE(null)}>{t("cancel")}</button><button className="btn btn-primary" onClick={save}>{t("save")}</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
