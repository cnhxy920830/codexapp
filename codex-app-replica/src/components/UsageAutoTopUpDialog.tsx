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
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsDialog } from "./SettingsDialog";
import { Spinner } from "./Spinner";

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
  onShowToast,
  open,
  serverState,
}: {
  creditDetails: UsageCreditsSnapshot | null;
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  onShowToast?: (toast: AppToast) => void;
  open: boolean;
  serverState: UsageAutoTopUpSettings;
}) {
  const { locale, t } = useI18n();
  const thresholdInputId = useId();
  const targetInputId = useId();

  const [draftState, setDraftState] = useState<DraftState>(() => buildDraftState(serverState));
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingInfo, setPricingInfo] = useState<UsagePricingInfo | null>(null);
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [isThresholdBlurred, setIsThresholdBlurred] = useState(false);
  const [isTargetBlurred, setIsTargetBlurred] = useState(false);
  const [hasImmediateTopUpFailure, setHasImmediateTopUpFailure] = useState(false);
  const [immediateTopUpFailureAmount, setImmediateTopUpFailureAmount] = useState<string | null>(null);
  const [isManagePaymentPending, setIsManagePaymentPending] = useState(false);
  const [isSavingEnableOrUpdate, setIsSavingEnableOrUpdate] = useState(false);
  const [isSavingDisable, setIsSavingDisable] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftState(buildDraftState(serverState));
    setSubmissionAttempts(0);
    setIsThresholdBlurred(false);
    setIsTargetBlurred(false);
    setHasImmediateTopUpFailure(false);
    setImmediateTopUpFailureAmount(null);
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
  const thresholdErrorMessage = buildThresholdErrorMessage(t, validation, submissionAttempts, isThresholdBlurred);
  const targetErrorMessage = buildTargetErrorMessage(t, validation, submissionAttempts, isTargetBlurred);

  if (!open) {
    return null;
  }

  return (
    <SettingsDialog
      contentClassName="w-[536px] max-w-[calc(100vw-2rem)]"
      onOpenAutoFocus={(event) => event.preventDefault()}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving) {
          onClose();
        }
      }}
      open={open}
      shouldIgnoreClickOutside={isSaving}
      title={t("settings.usage.autoTopUp.dialog.title")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave({
            draftState,
            immediateTopUpEstimate,
            onClose,
            onSaved,
            onShowToast,
            saveIntent,
            setHasImmediateTopUpFailure,
            setImmediateTopUpFailureAmount,
            setIsSavingEnableOrUpdate,
            setSubmissionAttempts,
            t,
          });
        }}
      >
        <p className="sr-only">{t("settings.usage.autoTopUp.dialog.description")}</p>

        <div className="flex flex-col gap-5">
            <AutoTopUpInputField
              ariaLabel={t("settings.usage.autoTopUp.threshold.ariaLabel")}
              disabled={isSaving}
              error={thresholdErrorMessage}
              fieldId={thresholdInputId}
              footerContent={null}
              footerTone="error"
              helperText={t("settings.usage.autoTopUp.threshold.helper")}
              label={t("settings.usage.autoTopUp.threshold.label")}
              onBlur={() => setIsThresholdBlurred(true)}
              onChange={(value) => {
                clearImmediateFailureState(setHasImmediateTopUpFailure, setImmediateTopUpFailureAmount);
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
              onBlur={() => setIsTargetBlurred(true)}
              onChange={(value) => {
                clearImmediateFailureState(setHasImmediateTopUpFailure, setImmediateTopUpFailureAmount);
                setDraftState((current) => ({ ...current, rechargeTarget: value }));
              }}
              placeholder={DEFAULT_TARGET}
              value={draftState.rechargeTarget}
            />
            <div className="text-sm leading-5 text-token-text-secondary">
              {t("settings.usage.autoTopUp.dialog.description")}
            </div>
            {immediateTopUpEstimate != null && (saveIntent === "enable" || saveIntent === "update") ? (
              <DialogBanner tone="info">
                {renderStrongMessage(
                  saveIntent === "enable"
                    ? t("settings.usage.autoTopUp.immediateTopUpNotice.enable", {
                        amount: immediateTopUpEstimate.amount,
                        creditCount: immediateTopUpEstimate.creditCount,
                      })
                    : t("settings.usage.autoTopUp.immediateTopUpNotice.update", {
                        amount: immediateTopUpEstimate.amount,
                        creditCount: immediateTopUpEstimate.creditCount,
                      }),
                )}
              </DialogBanner>
            ) : null}
            {hasImmediateTopUpFailure ? (
              <DialogBanner tone="error">
                {renderImmediateTopUpFailureMessage({
                  isManagePaymentPending,
                  template:
                    immediateTopUpFailureAmount == null
                      ? t("settings.usage.autoTopUp.immediateTopUpFailure.generic")
                      : t("settings.usage.autoTopUp.immediateTopUpFailure.amount", {
                          amount: immediateTopUpFailureAmount,
                        }),
                  onManagePayment: () =>
                    void handleManagePayment(
                      t("settings.usage.autoTopUp.managePayment.error"),
                      onShowToast,
                      setIsManagePaymentPending,
                    ),
                })}
              </DialogBanner>
            ) : null}
        </div>

        <div className="flex w-full items-center justify-end gap-2 pt-7">
          {serverState.isEnabled ? (
            <Button
              type="button"
              color="outline"
              className="min-w-[88px] justify-center"
              loading={isSavingDisable}
              disabled={isSaving}
              onClick={() =>
                void handleDisable({
                  onClose,
                  onSaved,
                  onShowToast,
                  setIsSavingDisable,
                  t,
                })
              }
            >
              {t("settings.usage.autoTopUp.disable")}
            </Button>
          ) : (
            <Button
              type="button"
              color="outline"
              className="min-w-[88px] justify-center"
              disabled={isSaving}
              onClick={onClose}
            >
              {t("settings.usage.autoTopUp.cancel")}
            </Button>
          )}
          <Button
            type="submit"
            color="primary"
            className="min-w-[88px] justify-center"
            disabled={!isSaveEnabled}
            loading={isSavingEnableOrUpdate}
          >
            {serverState.isEnabled ? t("settings.usage.autoTopUp.save") : t("settings.usage.autoTopUp.enable")}
          </Button>
        </div>
      </form>
    </SettingsDialog>
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
) {
  setHasImmediateTopUpFailure(false);
  setImmediateTopUpFailureAmount(null);
}

function resolveThresholdError(
  validation: DialogValidationState,
  submissionAttempts: number,
  isThresholdBlurred: boolean,
) {
  return submissionAttempts > 0 || isThresholdBlurred ? validation.rechargeThresholdError : null;
}

function resolveTargetError(validation: DialogValidationState, submissionAttempts: number, isTargetBlurred: boolean) {
  return submissionAttempts > 0 || isTargetBlurred ? validation.rechargeTargetError : null;
}

function buildThresholdErrorMessage(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  validation: DialogValidationState,
  submissionAttempts: number,
  isThresholdBlurred: boolean,
) {
  const error = resolveThresholdError(validation, submissionAttempts, isThresholdBlurred);
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
    return (
      <span
        role="status"
        aria-label={t("settings.usage.autoTopUp.target.equivalent.loading")}
        className="inline-flex items-center"
      >
        <Spinner className="icon-xxs text-token-description-foreground" />
      </span>
    );
  }
  if (estimate == null) {
    return null;
  }
  return renderStrongMessage(
    t("settings.usage.autoTopUp.target.equivalent", {
      amount: estimate.amount,
      creditCount: estimate.creditCount,
    }),
  );
}

