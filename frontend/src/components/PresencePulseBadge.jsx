const PresencePulseBadge = ({ className = "", isOnline = false }) => {
  const badgeClassName = isOnline
    ? "presence-pulse-badge presence-pulse-badge-online absolute size-3 rounded-full"
    : "presence-pulse-badge presence-pulse-badge-soft absolute h-2 w-5 rounded-full";

  return (
    <span
      className={`${badgeClassName} ${className}`}
      title="Presence pulse"
      aria-label="Presence pulse"
    />
  );
};

export default PresencePulseBadge;
