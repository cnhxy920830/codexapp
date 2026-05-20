export function renderInlineLinkMessage(
  template: string,
  href: string,
  linkClassName = "text-[var(--app-shell-accent)] underline underline-offset-2",
) {
  const tagPairs = [
    ["<a>", "</a>"] as const,
    ["<link>", "</link>"] as const,
  ];

  for (const [startTag, endTag] of tagPairs) {
    const startIndex = template.indexOf(startTag);
    const endIndex = template.indexOf(endTag);

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      continue;
    }

    const prefix = template.slice(0, startIndex);
    const linkLabel = template.slice(startIndex + startTag.length, endIndex);
    const suffix = template.slice(endIndex + endTag.length);

    return (
      <>
        {prefix}
        <a
          className={linkClassName}
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {linkLabel}
        </a>
        {suffix}
      </>
    );
  }

  return template;
}
