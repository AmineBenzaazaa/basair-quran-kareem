import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  verifyDashboardSession,
} from "../../../src/lib/auth/session";
import {
  deletePdfFromStorage,
  formatDashboardError,
  getModuleDocument,
  saveModuleDocument,
  uploadPdfToStorage,
  writeAccessAllowed,
} from "../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Write access denied." }, { status: 401 });
}

async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.headers.get("x-dashboard-token");
  const hasSession = await verifyDashboardSession(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  );
  return hasSession || writeAccessAllowed(token);
}

/** Extract paragraphs from PDF buffer — returns an array of non-empty text lines. */
async function extractPdfParagraphs(buffer: Buffer): Promise<string[]> {
  // pdf-parse@1.1.1: exports a single async function pdf(buffer) => { text, ... }
  // Loaded via require() so Next.js (serverExternalPackages) never bundles it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer
  ) => Promise<{ text: string }>;

  const data = await pdfParse(buffer);

  return data.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfContent = await extractPdfParagraphs(buffer);
    if (!pdfContent.length) {
      return NextResponse.json(
        {
          error:
            "تعذر استخراج نص من ملف PDF. يجب أن يحتوي الملف على نص قابل للتحديد، وليس صوراً فقط.",
        },
        { status: 400 }
      );
    }

    const pdfUrl = await uploadPdfToStorage(buffer);

    const existing = await getModuleDocument("method-flow");
    if (existing) {
      const updatedDoc = {
        ...(existing.document as object),
        pdfUrl,
        pdfContent,
      };
      await saveModuleDocument("method-flow", updatedDoc);
    }

    return NextResponse.json({ pdfUrl, paragraphs: pdfContent.length });
  } catch (error) {
    return NextResponse.json(
      { error: formatDashboardError(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth(request))) return unauthorizedResponse();

  try {
    await deletePdfFromStorage();

    const existing = await getModuleDocument("method-flow");
    if (existing) {
      const doc = existing.document as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pdfUrl: _removedUrl, pdfContent: _removedContent, ...rest } = doc;
      await saveModuleDocument("method-flow", rest);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatDashboardError(error) },
      { status: 500 }
    );
  }
}
