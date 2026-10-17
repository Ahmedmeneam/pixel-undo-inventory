import { useApp, itemBalances, aggregatedBalance, allDescendants, type Movement, type Unit } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Drawer, Modal, DiffBadge, downloadBlob } from "./kit";

export function useUnitName() {
  const { units } = useApp((s) => s.data);
  const { t, division, brigade, battalion, company } = useT();
  return (id: string | null) => {
    if (!id) return "—";
    const u = units.find((x) => x.id === id);
    if (!u) return "?";
    const levelLabel = u.level === "division" ? division : u.level === "brigade" ? brigade : u.level === "battalion" ? battalion : company;
    return `${levelLabel}: ${u.name}`;
  };
}

export function TypeChip({ m }: { m: Movement }) {
  const { t } = useT();
  const cls = m.type === "add" ? "bg-success/15 text-success" : m.type === "issue" ? "bg-destructive/15 text-destructive" : m.type === "deduct" ? "bg-destructive/15 text-destructive" : m.type === "return" ? "bg-success/15 text-success" : "bg-info/15 text-info";
  const label = m.type === "issue" ? t("issue") : m.type === "add" ? t("addStock") : m.type === "return" ? t("returnOp") : m.type === "deduct" ? t("deductOp") : t("reallocate");
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function VoucherModal({ m, onClose }: { m: Movement | null; onClose: () => void }) {
  const { t, lang } = useT();
  const { items, units, departments, settings, users } = useApp((s) => s.data);
  const un = useUnitName();
  if (!m) return null;
  const ar = lang === "ar";
  const item = items.find((i) => i.id === m.itemId);
  const dept = departments.find((d) => d.id === m.departmentId);
  const user = users.find((u) => u.id === m.userId);

  const typeLabel = m.type === "issue" ? t("issue") : m.type === "add" ? t("addStock") : m.type === "return" ? t("returnOp") : m.type === "deduct" ? t("deductOp") : t("reallocate");

  const printVoucher = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `
      <!DOCTYPE html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8">
      <title>${t("voucherNo")}: ${m.voucherNo}</title>
      <style>
        body { font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; padding: 24px; color: #1a1a1a; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin:0; font-size:20px; }
        .header h2 { margin:0; font-size:16px; color:#555; }
        .voucher-info { text-align:${ar ? "left" : "right"}; }
        .voucher-info .no { font-size:18px; font-weight:bold; }
        .info-grid { display:grid; grid-template-columns: 1fr 1fr; gap:8px 24px; margin-bottom:20px; }
        .info-item { display:flex; justify-content:space-between; border-bottom:1px solid #ddd; padding:6px 0; font-size:14px; }
        .info-item .label { color:#666; }
        .info-item .value { font-weight:600; }
        .total { text-align:${ar ? "left" : "right"}; font-size:20px; font-weight:bold; margin:16px 0; }
        .signatures { display:grid; grid-template-columns:1fr 1fr 1fr; gap:40px; margin-top:60px; }
        .sig-box { text-align:center; }
        .sig-box .line { border-top:1px solid #333; padding-top:4px; font-size:12px; color:#666; }
        .footer { margin-top:20px; font-size:11px; color:#999; text-align:center; }
      </style></head><body>
      <div class="header">
        <div>
          <h1>${ar ? settings.orgName : settings.orgNameEn || settings.orgName}</h1>
          <h2>${ar ? dept?.name : dept?.nameEn || ""} — ${typeLabel}</h2>
        </div>
        <div class="voucher-info">
          <div class="no">${m.voucherNo}</div>
          <div>${new Date(m.date).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="label">${t("itemName")}</span><span class="value">${item ? (ar ? item.name : item.nameEn) : "—"}</span></div>
        <div class="info-item"><span class="label">${t("sku")}</span><span class="value">${item?.sku || "—"}</span></div>
        <div class="info-item"><span class="label">${t("qty")}</span><span class="value">${m.qty} ${item?.unit || ""}</span></div>
        <div class="info-item"><span class="label">${t("type")}</span><span class="value">${typeLabel}</span></div>
        <div class="info-item"><span class="label">${t("fromStore")}</span><span class="value">${un(m.fromUnitId)}</span></div>
        <div class="info-item"><span class="label">${t("toStore")}</span><span class="value">${un(m.toUnitId)}</span></div>
        <div class="info-item"><span class="label">${t("invoice")}</span><span class="value">${m.invoice || "—"}</span></div>
        <div class="info-item"><span class="label">${t("recipient")}</span><span class="value">${m.recipient || "—"}</span></div>
        <div class="info-item"><span class="label">${t("executor")}</span><span class="value">${m.executor || "—"}</span></div>
        <div class="info-item"><span class="label">${t("status")}</span><span class="value">${m.status === "pending" ? t("pending") : t("done")}</span></div>
      </div>
      ${m.notes ? `<p style="font-size:14px; margin:12px 0;"><b>${t("notes")}:</b> ${m.notes}</p>` : ""}
      <div class="signatures">
        <div class="sig-box"><div style="height:50px;"></div><div class="line">${ar ? "أمين العُهدة" : "Storekeeper"}</div></div>
        <div class="sig-box"><div style="height:50px;"></div><div class="line">${ar ? "رئيس القسم" : "Dept Head"}</div></div>
        <div class="sig-box"><div style="height:50px;"></div><div class="line">${ar ? "المستلم" : "Recipient"}</div></div>
      </div>
      <div class="footer">${new Date().toLocaleString(ar ? "ar-EG" : "en-GB")}</div>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const rows: [string, React.ReactNode][] = [
    [t("voucherNo"), <span className="num font-bold" key="v">{m.voucherNo}</span>],
    [t("date"), new Date(m.date).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")],
    [t("type"), <TypeChip m={m} key="t" />],
    [t("status"), m.status === "pending" ? t("pending") : t("done")],
    [t("itemName"), `${item?.sku ?? ""} · ${item ? (ar ? item.name : item.nameEn) : "?"}`],
    [t("qty"), <span className="num" key="q">{m.qty} {item?.unit || ""}</span>],
    [t("fromStore"), un(m.fromUnitId)],
    [t("toStore"), un(m.toUnitId)],
    [t("invoice"), m.invoice || "—"],
    [t("recipient"), m.recipient || "—"],
    [t("phone"), <span className="num" key="p">{m.phone || "—"}</span>],
    [t("executor"), m.executor || "—"],
    [t("price"), <span className="num" key="pr">{m.price} {settings.currency} · {ar ? "الإجمالي" : "Total"}: {m.price * m.qty}</span>],
    [t("notes"), m.notes || "—"],
  ];

  return (
    <Modal open onClose={onClose} title={`${t("details")} · ${m.voucherNo}`} wide>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k as string} className="flex justify-between gap-3 border-b border-border py-1.5">
            <dt className="text-muted-foreground">{k}</dt><dd className="text-end font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {m.attachment && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-sm">{m.attachment.name}</span>
            <a className="btn" href={m.attachment.data} download={m.attachment.name}>{t("download")}</a>
          </div>
          {m.attachment.type.startsWith("image/") ? (
            <img src={m.attachment.data} alt="" className="max-h-96 w-full rounded border border-border object-contain" />
          ) : (
            <iframe src={m.attachment.data} title="attachment" className="h-96 w-full rounded border border-border" />
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2 no-print">
        <button className="btn" onClick={() => window.print()}>{t("print")}</button>
        <button className="btn btn-primary" onClick={printVoucher}>{t("printVoucher")}</button>
      </div>
    </Modal>
  );
}

export function ItemDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const { t, division, brigade, lang } = useT();
  const { items, units, departments, categories, movements } = useApp((s) => s.data);
  const un = useUnitName();
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  const b = itemBalances(item, units, movements);
  const dept = departments.find((d) => d.id === item.departmentId);
  const cat = categories.find((c) => c.id === item.categoryId);
  const moves = movements.filter((m) => m.itemId === item.id);
  const ar = lang === "ar";

  // Build unit hierarchy groups
  const divisions = units.filter((u) => u.level === "division");

  return (
    <Drawer open onClose={onClose} title={ar ? item.name : item.nameEn}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="num rounded bg-muted px-2 py-0.5">{item.sku}</span>
        <span className="text-muted-foreground">{item.unit}</span>
        {dept && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{ar ? dept.name : dept.nameEn}</span>}
        {cat && <span className="rounded bg-accent/10 px-2 py-0.5 text-xs">{ar ? cat.name : cat.nameEn}</span>}
        <DiffBadge diff={b.diff} labels={{ matched: t("matched"), shortage: t("shortage"), excess: t("excess") }} />
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[[t("bookInitial"), b.bookInit], [t("ending"), b.bookEnd], [ar ? "مجموع الوحدات" : "Units sum", b.unitsSum]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="num text-xl font-bold">{v}</div></div>
        ))}
      </div>
      {b.pendingOut > 0 && <p className="mb-4 rounded bg-warning/20 px-3 py-2 text-sm">{t("inTransit")}: <span className="num font-bold">{b.pendingOut}</span></p>}

      {divisions.map((div) => {
        const descendants = allDescendants(units, div.id);
        const divisionUnits = [div, ...descendants];
        return (
          <div key={div.id} className="mb-3">
            <h3 className="mb-1 text-sm font-bold text-primary">{division}: {div.name}</h3>
            <table className="w-full text-sm">
              <tbody>
                {divisionUnits.map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="py-1.5" style={{ paddingInlineStart: `${(u.level === "division" ? 0 : u.level === "brigade" ? 1 : u.level === "battalion" ? 2 : 3) * 12}px` }}>
                      <span className="text-xs text-muted-foreground">{"·".repeat(u.level === "division" ? 0 : u.level === "brigade" ? 1 : u.level === "battalion" ? 2 : 3)}</span>{" "}
                      {u.name}
                    </td>
                    <td className="num text-muted-foreground text-end">{b.unitInit[u.id]}</td>
                    <td className={`num text-end font-bold ${b.unitEnd[u.id] < item.minStock ? "text-warning" : ""}`}>{b.unitEnd[u.id]}</td>
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
            <div className="flex items-center gap-2">
              <TypeChip m={m} />
              <span className="num text-muted-foreground">{m.voucherNo}</span>
              <span>{un(m.fromUnitId)} → {un(m.toUnitId)}</span>
            </div>
            <span className="num font-bold">{m.qty}</span>
          </div>
        ))}
        {!moves.length && <p className="text-xs text-muted-foreground">{t("noData")}</p>}
      </div>
    </Drawer>
  );
}
