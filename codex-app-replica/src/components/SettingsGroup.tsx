import type { ReactNode } from "react";

type SettingsGroupRootProps = {
  children: ReactNode;
  className?: string;
};

type SettingsGroupHeaderProps = {
  actions?: ReactNode;
  className?: string;
  subtitle?: ReactNode;
  title?: ReactNode;
};

type SettingsGroupContentProps = {
  children: ReactNode;
  className?: string;
};

function SettingsGroupRoot({
  children,
  className,
}: SettingsGroupRootProps) {
  return <section className={joinClasses("flex flex-col", className)}>{children}</section>;
}

function SettingsGroupHeader({
  actions,
  className,
  subtitle,
  title,
}: SettingsGroupHeaderProps) {
  if (title == null && subtitle == null && actions == null) {
    return null;
  }

  return (
    <div
      className={joinClasses(
        subtitle
          ? "flex items-start justify-between gap-2 px-0 pt-[calc((var(--height-toolbar)-1.5rem)/2)]"
          : "flex h-toolbar items-center justify-between gap-2 px-0 py-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <div className="text-base font-medium text-token-text-primary">{title}</div> : null}
        {subtitle ? <div className="text-base font-normal text-token-text-tertiary">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function SettingsGroupContent({
  children,
  className,
}: SettingsGroupContentProps) {
  return <div className={joinClasses("flex flex-col gap-1.5", className)}>{children}</div>;
}

export const SettingsGroup = Object.assign(SettingsGroupRoot, {
  Content: SettingsGroupContent,
  Header: SettingsGroupHeader,
});

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
