import { type ReactNode, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, LayoutDashboard, Package, Network, Archive, Settings, Menu, Moon, Sun, Undo2, Redo2, Languages, Plus, LogOut, FileText, Users } from "lucide-react";
import { useApp, useCurrentUser, type Role } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { SetupWizard, LockScreen } from "./Onboarding";
import { OperationModal } from "./OperationModal";

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

// Use FileText as icon for operations (lucide has no "Operations")
const OpsIconAlt = FileText;

function Chrome({ children }: { children: ReactNode }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const { ui, setUI, undo, redo, past, future, setUnlocked, setCurrentUser } = useApp();
  const s = useApp((st) => st.data.settings);
  const user = useCurrentUser();

  const role = user?.role ?? "storekeeper";

  const allNav = [
    { to: "/", icon: LayoutDashboard, label: t("dashboard"), roles: ["super_admin", "dept_head", "storekeeper"] as Role[] },
    { to: "/items", icon: Package, label: t("items"), roles: ["super_admin", "dept_head", "storekeeper"] as Role[] },
    { to: "/hierarchy", icon: Network, label: t("hierarchy"), roles: ["super_admin", "dept_head"] as Role[] },
    { to: "/operations", icon: OpsIconAlt, label: t("operations"), roles: ["super_admin", "dept_head", "storekeeper"] as Role[] },
    { to: "/archive", icon: Archive, label: t("archive"), roles: ["super_admin", "dept_head", "storekeeper"] as Role[] },
    { to: "/users", icon: Users, label: t("users"), roles: ["super_admin", "dept_head"] as Role[] },
    { to: "/settings", icon: Settings, label: t("settings"), roles: ["super_admin", "dept_head"] as Role[] },
  ] as const;

  const nav = allNav.filter((n) => n.roles.includes(role));

  const roleLabel = (r: Role) => r === "super_admin" ? t("superAdmin") : r === "dept_head" ? t("departmentHead") : t("storekeeper");

  const logout = () => {
    setCurrentUser(null);
    setUnlocked(false);
  };

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`no-print fixed inset-y-0 start-0 z-40 flex flex-col border-e border-border bg-sidebar transition-all lg:sticky lg:top-0 lg:h-screen ${collapsed ? "lg:w-16" : "lg:w-60"} ${open ? "w-60" : "w-0 overflow-hidden lg:overflow-visible"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Shield className="size-6 shrink-0 text-primary" />
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
        {!collapsed && user && (
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{user.name.charAt(0)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{user.rank} {user.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{roleLabel(role)}</div>
              </div>
            </div>
          </div>
        )}
        {!collapsed && (
          <div className="border-t border-sidebar-border p-2 text-xs text-muted-foreground">
            <div className="px-3 py-1">FY <span className="num">{s.fiscalYear}</span> · {s.currency}</div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur">
          <button className="btn px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu className="size-4" /></button>
          <button className="btn hidden px-2 lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="collapse"><Menu className="size-4" /></button>
          {s.logo && <img src={s.logo} alt="" className="size-8 rounded object-contain" />}
          <div className="min-w-0 truncate font-bold">{lang === "ar" ? s.orgName : s.orgNameEn || s.orgName}</div>
          <div className="ms-auto flex items-center gap-1.5">
            <button className="btn px-2" onClick={undo} disabled={!past.length} title="Undo"><Undo2 className="size-4 rtl:-scale-x-100" /></button>
            <button className="btn px-2" onClick={redo} disabled={!future.length} title="Redo"><Redo2 className="size-4 rtl:-scale-x-100" /></button>
            <button className="btn px-2" onClick={() => setUI({ lang: ui.lang === "ar" ? "en" : "ar" })} title="Language"><Languages className="size-4" /><span className="hidden sm:inline">{ui.lang === "ar" ? "EN" : "ع"}</span></button>
            <button className="btn px-2" onClick={() => setUI({ theme: ui.theme === "dark" ? "light" : "dark" })} title="Theme">{ui.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
            <button className="btn px-2" onClick={logout} title={t("logout")}><LogOut className="size-4 rtl:-scale-x-100" /></button>
            {role !== "super_admin" && (
              <button className="btn btn-accent" onClick={() => setOpOpen(true)}><Plus className="size-4" /><span className="hidden sm:inline">{t("newMove")}</span></button>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
      <OperationModal open={opOpen} onClose={() => setOpOpen(false)} />
    </div>
  );
}
