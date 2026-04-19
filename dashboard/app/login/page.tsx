import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardAuthCredentials,
  isSafeRedirectPath,
  verifyDashboardSession,
} from "../../src/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    loggedOut?: string;
    next?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = isSafeRedirectPath(params.next ?? null);
  const cookieStore = await cookies();
  const hasSession = await verifyDashboardSession(
    cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value
  );
  const credentials = getDashboardAuthCredentials();

  if (hasSession && credentials.enabled) {
    redirect(nextPath as Parameters<typeof redirect>[0]);
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <img className="login-mark" src="/icon.png" alt="" />
          <span className="eyebrow">لوحة التحرير</span>
          <h1 id="login-title" className="login-title">
            بصائر القرآن الكريم
          </h1>
          <p className="login-subtitle">ادخل بيانات الوصول للمتابعة.</p>
        </div>

        {!credentials.enabled ? (
          <div className="login-alert">
            إعدادات الدخول غير مفعلة على هذا النشر.
          </div>
        ) : null}

        {params.error ? (
          <div className="login-alert" role="alert">
            بيانات الدخول غير صحيحة.
          </div>
        ) : null}

        {params.loggedOut ? (
          <div className="login-note">تم تسجيل الخروج.</div>
        ) : null}

        <form className="login-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={nextPath} />

          <label className="login-field">
            <span>اسم المستخدم</span>
            <input
              autoComplete="username"
              dir="ltr"
              name="username"
              required
              type="text"
            />
          </label>

          <label className="login-field">
            <span>كلمة المرور</span>
            <input
              autoComplete="current-password"
              dir="ltr"
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="login-button"
            disabled={!credentials.enabled}
            type="submit"
          >
            دخول
          </button>
        </form>
      </section>
    </main>
  );
}
