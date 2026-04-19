import { NextResponse } from "next/server";
import {
  basicAuthEnabled,
  formatDashboardError,
  listModuleSummaries,
  storageModeLabel,
  writeTokenRequired,
} from "../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listModuleSummaries();

    return NextResponse.json({
      items,
      storageMode: storageModeLabel(),
      writeTokenRequired: writeTokenRequired(),
      basicAuthEnabled: basicAuthEnabled(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatDashboardError(error),
      },
      { status: 500 }
    );
  }
}
