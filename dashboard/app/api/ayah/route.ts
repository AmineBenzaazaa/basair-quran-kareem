import { NextResponse } from "next/server";
import { getAyahText } from "../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surahId = searchParams.get("surahId") ?? "";
  const ayahNumber = parseInt(searchParams.get("ayahNumber") ?? "", 10);

  if (!surahId || isNaN(ayahNumber)) {
    return NextResponse.json({ error: "Missing surahId or ayahNumber" }, { status: 400 });
  }

  try {
    const textAr = await getAyahText(surahId, ayahNumber);
    if (!textAr) {
      return NextResponse.json({ error: "Ayah not found" }, { status: 404 });
    }

    return NextResponse.json({ textAr });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load ayahs",
      },
      { status: 500 }
    );
  }
}
