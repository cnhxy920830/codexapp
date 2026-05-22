import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CheckIcon, InfoIcon } from "../../../components/AppShellIcons";
import { Tooltip } from "../../../components/Tooltip";
import type { MessageKey } from "../../../i18n/messages";
import { WelcomeHeaderIcon, WelcomeHeaderSourceIcon } from "./icons";

const codexAppGaLogo = new URL("../../../assets/codex-app-ga-logo--UgmJjKM.png", import.meta.url).href;

export type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

export function WelcomeShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[var(--app-shell-main-surface)] electron:bg-transparent" />
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[var(--app-shell-main-surface)] text-[var(--app-shell-text)]">
        {children}
      </div>
    </div>
  );
}

export function WelcomeFrame({
  children,
  panelClassName = "max-w-[400px]",
}: {
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center justify-start">
      <div className={["flex w-full flex-col items-center overflow-hidden rounded-2xl p-10", panelClassName].join(" ")}>
        {children}
      </div>
    </div>
  );
}

export function WelcomeHeader({
  subtitle,
  title,
  titleId,
}: {
  subtitle: string;
  title: string;
  titleId?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <img alt="" aria-hidden="true" className="size-12 shrink-0" draggable={false} src={codexAppGaLogo} />
      <h1
        className="mt-4 text-[28px] leading-[34px] font-normal whitespace-nowrap text-[var(--app-shell-text)] max-[540px]:whitespace-normal"
        id={titleId}
      >
        {title}
      </h1>
      <p className="mt-2 text-[16px] leading-6 text-[var(--app-shell-subtle)]">{subtitle}</p>
    </div>
  );
}

export function WelcomeImportHeader({
  sourceIconVariant = "orange",
  subtitle,
  title,
}: {
  sourceIconVariant?: "neutral" | "orange";
  subtitle: string;
  title: string;
}) {
  const sourceIconClassName =
    sourceIconVariant === "neutral"
      ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--app-shell-text)_4%,transparent)] text-[var(--app-shell-subtle)]"
      : "flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#DA6A44] text-white ring-1 ring-[var(--app-shell-border)]";

  return (
    <div className="flex flex-col items-center text-center">
      <div aria-hidden="true" className="flex items-center gap-4">
        <div className={sourceIconClassName}>
          <WelcomeHeaderSourceIcon className="size-6" />
        </div>
        <WelcomeHeaderIcon className="h-12 w-10 text-[var(--app-shell-text)]" />
        <img alt="" className="size-12" src={codexAppGaLogo} />
      </div>
      <h1 className="mt-6 text-[28px] leading-[34px] font-normal text-[var(--app-shell-text)]">{title}</h1>
      <p className="mt-2 text-[16px] leading-6 text-[var(--app-shell-subtle)]">{subtitle}</p>
    </div>
  );
}

export function OptionChip({
  icon: Icon,
  label,
  onClick,
  selected,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  const isDark = useDocumentIsDark();

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "flex h-10 min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border px-[13px] text-left",
        selected
          ? [
              "bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)]",
              isDark
                ? "border-[var(--app-shell-border)]"
                : "border-transparent hover:border-[var(--app-shell-border)]",
            ].join(" ")
          : [
              "border-[var(--app-shell-border)]",
              "hover:bg-[color-mix(in_srgb,var(--app-shell-text)_3%,transparent)]",
              isDark ? "bg-transparent" : "bg-[var(--app-shell-control-bg)]",
            ].join(" "),
      ].join(" ")}
      onClick={onClick}
    >
      {selected ? (
        <CheckIcon className="h-5 w-5 shrink-0 text-[var(--app-shell-text)]" />
      ) : (
        <Icon className="h-5 w-5 shrink-0 text-[var(--app-shell-subtle)]" />
      )}
      <span className="min-w-0 truncate text-[14px] leading-5 font-normal text-[var(--app-shell-text)]">
        {label}
      </span>
    </button>
  );
}

export function WorkModeOption({
  description,
  icon: Icon,
  onClick,
  selected,
  title,
}: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-checked={selected}
      className={[
        "flex w-full items-center gap-2.5 rounded-2xl p-3 text-left",
        selected ? "bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)]" : "hover:bg-[var(--app-shell-hover)]",
      ].join(" ")}
      role="radio"
      onClick={onClick}
    >
      <Icon className="h-5 w-5 shrink-0 text-[var(--app-shell-subtle)]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="min-w-0 truncate text-[14px] leading-[18px] font-normal text-[var(--app-shell-text)]">
          {title}
        </span>
        <span className="min-w-0 truncate text-sm leading-4 text-[var(--app-shell-subtle)]">{description}</span>
      </div>
      {selected ? <CheckIcon className="h-5 w-5 shrink-0 text-[var(--app-shell-text)]" /> : null}
    </button>
  );
}

