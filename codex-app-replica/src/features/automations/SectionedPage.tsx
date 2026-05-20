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
  disableScrollFade?: boolean;
  header?: ReactNode;
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
  disableScrollFade = false,
  header,
  sections,
  showNav = true,
}: Props) {
  const visibleSections = sections?.filter((section) => getSectionLabel(section.title) !== null) ?? [];
  const scrollMaskClassName = disableScrollFade
    ? null
    : "vertical-scroll-fade-mask [--edge-fade-distance:1rem]";

  return (
    <div
      aria-label={ariaLabel}
      className={[
        "flex min-h-0 w-full flex-1 flex-col gap-8 [--sectioned-page-leading-inset:0.5rem]",
        className ?? "",
      ].join(" ")}
    >
      {header ? (
        <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-1 px-panel pt-panel">
          {header}
        </div>
      ) : null}
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
      <div
        className={[
          "relative min-h-0 w-full flex-1 overflow-y-auto [scrollbar-gutter:stable] lg:h-full",
          scrollMaskClassName ?? "",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto w-full max-w-[var(--thread-content-max-width)]",
            contentInnerClassName ?? "",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type SectionProps = {
  action?: ReactNode;
  children: ReactNode;
  id: string;
  showDivider?: boolean;
  title: ReactNode;
};

export function SectionedPageSection({
  action,
  children,
  id,
  showDivider = false,
  title,
}: SectionProps) {
  if (!showDivider && action == null) {
    return (
      <section id={id} className="flex flex-col gap-4">
        <div className="text-lg leading-6 font-medium text-token-foreground">
          {title}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section id={id} className="flex flex-col gap-4">
      <div
        className={[
          "flex items-center justify-between gap-3 [padding-inline-start:var(--sectioned-page-leading-inset,0.5rem)] pr-0.5 pb-2",
          showDivider ? "border-b border-token-border-light" : "",
        ].join(" ")}
      >
        <div className="text-lg leading-6 font-medium text-token-foreground">
          {title}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
