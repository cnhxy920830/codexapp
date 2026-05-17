import { useState, type ReactNode } from "react";
import { CheckIcon, InfoIcon } from "../../../components/AppShellIcons";
import type { MessageKey } from "../../../i18n/messages";
import { WelcomeHeaderIcon, WelcomeHeaderSourceIcon } from "./icons";

const codexAppGaLogo = new URL("../../../assets/codex-app-ga-logo--UgmJjKM.png", import.meta.url).href;

export type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

export function WelcomeShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[var(--app-shell-main-surface)] electron:bg-transparent" />
      <div className="fixed inset-0 flex items-center justify-center px-6 pb-8 pt-0">
        <div className="flex h-full w-full items-center justify-center overflow-auto bg-[var(--app-shell-main-surface)] text-[var(--app-shell-text)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function WelcomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center justify-start">
      <div className="flex w-full max-w-[400px] flex-col items-center overflow-hidden rounded-2xl p-10">
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
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div aria-hidden="true" className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#DA6A44] text-white ring-1 ring-[var(--app-shell-border)]">
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
  badge,
  label,
  onClick,
  selected,
}: {
  badge: string;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "flex h-10 min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border px-[13px] text-left",
        selected
          ? "border-[var(--app-shell-border)] bg-[color-mix(in_srgb,var(--app-shell-text)_6%,transparent)]"
          : "border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] hover:bg-[var(--app-shell-hover)]",
      ].join(" ")}
      onClick={onClick}
    >
      <MiniBadge className={selected ? "text-[var(--app-shell-text)]" : "text-[var(--app-shell-subtle)]"}>
        {badge}
      </MiniBadge>
      <span className="min-w-0 truncate text-[14px] leading-5 font-normal text-[var(--app-shell-text)]">
        {label}
      </span>
    </button>
  );
}

export function WorkModeOption({
  badge,
  description,
  onClick,
  selected,
  title,
}: {
  badge: string;
  description: string;
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
      <MiniBadge>{badge}</MiniBadge>
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
  leadingContent,
  label,
  onClick,
  state,
}: {
  description: string;
  leadingContent?: ReactNode;
  label: string;
  onClick: () => void;
  state: "all" | "none" | "partial";
}) {
  return (
    <button
      type="button"
      className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--app-shell-border)] px-3 py-3 text-left last:border-b-0"
      onClick={onClick}
    >
      {leadingContent ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--app-shell-text)_5%,transparent)] text-[var(--app-shell-subtle)]">
          {leadingContent}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-[var(--app-shell-text)]">{label}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-subtle)]">{description}</div>
      </div>
      <SelectionBadge isPartial={state === "partial"} isSelected={state === "all"} />
    </button>
  );
}

export function InlineTooltip({ content, label }: { content: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--app-shell-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-shell-text)]"
        onBlur={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      {isOpen ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 w-max max-w-[17rem] -translate-x-1/2 rounded-[6px] bg-black px-2 py-1.5 text-center text-xs leading-4 font-medium text-white shadow-lg"
        >
          {content}
        </span>
      ) : null}
    </span>
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
          : "bg-[var(--app-shell-text)] hover:opacity-90",
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
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center px-2 py-2 text-[14px] font-medium text-[var(--app-shell-subtle)] transition hover:text-[var(--app-shell-text)] disabled:cursor-default disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
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
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--app-shell-text)] bg-[var(--app-shell-text)] text-[var(--app-shell-main-surface)]">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  }

  if (isPartial) {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--app-shell-text)] bg-[color-mix(in_srgb,var(--app-shell-text)_8%,transparent)]">
        <span className="h-[2px] w-2 rounded-full bg-[var(--app-shell-text)]" />
      </span>
    );
  }

  return <span className="inline-flex h-4 w-4 rounded-[3px] border border-[var(--app-shell-border)]" aria-hidden="true" />;
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
