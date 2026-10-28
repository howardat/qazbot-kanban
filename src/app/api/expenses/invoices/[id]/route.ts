import { id } from "@/lib/board-ops";
import { invoicePath } from "@/lib/expenses";
import { requireUser } from "@/lib/session";
import { invoiceSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Opens an expense invoice: signed-in team members are redirected to a one-minute Storage link. The address
 * itself never expires, so it's what tables, side peeks and PDF reports link to. Others go to the login page.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const parsed = id.safeParse((await params).id);
  const path = parsed.success ? await invoicePath(parsed.data) : null;
  if (!path) return new Response("Invoice not found", { status: 404 });
  return Response.redirect(await invoiceSignedUrl(path), 302);
}
