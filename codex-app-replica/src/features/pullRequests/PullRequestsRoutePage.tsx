import { useI18n } from "../../i18n/i18n";

export function PullRequestsRoutePage() {
  const { t } = useI18n();

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-8">
      <div className="app-card flex w-full max-w-[420px] flex-col items-center rounded-[20px] px-8 py-8 text-center">
        <div className="app-title text-[18px] font-medium">{t("pullRequestsPage.empty.noRepos.title")}</div>
        <div className="app-text-muted mt-3 text-[14px] leading-6">
          {t("pullRequestsPage.empty.noRepos.description")}
        </div>
      </div>
    </div>
  );
}
