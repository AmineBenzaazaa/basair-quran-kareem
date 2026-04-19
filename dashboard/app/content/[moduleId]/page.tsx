import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "../../../components/document-editor";
import { LogoutButton } from "../../../components/logout-button";
import { MethodFlowPdfEditor } from "../../../components/method-flow-pdf-editor";
import {
  formatDashboardError,
  getModuleDocument,
} from "../../../src/lib/content/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ModulePageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function ModuleEditorPage({ params }: ModulePageProps) {
  const { moduleId } = await params;
  let item: Awaited<ReturnType<typeof getModuleDocument>> = null;

  try {
    item = await getModuleDocument(moduleId);
  } catch (error) {
    return (
      <main className="page-shell">
        <Link className="back-link" href="/">
          ← العودة
        </Link>
        <div className="error-card">
          <strong>تعذر تحميل هذا القسم</strong>
          <p>{formatDashboardError(error)}</p>
        </div>
      </main>
    );
  }

  if (!item) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="module-page-header">
        <div className="module-page-toolbar">
          <Link className="back-link" href="/">
            ← العودة
          </Link>
          <LogoutButton />
        </div>
        <div className="module-page-title-row">
          <div>
            <span className="module-page-area">{item.module.area}</span>
            <h1 className="module-page-title">{item.module.title}</h1>
          </div>
          <span className="module-page-summary">{item.summary}</span>
        </div>
      </div>

      {item.module.id === "method-flow" ? (
        <MethodFlowPdfEditor
          initialPdfUrl={(item.document as Record<string, unknown> | null)?.pdfUrl as string | null}
          writeTokenRequired={item.writeTokenRequired}
        />
      ) : (
        <DocumentEditor initialDocument={item} moduleId={item.module.id} />
      )}
    </main>
  );
}
