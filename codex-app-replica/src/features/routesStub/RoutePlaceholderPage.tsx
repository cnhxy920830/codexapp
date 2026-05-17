import type { ReactNode } from "react";

type RoutePlaceholderPageProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export function RoutePlaceholderPage({ title, description, action }: RoutePlaceholderPageProps) {
  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[var(--app-shell-text)]">
      <div className="text-[18px] font-medium">{title}</div>
      <div className="max-w-[420px] text-[13px] leading-5 text-[var(--app-shell-subtle)]">
        {description}
      </div>
      {action}
    </main>
  );
}
