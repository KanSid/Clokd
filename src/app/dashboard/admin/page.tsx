"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Shield, UserPlus, AlertTriangle, User } from "lucide-react";

interface AdminActivity {
  editor_email: string;
  total_edits: number;
  last_edit: string;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{ email: string; id: string } | null>(null);
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Create admin form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchAdminActivity();
  }, []);

  async function fetchCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({ email: user.email ?? "", id: user.id });
    }
  }

  async function fetchAdminActivity() {
    setLoading(true);
    // Get distinct editors and their activity from edit_logs
    const { data } = await supabase
      .from("edit_logs")
      .select("editor_email, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      const activityMap = new Map<string, { total: number; last: string }>();
      data.forEach((log: { editor_email: string | null; created_at: string }) => {
        const email = log.editor_email ?? "Unknown";
        const existing = activityMap.get(email);
        if (existing) {
          existing.total++;
        } else {
          activityMap.set(email, { total: 1, last: log.created_at });
        }
      });

      setAdminActivities(
        Array.from(activityMap.entries()).map(([email, info]) => ({
          editor_email: email,
          total_edits: info.total,
          last_edit: info.last,
        }))
      );
    }
    setLoading(false);
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setCreating(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: `Admin account created for ${email}. They may need to verify their email depending on your Supabase settings.`,
      });
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>

      {/* Current Admin Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Currently signed in as</p>
            <p className="text-lg font-semibold text-slate-900">{currentUser?.email ?? "Loading..."}</p>
          </div>
        </div>
      </div>

      {/* Create Admin Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Create New Admin</h2>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            This creates a new Supabase Auth user. In production, use a service role key via a secure API route
            for proper admin management.
          </p>
        </div>

        <form onSubmit={handleCreateAdmin} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Re-enter password"
            />
          </div>

          {message && (
            <div className={`rounded-lg p-3 text-sm ${
              message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Admin Account"}
          </button>
        </form>
      </div>

      {/* Admin Activity */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Admin Activity (from Edit Logs)</h2>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : adminActivities.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No admin activity recorded yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {adminActivities.map((admin) => (
              <div key={admin.editor_email} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <User className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{admin.editor_email}</p>
                    <p className="text-xs text-slate-500">
                      Last active: {new Date(admin.last_edit).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
                  {admin.total_edits} edits
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
