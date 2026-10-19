import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="num mb-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

/** Estado provisório das telas que ainda serão construídas nas próximas tasks. */
export function ComingSoon({ task, children }: { task: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      <p>{children}</p>
      <p className="num mt-3 text-xs">Chega na task {task}.</p>
    </section>
  );
}
