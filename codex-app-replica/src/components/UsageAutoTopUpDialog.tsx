import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import {
  disableUsageAutoTopUp,
  enableUsageAutoTopUp,
  readUsageBillingCurrency,
  readUsageCustomerPortal,
  readUsagePricing,
  updateUsageAutoTopUp,
  type UsageAutoTopUpSettings,
  type UsageCreditsSnapshot,
  type UsagePricingInfo,
} from "../services/usage";

const CREDIT_PURCHASE_URL = "https://chatgpt.com/codex/settings/usage?credit_modal=true";
const DEFAULT_THRESHOLD = "125";
const DEFAULT_TARGET = "250";

type SaveIntent = "enable" | "update" | "disable" | "none";
type ThresholdValidationError = "missing" | "not-whole-number" | "below-threshold-minimum";
type TargetValidationError = "missing" | "not-whole-number" | "target-difference-too-small";
type ParsedNumberState =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; value: number };
type DialogValidationState = {
  rechargeThresholdError: ThresholdValidationError | null;
  rechargeTargetError: TargetValidationError | null;
  isValid: boolean;
};
type DraftState = {
  isEnabled: boolean;
  rechargeThreshold: string;
  rechargeTarget: string;
};
type ImmediateTopUpEstimate = {
  amount: string;
  creditCount: number;
};

