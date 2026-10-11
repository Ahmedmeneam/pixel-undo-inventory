import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`panel my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="rounded p-1 hover:bg-muted" onClick={onClose} aria-label="close"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex bg-foreground/40 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="ms-auto h-full w-full max-w-xl overflow-y-auto border-s border-border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="rounded p-1 hover:bg-muted" onClick={onClose} aria-label="close"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-sm">{label}</span>
      {children}
    </label>
  );
}

export function DiffBadge({ diff, labels }: { diff: number; labels: { matched: string; shortage: string; excess: string } }) {
  const cls = diff === 0 ? "bg-success/15 text-success" : diff < 0 ? "bg-destructive/15 text-destructive" : "bg-info/15 text-info";
  const dot = diff === 0 ? "bg-success" : diff < 0 ? "bg-destructive" : "bg-info";
  const txt = diff === 0 ? labels.matched : diff < 0 ? labels.shortage : labels.excess;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      <span className="num">{diff > 0 ? "+" : ""}{diff}</span>
      <span className="hidden sm:inline">{txt}</span>
    </span>
  );
}

export function readFileAsDataURL(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function downloadBlob(content: string | Blob, filename: string, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
