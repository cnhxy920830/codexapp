import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
} from "../../components/AppShellIcons";
import type { TranslateFn, ScheduleConfig } from "./automationsPageUtils";
import {
  describeScheduleConfig,
  normalizeScheduleIntervalHours,
  normalizeScheduleIntervalMinutes,
  transitionScheduleMode,
} from "./automationsPageUtils";

export type CompactRailOption = {
  disabled?: boolean;
  secondaryLabel?: string;
  id: string;
  label: string;
  description?: string;
};

const WEEKDAY_OPTIONS = [
  { id: "MO", key: "settings.automations.scheduleSummary.mondaysLabel" },
  { id: "TU", key: "settings.automations.scheduleSummary.tuesdaysLabel" },
  { id: "WE", key: "settings.automations.scheduleSummary.wednesdaysLabel" },
  { id: "TH", key: "settings.automations.scheduleSummary.thursdaysLabel" },
  { id: "FR", key: "settings.automations.scheduleSummary.fridaysLabel" },
  { id: "SA", key: "settings.automations.scheduleSummary.saturdaysLabel" },
  { id: "SU", key: "settings.automations.scheduleSummary.sundaysLabel" },
] as const;

const MINUTES_PER_DAY = 1_440;
const TIME_PICKER_INTERVAL_MINUTES = 15;
const TIME_PICKER_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / TIME_PICKER_INTERVAL_MINUTES },
  (_, index) => {
    const totalMinutes = index * TIME_PICKER_INTERVAL_MINUTES;
    return formatTimePickerValue(
      Math.floor(totalMinutes / 60),
      totalMinutes % 60,
    );
  },
);

export const AUTOMATION_REASONING_OPTIONS = [
  { id: "none" },
  { id: "minimal" },
  { id: "low" },
  { id: "medium" },
  { id: "high" },
  { id: "xhigh" },
] as const;

function useDismissOnOutsidePointerDown(
  containerRef: { current: HTMLDivElement | null },
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [containerRef, isOpen, onClose]);
}

