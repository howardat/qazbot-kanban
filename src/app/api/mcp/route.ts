import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/activity";
import { dictFor, localeFromHeader } from "@/lib/i18n";
import { createMcpServer } from "@/lib/mcp/server";
import { userForToken } from "@/lib/mcp/tokens";

// External MCP endpoint (Streamable HTTP, stateless). Authenticate with a personal access token:
//   Authorization: Bearer qzb_…
// Each request gets a fresh server bound to the token's owner, so tools run with that person's rights.

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const user = auth.startsWith("Bearer ") ? await userForToken(auth.slice(7).trim()) : null;
  if (!user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid token. Create one under MCP access in Qazbot Kanban." }, id: null },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="qazbot-kanban"' } },
    );
  }

  await track(user.id, "mcp.call");
  let changed = false;
  const server = createMcpServer({
    actor: user,
    starterColumns: dictFor(localeFromHeader(req.headers.get("accept-language"))).newBoard.defaultColumns,
    onChange: () => (changed = true),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    if (changed) revalidatePath("/", "layout");
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
