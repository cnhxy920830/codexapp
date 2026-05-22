/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SETTINGS_SOURCE_PATH = path.join(process.cwd(), "src/components/UsageSettings.tsx");
const DIALOG_SOURCE_PATH = path.join(process.cwd(), "src/components/UsageAutoTopUpDialog.tsx");
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");
const HOOK_SOURCE_PATH = path.join(process.cwd(), "src/hooks/useUsageSettingsAccess.ts");

test("usage settings uses extracted settings shell and split row owners", () => {
  const source = readSource(SETTINGS_SOURCE_PATH);

  assert.match(source, /SettingsContentLayout title=\{<SettingsSectionTitle slug="usage" \/>\}/);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header title=\{sectionTitle\} \/>/s);
  assert.match(source, /<SettingsGroup>\s*<SettingsGroup\.Header title=\{t\("settings\.usage\.credit\.title"\)\} \/>/s);
  assert.match(source, /import \{ SettingsRow \} from "\.\/SettingsRow";/);
  assert.match(source, /import \{ CheckCircleFilledIcon, LinkExternalIcon \} from "\.\/AppShellIcons";/);
  assert.match(source, /<SettingsRow\s+key=\{row\.key\}\s+className="gap-6"/s);
  assert.match(source, /<SettingsRow className="gap-6" label=\{label\} control=\{control \?\? null\} \/>/);
  assert.match(source, /<UsageCreditActionRow\s+title=\{formatCreditRemaining\(creditDetails, locale, t\)\}/s);
  assert.match(source, /<UsageCreditActionRow\s+title=\{\s*<div className="flex items-center gap-1\.5">/s);
  assert.match(source, /function UsageCreditActionRow\(/);
  assert.match(source, /className="flex items-center justify-between gap-4 p-4"/);
  assert.match(source, /className="flex min-w-0 flex-1 flex-col gap-1"/);
  assert.match(source, /className="text-sm text-token-text-primary"/);
  assert.match(source, /className="text-sm text-token-text-secondary"/);
  assert.match(source, /className="flex shrink-0 items-center"/);
  assert.doesNotMatch(source, /function SettingsGroupHeader/);
  assert.doesNotMatch(source, /function SettingsSurface\(/);
  assert.doesNotMatch(source, /function SettingsRow\(/);
});

test("usage settings and app share extracted usage-access gate", () => {
  const settingsSource = readSource(SETTINGS_SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);
  const hookSource = readSource(HOOK_SOURCE_PATH);

  assert.match(settingsSource, /const \{ isUsageSettingsAccessLoading, isUsageSettingsVisible \} = useUsageSettingsAccess\(/);
  assert.match(
    appSource,
    /const \{[\s\S]*?isUsageSettingsVisible: showUsageSettings,[\s\S]*?\} = useUsageSettingsAccess\(/,
  );
  assert.doesNotMatch(appSource, /isUsageSettingsPlanSupported/);

  assert.match(hookSource, /await readAccountInfo\(\)/);
  assert.match(hookSource, /onQueryCacheInvalidated\(\(notification\) => \{/);
  assert.match(hookSource, /queryKeyMatchesPrefix\(notification\.queryKey, ACCOUNT_INFO_QUERY_KEY\)/);
  assert.match(hookSource, /const requestId = requestIdRef\.current \+ 1;/);
  assert.match(hookSource, /if \(requestId !== requestIdRef\.current\) \{/);
  assert.match(
    hookSource,
    /void loadUsageSettingsAccess\(\{\s*preserveStateOnError: true,\s*resetBeforeLoad: false,\s*\}\);/s,
  );
  assert.match(
    hookSource,
    /void loadUsageSettingsAccess\(\{\s*preserveStateOnError: false,\s*resetBeforeLoad: true,\s*\}\);/s,
  );
  assert.match(hookSource, /setState\(\(current\) => \(\{\s*isUsageSettingsAccessLoading: false,\s*isUsageSettingsVisible: current\.isUsageSettingsVisible,/s);
  assert.match(hookSource, /normalizedPlan === "plus"/);
  assert.match(hookSource, /normalizedPlan === "pro"/);
  assert.match(hookSource, /normalizedPlan === "prolite"/);
});

test("usage settings keeps extracted credit row link and active badge owner", () => {
  const source = readSource(SETTINGS_SOURCE_PATH);

  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /href=\{CREDIT_PRICING_URL\}/);
  assert.match(source, /window\.open\(CREDIT_PURCHASE_URL, "_blank", "noopener,noreferrer"\)/);
  assert.match(source, /<LinkExternalIcon className="icon-xxs" \/>/);
  assert.match(source, /<CheckCircleFilledIcon className="icon-2xs shrink-0" \/>/);
  assert.match(source, /const oneDayInSeconds = 24 \* 60 \* 60;/);
  assert.doesNotMatch(source, /<CheckIcon/);
  assert.doesNotMatch(source, /function LinkExternalIcon\(/);
});

test("usage auto top up dialog keeps extracted form submit shell and failure gating", () => {
  const source = readSource(DIALOG_SOURCE_PATH);

  assert.match(source, /<SettingsDialog\s+contentClassName="w-\[536px\] max-w-\[calc\(100vw-2rem\)\]"/s);
  assert.match(source, /onOpenAutoFocus=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(source, /shouldIgnoreClickOutside=\{isSaving\}/);
  assert.match(source, /<form\s+onSubmit=\{\(event\) => \{/s);
  assert.match(source, /event\.preventDefault\(\);/);
  assert.match(source, /<Button\s+type="submit"\s+color="primary"/s);
  assert.match(source, /<Button\s+type="button"\s+color="outline"/s);
  assert.match(source, /if \(response\.immediateTopUpStatus === "failed" \|\| response\.immediateTopUpStatus === "payment_declined"\) \{/);

  const onSavedIndex = source.indexOf("onSaved(response);");
  const failureIndex = source.indexOf('if (response.immediateTopUpStatus === "failed" || response.immediateTopUpStatus === "payment_declined") {');
  assert.ok(failureIndex >= 0);
  assert.ok(onSavedIndex > failureIndex);

  assert.match(source, /rel="noopener noreferrer"/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
