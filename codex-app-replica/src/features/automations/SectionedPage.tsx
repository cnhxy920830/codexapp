import type { ReactNode } from "react";

export type SectionedPageSection = {
  id: string;
  title: ReactNode;
};

type Props = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  contentInnerClassName?: string;
  sections?: SectionedPageSection[];
  showNav?: boolean;
};

function getSectionLabel(title: ReactNode) {
  return typeof title === "string" ? title : null;
}

export function SectionedPage({
  ariaLabel,
  children,
  className,
  contentInnerClassName,
  sections,
  showNav = true,
}: Props) {
  const visibleSections = sections?.filter((section) => getSectionLabel(section.title) !== null) ?? [];

  return (
    <div
      aria-label={ariaLabel}
      className={[
        "flex min-h-0 flex-1 flex-col",
        className ?? "",
      ].join(" ")}
    >
      {showNav && visibleSections.length > 0 ? (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label={ariaLabel}>
          {visibleSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="app-control rounded-full px-3 py-1.5 text-[12px]"
            >
              {getSectionLabel(section.title)}
            </a>
          ))}
        </nav>
      ) : null}
      <div className={contentInnerClassName}>{children}</div>
    </div>
  );
}

type SectionProps = {
  children: ReactNode;
  id: string;
  title: ReactNode;
};

export function SectionedPageSection({ children, id, title }: SectionProps) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-2">
      <div className="heading-xl font-normal text-[var(--app-shell-title)]">
        {title}
      </div>
      {children}
    </section>
  );
}
