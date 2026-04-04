"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface DashboardHeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

export default function DashboardHeader({
  title,
  onMenuToggle,
}: DashboardHeaderProps) {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-slate-500 md:block">
          {currentDate}
        </span>
        {email && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            {email}
          </span>
        )}
      </div>
    </header>
  );
}
