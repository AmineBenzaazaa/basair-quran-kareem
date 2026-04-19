import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  verifyDashboardSession,
} from "../../../../../src/lib/auth/session";
import {
  formatDashboardError,
  resetModuleDocument,
  writeAccessAllowed,
} from "../../../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ moduleId: string }>;
};

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error:
        "Write access denied. Provide the matching DASHBOARD_WRITE_TOKEN in the x-dashboard-token header.",
    },
    { status: 401 }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const token = request.headers.get("x-dashboard-token");
  const hasSession = await verifyDashboardSession(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  );

  if (!hasSession && !writeAccessAllowed(token)) {
    return unauthorizedResponse();
  }

  try {
    const { moduleId } = await context.params;
    const item = await resetModuleDocument(moduleId);

    if (!item) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatDashboardError(error),
      },
      { status: 400 }
    );
  }
}
