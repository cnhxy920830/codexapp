export function renderInlineLinkMessage(template: string, href: string) {
  const startTag = "<a>";
  const endTag = "</a>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const linkLabel = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <>
      {prefix}
      <a
        className="text-[var(--app-shell-accent)] underline underline-offset-2"
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
