import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Only allow relative paths to prevent open-redirect attacks.
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const next = rawNext.startsWith('/') ? rawNext : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Code exchange failed — redirect to login with a generic error flag.
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  } else {
    // No code present — nothing to exchange.
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