function buildTargetErrorMessage(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  validation: DialogValidationState,
  submissionAttempts: number,
  isTargetBlurred: boolean,
) {
  const error = resolveTargetError(validation, submissionAttempts, isTargetBlurred);
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
  onShowToast,
  saveIntent,
  setHasImmediateTopUpFailure,
  setImmediateTopUpFailureAmount,
  setIsSavingEnableOrUpdate,
  setSubmissionAttempts,
  t,
}: {
  draftState: DraftState;
  immediateTopUpEstimate: ImmediateTopUpEstimate | null;
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  onShowToast?: (toast: AppToast) => void;
  saveIntent: SaveIntent;
  setHasImmediateTopUpFailure: (value: boolean) => void;
  setImmediateTopUpFailureAmount: (value: string | null) => void;
  setIsSavingEnableOrUpdate: (value: boolean) => void;
  setSubmissionAttempts: (value: number | ((current: number) => number)) => void;
  t: (key: MessageKey) => string;
}) {
  setSubmissionAttempts((value) => value + 1);
  if (saveIntent !== "enable" && saveIntent !== "update") {
    return;
  }

  setIsSavingEnableOrUpdate(true);

  try {
    const params = {
      rechargeTarget: normalizeDraftValue(draftState.rechargeTarget),
      rechargeThreshold: normalizeDraftValue(draftState.rechargeThreshold),
    };
    const response =
      saveIntent === "enable" ? await enableUsageAutoTopUp(params) : await updateUsageAutoTopUp(params);

    if (response.immediateTopUpStatus === "failed" || response.immediateTopUpStatus === "payment_declined") {
      setHasImmediateTopUpFailure(true);
      setImmediateTopUpFailureAmount(immediateTopUpEstimate?.amount ?? null);
      return;
    }

    onSaved(response);
    onShowToast?.({
      tone: "success",
      message: t(
        saveIntent === "enable"
          ? "settings.usage.autoTopUp.enable.success"
          : "settings.usage.autoTopUp.update.success",
      ),
    });
    onClose();
  } catch {
    onShowToast?.({
      tone: "error",
      message: t(
        saveIntent === "enable"
          ? "settings.usage.autoTopUp.enable.error"
          : "settings.usage.autoTopUp.update.error",
      ),
    });
  } finally {
    setIsSavingEnableOrUpdate(false);
  }
}

