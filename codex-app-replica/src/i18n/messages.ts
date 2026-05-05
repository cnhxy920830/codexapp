export const UPSTREAM_LOCALE_CODES = [
  "en-US",
  "am",
  "ar",
  "bg-BG",
  "bn-BD",
  "bs-BA",
  "ca-ES",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "es-419",
  "es-ES",
  "et-EE",
  "fa",
  "fi-FI",
  "fr-CA",
  "fr-FR",
  "gu-IN",
  "hi-IN",
  "hr-HR",
  "hu-HU",
  "hy-AM",
  "id-ID",
  "is-IS",
  "it-IT",
  "ja-JP",
  "ka-GE",
  "kk",
  "kn-IN",
  "ko-KR",
  "lt",
  "lv-LV",
  "mk-MK",
  "ml",
  "mn",
  "mr-IN",
  "ms-MY",
  "my-MM",
  "nb-NO",
  "nl-NL",
  "pa",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sl-SI",
  "so-SO",
  "sq-AL",
  "sr-RS",
  "sv-SE",
  "sw-TZ",
  "ta-IN",
  "te-IN",
  "th-TH",
  "tl",
  "tr-TR",
  "uk-UA",
  "ur",
  "vi-VN",
  "zh-CN",
  "zh-HK",
  "zh-TW",
] as const;

export type LocaleCode = (typeof UPSTREAM_LOCALE_CODES)[number];
type MessageLocaleCode = "en-US" | "zh-CN";

export type MessageKey =
  | "app.menu.file"
  | "app.menu.edit"
  | "app.menu.view"
  | "app.menu.window"
  | "app.menu.help"
  | "app.nav.newChat"
  | "app.nav.search"
  | "app.nav.skills"
  | "app.nav.plugins"
  | "app.nav.automation"
  | "app.nav.settings"
  | "app.shell.appMenu"
  | "app.shell.back"
  | "app.shell.forward"
  | "app.shell.settings"
  | "app.shell.share"
  | "app.chat.noRecentThreads"
  | "app.chat.noMessages"
  | "app.chat.changedFiles"
  | "app.chat.undo"
  | "app.chat.viewDiff"
  | "app.chat.commit"
  | "app.chat.document"
  | "app.chat.open"
  | "app.chat.projects"
  | "app.chat.inspector"
  | "app.chat.openFiles"
  | "app.chat.openProject"
  | "app.chat.agentsMd"
  | "app.chat.filesChanged"
  | "app.inspector.bullet.targetVersion"
  | "app.inspector.bullet.resourceFirst"
  | "app.inspector.bullet.currentWork"
  | "app.inspector.bullet.compareArtifacts"
  | "general.title"
  | "general.appearance"
  | "general.usePointerCursors"
  | "general.uiFontSize"
  | "general.codeFontSize"
  | "general.loading"
  | "general.saving"
  | "general.loaded"
  | "general.language"
  | "general.languageAuto"
  | "general.languageEnglish"
  | "general.languageChineseSimplified"
  | "settings.general"
  | "settings.configuration"
  | "settings.backToApp"
  | "settings.title"
  | "settings.sectionApp"
  | "settings.sectionHost"
  | "settings.agent.title"
  | "settings.agent.subtitle"
  | "settings.agent.customConfig"
  | "settings.agent.openConfigToml"
  | "settings.agent.approvalPolicy"
  | "settings.agent.approval.untrusted"
  | "settings.agent.approval.onFailure"
  | "settings.agent.approval.onRequest"
  | "settings.agent.approval.never"
  | "settings.agent.sandboxMode"
  | "settings.agent.sandbox.readOnly"
  | "settings.agent.sandbox.workspaceWrite"
  | "settings.agent.sandbox.fullAccess"
  | "settings.agent.allowNetworkAccess"
  | "settings.agent.openSourceLicenses"
  | "settings.agent.thirdPartyNotices"
  | "settings.agent.view"
  | "settings.agent.version"
  | "settings.agent.scope.userConfig"
  | "settings.agent.scope.adminConfig"
  | "settings.agent.loaded"
  | "auth.signOut"
  | "auth.signIn"
  | "auth.apiKey"
  | "auth.deviceCode"
  | "auth.checking"
  | "auth.signingIn"
  | "auth.signedOut"
  | "auth.ready"
  | "auth.chatGpt"
  | "auth.openAiApiKey"
  | "auth.loginRequired"
  | "auth.cancel"
  | "auth.saveKey"
  | "auth.completeBrowserSignIn"
  | "auth.openBrowser"
  | "auth.copy"
  | "history.noMessageYet";

type MessageDictionary = Record<MessageKey, string>;

export const DEFAULT_LOCALE: LocaleCode = "en-US";

export const SUPPORTED_LOCALES = ["auto", ...UPSTREAM_LOCALE_CODES] as const;

const LOCALE_LOOKUP = new Map(UPSTREAM_LOCALE_CODES.map((code) => [normalizeLocaleCode(code), code]));

