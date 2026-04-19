import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../src/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return clearSession(request);
}

export function POST(request: NextRequest) {
  return clearSession(request);
}

function clearSession(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?loggedOut=1", request.url),
    303
  );

  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: DASHBOARD_SESSION_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: "",
  });

  return response;
}