export function RoleChip({
  label,
  onClick,
  selected,
}: {
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "relative flex h-10 min-w-0 items-center justify-center overflow-hidden rounded-xl border px-3 py-2 text-center text-[14px] leading-5 font-normal text-[var(--app-shell-text)]",
        selected
          ? "border-[color-mix(in_srgb,var(--app-shell-text)_20%,transparent)] bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)]"
          : "border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] hover:bg-[var(--app-shell-hover)]",
      ].join(" ")}
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{label}</span>
      {selected ? <CheckIcon className="absolute left-2 h-4 w-4 text-[var(--app-shell-text)]" aria-hidden="true" /> : null}
    </button>
  );
}

export function ImportGroupRow({
  description,
  disabled = false,
  leadingContent,
  label,
  onCheckedChange,
  state,
}: {
  description: string;
  disabled?: boolean;
  leadingContent?: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  state: "all" | "none" | "partial";
}) {
  const checked = state === "all";

  return (
    <label
      className={[
        "flex min-h-16 w-full items-center gap-3 border-b border-[var(--app-shell-border)] px-3 py-3 text-left last:border-b-0",
        disabled ? "cursor-default opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      {leadingContent ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)] text-[var(--app-shell-subtle)]">
          {leadingContent}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] leading-[17px] font-normal text-[var(--app-shell-text)]">{label}</div>
        <div className="mt-1 truncate text-[12px] leading-[14px] text-[var(--app-shell-subtle)]">{description}</div>
      </div>
      <SelectionCheckbox
        checked={checked}
        disabled={disabled}
        indeterminate={state === "partial"}
        label={label}
        className="ml-3"
        onChange={onCheckedChange}
      />
    </label>
  );
}

export function InlineTooltip({
  content,
  label,
  variant = "role",
}: {
  content: string;
  label: string;
  variant?: "intent" | "role";
}) {
  const tooltipClassName =
    variant === "intent"
      ? "!border-transparent !bg-black px-1.5 py-1.5 text-center !text-white text-sm leading-4 shadow-lg"
      : "!border-transparent !bg-black px-1.5 py-1.5 text-center text-xs leading-4 font-medium !text-white shadow-lg";

  return (
    <Tooltip
      delayDuration={0}
      side="top"
      sideOffset={6}
      tooltipBodyClassName="!text-white"
      tooltipClassName={tooltipClassName}
      tooltipContent={<span className="block !text-white">{content}</span>}
      tooltipMaxWidth={272}
    >
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--app-shell-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-shell-text)]"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="text-center text-[13px] leading-5 text-[var(--color-text-danger)]">
      {message}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "flex items-center justify-center rounded-full border border-transparent px-4 py-3 text-[14px] leading-5 font-medium text-[var(--app-shell-main-surface)]",
        disabled
          ? "cursor-not-allowed bg-[color-mix(in_srgb,var(--app-shell-text)_30%,transparent)]"
          : "bg-[var(--app-shell-text)] hover:bg-[color-mix(in_srgb,var(--app-shell-text)_80%,transparent)]",
        className,
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "flex items-center justify-center rounded-full border border-transparent px-4 py-3 text-[14px] leading-5 font-medium text-[var(--app-shell-text)]",
        "bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--app-shell-text)_10%,transparent)]",
        "disabled:cursor-default disabled:opacity-40",
        className,
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SecondaryTextButton({
  children,
  className = "",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center text-[14px] font-medium text-[var(--app-shell-subtle)] transition hover:text-[var(--app-shell-text)] disabled:cursor-default disabled:opacity-40",
        className || "px-2 py-2",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SelectionCheckbox({
  checked,
  className = "ml-3",
  disabled = false,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current != null) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <span className={[className, "inline-flex items-center"].filter(Boolean).join(" ")}>
      <input
        ref={inputRef}
        aria-label={label}
        checked={checked}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <SelectionBadge isPartial={indeterminate} isSelected={checked} />
    </span>
  );
}

export function SelectionBadge({
  isPartial = false,
  isSelected,
}: {
  isPartial?: boolean;
  isSelected: boolean;
}) {
  if (isSelected) {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--app-shell-accent)] bg-[var(--app-shell-accent)] text-white">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  }

  if (isPartial) {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--app-shell-accent)] bg-[var(--app-shell-accent)]">
        <span className="h-[2px] w-2 rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-4 w-4 rounded-[3px] border border-[var(--app-shell-border-heavy)]"
      aria-hidden="true"
    />
  );
}

export function MiniBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-[10px] font-semibold tracking-[0.04em]",
        "bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)] text-[var(--app-shell-subtle)]",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function useDocumentIsDark() {
  const [isDark, setIsDark] = useState(readDocumentIsDark);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(readDocumentIsDark());
    });

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia == null) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setIsDark(readDocumentIsDark());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isDark;
}

function readDocumentIsDark() {
  if (typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  if (root.classList.contains("electron-dark")) {
    return true;
  }
  if (root.classList.contains("electron-light")) {
    return false;
  }

  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}
