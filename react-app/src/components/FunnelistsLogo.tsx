export function FunnelistsLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Funnelists"
    >
      {/* Funnel - three horizontal bands tapering to a point */}
      <polygon points="6,8 58,8 52,22 12,22" fill="#4AABF5" />
      <polygon points="12,24 52,24 44,38 20,38" fill="#3DD4A7" />
      <polygon points="20,40 44,40 32,56" fill="#2ECC71" />
    </svg>
  );
}
