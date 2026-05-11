import type { ReactNode } from "react";

type FirstRunButtonProps = {
  children: ReactNode;
  color?: "outline" | "primary";
  disabled?: boolean;
  onClick: () => void;
};

const BASE_CLASS_NAME =
  "border-token-border user-select-none no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const SIZE_CLASS_NAME = "rounded-full px-5 py-2 text-base leading-[18px]";
const VARIANT_CLASS_NAME = {
  outline:
    "border-token-border text-token-button-tertiary-foreground bg-token-bg-fog enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border",
  primary: "bg-token-foreground enabled:hover:bg-token-foreground/80 data-[state=open]:bg-token-foreground/80 text-token-dropdown-background",
} as const;

export function FirstRunButton({ children, color = "primary", disabled = false, onClick }: FirstRunButtonProps) {
  return (
    <button type="button" className={[BASE_CLASS_NAME, SIZE_CLASS_NAME, VARIANT_CLASS_NAME[color]].join(" ")} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
