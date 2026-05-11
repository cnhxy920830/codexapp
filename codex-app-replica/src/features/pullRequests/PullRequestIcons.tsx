import type { PullRequestBoardState, PullRequestCheck } from "../../services/pullRequests";

type IconProps = {
  className?: string;
};

export function PullRequestStateIcon({
  className,
  state,
}: {
  className?: string;
  state: PullRequestBoardState;
}) {
  switch (state) {
    case "draft":
      return <DraftPullRequestIcon className={className} />;
    case "merged":
      return <MergedPullRequestIcon className={className} />;
    case "failing":
    case "in_progress":
    case "ready":
      return <OpenPullRequestIcon className={className} />;
  }
}

export function PullRequestStateColorClass(state: PullRequestBoardState) {
  switch (state) {
    case "draft":
      return "text-[var(--app-shell-subtle)]";
    case "merged":
      return "text-violet-600 dark:text-violet-400";
    case "failing":
      return "text-[var(--app-shell-error-text)]";
    case "in_progress":
      return "text-amber-600 dark:text-amber-400";
    case "ready":
      return "text-emerald-600 dark:text-emerald-400";
  }
}

export function CheckStatusIcon({
  className,
  status,
}: {
  className?: string;
  status: PullRequestCheck["status"];
}) {
  switch (status) {
    case "passing":
    case "successful":
      return <CheckCircleIcon className={className} />;
    case "failing":
      return <CrossCircleIcon className={className} />;
    case "pending":
      return <PendingCircleIcon className={className} />;
    default:
      return <UnknownCircleIcon className={className} />;
  }
}

export function ActivityEventIcon({
  className,
  event,
}: {
  className?: string;
  event: string;
}) {
  switch (event) {
    case "approved":
      return <CheckCircleIcon className={className} />;
    case "changes_requested":
      return <CrossCircleIcon className={className} />;
    case "merged":
      return <MergedPullRequestIcon className={className} />;
    case "opened":
      return <OpenPullRequestIcon className={className} />;
    default:
      return <UnknownCircleIcon className={className} />;
  }
}

