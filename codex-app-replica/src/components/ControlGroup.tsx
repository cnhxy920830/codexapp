import type { ReactNode } from "react";

export function ControlGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClasses("flex items-center gap-2", className)}>{children}</div>;
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
