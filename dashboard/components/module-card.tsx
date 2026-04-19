import Link from "next/link";
import type { ModuleSummary } from "../src/lib/content/types";

type ModuleCardProps = {
  item: ModuleSummary;
};

export function ModuleCard({ item }: ModuleCardProps) {
  const updatedAt = item.updatedAt
    ? new Intl.DateTimeFormat("ar-EG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(item.updatedAt))
    : null;

  return (
    <Link className="module-card" href={`/content/${item.module.id}`}>
      <div className="module-card-top">
        <span className="module-area">{item.module.area}</span>
        <span className="module-chevron">‹</span>
      </div>
      <h3 className="module-title">{item.module.title}</h3>
      <p className="module-description">{item.module.description}</p>
      {updatedAt && <span className="module-date">{updatedAt}</span>}
    </Link>
  );
}
