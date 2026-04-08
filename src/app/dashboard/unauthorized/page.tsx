import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-5">
        <ShieldX className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-slate-500 mb-6 max-w-sm">
        You don&apos;t have permission to view this page. This section is restricted to admins only.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
