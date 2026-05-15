import { MarkdownPreview } from "../../../components/MarkdownPreview";

type SkillMarkdownPreviewProps = {
  text: string;
};

export function SkillMarkdownPreview({ text }: SkillMarkdownPreviewProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4">
      <MarkdownPreview text={text} variant="appShell" />
    </div>
  );
}
