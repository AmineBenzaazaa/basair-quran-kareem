import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  credentialsAreValid,
  DASHBOARD_SESSION_COOKIE,
  getDashboardAuthCredentials,
  isSafeRedirectPath,
  verifyDashboardSession,
} from "./src/lib/auth/session";

function apiUnauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Authentication required.",
    },
    { status: 401 }
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(loginUrl);
}

function hasValidBasicAuth(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  let decoded = "";
  try {
    decoded = atob(authorization.slice("Basic ".length).trim());
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  const providedUser =
    separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
  const providedPassword =
    separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  return credentialsAreValid(providedUser, providedPassword);
}

export async function middleware(request: NextRequest) {
  const credentials = getDashboardAuthCredentials();

  if (!credentials.enabled) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isLogout = pathname === "/logout";
  const isLoginAction = pathname === "/api/auth/login";
  const hasValidSession = await verifyDashboardSession(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  );

  if (isLoginAction || isLogout) {
    return NextResponse.next();
  }

  if (isLogin) {
    if (!hasValidSession) {
      return NextResponse.next();
    }

    return NextResponse.redirect(
      new URL(
        isSafeRedirectPath(request.nextUrl.searchParams.get("next")),
        request.url
      )
    );
  }

  if (hasValidSession || hasValidBasicAuth(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return apiUnauthorizedResponse();
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
