import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  verifyDashboardSession,
} from "../../../../src/lib/auth/session";
import {
  formatDashboardError,
  getModuleDocument,
  saveModuleDocument,
  writeAccessAllowed,
} from "../../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ moduleId: string }>;
};

const VALID_GLOSSARY_STATUSES = new Set([
  "ok",
  "needs_review",
  "missing_source",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGlossaryStatus(value: unknown): string {
  const status = typeof value === "string" ? value.trim() : "";

  if (VALID_GLOSSARY_STATUSES.has(status)) {
    return status;
  }

  if (status === "published") {
    return "ok";
  }

  if (status === "draft" || status === "missingSource" || status === "") {
    return status === "missingSource" ? "missing_source" : "needs_review";
  }

  return "needs_review";
}

function sanitizeGlossaryDocument(document: unknown): unknown {
  if (!isRecord(document) || !isRecord(document.entries)) {
    return document;
  }

  const nextEntries = Object.fromEntries(
    Object.entries(document.entries).map(([entryId, entry]) => {
      if (!isRecord(entry)) {
        return [entryId, entry];
      }

      return [
        entryId,
        {
          ...entry,
          status: normalizeGlossaryStatus(entry.status),
        },
      ];
    })
  );

  return {
    ...document,
    entries: nextEntries,
  };
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error:
        "Write access denied. Provide the matching DASHBOARD_WRITE_TOKEN in the x-dashboard-token header.",
    },
    { status: 401 }
  );
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { moduleId } = await context.params;
    const item = await getModuleDocument(moduleId);

    if (!item) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatDashboardError(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const token = request.headers.get("x-dashboard-token");
  const hasSession = await verifyDashboardSession(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  );

  if (!hasSession && !writeAccessAllowed(token)) {
    return unauthorizedResponse();
  }

  try {
    const { moduleId } = await context.params;
    const body = (await request.json()) as { document?: unknown };

    if (body.document === undefined) {
      return NextResponse.json(
        { error: "Request body must contain a document value." },
        { status: 400 }
      );
    }

    const nextDocument =
      moduleId === "glossary"
        ? sanitizeGlossaryDocument(body.document)
        : body.document;

    const item = await saveModuleDocument(moduleId, nextDocument);

    if (!item) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatDashboardError(error),
      },
      { status: 500 }
    );
  }
}