export function DraftPullRequestIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.4375 5.99609C5.4375 5.40929 5.9132 4.93359 6.5 4.93359C7.0868 4.93359 7.5625 5.40929 7.5625 5.99609C7.5625 6.5829 7.0868 7.05859 6.5 7.05859C5.9132 7.05859 5.4375 6.5829 5.4375 5.99609ZM6.5 3.05859C4.87766 3.05859 3.5625 4.37376 3.5625 5.99609C3.5625 7.29062 4.39988 8.38957 5.56252 8.78082V15.2114C4.39988 15.6026 3.5625 16.7016 3.5625 17.9961C3.5625 19.6184 4.87766 20.9336 6.5 20.9336C8.12234 20.9336 9.4375 19.6184 9.4375 17.9961C9.4375 16.7016 8.60014 15.6026 7.43752 15.2114V8.78081C8.60014 8.38955 9.4375 7.29061 9.4375 5.99609C9.4375 4.37376 8.12234 3.05859 6.5 3.05859ZM5.4375 17.9961C5.4375 17.4093 5.9132 16.9336 6.5 16.9336C7.0868 16.9336 7.5625 17.4093 7.5625 17.9961C7.5625 18.5829 7.0868 19.0586 6.5 19.0586C5.9132 19.0586 5.4375 18.5829 5.4375 17.9961ZM17.5 16.9336C16.9132 16.9336 16.4375 17.4093 16.4375 17.9961C16.4375 18.5829 16.9132 19.0586 17.5 19.0586C18.0868 19.0586 18.5625 18.5829 18.5625 17.9961C18.5625 17.4093 18.0868 16.9336 17.5 16.9336ZM14.5625 17.9961C14.5625 16.3738 15.8777 15.0586 17.5 15.0586C19.1224 15.0586 20.4375 16.3738 20.4375 17.9961C20.4375 19.6184 19.1224 20.9336 17.5 20.9336C15.8777 20.9336 14.5625 19.6184 14.5625 17.9961ZM19 6C19 6.82843 18.3284 7.5 17.5 7.5C16.6716 7.5 16 6.82843 16 6C16 5.17157 16.6716 4.5 17.5 4.5C18.3284 4.5 19 5.17157 19 6ZM17.5 12.75C18.3284 12.75 19 12.0784 19 11.25C19 10.4216 18.3284 9.75 17.5 9.75C16.6716 9.75 16 10.4216 16 11.25C16 12.0784 16.6716 12.75 17.5 12.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OpenPullRequestIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 5C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7C6.55228 7 7 6.55228 7 6C7 5.44772 6.55228 5 6 5ZM3 6C3 4.34315 4.34315 3 6 3C7.30622 3 8.41746 3.83481 8.82929 5H15C17.2091 5 19 6.79086 19 9V15.1707C20.1652 15.5825 21 16.6938 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18C15 16.6938 15.8348 15.5825 17 15.1707V9C17 7.89543 16.1046 7 15 7H8.82929C8.52801 7.85241 7.85241 8.52801 7 8.82929V15.1707C8.16519 15.5825 9 16.6938 9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.6938 3.83481 15.5825 5 15.1707V8.82929C3.83481 8.41746 3 7.30622 3 6ZM6 17C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19C6.55228 19 7 18.5523 7 18C7 17.4477 6.55228 17 6 17ZM17 18C17 17.4477 17.4477 17 18 17C18.5523 17 19 17.4477 19 18C19 18.5523 18.5523 19 18 19C17.4477 19 17 18.5523 17 18Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MergedPullRequestIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.4375 5.99609C5.4375 5.40929 5.9132 4.93359 6.5 4.93359C7.0868 4.93359 7.5625 5.40929 7.5625 5.99609C7.5625 6.5829 7.0868 7.05859 6.5 7.05859C5.9132 7.05859 5.4375 6.5829 5.4375 5.99609ZM6.5 3.05859C4.87766 3.05859 3.5625 4.37376 3.5625 5.99609C3.5625 7.29062 4.39988 8.38957 5.56252 8.78082V15.2114C4.39988 15.6026 3.5625 16.7016 3.5625 17.9961C3.5625 19.6184 4.87766 20.9336 6.5 20.9336C8.12234 20.9336 9.4375 19.6184 9.4375 17.9961C9.4375 16.7016 8.60014 15.6026 7.43752 15.2114V8.78082C8.60014 8.38957 9.4375 7.29062 9.4375 5.99609C9.4375 4.37376 8.12234 3.05859 6.5 3.05859ZM5.4375 17.9961C5.4375 17.4093 5.9132 16.9336 6.5 16.9336C7.0868 16.9336 7.5625 17.4093 7.5625 17.9961C7.5625 18.5829 7.0868 19.0586 6.5 19.0586C5.9132 19.0586 5.4375 18.5829 5.4375 17.9961ZM17.5 16.9414C17.5299 16.9414 17.5596 16.94 17.5888 16.9373C18.1341 16.9824 18.5625 17.4392 18.5625 17.9961C18.5625 18.5829 18.0868 19.0586 17.5 19.0586C16.9132 19.0586 16.4375 18.5829 16.4375 17.9961C16.4375 17.4392 16.866 16.9824 17.4112 16.9373C17.4404 16.94 17.47 16.9414 17.5 16.9414ZM18.4375 11.0039V15.2114C19.6001 15.6026 20.4375 16.7016 20.4375 17.9961C20.4375 19.6184 19.1224 20.9336 17.5 20.9336C15.8777 20.9336 14.5625 19.6184 14.5625 17.9961C14.5625 16.7016 15.3999 15.6026 16.5625 15.2114V11.0039C16.5625 10.4861 16.9822 10.0664 17.5 10.0664C18.0178 10.0664 18.4375 10.4861 18.4375 11.0039ZM16.4129 3.59099C16.0468 3.22488 15.4532 3.22488 15.0871 3.59099C14.721 3.95711 14.721 4.5507 15.0871 4.91682L16.1742 6.00391L15.0871 7.09099C14.721 7.45711 14.721 8.0507 15.0871 8.41682C15.4532 8.78294 16.0468 8.78294 16.4129 8.41682L17.5 7.32973L18.5871 8.41682C18.9532 8.78294 19.5468 8.78294 19.9129 8.41682C20.279 8.0507 20.279 7.45711 19.9129 7.09099L18.8258 6.00391L19.9129 4.91682C20.279 4.5507 20.279 3.95711 19.9129 3.59099C19.5468 3.22488 18.9532 3.22488 18.5871 3.59099L17.5 4.67808L16.4129 3.59099Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2.08496C14.3713 2.08496 17.915 5.62867 17.915 10C17.915 14.3713 14.3713 17.915 10 17.915C5.62867 17.915 2.08496 14.3713 2.08496 10C2.08496 5.62867 5.62867 2.08496 10 2.08496ZM13.2674 7.25576C13.5407 7.04763 13.9302 7.06409 14.1849 7.29483C14.4396 7.52557 14.4909 7.91203 14.3075 8.2001L14.2257 8.30793L9.55898 13.5579C9.43116 13.7018 9.24806 13.7848 9.0556 13.7862C8.86313 13.7876 8.67886 13.7072 8.54898 13.5652L5.88231 10.6485L5.7951 10.5343C5.61952 10.2553 5.65372 9.88007 5.88231 9.63851C6.1109 9.39695 6.484 9.34195 6.77316 9.50246L6.88648 9.58435L9.05231 11.951L13.1773 7.31091L13.2674 7.25576Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CrossCircleIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2.08496C14.3713 2.08496 17.915 5.62867 17.915 10C17.915 14.3713 14.3713 17.915 10 17.915C5.62867 17.915 2.08496 14.3713 2.08496 10C2.08496 5.62867 5.62867 2.08496 10 2.08496ZM7.56916 6.62866C7.84921 6.34861 8.30323 6.34861 8.58328 6.62866L10 8.04538L11.4167 6.62866L11.527 6.53882C11.7987 6.35961 12.1678 6.38953 12.4069 6.62866C12.646 6.86778 12.6759 7.23686 12.4967 7.50854L12.4069 7.6189L10.9902 9.03561L12.4069 10.4523C12.687 10.7323 12.687 11.1863 12.4069 11.4664C12.1269 11.7464 11.6729 11.7464 11.3928 11.4664L9.97608 10.0496L8.55937 11.4664L8.44902 11.5562C8.17734 11.7354 7.80826 11.7055 7.56916 11.4664C7.33003 11.2273 7.30011 10.8582 7.47932 10.5865L7.56916 10.4762L8.98588 9.05945L7.56916 7.64273C7.28911 7.36268 7.28911 6.90871 7.56916 6.62866Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UnknownCircleIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2.08496C14.3713 2.08496 17.915 5.62867 17.915 10C17.915 14.3713 14.3713 17.915 10 17.915C5.62867 17.915 2.08496 14.3713 2.08496 10C2.08496 5.62867 5.62867 2.08496 10 2.08496ZM10 3.41504C6.3632 3.41504 3.41504 6.3632 3.41504 10C3.41504 13.6368 6.3632 16.585 10 16.585C13.6368 16.585 16.585 13.6368 16.585 10C16.585 6.3632 13.6368 3.41504 10 3.41504ZM10 6.97559C10.4142 6.97559 10.75 7.31137 10.75 7.72559V10.291C10.75 10.7052 10.4142 11.041 10 11.041C9.58579 11.041 9.25 10.7052 9.25 10.291V7.72559C9.25 7.31137 9.58579 6.97559 10 6.97559ZM9.99902 12.249C10.5508 12.249 10.998 12.6962 10.998 13.248C10.9978 13.7996 10.5506 14.2471 9.99902 14.2471C9.44729 14.2471 9 13.7997 9 13.248C9.00018 12.6961 9.44717 12.249 9.99902 12.249Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PendingCircleIcon({ className }: IconProps) {
  return (
    <span className={className} aria-hidden="true">
      <span className="relative inline-flex size-4 items-center justify-center">
        <span className="inline-flex size-2 rounded-full bg-current" />
        <span className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-current border-r-current motion-safe:animate-spin" />
      </span>
    </span>
  );
}
