import { useApp, itemBalances, type Movement } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Drawer, Modal, DiffBadge } from "./kit";
import { Download } from "lucide-react";

export function useStoreName() {
  const { stores, branches } = useApp((s) => s.data);
  const { company } = useT();
  return (id: string | null) => {
    if (!id) return "—";
    const s = stores.find((x) => x.id === id);
    if (!s) return "?";
    const b = branches.find((x) => x.id === s.branchId);
    return `${b ? b.name : company} / ${s.name}`;
  };
}

export function TypeChip({ m }: { m: Movement }) {
  const { t } = useT();
  const cls = m.type === "in" ? "bg-success/15 text-success" : m.type === "out" ? "bg-destructive/15 text-destructive" : "bg-info/15 text-info";
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{t(m.type === "in" ? "stockIn" : m.type === "out" ? "stockOut" : "transfer")}</span>;
}

export function ReceiptModal({ m, onClose }: { m: Movement | null; onClose: () => void }) {
  const { t, lang } = useT();
  const items = useApp((s) => s.data.items);
  const currency = useApp((s) => s.data.settings.currency);
  const sn = useStoreName();
  if (!m) return null;
  const item = items.find((i) => i.id === m.itemId);
  const rows: [string, React.ReactNode][] = [
    [t("date"), new Date(m.date).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")],
    [t("type"), <TypeChip m={m} key="t" />],
    [t("status"), m.status === "pending" ? t("pending") : t("done")],
    [t("itemName"), `${item?.sku ?? ""} · ${item?.name ?? "?"}`],
    [t("qty"), <span className="num" key="q">{m.qty}</span>],
    [t("fromStore"), sn(m.fromStoreId)],
    [t("toStore"), sn(m.toStoreId)],
    [t("invoice"), m.invoice || "—"],
    [t("recipient"), m.recipient || "—"],
    [t("phone"), <span className="num" key="p">{m.phone || "—"}</span>],
    [t("executor"), m.executor || "—"],
    [t("price"), <span className="num" key="pr">{m.price} {currency} · {lang === "ar" ? "الإجمالي" : "Total"}: {m.price * m.qty}</span>],
    [t("notes"), m.notes || "—"],
  ];
  return (
    <Modal open onClose={onClose} title={`${t("details")} · ${m.invoice || m.id}`} wide>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5">
            <dt className="text-muted-foreground">{k}</dt><dd className="text-end font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {m.attachment && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-sm">{m.attachment.name}</span>
            <a className="btn" href={m.attachment.data} download={m.attachment.name}><Download className="size-4" />{t("download")}</a>
          </div>
          {m.attachment.type.startsWith("image/") ? (
            <img src={m.attachment.data} alt="" className="max-h-96 w-full rounded border border-border object-contain" />
          ) : (
            <iframe src={m.attachment.data} title="attachment" className="h-96 w-full rounded border border-border" />
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end no-print"><button className="btn" onClick={() => window.print()}>{t("print")}</button></div>
    </Modal>
  );
}

export function ItemDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const { t, company, lang } = useT();
  const { items, stores, branches, movements } = useApp((s) => s.data);
  const sn = useStoreName();
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  const b = itemBalances(item, stores, movements);
  const moves = movements.filter((m) => m.itemId === item.id);
  const groups = [{ id: null as string | null, name: `${company} — ${t("directStores")}` }, ...branches.map((x) => ({ id: x.id as string | null, name: x.name }))];
  return (
    <Drawer open onClose={onClose} title={`${item.name}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="num rounded bg-muted px-2 py-0.5">{item.sku}</span>
        <span className="text-muted-foreground">{item.unit}</span>
        <DiffBadge diff={b.diff} labels={{ matched: t("matched"), shortage: t("shortage"), excess: t("excess") }} />
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[[t("bookInitial"), b.bookInit], [`${company} · ${t("ending")}`, b.bookEnd], [lang === "ar" ? "مجموع المخازن" : "Stores sum", b.storesSum]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="num text-xl font-bold">{v}</div></div>
        ))}
      </div>
      {b.pendingOut > 0 && <p className="mb-4 rounded bg-warning/20 px-3 py-2 text-sm">{t("inTransit")}: <span className="num font-bold">{b.pendingOut}</span></p>}
      {groups.map((g) => {
        const ss = stores.filter((s) => s.branchId === g.id);
        if (!ss.length) return null;
        return (
          <div key={String(g.id)} className="mb-3">
            <h3 className="mb-1 text-sm font-bold text-primary">{g.name}</h3>
            <table className="w-full text-sm">
              <tbody>
                {ss.map((s) => (
                  <tr key={s.id} className="border-b border-border">
                    <td className="py-1.5">{s.name}</td>
                    <td className="num text-muted-foreground">{b.storeInit[s.id]}</td>
                    <td className={`num text-end font-bold ${b.storeEnd[s.id] < item.minStock ? "text-warning" : ""}`}>{b.storeEnd[s.id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <h3 className="mb-2 mt-5 text-sm font-bold">{t("movements")} ({moves.length})</h3>
      <div className="space-y-2">
        {moves.slice(0, 50).map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
            <div className="flex items-center gap-2"><TypeChip m={m} /><span>{sn(m.fromStoreId)} → {sn(m.toStoreId)}</span></div>
            <span className="num font-bold">{m.qty}</span>
          </div>
        ))}
        {!moves.length && <p className="text-xs text-muted-foreground">{t("noData")}</p>}
      </div>
    </Drawer>
  );
}
