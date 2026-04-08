"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  UserPlus,
  AlertTriangle,
  User,
  KeyRound,
  Trash2,
  Users,
} from "lucide-react";

interface AdminActivity {
  editor_email: string;
  total_edits: number;
  last_edit: string;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "viewer";
  created_at: string;
  last_sign_in_at: string | null;
}

type Msg = { type: "success" | "error"; text: string };

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    id: string;
    full_name: string;
  } | null>(null);
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // All users list
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<Msg | null>(null);

  // Change password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null);

  // Create user form
  const [newName, setNewName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "admin">("viewer");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<Msg | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchAdminActivity();
    fetchAllUsers();
  }, []);

  async function fetchCurrentUser() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({
        email: user.email ?? "",
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) ?? "",
      });
    }
  }

  async function fetchAllUsers() {
    setLoadingUsers(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setAdminUsers(data.users);
    }
    setLoadingUsers(false);
  }

  async function fetchAdminActivity() {
    setLoadingActivity(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("edit_logs")
      .select("editor_email, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      const activityMap = new Map<string, { total: number; last: string }>();
      data.forEach((log: { editor_email: string | null; created_at: string }) => {
        const e = log.editor_email ?? "Unknown";
        const existing = activityMap.get(e);
        if (existing) {
          existing.total++;
        } else {
          activityMap.set(e, { total: 1, last: log.created_at });
        }
      });
      setAdminActivities(
        Array.from(activityMap.entries()).map(([e, info]) => ({
          editor_email: e,
          total_edits: info.total,
          last_edit: info.last,
        }))
      );
    }
    setLoadingActivity(false);
  }

  async function handleChangePassword(ev: React.FormEvent) {
    ev.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ type: "error", text: error.message });
    } else {
      setPasswordMsg({ type: "success", text: "Password updated successfully" });
      setNewPassword("");
      setConfirmNewPassword("");
    }
    setChangingPassword(false);
  }

  async function handleCreateUser(ev: React.FormEvent) {
    ev.preventDefault();
    setCreateMsg(null);
    if (password !== confirmPassword) {
      setCreateMsg({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (password.length < 8) {
      setCreateMsg({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: newName } },
    });
    if (error) {
      setCreateMsg({ type: "error", text: error.message });
      setCreating(false);
      return;
    }
    if (data.user && selectedRole === "admin") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", data.user.id);
      if (profileError) {
        setCreateMsg({
          type: "error",
          text: `User created but role could not be set: ${profileError.message}`,
        });
        setCreating(false);
        return;
      }
    }
    setCreateMsg({
      type: "success",
      text: `${selectedRole === "admin" ? "Admin" : "Viewer"} account created for ${email}.`,
    });
    setNewName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setSelectedRole("viewer");
    setCreating(false);
    fetchAllUsers();
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!confirm(`Delete account for ${userEmail}? This cannot be undone.`)) return;
    setDeletingId(userId);
    setDeleteMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDeleteMsg({ type: "error", text: data.error ?? "Failed to delete user" });
    } else {
      setDeleteMsg({ type: "success", text: `Deleted account for ${userEmail}` });
      setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Admin Only
        </span>
      </div>

      {/* Current user info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Currently signed in as</p>
            {currentUser?.full_name ? (
              <>
                <p className="text-lg font-semibold text-slate-900">{currentUser.full_name}</p>
                <p className="text-sm text-slate-500">{currentUser.email}</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-slate-900">
                {currentUser?.email ?? "Loading..."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Change My Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
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
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Re-enter new password"
            />
          </div>
          {passwordMsg && (
            <div
              className={`rounded-lg p-3 text-sm ${
                passwordMsg.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {passwordMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={changingPassword}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Create user */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Create New User</h2>
        </div>
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            This creates a new Supabase Auth user. In production, use a service role key via a
            secure API route for proper user management.
          </p>
        </div>
        <form onSubmit={handleCreateUser} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="user@example.com"
            />
          </div>
          {/* Role selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <div className="flex gap-3">
              <label
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  selectedRole === "viewer"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="viewer"
                  checked={selectedRole === "viewer"}
                  onChange={() => setSelectedRole("viewer")}
                  className="hidden"
                />
                <User className="h-4 w-4" />
                <span>Viewer</span>
              </label>
              <label
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  selectedRole === "admin"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={selectedRole === "admin"}
                  onChange={() => setSelectedRole("admin")}
                  className="hidden"
                />
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </label>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {selectedRole === "admin"
                ? "Full access including this Admin panel."
                : "Can view and edit records but cannot access the Admin panel."}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Min 8 characters"
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
          {createMsg && (
            <div
              className={`rounded-lg p-3 text-sm ${
                createMsg.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {createMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating
              ? "Creating..."
              : `Create ${selectedRole === "admin" ? "Admin" : "Viewer"} Account`}
          </button>
        </form>
      </div>

      {/* All users */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <Users className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
        </div>

        {deleteMsg && (
          <div
            className={`mx-6 mt-4 rounded-lg p-3 text-sm ${
              deleteMsg.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {deleteMsg.text}
          </div>
        )}

        {loadingUsers ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : adminUsers.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No users found</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {adminUsers.map((u) => {
              const isMe = u.id === currentUser?.id;
              return (
                <div key={u.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <User className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      {u.full_name && (
                        <p className="font-medium text-slate-900">{u.full_name}</p>
                      )}
                      <p
                        className={
                          u.full_name ? "text-sm text-slate-500" : "font-medium text-slate-900"
                        }
                      >
                        {u.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                        {u.last_sign_in_at && (
                          <> &middot; Last login {new Date(u.last_sign_in_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role}
                    </span>
                    {isMe ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        You
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        disabled={deletingId === u.id}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin activity */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Admin Activity (from Edit Logs)</h2>
        </div>
        {loadingActivity ? (
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
              <div
                key={admin.editor_email}
                className="flex items-center justify-between px-6 py-4"
              >
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
