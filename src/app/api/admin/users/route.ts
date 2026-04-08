import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: authData, error: authError }, { data: profiles }] =
    await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("profiles").select("id, role"),
    ]);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const roleMap = new Map(
    (profiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role])
  );

  return NextResponse.json({
    users: authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: (u.user_metadata?.full_name as string) ?? "",
      role: roleMap.get(u.id) ?? "viewer",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
