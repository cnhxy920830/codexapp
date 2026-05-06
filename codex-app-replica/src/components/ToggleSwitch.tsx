export function ToggleSwitch({
  ariaLabel,
  checked,
  disabled,
  onChange,
}: {
  ariaLabel: string;
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
      className="app-toggle"
    >
      <span className="app-toggle-track" data-state={dataState}>
        <span className="app-toggle-thumb" data-state={dataState} />
      </span>
    </button>
  );
}
