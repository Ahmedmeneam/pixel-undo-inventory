import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp, uid, nextCode, type Store } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Field } from "@/components/kit";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "استيراد Excel — إدارة المخازن الهرمية" },
      { name: "description", content: "Import items, opening balances and stores from .xlsx / .xlsm files." },
      { property: "og:title", content: "استيراد Excel — إدارة المخازن الهرمية" },
      { property: "og:description", content: "Import items and balances from Excel." },
    ],
  }),
  component: ImportPage,
});

type Grid = (string | number | null)[][];

function ImportPage() {
  const { t, company, lang } = useT();
  const ar = lang === "ar";
  const branches = useApp((s) => s.data.branches);
  const commit = useApp((s) => s.commit);
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [sheets, setSheets] = useState<Record<string, Grid>>({});
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState({ name: -1, sku: -1, initial: -1 });
  const [storeCols, setStoreCols] = useState<Record<number, string>>({}); // colIndex -> "__direct" | branchId

  const grid = sheets[sheet] ?? [];
  const headers = (grid[headerRow] ?? []).map((h, i) => String(h ?? `Col ${i + 1}`));
  const body = grid.slice(headerRow + 1);

  const onFile = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const out: Record<string, Grid> = {};
    wb.SheetNames.forEach((n) => (out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null }) as Grid));
    setSheets(out);
    setSheet(wb.SheetNames[0]);
    setStep(2);
  };

  const run = () => {
    if (map.name < 0) return toast.error(ar ? "حدد عمود اسم الصنف" : "Map the item name column");
    let created = 0;
    commit((d) => {
      const colStore: Record<number, Store> = {};
      for (const [col, target] of Object.entries(storeCols)) {
        const branchId = target === "__direct" ? null : target;
        const name = headers[+col].trim();
        let s = d.stores.find((x) => x.branchId === branchId && x.name.trim().toLowerCase() === name.toLowerCase());
        if (!s) { s = { id: uid(), code: nextCode("ST", d.stores.map((x) => x.code)), name, branchId }; d.stores.push(s); }
        colStore[+col] = s;
      }
      for (const row of body) {
        const name = String(row[map.name] ?? "").trim();
        if (!name) continue;
        const sku = map.sku >= 0 && row[map.sku] != null ? String(row[map.sku]) : "";
        let item = d.items.find((i) => (sku && i.sku === sku) || i.name === name);
        if (!item) {
          item = { id: uid(), sku: sku || nextCode("IT", d.items.map((i) => i.sku)), name, unit: ar ? "قطعة" : "pcs", minStock: 0, bookInitial: 0, initial: {} };
          d.items.push(item);
          created++;
        }
        if (map.initial >= 0) item.bookInitial = Number(row[map.initial]) || 0;
        for (const [col, s] of Object.entries(colStore)) item.initial[s.id] = Number(row[+col]) || 0;
      }
      return d;
    });
    toast.success(ar ? `تم الاستيراد: ${created} صنف جديد` : `Imported: ${created} new items`);
    nav({ to: "/" });
  };

  const colSelect = (k: keyof typeof map) => (
    <select className="field" value={map[k]} onChange={(e) => setMap({ ...map, [k]: +e.target.value })}>
      <option value={-1}>—</option>
      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
    </select>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold">{t("import")} <span className="text-sm font-normal text-muted-foreground">· {step}/3</span></h1>
      {step === 1 && (
        <label className="panel flex cursor-pointer flex-col items-center gap-3 border-dashed p-12 text-center hover:bg-muted/40">
          <Upload className="size-10 text-primary" />
          <span className="font-semibold">{ar ? "اختر ملف Excel (.xlsx / .xlsm / .xls)" : "Choose an Excel file (.xlsx / .xlsm / .xls)"}</span>
          <input type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      )}
      {step === 2 && (
        <>
          <div className="panel grid gap-3 p-4 sm:grid-cols-5">
            <Field label={ar ? "الورقة" : "Sheet"}><select className="field" value={sheet} onChange={(e) => setSheet(e.target.value)}>{Object.keys(sheets).map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label={ar ? "صف العناوين" : "Header row"}><input type="number" min={1} className="field num" value={headerRow + 1} onChange={(e) => setHeaderRow(Math.max(0, +e.target.value - 1))} /></Field>
            <Field label={t("itemName")}>{colSelect("name")}</Field>
            <Field label={t("sku")}>{colSelect("sku")}</Field>
            <Field label={`${company} · ${t("initial")}`}>{colSelect("initial")}</Field>
          </div>
          <div className="panel overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="bg-secondary">
                  {headers.map((h, i) => (
                    <th key={i} className="min-w-32 border-e border-border p-2 text-start align-top">
                      <div className="mb-1 font-bold">{h}</div>
                      <select className="field py-1 text-xs" value={storeCols[i] ?? ""} onChange={(e) => { const v = e.target.value; const n = { ...storeCols }; if (v) n[i] = v; else delete n[i]; setStoreCols(n); }}>
                        <option value="">{ar ? "ليس مخزناً" : "Not a store"}</option>
                        <option value="__direct">{ar ? "مخزن مباشر" : "Direct store"}</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{body.slice(0, 5).map((r, ri) => <tr key={ri} className="border-t border-border">{headers.map((_, i) => <td key={i} className="border-e border-border p-2">{String(r[i] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between"><button className="btn" onClick={() => setStep(1)}>{t("back")}</button><button className="btn btn-primary" onClick={() => setStep(3)}>{t("next")}</button></div>
        </>
      )}
      {step === 3 && (
        <div className="panel space-y-3 p-5 text-sm">
          <p>{ar ? "عدد الصفوف" : "Rows"}: <b className="num">{body.filter((r) => r[map.name] != null && String(r[map.name]).trim()).length}</b></p>
          <p>{ar ? "أعمدة المخازن" : "Store columns"}: <b>{Object.keys(storeCols).map((c) => headers[+c]).join("، ") || "—"}</b></p>
          <div className="flex justify-between"><button className="btn" onClick={() => setStep(2)}>{t("back")}</button><button className="btn btn-primary" onClick={run}>{t("execute")}</button></div>
        </div>
      )}
    </div>
  );
}
