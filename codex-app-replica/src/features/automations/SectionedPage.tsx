import type { ReactNode } from "react";

type SectionedPageSection = {
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

export function SectionedPage({
  ariaLabel,
  children,
  className,
  contentInnerClassName,
  sections,
  showNav = true,
}: Props) {
  return (
    <div
      aria-label={ariaLabel}
      className={[
        "flex min-h-0 flex-1 flex-col",
        className ?? "",
      ].join(" ")}
    >
      {showNav && sections && sections.length > 0 ? (
        <nav className="hidden" aria-hidden="true" />
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
    <section id={id} className="flex flex-col gap-2">
      <div className="heading-xl font-normal text-[var(--app-shell-title)]">
        {title}
      </div>
      {children}
    </section>
  );
}
