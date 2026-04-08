"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, UserCircle } from "lucide-react";

type Msg = { type: "success" | "error"; text: string };

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? "");
        setFullName((user.user_metadata?.full_name as string) ?? "");
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>

      {/* Account info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <UserCircle className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            {fullName && (
              <p className="text-lg font-semibold text-slate-900">{fullName}</p>
            )}
            <p className={fullName ? "text-sm text-slate-500" : "text-lg font-semibold text-slate-900"}>
              {userEmail || "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
        </div>

        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Re-enter new password"
            />
          </div>

          {msg && (
            <div
              className={`rounded-lg p-3 text-sm ${
                msg.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
