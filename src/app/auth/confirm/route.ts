import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, upsertProfile } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

// Magic link lands here with ?token_hash=&type=. Verify it, then enforce the allowlist.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type) return NextResponse.redirect(`${origin}/login?error=LinkInvalid`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  const user = data.user;
  if (error || !user?.email) return NextResponse.redirect(`${origin}/login?error=LinkInvalid`);

  if (!(await isEmailAllowed(user.email))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=AccessDenied`);
  }

  await upsertProfile({ id: user.id, email: user.email, name: null, image: null });
  return NextResponse.redirect(`${origin}/`);
}
