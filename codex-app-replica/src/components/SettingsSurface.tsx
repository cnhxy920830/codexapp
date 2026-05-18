import type { ReactNode } from "react";

type SettingsSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsSurface({
  children,
  className,
}: SettingsSurfaceProps) {
  return (
    <div
      className={joinClasses(
        "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border",
        className,
      )}
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
