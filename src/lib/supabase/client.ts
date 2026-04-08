import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase browser client.
 *
 * NOTE: Do not cache this at module scope. A module-level singleton shares
 * the same auth state across all component instances and makes it impossible
 * to reset the client on logout. Call this function directly in each
 * component or hook that needs it.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Convenience re-export for components that import `supabase` directly.
// This creates a fresh instance per module load, which is safe for
// client components that each have their own module scope.
export const supabase = createClient();
