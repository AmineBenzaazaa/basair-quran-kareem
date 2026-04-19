import { LogoutButton } from "../components/logout-button";
import { ModuleCard } from "../components/module-card";
import {
  formatDashboardError,
  listModuleSummaries,
} from "../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardHomePage() {
  try {
    const modules = await listModuleSummaries();

    return (
      <main className="page-shell">
        <header className="page-header page-header-with-action">
          <div>
            <span className="eyebrow">لوحة التحرير</span>
            <h1 className="page-title"> بصائر القرآن الكريم</h1>
          </div>
          <LogoutButton />
        </header>

        <div className="module-grid">
          {modules.filter((item) => !item.module.readOnly).map((item) => (
            <ModuleCard key={item.module.id} item={item} />
          ))}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="page-shell">
        <header className="page-header page-header-with-action">
          <div>
            <span className="eyebrow">لوحة التحرير</span>
            <h1 className="page-title"> بصائر القرآن الكريم</h1>
          </div>
          <LogoutButton />
        </header>
        <div className="error-card">
          <strong>تعذر تحميل المحتوى</strong>
          <p>{formatDashboardError(error)}</p>
        </div>
      </main>
    );
  }
}
