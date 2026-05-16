import { type MouseEventHandler } from "react";

type ScrollToBottomButtonProps = {
  className?: string;
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  show: boolean;
};

export function ScrollToBottomButton({
  className = "",
  label,
  onClick,
  show,
}: ScrollToBottomButtonProps) {
  const visibilityClassName = show ? "opacity-100" : "pointer-events-none opacity-0";

  return (
    <button
      type="button"
      aria-hidden={!show}
      aria-label={label}
      tabIndex={show ? undefined : -1}
      onClick={show ? onClick : undefined}
      className={[
        "absolute end-1/2 z-30 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] text-[var(--app-shell-text)] transition-opacity duration-150 ease-in-out print:hidden",
        visibilityClassName,
        className,
      ].join(" ")}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 rotate-180">
        <path
          d="M9.33467 16.6663V4.93978L4.6374 9.63704L4.1667 9.16634L3.69599 8.69661L9.52998 2.86263L9.63447 2.77767C9.8925 2.60753 10.2433 2.63564 10.4704 2.86263L16.3034 8.69661L16.3884 8.80111C16.5588 9.05922 16.5306 9.40982 16.3034 9.63704C16.0762 9.86414 15.7255 9.89242 15.4675 9.722L15.363 9.63704L10.6647 4.9388V16.6663C10.6647 17.0336 10.367 17.3314 9.99971 17.3314C9.63259 17.3312 9.33467 17.0335 9.33467 16.6663ZM4.6374 9.63704C4.3777 9.89674 3.95569 9.89674 3.69599 9.63704C3.43657 9.37744 3.43668 8.95628 3.69599 8.69661L4.6374 9.63704Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