export function CompactRailSelect({
  ariaLabel,
  emptyLabel,
  icon,
  menuTitle,
  onSelect,
  options,
  selectedId,
  triggerLabel,
}: {
  ariaLabel: string;
  emptyLabel?: string;
  icon?: ReactNode;
  menuTitle?: string;
  onSelect: (id: string) => void;
  options: CompactRailOption[];
  selectedId: string;
  triggerLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.id === selectedId) ?? null;
  const resolvedTriggerLabel =
    selectedOption?.label ?? triggerLabel ?? emptyLabel ?? "";

  useDismissOnOutsidePointerDown(containerRef, isOpen, () => {
    setIsOpen(false);
  });

  return (
    <div ref={containerRef} className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((current) => !current)}
        className="app-control flex min-w-[160px] max-w-[220px] items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[13px]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate text-left text-[var(--app-shell-title)]">
            {resolvedTriggerLabel}
          </span>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
      </button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-64 rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {menuTitle ? (
            <div className="px-3 py-2 text-[12px] font-medium text-[var(--app-shell-title)]">
              {menuTitle}
            </div>
          ) : null}
          <div className="flex max-h-[240px] flex-col overflow-y-auto">
            {options.length > 0 ? (
              options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }
                      onSelect(option.id);
                      setIsOpen(false);
                    }}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                      isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                      option.disabled
                        ? "cursor-default opacity-50"
                        : "disabled:cursor-default disabled:opacity-50",
                    ].join(" ")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="block truncate">{option.label}</span>
                        {option.secondaryLabel ? (
                          <span className="truncate text-[12px] text-[var(--app-shell-subtle)]">
                            {option.secondaryLabel}
                          </span>
                        ) : null}
                      </span>
                      {option.description ? (
                        <span className="app-text-muted mt-1 block whitespace-normal text-[12px] leading-5">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-[13px] app-text-muted">
                {emptyLabel ?? triggerLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CompactScheduleEditor({
  locale,
  modeOptions,
  onChange,
  scheduleConfig,
  t,
}: {
  locale: string;
  modeOptions: Array<{ id: ScheduleConfig["mode"]; label: string }>;
  onChange: (nextConfig: ScheduleConfig) => void;
  scheduleConfig: ScheduleConfig;
  t: TranslateFn;
}) {
  const selectedModeLabel =
    modeOptions.find((option) => option.id === scheduleConfig.mode)?.label ??
    t("settings.automations.scheduleMode.custom");
  const selectedWeekdayId = scheduleConfig.weekdays[0] ?? "MO";
  const selectedWeekdayOption = WEEKDAY_OPTIONS.find(
    (option) => option.id === selectedWeekdayId,
  );
  const selectedWeekdayLabel = selectedWeekdayOption
    ? t(selectedWeekdayOption.key)
    : selectedWeekdayId;
  const scheduleSummary = describeScheduleConfig(scheduleConfig, locale, t);
  const isMinuteInterval = scheduleConfig.intervalMinutes !== null;
  const intervalValue =
    scheduleConfig.intervalMinutes ?? scheduleConfig.intervalHours;

  return (
    <div className="flex max-w-[260px] flex-col items-end gap-2">
      <CompactRailSelect
        ariaLabel={t("settings.automations.scheduleModeLabel")}
        emptyLabel={t("settings.automations.scheduleMode.custom")}
        icon={<ClockIcon className="h-4 w-4 shrink-0" />}
        triggerLabel={selectedModeLabel}
        options={modeOptions}
        selectedId={scheduleConfig.mode}
        onSelect={(value) =>
          onChange(transitionScheduleMode(scheduleConfig, value as ScheduleConfig["mode"]))
        }
      />
      {scheduleConfig.mode === "hourly" ? (
        <label className="flex w-full items-center justify-end gap-2 text-[12px] app-text-muted">
          <span>{t("settings.automations.scheduleIntervalLabel")}</span>
          <input
            aria-label={t("settings.automations.scheduleIntervalLabel")}
            className="app-input h-9 w-20 rounded-[10px] px-2 text-[13px]"
            defaultValue={String(intervalValue)}
            inputMode="numeric"
            onBlur={(event) => {
              if (event.currentTarget.value.length === 0) {
                event.currentTarget.value = String(intervalValue);
              }
            }}
            onChange={(event) => {
              const digitsOnly = event.currentTarget.value.replaceAll(/[^0-9]/g, "");
              event.currentTarget.value = digitsOnly;
              if (digitsOnly.length === 0) {
                return;
              }

              if (isMinuteInterval) {
                const nextIntervalMinutes = normalizeScheduleIntervalMinutes(Number(digitsOnly));
                if (nextIntervalMinutes === null) {
                  return;
                }

                onChange({
                  ...scheduleConfig,
                  intervalMinutes: nextIntervalMinutes,
                });
                return;
              }

              const nextIntervalHours = normalizeScheduleIntervalHours(Number(digitsOnly));
              if (nextIntervalHours === null) {
                return;
              }

              onChange({
                ...scheduleConfig,
                intervalHours: nextIntervalHours,
              });
            }}
            pattern="[0-9]*"
            type="text"
          />
          <span>{isMinuteInterval ? "m" : "h"}</span>
        </label>
      ) : null}
      {scheduleConfig.mode === "weekly" ? (
        <CompactRailSelect
          ariaLabel={t("settings.automations.scheduleWeekday")}
          triggerLabel={selectedWeekdayLabel}
          options={WEEKDAY_OPTIONS.map((option) => ({
            id: option.id,
            label: t(option.key),
          }))}
          selectedId={selectedWeekdayId}
          onSelect={(value) =>
            onChange({
              ...scheduleConfig,
              weekdays: [value],
            })
          }
        />
      ) : null}
      {scheduleConfig.mode !== "custom" && scheduleConfig.mode !== "hourly" ? (
        <CompactTimePicker
          locale={locale}
          value={scheduleConfig.time}
          t={t}
          onChange={(time) =>
            onChange({
              ...scheduleConfig,
              time,
            })
          }
        />
      ) : null}
      {scheduleConfig.mode === "custom" ? (
        <input
          aria-label={t("settings.automations.scheduleCustomLabel")}
          value={scheduleConfig.customRrule}
          onChange={(event) =>
            onChange({
              ...scheduleConfig,
              customRrule: event.target.value,
            })
          }
          placeholder={t("settings.automations.scheduleCustomPlaceholder")}
          className="app-input h-9 w-full rounded-[10px] px-2 text-[12px] font-mono"
          spellCheck={false}
        />
      ) : (
        <div className="app-text-muted max-w-[220px] text-right text-[12px] leading-5">
          {scheduleSummary}
        </div>
      )}
    </div>
  );
}

function CompactTimePicker({
  locale,
  onChange,
  t,
  value,
}: {
  locale: string;
  onChange: (value: string) => void;
  t: TranslateFn;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snappedValue = snapTimePickerValue(value);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  );
  const timeInputLabel = t("settings.automations.scheduleTime");
  const toggleLabel = isOpen
    ? t("settings.automations.hideTimePicker")
    : t("settings.automations.showTimePicker");

  useDismissOnOutsidePointerDown(containerRef, isOpen, () => {
    setIsOpen(false);
  });

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-1">
      <div className="relative w-full">
        <input
          aria-label={timeInputLabel}
          className="app-input h-9 w-full min-w-[110px] rounded-[10px] px-2 pr-8 text-[13px] [&::-webkit-calendar-picker-indicator]:hidden"
          type="time"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((current) => !current);
          }}
          className={[
            isOpen ? "app-control" : "app-control-weak",
            "absolute top-1/2 right-[5px] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px]",
          ].join(" ")}
        >
          <ClockIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen ? (
        <div
          className="overflow-y-scroll overscroll-contain rounded-lg border border-token-border bg-token-input-background/70 p-1"
          style={{
            maxHeight: "min(14rem, max(3.5rem, calc(100vh - 9rem)))",
          }}
          onWheel={(event) => {
            event.stopPropagation();
          }}
        >
          {TIME_PICKER_OPTIONS.map((optionValue) => {
            const formattedTime = formatTimePickerOptionLabel(
              optionValue,
              timeFormatter,
            );
            const isSelected = optionValue === value;
            return (
              <button
                key={optionValue}
                ref={
                  optionValue === snappedValue
                    ? (node) => {
                        node?.scrollIntoView({
                          block: "center",
                          inline: "nearest",
                        });
                      }
                    : undefined
                }
                type="button"
                aria-label={t("settings.automations.timePicker.setTime", {
                  time: formattedTime,
                })}
                aria-pressed={isSelected}
                className={[
                  "cursor-interaction flex h-7 w-full items-center rounded-md px-2 text-left text-sm tabular-nums outline-none focus:bg-token-list-hover-background",
                  isSelected
                    ? "bg-token-list-hover-background text-token-foreground"
                    : "text-token-secondary hover:bg-token-list-hover-background",
                ].join(" ")}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onChange(optionValue);
                  setIsOpen(false);
                }}
              >
                {formattedTime}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function parseTimePickerValue(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return { hour, minute };
}

function formatTimePickerValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapTimePickerValue(value: string) {
  const parsedValue = parseTimePickerValue(value);
  if (!parsedValue) {
    return null;
  }

  const totalMinutes = parsedValue.hour * 60 + parsedValue.minute;
  const snappedMinutes =
    (Math.floor(totalMinutes / TIME_PICKER_INTERVAL_MINUTES) *
      TIME_PICKER_INTERVAL_MINUTES) %
    MINUTES_PER_DAY;
  return formatTimePickerValue(
    Math.floor(snappedMinutes / 60),
    snappedMinutes % 60,
  );
}

function formatTimePickerOptionLabel(
  value: string,
  formatter: Intl.DateTimeFormat,
) {
  const parsedValue = parseTimePickerValue(value);
  if (!parsedValue) {
    return value;
  }

  return formatter.format(
    new Date(2024, 0, 1, parsedValue.hour, parsedValue.minute),
  );
}

export function formatReasoningLabel(value: string, t: TranslateFn) {
  switch (value) {
    case "none":
      return t("settings.agent.approval.never");
    case "minimal":
      return "Minimal";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "Very high";
    default:
      return value;
  }
}
