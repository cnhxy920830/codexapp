import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from "react";

export type SectionedPageSection = {
  id: string;
  title: ReactNode;
};

type Props = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  contentInnerClassName?: string;
  disableScrollFade?: boolean;
  header?: ReactNode;
  sections?: SectionedPageSection[];
  showNav?: boolean;
};

const SECTION_SCROLL_OFFSET_PX = 96;

type SectionRegistryContextValue = {
  setSectionElement: (id: string, element: HTMLElement | null) => void;
};

const SectionRegistryContext = createContext<SectionRegistryContextValue | null>(null);

function getSectionLabel(title: ReactNode) {
  return typeof title === "string" ? title : null;
}

function useActiveSectionId(
  container: HTMLDivElement | null,
  sectionElementsRef: MutableRefObject<Record<string, HTMLElement>>,
  sectionIds: string[],
) {
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => {
      if (container == null) {
        return () => {};
      }

      const notify = () => {
        onStoreChange();
      };

      container.addEventListener("scroll", notify, { passive: true });
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(notify);
      if (resizeObserver !== null) {
        resizeObserver.observe(container);
        for (const sectionId of sectionIds) {
          const sectionElement = sectionElementsRef.current[sectionId];
          if (sectionElement != null) {
            resizeObserver.observe(sectionElement);
          }
        }
      }

      return () => {
        container.removeEventListener("scroll", notify);
        resizeObserver?.disconnect();
      };
    },
    [container, sectionElementsRef, sectionIds],
  );

  const getSnapshot = useMemo(
    () => () => {
      if (sectionIds.length === 0) {
        return null;
      }
      if (container == null) {
        return sectionIds[0] ?? null;
      }

      const thresholdTop = container.getBoundingClientRect().top + SECTION_SCROLL_OFFSET_PX;
      let activeSectionId = sectionIds[0] ?? null;
      for (const sectionId of sectionIds) {
        const sectionElement = sectionElementsRef.current[sectionId];
        if (sectionElement == null) {
          continue;
        }

        if (sectionElement.getBoundingClientRect().top <= thresholdTop) {
          activeSectionId = sectionId;
        } else {
          break;
        }
      }

      return activeSectionId;
    },
    [container, sectionElementsRef, sectionIds],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function SectionedPage({
  ariaLabel,
  children,
  className,
  contentInnerClassName,
  disableScrollFade = false,
  header,
  sections,
  showNav = true,
}: Props) {
  const visibleSections = sections?.filter((section) => getSectionLabel(section.title) !== null) ?? [];
  const sectionIds = visibleSections.map((section) => section.id);
  const scrollMaskClassName = disableScrollFade
    ? null
    : "vertical-scroll-fade-mask [--edge-fade-distance:1rem]";
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const sectionElementsRef = useRef<Record<string, HTMLElement>>({});
  const activeSectionId = useActiveSectionId(
    scrollContainer,
    sectionElementsRef,
    sectionIds,
  );
  const sectionRegistryValue = useMemo<SectionRegistryContextValue>(
    () => ({
      setSectionElement: (id, element) => {
        if (element == null) {
          delete sectionElementsRef.current[id];
          return;
        }
        sectionElementsRef.current[id] = element;
      },
    }),
    [],
  );

  useEffect(() => {
    if (scrollContainerRef.current !== scrollContainer) {
      setScrollContainer(scrollContainerRef.current);
    }
  }, [scrollContainer]);

  const handleNavSelect = (sectionId: string) => {
    sectionElementsRef.current[sectionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      aria-label={ariaLabel}
      className={[
        "flex min-h-0 w-full flex-1 flex-col gap-8 [--sectioned-page-leading-inset:0.5rem]",
        className ?? "",
      ].join(" ")}
    >
      {header ? (
        <div className="mx-auto flex w-full max-w-[var(--thread-content-max-width)] flex-col gap-1 px-panel pt-panel">
          {header}
        </div>
      ) : null}
      {showNav && visibleSections.length > 0 ? (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label={ariaLabel}>
          {visibleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-pressed={activeSectionId === section.id}
              className={joinClasses(
                "app-control rounded-full px-3 py-1.5 text-[12px]",
                activeSectionId === section.id ? "text-token-foreground" : null,
              )}
              onClick={() => handleNavSelect(section.id)}
            >
              {getSectionLabel(section.title)}
            </button>
          ))}
        </nav>
      ) : null}
      <div
        className={[
          "relative min-h-0 w-full flex-1 overflow-y-auto [scrollbar-gutter:stable] lg:h-full",
          scrollMaskClassName ?? "",
        ].join(" ")}
        ref={scrollContainerRef}
      >
        <SectionRegistryContext.Provider value={sectionRegistryValue}>
          <div
            className={[
              "mx-auto w-full max-w-[var(--thread-content-max-width)]",
              contentInnerClassName ?? "",
            ].join(" ")}
          >
            {children}
          </div>
        </SectionRegistryContext.Provider>
      </div>
    </div>
  );
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

type SectionProps = {
  action?: ReactNode;
  children: ReactNode;
  id: string;
  showDivider?: boolean;
  title: ReactNode;
};

export function SectionedPageSection({
  action,
  children,
  id,
  showDivider = true,
  title,
}: SectionProps) {
  const registry = useContext(SectionRegistryContext);
  const sectionRef = (element: HTMLElement | null) => {
    registry?.setSectionElement(id, element);
  };

  return (
    <section ref={sectionRef} id={id} className="flex flex-col gap-4">
      <div
        className={[
          "flex items-center justify-between gap-3 [padding-inline-start:var(--sectioned-page-leading-inset,0.5rem)] pr-0.5 pb-2",
          showDivider ? "border-b border-token-border-light" : "",
        ].join(" ")}
      >
        <div className="text-lg leading-6 font-medium text-token-foreground">
          {title}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