async function handleDisable({
  onClose,
  onSaved,
  onShowToast,
  setIsSavingDisable,
  t,
}: {
  onClose: () => void;
  onSaved: (response: UsageAutoTopUpSettings) => void;
  onShowToast?: (toast: AppToast) => void;
  setIsSavingDisable: (value: boolean) => void;
  t: (key: MessageKey) => string;
}) {
  setIsSavingDisable(true);

  try {
    const response = await disableUsageAutoTopUp();
    onSaved(response);
    onShowToast?.({
      tone: "success",
      message: t("settings.usage.autoTopUp.disable.success"),
    });
    onClose();
  } catch {
    onShowToast?.({
      tone: "error",
      message: t("settings.usage.autoTopUp.disable.error"),
    });
  } finally {
    setIsSavingDisable(false);
  }
}

async function handleManagePayment(
  errorMessage: string,
  onShowToast: ((toast: AppToast) => void) | undefined,
  setIsManagePaymentPending: (value: boolean) => void,
) {
  setIsManagePaymentPending(true);

  try {
    const response = await readUsageCustomerPortal();
    window.open(response.url, "_blank", "noopener,noreferrer");
  } catch {
    onShowToast?.({
      tone: "error",
      message: errorMessage,
    });
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

function renderStrongMessage(template: string) {
  const startTag = "<strong>";
  const endTag = "</strong>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const strongText = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);
  return (
    <>
      {prefix}
      <span className="font-medium text-token-text-primary">{strongText}</span>
      {suffix}
    </>
  );
}

function renderImmediateTopUpFailureMessage({
  isManagePaymentPending,
  onManagePayment,
  template,
}: {
  isManagePaymentPending: boolean;
  onManagePayment: () => void;
  template: string;
}) {
  const actionLineStartTag = "<actionLine>";
  const actionLineEndTag = "</actionLine>";
  const actionLineStartIndex = template.indexOf(actionLineStartTag);
  const actionLineEndIndex = template.indexOf(actionLineEndTag);

  if (
    actionLineStartIndex === -1 ||
    actionLineEndIndex === -1 ||
    actionLineEndIndex < actionLineStartIndex
  ) {
    return template;
  }

  const prefix = template.slice(0, actionLineStartIndex);
  const actionLineTemplate = template.slice(
    actionLineStartIndex + actionLineStartTag.length,
    actionLineEndIndex,
  );
  const suffix = template.slice(actionLineEndIndex + actionLineEndTag.length);

  return (
    <>
      {prefix}
      <div className="mt-1">
        {renderImmediateTopUpFailureActionLine({
          actionLineTemplate,
          isManagePaymentPending,
          onManagePayment,
        })}
      </div>
      {suffix}
    </>
  );
}

function renderImmediateTopUpFailureActionLine({
  actionLineTemplate,
  isManagePaymentPending,
  onManagePayment,
}: {
  actionLineTemplate: string;
  isManagePaymentPending: boolean;
  onManagePayment: () => void;
}) {
  const managePaymentStartTag = "<managePayment>";
  const managePaymentEndTag = "</managePayment>";
  const purchaseCreditStartTag = "<purchaseCredit>";
  const purchaseCreditEndTag = "</purchaseCredit>";
  const managePaymentStartIndex = actionLineTemplate.indexOf(managePaymentStartTag);
  const managePaymentEndIndex = actionLineTemplate.indexOf(managePaymentEndTag);
  const purchaseCreditStartIndex = actionLineTemplate.indexOf(purchaseCreditStartTag);
  const purchaseCreditEndIndex = actionLineTemplate.indexOf(purchaseCreditEndTag);

  if (
    managePaymentStartIndex === -1 ||
    managePaymentEndIndex === -1 ||
    purchaseCreditStartIndex === -1 ||
    purchaseCreditEndIndex === -1 ||
    managePaymentEndIndex < managePaymentStartIndex ||
    purchaseCreditEndIndex < purchaseCreditStartIndex
  ) {
    return actionLineTemplate;
  }

  const beforeManagePayment = actionLineTemplate.slice(0, managePaymentStartIndex);
  const managePaymentLabel = actionLineTemplate.slice(
    managePaymentStartIndex + managePaymentStartTag.length,
    managePaymentEndIndex,
  );
  const betweenActions = actionLineTemplate.slice(
    managePaymentEndIndex + managePaymentEndTag.length,
    purchaseCreditStartIndex,
  );
  const purchaseCreditLabel = actionLineTemplate.slice(
    purchaseCreditStartIndex + purchaseCreditStartTag.length,
    purchaseCreditEndIndex,
  );
  const afterPurchaseCredit = actionLineTemplate.slice(
    purchaseCreditEndIndex + purchaseCreditEndTag.length,
  );

  return (
    <>
      {beforeManagePayment}
      <a
        href="#"
        aria-disabled={isManagePaymentPending}
        onClick={(event) => {
          event.preventDefault();
          if (!isManagePaymentPending) {
            onManagePayment();
          }
        }}
        className={joinClasses(
          "font-medium underline underline-offset-2",
          isManagePaymentPending && "pointer-events-none opacity-60",
        )}
      >
        {managePaymentLabel}
      </a>
      {betweenActions}
      <a
        href={CREDIT_PURCHASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2"
      >
        {purchaseCreditLabel}
      </a>
      {afterPurchaseCredit}
    </>
  );
}

function joinClasses(...values: Array<string | false>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
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
  footerContent: ReactNode;
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