export function normalizeLocaleCode(value: string) {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

export function resolveSupportedLocale(value: unknown): LocaleCode | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const normalized = normalizeLocaleCode(value);
  const exactMatch = LOCALE_LOOKUP.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }
  const [language] = normalized.split("-");
  if (!language) {
    return null;
  }
  return (
    UPSTREAM_LOCALE_CODES.find((code) => {
      const supportedCode = normalizeLocaleCode(code);
      return supportedCode === language || supportedCode.startsWith(`${language}-`);
    }) ?? null
  );
}

export function getMessageLocale(locale: LocaleCode | null | undefined): MessageLocaleCode {
  return locale && normalizeLocaleCode(locale).startsWith("zh") ? "zh-CN" : "en-US";
}

export function getLocaleLabel(code: LocaleCode, displayLocale: LocaleCode) {
  try {
    return new Intl.DisplayNames([displayLocale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const MESSAGES: Record<MessageLocaleCode, MessageDictionary> = {
  "en-US": {
    "app.menu.file": "File",
    "app.menu.edit": "Edit",
    "app.menu.view": "View",
    "app.menu.window": "Window",
    "app.menu.help": "Help",
    "app.nav.newChat": "New chat",
    "app.nav.search": "Search",
    "app.nav.skills": "Skills",
    "app.nav.plugins": "Plugins",
    "app.nav.automation": "Automation",
    "app.nav.settings": "Settings",
    "app.shell.appMenu": "App menu",
    "app.shell.back": "Back",
    "app.shell.forward": "Forward",
    "app.shell.settings": "Settings",
    "app.shell.share": "Share",
    "app.chat.noRecentThreads": "No recent conversations",
    "app.chat.noMessages": "No messages",
    "app.chat.changedFiles": "1 file changed",
    "app.chat.undo": "Undo",
    "app.chat.viewDiff": "View diff",
    "app.chat.commit": "Commit",
    "app.chat.document": "Document · MD",
    "app.chat.open": "Open",
    "app.chat.projects": "PROJECTS",
    "app.chat.inspector": "INSPECTOR",
    "app.chat.openFiles": "OPEN FILES",
    "app.chat.openProject": "OPEN PROJECT",
    "app.chat.agentsMd": "AGENTS.MD",
    "app.chat.filesChanged": "1 file changed",
    "app.inspector.bullet.targetVersion": "Target app version fixed at 26.429.3425.0.",
    "app.inspector.bullet.resourceFirst": "Resource extraction stays ahead of approximation work.",
    "app.inspector.bullet.currentWork": "Current work stays focused on shell density and header structure.",
    "app.inspector.bullet.compareArtifacts": "All comparison artifacts continue to live under compare/.",
    "general.title": "General",
    "general.appearance": "Appearance",
    "general.usePointerCursors": "Use pointer cursors",
    "general.uiFontSize": "UI font size",
    "general.codeFontSize": "Code font size",
    "general.loading": "Loading",
    "general.saving": "Saving",
    "general.loaded": "Global settings loaded",
    "general.language": "Language",
    "general.languageAuto": "Auto Detect",
    "general.languageEnglish": "English",
    "general.languageChineseSimplified": "Chinese (Simplified)",
    "settings.general": "General",
    "settings.configuration": "Configuration",
    "settings.backToApp": "Back to app",
    "settings.title": "SETTINGS",
    "settings.sectionApp": "APP",
    "settings.sectionHost": "HOST",
    "settings.agent.title": "Configuration",
    "settings.agent.subtitle": "Approval policy and sandbox settings",
    "settings.agent.customConfig": "Custom config.toml settings",
    "settings.agent.openConfigToml": "Open config.toml",
    "settings.agent.approvalPolicy": "Approval policy",
    "settings.agent.approval.untrusted": "Untrusted",
    "settings.agent.approval.onFailure": "On failure",
    "settings.agent.approval.onRequest": "On request",
    "settings.agent.approval.never": "Never",
    "settings.agent.sandboxMode": "Sandbox mode",
    "settings.agent.sandbox.readOnly": "Read only",
    "settings.agent.sandbox.workspaceWrite": "Workspace write",
    "settings.agent.sandbox.fullAccess": "Full access",
    "settings.agent.allowNetworkAccess": "Allow network access",
    "settings.agent.openSourceLicenses": "Open source licenses",
    "settings.agent.thirdPartyNotices": "Third-party notices for bundled dependencies",
    "settings.agent.view": "View",
    "settings.agent.version": "version",
    "settings.agent.scope.userConfig": "User config",
    "settings.agent.scope.adminConfig": "Admin config",
    "settings.agent.loaded": "configuration loaded",
    "auth.signOut": "Sign out",
    "auth.signIn": "Sign in",
    "auth.apiKey": "API key",
    "auth.deviceCode": "Device code",
    "auth.checking": "Checking",
    "auth.signingIn": "Signing in",
    "auth.signedOut": "Signed out",
    "auth.ready": "Ready",
    "auth.chatGpt": "ChatGPT",
    "auth.openAiApiKey": "OpenAI API key",
    "auth.loginRequired": "Login required",
    "auth.cancel": "Cancel",
    "auth.saveKey": "Save key",
    "auth.completeBrowserSignIn": "Complete sign-in in your browser.",
    "auth.openBrowser": "Open browser",
    "auth.copy": "Copy",
    "history.noMessageYet": "(no message yet)",
  },
  "zh-CN": {
    "app.menu.file": "文件",
    "app.menu.edit": "编辑",
    "app.menu.view": "查看",
    "app.menu.window": "窗口",
    "app.menu.help": "帮助",
    "app.nav.newChat": "新对话",
    "app.nav.search": "搜索",
    "app.nav.skills": "技能",
    "app.nav.plugins": "插件",
    "app.nav.automation": "自动化",
    "app.nav.settings": "设置",
    "app.shell.appMenu": "应用菜单",
    "app.shell.back": "返回",
    "app.shell.forward": "前进",
    "app.shell.settings": "设置",
    "app.shell.share": "共享",
    "app.chat.noRecentThreads": "暂无最近会话",
    "app.chat.noMessages": "暂无消息",
    "app.chat.changedFiles": "1 个文件已更改",
    "app.chat.undo": "撤销",
    "app.chat.viewDiff": "查看差异",
    "app.chat.commit": "提交",
    "app.chat.document": "文档 · MD",
    "app.chat.open": "打开",
    "app.chat.projects": "项目",
    "app.chat.inspector": "检查",
    "app.chat.openFiles": "打开的文件",
    "app.chat.openProject": "打开项目",
    "app.chat.agentsMd": "AGENTS.MD",
    "app.chat.filesChanged": "1 个文件已更改",
    "app.inspector.bullet.targetVersion": "目标应用版本固定为 26.429.3425.0。",
    "app.inspector.bullet.resourceFirst": "资源提取优先于近似实现。",
    "app.inspector.bullet.currentWork": "当前工作聚焦 shell 密度、本地化和设置对齐。",
    "app.inspector.bullet.compareArtifacts": "所有比较产物继续保存在 compare/ 目录下。",
    "general.title": "通用",
    "general.appearance": "外观",
    "general.usePointerCursors": "使用指针光标",
    "general.uiFontSize": "界面字体大小",
    "general.codeFontSize": "代码字体大小",
    "general.loading": "正在加载",
    "general.saving": "正在保存",
    "general.loaded": "全局设置已加载",
    "general.language": "语言",
    "general.languageAuto": "自动检测",
    "general.languageEnglish": "英语",
    "general.languageChineseSimplified": "简体中文",
    "settings.general": "通用",
    "settings.configuration": "配置",
    "settings.backToApp": "返回应用",
    "settings.title": "设置",
    "settings.sectionApp": "应用",
    "settings.sectionHost": "主机",
    "settings.agent.title": "配置",
    "settings.agent.subtitle": "审批策略和沙箱设置",
    "settings.agent.customConfig": "自定义 config.toml 设置",
    "settings.agent.openConfigToml": "打开 config.toml",
    "settings.agent.approvalPolicy": "审批策略",
    "settings.agent.approval.untrusted": "不受信任",
    "settings.agent.approval.onFailure": "失败时",
    "settings.agent.approval.onRequest": "按需",
    "settings.agent.approval.never": "从不",
    "settings.agent.sandboxMode": "沙箱模式",
    "settings.agent.sandbox.readOnly": "只读",
    "settings.agent.sandbox.workspaceWrite": "工作区写入",
    "settings.agent.sandbox.fullAccess": "完全访问",
    "settings.agent.allowNetworkAccess": "允许网络访问",
    "settings.agent.openSourceLicenses": "开源许可证",
    "settings.agent.thirdPartyNotices": "捆绑依赖的第三方声明",
    "settings.agent.view": "查看",
    "settings.agent.version": "版本",
    "settings.agent.scope.userConfig": "用户配置",
    "settings.agent.scope.adminConfig": "管理员配置",
    "settings.agent.loaded": "配置已加载",
    "auth.signOut": "退出登录",
    "auth.signIn": "登录",
    "auth.apiKey": "API 密钥",
    "auth.deviceCode": "设备代码",
    "auth.checking": "检查中",
    "auth.signingIn": "登录中",
    "auth.signedOut": "已退出登录",
    "auth.ready": "就绪",
    "auth.chatGpt": "ChatGPT",
    "auth.openAiApiKey": "OpenAI API 密钥",
    "auth.loginRequired": "需要登录",
    "auth.cancel": "取消",
    "auth.saveKey": "保存密钥",
    "auth.completeBrowserSignIn": "请在浏览器中完成登录。",
    "auth.openBrowser": "打开浏览器",
    "auth.copy": "复制",
    "history.noMessageYet": "(暂无消息)",
  },
};
