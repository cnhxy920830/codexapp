import { MarkdownPreview } from "../../components/MarkdownPreview";

type RenderMessageContentOptions = {
  cwd?: string | null;
  hostId?: string | null;
};

export function renderMessageContent(
  text: string,
  { cwd = null, hostId = null }: RenderMessageContentOptions = {},
) {
  return (
    <MarkdownPreview
      className="app-message-markdown"
      cwd={cwd}
      hostId={hostId}
      text={text}
      variant="appShell"
    />
  );
}
