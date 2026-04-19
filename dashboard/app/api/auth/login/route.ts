import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  credentialsAreValid,
  createDashboardSession,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
  getDashboardAuthCredentials,
  isSafeRedirectPath,
} from "../../../../src/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = isSafeRedirectPath(formData.get("next"));
  const credentials = getDashboardAuthCredentials();

  if (!credentials.enabled || !credentialsAreValid(username, password)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  response.cookies.set({
    httpOnly: true,
    maxAge: DASHBOARD_SESSION_MAX_AGE_SECONDS,
    name: DASHBOARD_SESSION_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: await createDashboardSession(credentials.username),
  });

  return response;
}
