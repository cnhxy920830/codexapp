export type ScratchpadRowState =
  | "draft"
  | "starting"
  | "started"
  | "queued_follow_up"
  | "sending_follow_up"
  | "error";

export type ScratchpadRow = {
  id: string;
  state: ScratchpadRowState;
  text: string;
  isIndented: boolean;
  conversationId: string | null;
  turnId: string | null;
  parentRowId: string | null;
  createdAtMs: number | null;
  error: string | null;
};

export type RowSummaryState =
  | {
      status: "idle";
      message: string | null;
      summary: string | null;
    }
  | {
      status: "loading";
      message: string;
      summary: null;
    }
  | {
      status: "ready";
      message: string;
      summary: string | null;
    }
  | {
      status: "error";
      message: string;
      summary: null;
    };

export type ThreadRuntimeState = {
  pendingApprovalTurnIds: Set<string>;
  pendingUserInputTurnIds: Set<string>;
};
