/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildThreadConversationInputWithPendingPdfComments,
  removePendingPdfCommentsForPath,
  type PendingPdfCommentAttachment,
} from "./pdfCommentAttachments";

function buildPendingAttachment(id: string, path: string): PendingPdfCommentAttachment {
  return {
    id,
    comment: {
      type: "comment",
      path,
      body: `Comment ${id}`,
      content: [
        {
          content_type: "text",
          text: `Comment ${id}`,
        },
      ],
      position: {
        side: "right",
        path: `pdf:${path}`,
        line: 1,
      },
      origin: "pdf",
      localPdfContext: {
        pageCount: 3,
        pageNumber: 1,
        path,
        title: "Report",
      },
      localPdfCommentMetadata: {
        kind: "point",
        pagePoint: {
          x: 10,
          y: 20,
        },
        pageSize: {
          width: 612,
          height: 792,
        },
      },
      localPdfScreenshot: null,
    },
  };
}

test("buildThreadConversationInputWithPendingPdfComments keeps comment-only submits", () => {
  const pendingAttachment = buildPendingAttachment("a1", "D:\\workspace\\docs\\report.pdf");

  const input = buildThreadConversationInputWithPendingPdfComments({
    text: "",
    pendingPdfComments: [pendingAttachment],
  });

  assert.equal(input.length, 1);
  assert.equal(input[0]?.type, "comment");
});

test("buildThreadConversationInputWithPendingPdfComments prepends text before comments", () => {
  const pendingAttachment = buildPendingAttachment("a1", "D:\\workspace\\docs\\report.pdf");

  const input = buildThreadConversationInputWithPendingPdfComments({
    text: "Summarize the selected chart.",
    pendingPdfComments: [pendingAttachment],
  });

  assert.equal(input.length, 2);
  assert.deepEqual(input[0], {
    type: "text",
    text: "Summarize the selected chart.",
    textElements: [],
  });
  assert.equal(input[1], pendingAttachment.comment);
});

test("removePendingPdfCommentsForPath clears only the current preview path", () => {
  const reportPath = "D:\\workspace\\docs\\report.pdf";
  const appendixPath = "D:\\workspace\\docs\\appendix.pdf";

  const remaining = removePendingPdfCommentsForPath(
    [buildPendingAttachment("a1", reportPath), buildPendingAttachment("a2", appendixPath)],
    reportPath,
  );

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.comment.localPdfContext?.path, appendixPath);
});
