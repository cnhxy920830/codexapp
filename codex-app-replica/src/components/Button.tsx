import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

const BUTTON_RADII = {
  composer: "rounded-full",
  composerSm: "rounded-full",
  default: "rounded-full",
  icon: "rounded-full electron:rounded-md",
  iconSm: "rounded-md",
  large: "rounded-full",
  medium: "rounded-lg",
  toolbar: "rounded-lg",
} as const;

const BUTTON_COLORS = {
  danger: "bg-token-charts-red/10 text-token-charts-red border-transparent",
  ghost: "text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent",
  ghostActive: "text-token-foreground enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent",
  ghostMuted: "text-token-muted-foreground enabled:hover:bg-transparent data-[state=open]:bg-transparent hover:text-token-foreground border-transparent",
  outline:
    "border-token-border text-token-button-tertiary-foreground bg-token-bg-fog enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border",
  outlineActive:
    "border-token-border text-token-button-tertiary-foreground bg-token-foreground/10 enabled:hover:bg-token-foreground/15 data-[state=open]:bg-token-foreground/15 border",
  primary: "bg-token-foreground enabled:hover:bg-token-foreground/80 data-[state=open]:bg-token-foreground/80 text-token-dropdown-background",
  secondary: "text-token-foreground bg-token-foreground/5 enabled:hover:bg-token-foreground/10 data-[state=open]:bg-token-foreground/10 border-transparent",
} as const;

const BUTTON_SIZES = {
  composer: "h-token-button-composer px-2 py-0 text-sm leading-[18px]",
  composerSm: "h-token-button-composer-sm px-1.5 py-0 text-sm leading-[18px]",
  default: "px-2 py-0.5 text-sm leading-[18px]",
  icon: "electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5",
  iconSm: "flex h-4 w-4 items-center justify-center p-0.5 [&>svg]:icon-2xs",
  large: "px-5 py-2 text-base leading-[18px]",
  medium: "px-4 py-1.5 text-base leading-[18px]",
  toolbar: "h-token-button-composer px-2 py-0 text-base leading-[18px]",
} as const;

type ButtonColor = keyof typeof BUTTON_COLORS;
type ButtonSize = keyof typeof BUTTON_SIZES;

type SharedButtonProps = {
  children?: ReactNode;
  className?: string;
  color?: ButtonColor;
  loading?: boolean;
  size?: ButtonSize;
  uniform?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">;

export function Button({
  children,
  className,
  color = "primary",
  disabled = false,
  loading = false,
  size = "default",
  type = "button",
  uniform = false,
  ...rest
}: SharedButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={joinClasses(
        "border-token-border user-select-none no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        BUTTON_RADII[size],
        BUTTON_COLORS[color],
        BUTTON_SIZES[size],
        uniform && "aspect-square items-center justify-center !px-0",
        className,
      )}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? <Spinner className="icon-xxs" /> : null}
      {children}
    </button>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
