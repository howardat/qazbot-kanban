import { nbkUsdRate } from "@/lib/nbk";
import { getCurrentUser } from "@/lib/session";

/** National Bank USD→KZT rate for ?date=YYYY-MM-DD, for expenses entered in dollars. `rate` is null when there's none. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? "";
  return Response.json({ date, rate: await nbkUsdRate(date) });
}
