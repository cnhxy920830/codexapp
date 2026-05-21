export function ToggleSwitch({
  ariaLabel,
  className,
  checked,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  className?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const dataState = checked ? "checked" : "unchecked";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-state={dataState}
      onClick={() => onChange(!checked)}
      className={joinClasses("app-toggle", className)}
    >
      <span className="app-toggle-track" data-state={dataState}>
        <span className="app-toggle-thumb" data-state={dataState} />
      </span>
    </button>
  );
}

function joinClasses(...values: Array<string | null | undefined | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
