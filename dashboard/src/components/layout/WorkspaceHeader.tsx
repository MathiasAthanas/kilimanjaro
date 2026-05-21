import { Breadcrumbs } from '../navigation/Breadcrumbs';

export function WorkspaceHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <Breadcrumbs />
        <h1 className="mt-2 font-display text-3xl font-bold text-ks-navy">{title}</h1>
        <p className="mt-1 text-sm text-ks-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
