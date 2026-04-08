"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Building2,
  BarChart3,
  Shield,
  FileText,
  LogOut,
  Menu,
  X,
  PartyPopper,
  UserCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Links visible to every authenticated user
const commonLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/holidays", label: "Holidays", icon: PartyPopper },
  { href: "/dashboard/edit-logs", label: "Edit Logs", icon: FileText },
  { href: "/dashboard/profile", label: "My Profile", icon: UserCircle },
];

// Links visible only to admins
const adminLinks = [
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole((profile?.role as "admin" | "viewer") ?? "viewer");
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleLinks = role === "admin"
    ? [...commonLinks, ...adminLinks]
    : commonLinks;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-6 py-5">
        <Clock className="h-8 w-8 text-indigo-400" />
        <span className="text-xl font-bold tracking-tight">
          D&apos;Aisle Clokd
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-slate-700 p-3 space-y-1">
        {/* Role badge + email */}
        {userEmail && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold uppercase text-slate-300">
              {userEmail[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-300">{userEmail}</p>
              {role && (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    role === "admin"
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-slate-600/50 text-slate-400"
                  }`}
                >
                  {role}
                </span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 rounded-lg bg-slate-900 p-2 text-white shadow-lg lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {sidebarContent}
      </aside>
    </>
  );
}
