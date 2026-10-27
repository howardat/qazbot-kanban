import { lookOf } from "@/components/office/look";
import { displayName, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Avatar icon drawn like the person's figure in the office: same skin, hair and shirt. */
export function PersonIcon({ member, size = 28, className }: { member: Member; size?: number; className?: string }) {
  const { skin, hair, shirt } = lookOf(member);
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={displayName(member)}
      className={cn("shrink-0 rounded-full", className)}
      shapeRendering="crispEdges"
    >
      <title>{displayName(member)}</title>
      <rect width="32" height="32" fill="#f1ebe1" />
      <rect x="6" y="23" width="20" height="10" fill={shirt} />
      <rect x="13" y="20" width="6" height="4" fill={skin} />
      <rect x="9" y="8" width="14" height="14" fill={skin} />
      <rect x="8" y="6" width="16" height="5" fill={hair} />
      <rect x="8" y="9" width="3" height="6" fill={hair} />
      <rect x="21" y="9" width="3" height="6" fill={hair} />
      <rect x="12" y="14" width="2" height="2" fill="#2a1a10" />
      <rect x="18" y="14" width="2" height="2" fill="#2a1a10" />
      <rect x="14" y="18" width="4" height="1" fill="#9a5a40" />
    </svg>
  );
}
