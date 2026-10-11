import { type ReactNode, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Boxes, LayoutDashboard, Package, Network, ScrollText, FileSpreadsheet, Settings, Menu, Moon, Sun, Undo2, Redo2, Languages, Plus, Lock } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { SetupWizard, LockScreen } from "./Onboarding";
import { MovementModal } from "./MovementModal";

export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const ui = useApp((s) => s.ui);
  const settings = useApp((s) => s.data.settings);
  const unlocked = useApp((s) => s.unlocked);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dir = ui.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = ui.lang;
    document.documentElement.classList.toggle("dark", ui.theme === "dark");
  }, [mounted, ui.lang, ui.theme]);

  if (!mounted) return <div className="min-h-screen bg-background" />;
  if (!settings.setupDone) return <SetupWizard />;
  if (settings.pin && !unlocked) return <LockScreen />;
  return <Chrome>{children}</Chrome>;
}

function Chrome({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const { ui, setUI, undo, redo, past, future, setUnlocked } = useApp();
  const s = useApp((st) => st.data.settings);

  const nav = [
    { to: "/", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/items", icon: Package, label: t("items") },
    { to: "/hierarchy", icon: Network, label: t("hierarchy") },
    { to: "/log", icon: ScrollText, label: t("log") },
    { to: "/import", icon: FileSpreadsheet, label: t("import") },
    { to: "/settings", icon: Settings, label: t("settings") },
  ] as const;

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`no-print fixed inset-y-0 start-0 z-40 flex flex-col border-e border-border bg-sidebar transition-all lg:sticky lg:top-0 lg:h-screen ${collapsed ? "lg:w-16" : "lg:w-60"} ${open ? "w-60" : "w-0 overflow-hidden lg:overflow-visible"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Boxes className="size-6 shrink-0 text-primary" />
          {!collapsed && <span className="truncate text-sm font-bold">{t("appName")}</span>}
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-primary/10 !text-primary" }}>
              <n.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2 text-xs text-muted-foreground">
          {!collapsed && <div className="px-3 py-1">FY <span className="num">{s.fiscalYear}</span> · {s.currency}</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur">
          <button className="btn px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu className="size-4" /></button>
          <button className="btn hidden px-2 lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="collapse"><Menu className="size-4" /></button>
          {s.logo && <img src={s.logo} alt="" className="size-8 rounded object-contain" />}
          <div className="min-w-0 truncate font-bold">{s.companyName}</div>
          <div className="ms-auto flex items-center gap-1.5">
            <button className="btn px-2" onClick={undo} disabled={!past.length} title="Undo"><Undo2 className="size-4 rtl:-scale-x-100" /></button>
            <button className="btn px-2" onClick={redo} disabled={!future.length} title="Redo"><Redo2 className="size-4 rtl:-scale-x-100" /></button>
            <button className="btn px-2" onClick={() => setUI({ lang: ui.lang === "ar" ? "en" : "ar" })} title="Language"><Languages className="size-4" /><span className="hidden sm:inline">{ui.lang === "ar" ? "EN" : "ع"}</span></button>
            <button className="btn px-2" onClick={() => setUI({ theme: ui.theme === "dark" ? "light" : "dark" })} title="Theme">{ui.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
            {s.pin && <button className="btn px-2" onClick={() => setUnlocked(false)} title="Lock"><Lock className="size-4" /></button>}
            <button className="btn btn-accent" onClick={() => setMoveOpen(true)}><Plus className="size-4" /><span className="hidden sm:inline">{t("newMove")}</span></button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
      <MovementModal open={moveOpen} onClose={() => setMoveOpen(false)} />
    </div>
  );
}
