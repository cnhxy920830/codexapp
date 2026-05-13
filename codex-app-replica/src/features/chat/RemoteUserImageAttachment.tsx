import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  readRemoteTaskImageAsset,
  type RemoteTaskUserImageAttachment,
} from "../../services/remoteTasks";

export function RemoteUserImageAttachment({
  attachment,
}: {
  attachment: RemoteTaskUserImageAttachment;
}) {
  const { t } = useI18n();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { isError, isLoading, refetch, src } = useRemoteUserImageAttachmentSrc(attachment);

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPreviewOpen]);

  if (isError) {
    return null;
  }

  const altText = t("codex.remoteConversation.userImageAttachment");
  const closeLabel = t("codex.remoteConversation.closeImagePreview");

  if (isLoading || !src) {
    return (
      <div
        className="flex size-16 items-center justify-center rounded-md border border-[var(--app-shell-border)] bg-[var(--app-shell-card-bg-weak)] text-sm text-[var(--app-shell-subtle)]"
        aria-label={t("codex.remoteConversation.loadingImage")}
      >
        …
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={altText}
        onClick={() => setIsPreviewOpen(true)}
        className="size-16 cursor-zoom-in overflow-hidden rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-shell-accent)]"
      >
        <img
          src={src}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          className="h-full w-full rounded-md object-contain"
          referrerPolicy="no-referrer"
          onError={() => void refetch()}
          alt={altText}
        />
      </button>
      {isPreviewOpen ? (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.72)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={closeLabel}
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setIsPreviewOpen(false)}
            className="app-control absolute top-4 right-4 rounded-full px-3 py-1.5 text-[13px]"
          >
            ×
          </button>
          <div
            className="w-full max-w-[min(90vw,calc(var(--thread-content-max-width)+16rem))]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={src}
              width={attachment.width ?? undefined}
              height={attachment.height ?? undefined}
              className="max-h-[90vh] w-full object-contain"
              referrerPolicy="no-referrer"
              onError={() => void refetch()}
              alt={altText}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function useRemoteUserImageAttachmentSrc(attachment: RemoteTaskUserImageAttachment) {
  const [requestNonce, setRequestNonce] = useState(0);
  const [state, setState] = useState<{
    src: string | null;
    isLoading: boolean;
    isError: boolean;
  }>(() => ({
    src: attachment.assetPointer === null ? (attachment.directUrl ?? null) : null,
    isLoading: attachment.assetPointer !== null,
    isError: false,
  }));

  useEffect(() => {
    if (attachment.assetPointer) {
      let isDisposed = false;
      let objectUrl: string | null = null;

      setState({
        src: null,
        isLoading: true,
        isError: false,
      });

      void readRemoteTaskImageAsset({
        assetPointer: attachment.assetPointer,
      })
        .then((response) => {
          if (isDisposed) {
            return;
          }
          objectUrl = createObjectUrlFromBase64(
            response.contentsBase64,
            response.contentType ?? "application/octet-stream",
          );
          setState({
            src: objectUrl,
            isLoading: false,
            isError: false,
          });
        })
        .catch(() => {
          if (isDisposed) {
            return;
          }
          if (attachment.directUrl) {
            setState({
              src: attachment.directUrl,
              isLoading: false,
              isError: false,
            });
            return;
          }
          setState({
            src: null,
            isLoading: false,
            isError: true,
          });
        });

      return () => {
        isDisposed = true;
        if (objectUrl && objectUrl.startsWith("blob:")) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    if (attachment.directUrl) {
      setState({
        src: attachment.directUrl,
        isLoading: false,
        isError: false,
      });
      return;
    }

    if (!attachment.assetPointer) {
      setState({
        src: null,
        isLoading: false,
        isError: true,
      });
      return;
    }

  }, [attachment.assetPointer, attachment.directUrl, requestNonce]);

  return {
    ...state,
    refetch: () => {
      if (attachment.assetPointer === null) {
        setState({
          src: null,
          isLoading: false,
          isError: true,
        });
        return;
      }
      setRequestNonce((current) => current + 1);
    },
  };
}

function createObjectUrlFromBase64(contentsBase64: string, contentType: string) {
  const binary = atob(contentsBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}