export function UsageAutoTopUpDialog({
  creditDetails,
  onClose,
  onSaved,
  open,
  serverState,
}: {
  creditDetails: UsageCreditsSnapshot | null;
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  open: boolean;
  serverState: UsageAutoTopUpSettings;
}) {
  const { locale, t } = useI18n();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const thresholdInputId = useId();
  const targetInputId = useId();

  const [draftState, setDraftState] = useState<DraftState>(() => buildDraftState(serverState));
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingInfo, setPricingInfo] = useState<UsagePricingInfo | null>(null);
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [hasImmediateTopUpFailure, setHasImmediateTopUpFailure] = useState(false);
  const [immediateTopUpFailureAmount, setImmediateTopUpFailureAmount] = useState<string | null>(null);
  const [isManagePaymentPending, setIsManagePaymentPending] = useState(false);
  const [managePaymentError, setManagePaymentError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingEnableOrUpdate, setIsSavingEnableOrUpdate] = useState(false);
  const [isSavingDisable, setIsSavingDisable] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftState(buildDraftState(serverState));
    setSubmissionAttempts(0);
    setHasImmediateTopUpFailure(false);
    setImmediateTopUpFailureAmount(null);
    setManagePaymentError(null);
    setSaveError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsPricingLoading(true);
    setPricingInfo(null);

    void readUsageBillingCurrency()
      .then((response) => {
        if (cancelled || response.billingCurrency == null) {
          return null;
        }
        return readUsagePricing({ billingCurrency: response.billingCurrency });
      })
      .then((response) => {
        if (!cancelled) {
          setPricingInfo(response ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPricingInfo(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSavingEnableOrUpdate && !isSavingDisable) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSavingDisable, isSavingEnableOrUpdate, onClose, open]);

  const validation = useMemo(
    () =>
      validateAutoTopUpInputs({
        rechargeTarget: draftState.rechargeTarget,
        rechargeThreshold: draftState.rechargeThreshold,
      }),
    [draftState.rechargeTarget, draftState.rechargeThreshold],
  );

  const isSaving = isSavingEnableOrUpdate || isSavingDisable;
  const hasChanges = computeHasChanges(draftState, serverState);
  const saveIntent = computeSaveIntent(draftState, serverState, validation);
  const isSaveEnabled = hasChanges && saveIntent !== "none" && validation.isValid && !isSaving;
  const immediateTopUpEstimate = hasImmediateTopUpFailure
    ? null
    : calculateImmediateTopUpEstimate(locale, creditDetails, draftState, pricingInfo);
  const targetEquivalentEstimate = calculateTargetEquivalentEstimate(locale, draftState, pricingInfo);
  const thresholdErrorMessage = buildThresholdErrorMessage(t, validation, submissionAttempts);
  const targetErrorMessage = buildTargetErrorMessage(t, validation, submissionAttempts);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4"
      onClick={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        className="w-full max-w-[536px] rounded-[18px] border border-token-border bg-token-main-surface-primary px-6 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={dialogTitleId} className="text-[20px] font-medium leading-7 text-token-text-primary">
          {t("settings.usage.autoTopUp.dialog.title")}
        </h2>
        <p id={dialogDescriptionId} className="mt-3 text-sm leading-6 text-token-text-secondary">
          {t("settings.usage.autoTopUp.dialog.description")}
        </p>

        <div className="mt-5 flex flex-col gap-5">
          <AutoTopUpInputField
            ariaLabel={t("settings.usage.autoTopUp.threshold.ariaLabel")}
            disabled={isSaving}
            error={thresholdErrorMessage}
            fieldId={thresholdInputId}
            footerContent={null}
            footerTone="error"
            helperText={t("settings.usage.autoTopUp.threshold.helper")}
            label={t("settings.usage.autoTopUp.threshold.label")}
            onBlur={() => setSubmissionAttempts((value) => value + 1)}
            onChange={(value) => {
              clearImmediateFailureState(setHasImmediateTopUpFailure, setImmediateTopUpFailureAmount, setManagePaymentError, setSaveError);
              setDraftState((current) => ({ ...current, rechargeThreshold: value }));
            }}
            placeholder={DEFAULT_THRESHOLD}
            value={draftState.rechargeThreshold}
          />
          <AutoTopUpInputField
            ariaLabel={t("settings.usage.autoTopUp.target.ariaLabel")}
            disabled={isSaving}
            error={targetErrorMessage}
            fieldId={targetInputId}
            footerContent={renderTargetFooter({
              estimate: targetEquivalentEstimate,
              hasError: targetErrorMessage != null,
              isPricingLoading,
              t,
            })}
            footerTone={targetErrorMessage == null ? "secondary" : "error"}
            helperText={t("settings.usage.autoTopUp.target.helper")}
            label={t("settings.usage.autoTopUp.target.label")}
            onBlur={() => setSubmissionAttempts((value) => value + 1)}
            onChange={(value) => {
              clearImmediateFailureState(setHasImmediateTopUpFailure, setImmediateTopUpFailureAmount, setManagePaymentError, setSaveError);
              setDraftState((current) => ({ ...current, rechargeTarget: value }));
            }}
            placeholder={DEFAULT_TARGET}
            value={draftState.rechargeTarget}
          />
          {immediateTopUpEstimate != null && (saveIntent === "enable" || saveIntent === "update") ? (
            <DialogBanner tone="info">
              {saveIntent === "enable"
                ? t("settings.usage.autoTopUp.immediateTopUpNotice.enable", {
                    amount: immediateTopUpEstimate.amount,
                    creditCount: immediateTopUpEstimate.creditCount,
                  })
                : t("settings.usage.autoTopUp.immediateTopUpNotice.update", {
                    amount: immediateTopUpEstimate.amount,
                    creditCount: immediateTopUpEstimate.creditCount,
                  })}
            </DialogBanner>
          ) : null}
          {hasImmediateTopUpFailure ? (
            <DialogBanner tone="error">
              <div>
                {immediateTopUpFailureAmount == null
                  ? t("settings.usage.autoTopUp.immediateTopUpFailure.generic")
                  : t("settings.usage.autoTopUp.immediateTopUpFailure.amount", {
                      amount: immediateTopUpFailureAmount,
                    })}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isManagePaymentPending}
                  onClick={() =>
                    void handleManagePayment(
                      t("settings.usage.autoTopUp.managePayment.error"),
                      setIsManagePaymentPending,
                      setManagePaymentError,
                    )
                  }
                  className="font-medium underline underline-offset-2 disabled:pointer-events-none disabled:opacity-60"
                >
                  {t("settings.usage.autoTopUp.managePayment.action")}
                </button>
                <a
                  href={CREDIT_PURCHASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  {t("settings.usage.autoTopUp.purchaseCredit.action")}
                </a>
              </div>
              {managePaymentError ? <div className="mt-2">{managePaymentError}</div> : null}
            </DialogBanner>
          ) : null}
          {saveError ? <DialogBanner tone="error">{saveError}</DialogBanner> : null}
        </div>

        <div className="mt-7 flex items-center justify-end gap-2">
          {serverState.isEnabled ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                void handleDisable({
                  onClose,
                  onSaved,
                  setIsSavingDisable,
                  setSaveError,
                })
              }
              className="rounded-lg border border-token-border px-3 py-1.5 text-sm text-token-text-primary disabled:opacity-60"
            >
              {isSavingDisable ? t("settings.usage.load.loading") : t("settings.usage.autoTopUp.disable")}
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-lg border border-token-border px-3 py-1.5 text-sm text-token-text-primary disabled:opacity-60"
            >
              {t("settings.usage.autoTopUp.cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={!isSaveEnabled}
            onClick={() =>
              void handleSave({
                draftState,
                immediateTopUpEstimate,
                onClose,
                onSaved,
                saveIntent,
                setHasImmediateTopUpFailure,
                setImmediateTopUpFailureAmount,
                setIsSavingEnableOrUpdate,
                setSaveError,
                setSubmissionAttempts,
              })
            }
            className="rounded-lg bg-token-text-primary px-3 py-1.5 text-sm text-token-main-surface-primary disabled:opacity-60"
          >
            {isSavingEnableOrUpdate
              ? t("settings.usage.load.loading")
              : serverState.isEnabled
                ? t("settings.usage.autoTopUp.save")
                : t("settings.usage.autoTopUp.enable")}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildDraftState(serverState: UsageAutoTopUpSettings): DraftState {
  return {
    isEnabled: true,
    rechargeThreshold: serverState.rechargeThreshold ?? DEFAULT_THRESHOLD,
    rechargeTarget: serverState.rechargeTarget ?? DEFAULT_TARGET,
  };
}

function clearImmediateFailureState(
  setHasImmediateTopUpFailure: (value: boolean) => void,
  setImmediateTopUpFailureAmount: (value: string | null) => void,
  setManagePaymentError: (value: string | null) => void,
  setSaveError: (value: string | null) => void,
) {
  setHasImmediateTopUpFailure(false);
  setImmediateTopUpFailureAmount(null);
  setManagePaymentError(null);
  setSaveError(null);
}

function resolveThresholdError(validation: DialogValidationState, submissionAttempts: number) {
  return submissionAttempts > 0 ? validation.rechargeThresholdError : null;
}

function resolveTargetError(validation: DialogValidationState, submissionAttempts: number) {
  return submissionAttempts > 0 ? validation.rechargeTargetError : null;
}

function buildThresholdErrorMessage(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  validation: DialogValidationState,
  submissionAttempts: number,
) {
  const error = resolveThresholdError(validation, submissionAttempts);
  if (error == null) {
    return null;
  }
  if (error === "missing") {
    return t("settings.usage.autoTopUp.threshold.error.missing");
  }
  if (error === "not-whole-number") {
    return t("settings.usage.autoTopUp.threshold.error.wholeNumber");
  }
  return t("settings.usage.autoTopUp.threshold.error.minimum");
}

function renderTargetFooter({
  estimate,
  hasError,
  isPricingLoading,
  t,
}: {
  estimate: ImmediateTopUpEstimate | null;
  hasError: boolean;
  isPricingLoading: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (hasError) {
    return null;
  }
  if (isPricingLoading) {
    return t("settings.usage.autoTopUp.target.equivalent.loading");
  }
  if (estimate == null) {
    return null;
  }
  return t("settings.usage.autoTopUp.target.equivalent", {
    amount: estimate.amount,
    creditCount: estimate.creditCount,
  });
}

function buildTargetErrorMessage(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  validation: DialogValidationState,
  submissionAttempts: number,
) {
  const error = resolveTargetError(validation, submissionAttempts);
  if (error == null) {
    return null;
  }
  if (error === "missing") {
    return t("settings.usage.autoTopUp.target.error.missing");
  }
  if (error === "not-whole-number") {
    return t("settings.usage.autoTopUp.target.error.wholeNumber");
  }
  return t("settings.usage.autoTopUp.target.error.minimumDifference");
}

async function handleSave({
  draftState,
  immediateTopUpEstimate,
  onClose,
  onSaved,
  saveIntent,
  setHasImmediateTopUpFailure,
  setImmediateTopUpFailureAmount,
  setIsSavingEnableOrUpdate,
  setSaveError,
  setSubmissionAttempts,
}: {
  draftState: DraftState;
  immediateTopUpEstimate: ImmediateTopUpEstimate | null;
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  saveIntent: SaveIntent;
  setHasImmediateTopUpFailure: (value: boolean) => void;
  setImmediateTopUpFailureAmount: (value: string | null) => void;
  setIsSavingEnableOrUpdate: (value: boolean) => void;
  setSaveError: (value: string | null) => void;
  setSubmissionAttempts: (value: number | ((current: number) => number)) => void;
}) {
  setSubmissionAttempts((value) => value + 1);
  if (saveIntent !== "enable" && saveIntent !== "update") {
    return;
  }

  setIsSavingEnableOrUpdate(true);
  setSaveError(null);

  try {
    const params = {
      rechargeTarget: normalizeDraftValue(draftState.rechargeTarget),
      rechargeThreshold: normalizeDraftValue(draftState.rechargeThreshold),
    };
    const response =
      saveIntent === "enable" ? await enableUsageAutoTopUp(params) : await updateUsageAutoTopUp(params);

    onSaved(response);

    if (response.immediateTopUpStatus === "failed" || response.immediateTopUpStatus === "payment_declined") {
      setHasImmediateTopUpFailure(true);
      setImmediateTopUpFailureAmount(immediateTopUpEstimate?.amount ?? null);
      return;
    }

    onClose();
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : String(error));
  } finally {
    setIsSavingEnableOrUpdate(false);
  }
}

async function handleDisable({
  onClose,
  onSaved,
  setIsSavingDisable,
  setSaveError,
}: {
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  setIsSavingDisable: (value: boolean) => void;
  setSaveError: (value: string | null) => void;
}) {
  setIsSavingDisable(true);
  setSaveError(null);

  try {
    const response = await disableUsageAutoTopUp();
    onSaved(response);
    onClose();
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : String(error));
  } finally {
    setIsSavingDisable(false);
  }
}

async function handleManagePayment(
  errorMessage: string,
  setIsManagePaymentPending: (value: boolean) => void,
  setManagePaymentError: (value: string | null) => void,
) {
  setIsManagePaymentPending(true);
  setManagePaymentError(null);

  try {
    const response = await readUsageCustomerPortal();
    window.open(response.url, "_blank", "noopener,noreferrer");
  } catch {
    setManagePaymentError(errorMessage);
  } finally {
    setIsManagePaymentPending(false);
  }
}

function calculateTargetEquivalentEstimate(
  locale: string,
  draftState: DraftState,
  pricingInfo: UsagePricingInfo | null,
): ImmediateTopUpEstimate | null {
  if (pricingInfo == null) {
    return null;
  }
  const minimumCreditCount = calculateMinimumCreditCount(draftState.rechargeThreshold, draftState.rechargeTarget);
  if (minimumCreditCount == null) {
    return null;
  }
  return {
    amount: formatCurrencyAmount(locale, minimumCreditCount * pricingInfo.amountPerCredit, pricingInfo),
    creditCount: minimumCreditCount,
  };
}

function calculateImmediateTopUpEstimate(
  locale: string,
  creditDetails: UsageCreditsSnapshot | null,
  draftState: DraftState,
  pricingInfo: UsagePricingInfo | null,
): ImmediateTopUpEstimate | null {
  if (pricingInfo == null) {
    return null;
  }

  const currentBalance = Math.floor(Number(creditDetails?.balance ?? 0));
  const threshold = Number(normalizeDraftValue(draftState.rechargeThreshold));
  const target = Number(normalizeDraftValue(draftState.rechargeTarget));
  if (!Number.isFinite(currentBalance) || !Number.isFinite(threshold) || !Number.isFinite(target)) {
    return null;
  }
  if (currentBalance >= threshold) {
    return null;
  }

  const creditCount = Math.ceil(target - currentBalance);
  if (creditCount <= 0) {
    return null;
  }

  return {
    amount: formatCurrencyAmount(locale, creditCount * pricingInfo.amountPerCredit, pricingInfo),
    creditCount,
  };
}

function calculateMinimumCreditCount(rechargeThreshold: string, rechargeTarget: string) {
  const parsedThreshold = parseInputNumber(rechargeThreshold);
  const parsedTarget = parseInputNumber(rechargeTarget);
  if (parsedThreshold.kind !== "valid" || parsedTarget.kind !== "valid") {
    return null;
  }
  if (parsedTarget.value < parsedThreshold.value) {
    return null;
  }
  return parsedTarget.value - parsedThreshold.value;
}

function formatCurrencyAmount(locale: string, amount: number, pricingInfo: UsagePricingInfo) {
  const minimumFractionDigits =
    pricingInfo.minorUnitExponent ?? new Intl.NumberFormat(locale, {
      currency: pricingInfo.currencyCode,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits;

  return new Intl.NumberFormat(locale, {
    currency: pricingInfo.currencyCode,
    maximumFractionDigits: minimumFractionDigits,
    minimumFractionDigits,
    style: "currency",
  }).format(amount);
}

function computeHasChanges(draftState: DraftState, serverState: UsageAutoTopUpSettings) {
  if (draftState.isEnabled !== serverState.isEnabled) {
    return true;
  }
  if (!draftState.isEnabled && !serverState.isEnabled) {
    return false;
  }
  return (
    normalizeDraftValue(draftState.rechargeThreshold) !== normalizeDraftValue(serverState.rechargeThreshold) ||
    normalizeDraftValue(draftState.rechargeTarget) !== normalizeDraftValue(serverState.rechargeTarget)
  );
}

function computeSaveIntent(
  draftState: DraftState,
  serverState: UsageAutoTopUpSettings,
  validation: DialogValidationState,
): SaveIntent {
  if (draftState.isEnabled) {
    if (!validation.isValid) {
      return "none";
    }
    if (!serverState.isEnabled) {
      return "enable";
    }
    if (
      normalizeDraftValue(draftState.rechargeThreshold) === normalizeDraftValue(serverState.rechargeThreshold) &&
      normalizeDraftValue(draftState.rechargeTarget) === normalizeDraftValue(serverState.rechargeTarget)
    ) {
      return "none";
    }
    return "update";
  }
  return serverState.isEnabled ? "disable" : "none";
}

function validateAutoTopUpInputs({
  rechargeTarget,
  rechargeThreshold,
}: {
  rechargeTarget: string;
  rechargeThreshold: string;
}): DialogValidationState {
  const parsedThreshold = parseInputNumber(rechargeThreshold);
  const parsedTarget = parseInputNumber(rechargeTarget);
  const rechargeThresholdError = resolveThresholdValidationError(parsedThreshold);
  const rechargeTargetError = resolveTargetValidationError(parsedThreshold, parsedTarget);
  return {
    rechargeThresholdError,
    rechargeTargetError,
    isValid: rechargeThresholdError == null && rechargeTargetError == null,
  };
}

function parseInputNumber(value: string): ParsedNumberState {
  const trimmedValue = normalizeDraftValue(value);
  if (trimmedValue.length === 0) {
    return { kind: "missing" };
  }
  if (!/^\d+$/.test(trimmedValue)) {
    return { kind: "invalid" };
  }
  return { kind: "valid", value: Number.parseInt(trimmedValue, 10) };
}

function resolveThresholdValidationError(parsedThreshold: ParsedNumberState): ThresholdValidationError | null {
  if (parsedThreshold.kind === "missing") {
    return "missing";
  }
  if (parsedThreshold.kind === "invalid") {
    return "not-whole-number";
  }
  if (parsedThreshold.value < 125) {
    return "below-threshold-minimum";
  }
  return null;
}

function resolveTargetValidationError(
  parsedThreshold: ParsedNumberState,
  parsedTarget: ParsedNumberState,
): TargetValidationError | null {
  if (parsedTarget.kind === "missing") {
    return "missing";
  }
  if (parsedTarget.kind === "invalid") {
    return "not-whole-number";
  }
  if (parsedThreshold.kind === "valid" && parsedTarget.value - parsedThreshold.value < 125) {
    return "target-difference-too-small";
  }
  return null;
}

function normalizeDraftValue(value: string | null) {
  return value == null ? "" : value.trim();
}

function AutoTopUpInputField({
  ariaLabel,
  disabled,
  error,
  fieldId,
  footerContent,
  footerTone,
  helperText,
  label,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  error: string | null;
  fieldId: string;
  footerContent: string | null;
  footerTone: "error" | "secondary";
  helperText: string;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-lg text-token-text-secondary">
        {label}
      </label>
      <div className="text-sm leading-4 text-token-text-secondary">{helperText}</div>
      <input
        id={fieldId}
        aria-label={ariaLabel}
        aria-invalid={error != null}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-10 w-full rounded-lg border border-token-border bg-token-input-background px-3 text-left text-sm text-token-text-primary outline-none placeholder:text-token-input-placeholder-foreground focus-visible:ring-2 focus-visible:ring-token-focus aria-invalid:border-token-error-foreground aria-invalid:ring-token-error-foreground/20"
      />
      {error ? (
        <div className="text-sm text-token-error-foreground">{error}</div>
      ) : footerContent ? (
        <div className={footerTone === "error" ? "text-sm text-token-error-foreground" : "text-sm text-token-text-secondary"}>
          {footerContent}
        </div>
      ) : null}
    </div>
  );
}

function DialogBanner({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "info";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-token-error-foreground/30 bg-token-error-foreground/10 px-3 py-2 text-sm text-token-error-foreground"
          : "rounded-lg border border-token-border bg-token-main-surface-secondary px-3 py-2 text-sm text-token-text-secondary"
      }
    >
      {children}
    </div>
  );
}
