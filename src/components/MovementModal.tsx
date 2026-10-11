import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp, uid, itemBalances, type MoveType, type Attachment } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Modal, Field, readFileAsDataURL } from "./kit";

export function MovementModal({ open, onClose, presetItemId }: { open: boolean; onClose: () => void; presetItemId?: string }) {
  const { t, company, branch, lang } = useT();
  const { branches, stores, items, movements } = useApp((s) => s.data);
  const commit = useApp((s) => s.commit);
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<string>("company"); // "company" or branchId
  const [f, setF] = useState({ itemId: presetItemId ?? "", type: "in" as MoveType, from: "", to: "", qty: 1, invoice: "", recipient: "", phone: "", executor: "", price: 0, notes: "" });
  const [att, setAtt] = useState<Attachment | null>(null);
  const [err, setErr] = useState("");

  const levelStores = useMemo(() => stores.filter((s) => (level === "company" ? s.branchId === null : s.branchId === level)), [stores, level]);
  const storeLabel = (id: string) => {
    const s = stores.find((x) => x.id === id);
    if (!s) return "";
    const b = branches.find((x) => x.id === s.branchId);
    return b ? `${b.name} / ${s.name}` : `${company} / ${s.name}`;
  };

  const reset = () => { setStep(1); setErr(""); setAtt(null); setF((p) => ({ ...p, qty: 1, invoice: "", recipient: "", phone: "", notes: "", price: 0, from: "", to: "" })); };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    setErr("");
    const item = items.find((i) => i.id === f.itemId);
    if (!item) return setErr(lang === "ar" ? "اختر الصنف" : "Select an item");
    if (!(f.qty > 0)) return setErr(lang === "ar" ? "كمية غير صالحة" : "Invalid quantity");
    if ((f.type === "out" || f.type === "transfer") && !f.from) return setErr(t("fromStore"));
    if ((f.type === "in" || f.type === "transfer") && !f.to) return setErr(t("toStore"));
    if (f.type === "transfer" && f.from === f.to) return setErr(lang === "ar" ? "لا يمكن التحويل لنفس المخزن" : "Same store");
    if (f.from) {
      const bal = itemBalances(item, stores, movements).storeEnd[f.from] ?? 0;
      if (bal < f.qty) return setErr((lang === "ar" ? "الرصيد غير كافٍ. المتاح: " : "Insufficient balance. Available: ") + bal);
    }
    commit((d) => {
      d.movements.unshift({
        id: uid(), date: new Date().toISOString(), type: f.type, itemId: f.itemId,
        fromStoreId: f.type === "in" ? null : f.from, toStoreId: f.type === "out" ? null : f.to,
        qty: f.qty, invoice: f.invoice, recipient: f.recipient, phone: f.phone, executor: f.executor,
        price: f.price, notes: f.notes, attachment: att, status: f.type === "transfer" ? "pending" : "done",
      });
      return d;
    });
    toast.success(f.type === "transfer" ? (lang === "ar" ? "تم إرسال التحويل بانتظار تأكيد الاستلام" : "Transfer sent, awaiting receipt") : (lang === "ar" ? "تم تنفيذ الحركة" : "Movement executed"));
    close();
  };

  return (
    <Modal open={open} onClose={close} title={`${t("newMove")} · ${step}/2`} wide>
      {step === 1 ? (
        <div className="grid gap-3">
          <p className="label-sm">{t("level")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setLevel("company")} className={`rounded-lg border p-3 text-start ${level === "company" ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="font-semibold">{company} — {t("directStores")}</div>
              <div className="text-xs text-muted-foreground">{stores.filter((s) => !s.branchId).length} {t("stores")}</div>
            </button>
            {branches.map((b) => (
              <button key={b.id} onClick={() => setLevel(b.id)} className={`rounded-lg border p-3 text-start ${level === b.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="font-semibold">{branch}: {b.name}</div>
                <div className="text-xs text-muted-foreground">{stores.filter((s) => s.branchId === b.id).length} {t("stores")}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end"><button className="btn btn-primary" disabled={!levelStores.length} onClick={() => setStep(2)}>{t("next")}</button></div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("itemName")}>
            <select className="field" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}>
              <option value="">—</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}
            </select>
          </Field>
          <Field label={t("type")}>
            <div className="grid grid-cols-3 gap-1">
              {(["in", "out", "transfer"] as const).map((ty) => (
                <button key={ty} type="button" onClick={() => setF({ ...f, type: ty })} className={`btn ${f.type === ty ? "btn-primary" : ""}`}>{t(ty === "in" ? "stockIn" : ty === "out" ? "stockOut" : "transfer")}</button>
              ))}
            </div>
          </Field>
          {f.type !== "in" && (
            <Field label={t("fromStore")}>
              <select className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
                <option value="">—</option>
                {levelStores.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </select>
            </Field>
          )}
          {f.type !== "out" && (
            <Field label={t("toStore")}>
              <select className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
                <option value="">—</option>
                {(f.type === "transfer" ? stores : levelStores).map((s) => <option key={s.id} value={s.id}>{storeLabel(s.id)}</option>)}
              </select>
            </Field>
          )}
          <Field label={t("qty")}><input type="number" min={1} className="field num" value={f.qty} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
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
                if (file.size > 3_000_000) { toast.error(lang === "ar" ? "الحد الأقصى 3 ميجا" : "Max 3MB"); return; }
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
