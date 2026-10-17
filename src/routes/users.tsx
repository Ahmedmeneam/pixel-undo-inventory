import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, useCurrentUser, defaultPermissions, type User, type Role, type Permissions } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field } from "@/components/kit";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون — نظام إدارة العُهد العسكرية" },
      { name: "description", content: "User management and storekeeper permissions." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { t, lang } = useT();
  const { users, departments, units, permissions } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const logAction = useApp((s) => s.logAction);
  const user = useCurrentUser();
  const ar = lang === "ar";
  const [edit, setEdit] = useState<User | null>(null);
  const [permsModal, setPermsModal] = useState<string | null>(null);

  const visibleUsers = user?.role === "super_admin"
    ? users
    : users.filter((u) => u.departmentId === user?.departmentId);

  const blank = (): User => ({
    id: "", name: "", rank: "", pin: "", role: "storekeeper" as Role,
    departmentId: user?.departmentId || departments[0]?.id || null,
    unitId: null, active: true,
  });

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error(t("name"));
    if (!edit.pin.trim()) return toast.error(t("pin"));
    if (users.some((u) => u.id !== edit.id && u.pin === edit.pin)) return toast.error(ar ? "الرقم السري مستخدم" : "PIN already used");
    commit((d) => {
      if (edit.id) d.users = d.users.map((u) => (u.id === edit.id ? edit : u));
      else { d.users.push({ ...edit, id: uid() }); d.permissions[uid()] = { ...defaultPermissions }; }
      return d;
    });
    logAction("user_save", `${edit.name}`);
    setEdit(null);
  };

  const del = (id: string) => {
    if (id === user?.id) return toast.error(ar ? "لا يمكن حذف حسابك" : "Cannot delete your own account");
    if (!confirm(ar ? "حذف المستخدم؟" : "Delete user?")) return;
    commit((d) => { d.users = d.users.filter((u) => u.id !== id); delete d.permissions[id]; return d; });
    logAction("user_delete", id);
  };

  const roleLabel = (r: Role) => r === "super_admin" ? t("superAdmin") : r === "dept_head" ? t("departmentHead") : t("storekeeper");

  const availableDepartments = user?.role === "super_admin" ? departments : departments.filter((d) => d.id === user?.departmentId);
  const availableUnits = units;

  // Permissions management
  const permsUser = users.find((u) => u.id === permsModal);
  const currentPerms = permsUser ? (permissions[permsUser.id] || { ...defaultPermissions }) : null;

  const togglePerm = (key: keyof Permissions) => {
    if (!permsModal || !currentPerms) return;
    commit((d) => {
      const p = d.permissions[permsModal] || { ...defaultPermissions };
      d.permissions[permsModal] = { ...p, [key]: !p[key] };
      return d;
    });
  };

  const permFields: { key: keyof Permissions; label: string }[] = [
    { key: "canIssue", label: t("canIssue") },
    { key: "canReturn", label: t("canReturn") },
    { key: "canTransfer", label: t("canTransfer") },
    { key: "canManualAdjust", label: t("canManualAdjust") },
    { key: "canViewHistory", label: t("canViewHistory") },
    { key: "canPrintVoucher", label: t("canPrintVoucher") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{t("users")}</h1>
        <button className="btn btn-primary ms-auto" onClick={() => setEdit(blank())}><Plus className="size-4" />{t("addUser")}</button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs">
            <tr>{[t("name"), t("rank"), t("role"), t("department"), t("store"), t("status"), ""].map((h, i) => <th key={i} className="px-3 py-2 text-start">{h}</th>)}</tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => {
              const dept = departments.find((d) => d.id === u.departmentId);
              const unit = units.find((un) => un.id === u.unitId);
              return (
                <tr key={u.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{u.name.charAt(0)}</div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 text-xs">{u.rank}</td>
                  <td className="px-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${u.role === "super_admin" ? "bg-primary/15 text-primary" : u.role === "dept_head" ? "bg-accent/15 text-accent-foreground" : "bg-muted"}`}>{roleLabel(u.role)}</span></td>
                  <td className="px-3 text-xs">{dept ? (ar ? dept.name : dept.nameEn) : "—"}</td>
                  <td className="px-3 text-xs">{unit?.name || "—"}</td>
                  <td className="px-3"><span className={`rounded px-2 py-0.5 text-xs ${u.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{u.active ? t("active") : t("inactive")}</span></td>
                  <td className="px-3 text-end whitespace-nowrap">
                    {u.role === "storekeeper" && (user?.role === "super_admin" || user?.role === "dept_head") && (
                      <button className="btn px-2 py-1 text-xs" onClick={() => setPermsModal(u.id)} title={t("permissions")}>
                        <Lock className="size-3" />{t("permissions")}
                      </button>
                    )}
                    <button className="btn px-2" onClick={() => setEdit(structuredClone(u))}><Pencil className="size-3.5" /></button>
                    {u.role !== "super_admin" && <button className="btn btn-danger px-2" onClick={() => del(u.id)}><Trash2 className="size-3.5" /></button>}
                  </td>
                </tr>
              );
            })}
            {!visibleUsers.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("noData")}</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("edit") : t("addUser")}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("name")}><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t("rank")}><input className="field" value={edit.rank} onChange={(e) => setEdit({ ...edit, rank: e.target.value })} /></Field>
            <Field label={t("role")}>
              <select className="field" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                {user?.role === "super_admin" && <option value="super_admin">{t("superAdmin")}</option>}
                <option value="dept_head">{t("departmentHead")}</option>
                <option value="storekeeper">{t("storekeeper")}</option>
              </select>
            </Field>
            <Field label={t("department")}>
              <select className="field" value={edit.departmentId ?? ""} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value || null })}>
                <option value="">—</option>
                {availableDepartments.map((d) => <option key={d.id} value={d.id}>{ar ? d.name : d.nameEn}</option>)}
              </select>
            </Field>
            <Field label={t("store")}>
              <select className="field" value={edit.unitId ?? ""} onChange={(e) => setEdit({ ...edit, unitId: e.target.value || null })}>
                <option value="">—</option>
                {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label={t("pin")}><input type="password" inputMode="numeric" className="field num" value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              {t("active")}
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2"><button className="btn" onClick={() => setEdit(null)}>{t("cancel")}</button><button className="btn btn-primary" onClick={save}>{t("save")}</button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!permsModal} onClose={() => setPermsModal(null)} title={`${t("permissions")} — ${permsUser?.name ?? ""}`}>
        {currentPerms && (
          <div className="grid gap-2">
            {permFields.map((p) => (
              <label key={p.key} className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <span className="text-sm font-medium">{p.label}</span>
                <input type="checkbox" checked={currentPerms[p.key]} onChange={() => togglePerm(p.key)} className="size-4" />
              </label>
            ))}
            <div className="mt-2 flex justify-end"><button className="btn btn-primary" onClick={() => { setPermsModal(null); toast.success(ar ? "تم حفظ الصلاحيات" : "Permissions saved"); }}>{t("save")}</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
