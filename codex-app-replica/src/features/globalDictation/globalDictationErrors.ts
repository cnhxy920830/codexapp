export type GlobalDictationErrorResolution = {
  canRetry: boolean;
  message: string;
};

export type GlobalDictationErrorStage = "start" | "transcription";

export type GlobalDictationErrorMessages = {
  connection: string;
  microphoneMissing: string;
  microphonePermissionDenied: string;
  microphoneUnavailable: string;
  startError: string;
  transcribeError: string;
  unsupported: string;
};

export function resolveGlobalDictationError(
  stage: GlobalDictationErrorStage,
  error: unknown,
  messages: GlobalDictationErrorMessages,
): GlobalDictationErrorResolution {
  if (stage === "transcription") {
    const message = getErrorMessage(error);
    if (message.startsWith("rate_limit:")) {
      return {
        canRetry: false,
        message: trimPrefixedMessage(message, "rate_limit:", messages.transcribeError),
      };
    }

    const normalizedMessage = message.toLowerCase();
    if (
      message.startsWith("network:") ||
      normalizedMessage.includes("fetch failed") ||
      normalizedMessage.includes("failed to fetch") ||
      normalizedMessage.includes("network")
    ) {
      return {
        canRetry: true,
        message: messages.connection,
      };
    }

    return {
      canRetry: true,
      message: messages.transcribeError,
    };
  }

  const errorName = getErrorName(error);
  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return {
      canRetry: false,
      message: messages.microphonePermissionDenied,
    };
  }

  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError" ||
    errorName === "OverconstrainedError" ||
    errorName === "ConstraintNotSatisfiedError"
  ) {
    return {
      canRetry: false,
      message: messages.microphoneMissing,
    };
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return {
      canRetry: false,
      message: messages.microphoneUnavailable,
    };
  }

  if (errorName === "NotSupportedError" || errorName === "TypeError") {
    return {
      canRetry: false,
      message: messages.unsupported,
    };
  }

  return {
    canRetry: false,
    message: messages.startError,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "";
}

function getErrorName(error: unknown) {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name;
  }

  if (error instanceof Error) {
    return error.name;
  }

  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }

  return null;
}

function trimPrefixedMessage(message: string, prefix: string, fallback: string) {
  const trimmed = message.slice(prefix.length).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
