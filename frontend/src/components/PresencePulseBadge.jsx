import { Eye } from "lucide-react";

const PresencePulseBadge = ({ className = "", isOnline = false }) => {
  const badgeClassName = isOnline
    ? "presence-pulse-badge presence-pulse-badge-online absolute size-3 rounded-full bg-green-500 ring-2 ring-zinc-900"
    : "presence-pulse-badge absolute size-5 rounded-full";

  return (
    <span
      className={`${badgeClassName} ${className}`}
      title="Presence pulse"
      aria-label="Presence pulse"
    >
      <Eye
        className={isOnline ? "size-2.5" : "size-3.5"}
        aria-hidden="true"
        strokeWidth={isOnline ? 3.2 : 2.5}
      />
    </span>
  );
};

export default PresencePulseBadge;
