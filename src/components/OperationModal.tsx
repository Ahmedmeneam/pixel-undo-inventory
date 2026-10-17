import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp, uid, itemBalances, nextVoucherNo, type MoveType, type Attachment, type Unit } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field, readFileAsDataURL } from "./kit";

export function OperationModal({ open, onClose, presetItemId }: { open: boolean; onClose: () => void; presetItemId?: string }) {
  const { t, lang, division, brigade, battalion, company } = useT();
  const { units, departments, categories, items, movements, users, permissions } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const logAction = useApp((s) => s.logAction);
  const currentUserId = useApp((s) => s.currentUserId);
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    itemId: presetItemId ?? "",
    type: "issue" as MoveType,
    from: "",
    to: "",
    qty: 1,
    invoice: "",
    recipient: "",
    phone: "",
    executor: "",
    price: 0,
    notes: "",
  });
  const [att, setAtt] = useState<Attachment | null>(null);
  const [err, setErr] = useState("");

  const currentUser = users.find((u) => u.id === currentUserId);
  const userPerms = currentUserId ? permissions[currentUserId] : null;
  const ar = lang === "ar";

  const levelLabel = (level: string) =>
    level === "division" ? division : level === "brigade" ? brigade : level === "battalion" ? battalion : company;

  const unitFullName = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (!u) return "—";
    const parts: string[] = [];
    let cur: Unit | undefined = u;
    while (cur) {
      parts.unshift(cur.name);
      cur = units.find((x) => x.id === cur!.parentId);
    }
    return parts.join(" / ");
  };

  const reset = () => { setStep(1); setErr(""); setAtt(null); setF((p) => ({ ...p, qty: 1, invoice: "", recipient: "", phone: "", notes: "", price: 0, from: "", to: "" })); };
  const close = () => { reset(); onClose(); };

  // Filter items by department for dept_head and storekeeper
  const availableItems = useMemo(() => {
    if (!currentUser) return items;
    if (currentUser.role === "super_admin") return items;
    return items.filter((i) => i.departmentId === currentUser.departmentId);
  }, [items, currentUser]);

  // Filter units - storekeepers only see their unit and sub-units
  const availableUnits = useMemo(() => {
    if (!currentUser) return units;
    if (currentUser.role === "super_admin") return units;
    if (currentUser.role === "dept_head") return units;
    if (currentUser.unitId) {
      // storekeeper sees their unit and its sub-units and parent chain
      const result: Unit[] = [];
      let cur: Unit | undefined = units.find((x) => x.id === currentUser.unitId);
      while (cur) { result.push(cur); cur = units.find((x) => x.id === cur!.parentId); }
      const subs = (function collect(id: string): Unit[] {
        const children = units.filter((u) => u.parentId === id);
        return children.concat(...children.map((c) => collect(c.id)));
      })(currentUser.unitId);
      return [...new Set([...result, ...subs])];
    }
    return units;
  }, [units, currentUser]);

  const submit = () => {
    setErr("");
    const item = items.find((i) => i.id === f.itemId);
    if (!item) return setErr(ar ? "اختر الصنف" : "Select an item");
    if (!(f.qty > 0)) return setErr(ar ? "كمية غير صالحة" : "Invalid quantity");
    const needsFrom = f.type === "issue" || f.type === "deduct" || f.type === "reallocate" || f.type === "return";
    const needsTo = f.type === "add" || f.type === "reallocate" || f.type === "return";
    if (needsFrom && !f.from) return setErr(t("fromStore"));
    if (needsTo && !f.to) return setErr(t("toStore"));
    if (f.type === "reallocate" && f.from === f.to) return setErr(ar ? "لا يمكن التحويل لنفس الوحدة" : "Same unit");
    if (needsFrom) {
      const bal = itemBalances(item, units, movements).unitEnd[f.from] ?? 0;
      if (bal < f.qty) return setErr((ar ? "الرصيد غير كافٍ. المتاح: " : "Insufficient balance. Available: ") + bal);
    }

    const voucherNo = nextVoucherNo(f.type, movements);
    commit((d) => {
      d.movements.unshift({
        id: uid(),
        voucherNo,
        date: new Date().toISOString(),
        type: f.type,
        itemId: f.itemId,
        fromUnitId: needsFrom ? f.from : null,
        toUnitId: needsTo ? f.to : null,
        fromStoreId: null,
        toStoreId: null,
        qty: f.qty,
        invoice: f.invoice,
        recipient: f.recipient,
        phone: f.phone,
        executor: f.executor,
        price: f.price,
        notes: f.notes,
        attachment: att,
        status: f.type === "reallocate" ? "pending" : "done",
        userId: currentUserId ?? "",
        departmentId: item.departmentId,
      });
      return d;
    });
    logAction(
      `${f.type}`,
      `${ar ? "إيصال" : "Voucher"} ${voucherNo} · ${item.name} · ${f.qty} ${item.unit}`
    );
    toast.success(
      f.type === "reallocate"
        ? (ar ? "تم إرسال التحويل بانتظار تأكيد الاستلام" : "Reallocate sent, awaiting receipt")
        : (ar ? `تم تنفيذ العملية — رقم الإيصال: ${voucherNo}` : `Operation executed — Voucher: ${voucherNo}`)
    );
    close();
  };

  const typeOptions: { val: MoveType; label: string }[] = [
    { val: "issue", label: t("issue") },
    { val: "add", label: t("addStock") },
    { val: "return", label: t("returnOp") },
    { val: "deduct", label: t("deductOp") },
    { val: "reallocate", label: t("reallocate") },
  ];

  // Filter type options by permissions
  const allowedTypes = typeOptions.filter((o) => {
    if (!userPerms || currentUser?.role === "super_admin" || currentUser?.role === "dept_head") return true;
    if (o.val === "issue") return userPerms.canIssue;
    if (o.val === "return") return userPerms.canReturn;
    if (o.val === "reallocate") return userPerms.canTransfer;
    if (o.val === "add" || o.val === "deduct") return userPerms.canManualAdjust;
    return true;
  });

  return (
    <Modal open={open} onClose={close} title={`${t("newMove")} · ${step}/2`} wide>
      {step === 1 ? (
        <div className="grid gap-3">
          <Field label={t("type")}>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {allowedTypes.map((o) => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setF({ ...f, type: o.val })}
                  className={`btn ${f.type === o.val ? "btn-primary" : ""}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("itemName")}>
            <select className="field" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}>
              <option value="">—</option>
              {availableItems.map((i) => <option key={i.id} value={i.id}>{i.sku} · {ar ? i.name : i.nameEn}</option>)}
            </select>
          </Field>
          <div className="flex justify-end"><button className="btn btn-primary" disabled={!f.itemId} onClick={() => setStep(2)}>{t("next")}</button></div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("type")}>
            <span className="font-semibold">{allowedTypes.find((o) => o.val === f.type)?.label}</span>
          </Field>
          <Field label={t("qty")}><input type="number" min={1} className="field num" value={f.qty} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
          {(f.type === "issue" || f.type === "deduct" || f.type === "reallocate" || f.type === "return") && (
            <Field label={t("fromStore")}>
              <select className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
                <option value="">—</option>
                {availableUnits.map((u) => <option key={u.id} value={u.id}>{levelLabel(u.level)}: {u.name}</option>)}
              </select>
            </Field>
          )}
          {(f.type === "add" || f.type === "reallocate" || f.type === "return") && (
            <Field label={t("toStore")}>
              <select className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
                <option value="">—</option>
                {availableUnits.map((u) => <option key={u.id} value={u.id}>{levelLabel(u.level)}: {u.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={t("invoice")}><input className="field" value={f.invoice} onChange={(e) => setF({ ...f, invoice: e.target.value })} /></Field>
          <Field label={t("recipient")}><input className="field" value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} /></Field>
          <Field label={t("phone")}><input className="field num" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label={t("executor")}><input className="field" value={f.executor} onChange={(e) => setF({ ...f, executor: e.target.value })} /></Field>
          <Field label={t("price")}><input type="number" className="field num" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label={t("notes")}><textarea rows={2} className="field" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
          <div className="sm:col-span-2">
            <Field label={t("attachment")}>
              <input type="file" accept="application/pdf,image/*" className="field" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return setAtt(null);
                if (file.size > 3_000_000) { toast.error(ar ? "الحد الأقصى 3 ميجا" : "Max 3MB"); return; }
                setAtt({ name: file.name, type: file.type, data: await readFileAsDataURL(file) });
              }} />
            </Field>
          </div>
          {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="flex justify-between sm:col-span-2">
            <button className="btn" onClick={() => setStep(1)}>{t("back")}</button>
            <button className="btn btn-primary" onClick={submit}>{t("execute")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
