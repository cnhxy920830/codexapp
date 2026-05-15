import type {
  ThreadConversationUserComment,
  ThreadConversationUserInput,
  ThreadConversationUserInputComment,
} from "../../services/history";

export type PendingPdfCommentAttachment = {
  id: string;
  comment: ThreadConversationUserInputComment;
};

export function buildThreadConversationInputWithPendingPdfComments(params: {
  text: string;
  pendingPdfComments: PendingPdfCommentAttachment[];
}): ThreadConversationUserInput[] {
  const input: ThreadConversationUserInput[] = [];
  const trimmedText = params.text.trim();
  if (trimmedText.length > 0) {
    input.push({
      type: "text",
      text: trimmedText,
      textElements: [],
    });
  }
  input.push(...params.pendingPdfComments.map(({ comment }) => comment));
  return input;
}

export function createPendingPdfCommentAttachment(comment: ThreadConversationUserInputComment): PendingPdfCommentAttachment {
  return {
    id: createPendingPdfCommentAttachmentId(),
    comment,
  };
}

export function filterPendingPdfCommentsForPath(
  pendingPdfComments: PendingPdfCommentAttachment[],
  path: string,
) {
  return pendingPdfComments.filter(
    ({ comment }) => comment.localPdfContext?.path === path,
  );
}

export function removePendingPdfCommentsForPath(
  pendingPdfComments: PendingPdfCommentAttachment[],
  path: string,
) {
  return pendingPdfComments.filter(
    ({ comment }) => comment.localPdfContext?.path !== path,
  );
}

export function getNextPdfCommentNumber(params: {
  comments: ThreadConversationUserComment[];
  pendingPdfComments: PendingPdfCommentAttachment[];
}) {
  const submittedLineNumbers = params.comments.map((comment) => comment.position?.line ?? 0);
  const pendingLineNumbers = params.pendingPdfComments.map(
    ({ comment }) => comment.position?.line ?? 0,
  );
  return Math.max(0, ...submittedLineNumbers, ...pendingLineNumbers) + 1;
}

function createPendingPdfCommentAttachmentId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `pending-pdf-comment:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}
