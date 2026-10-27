import { lookOf, type Look } from "@/components/office/look";
import { displayName, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Avatar icon drawn like the person's figure in the office: same skin, hair, outfit and accessory. */
export function PersonIcon({ member, size = 28, className }: { member: Member; size?: number; className?: string }) {
  return <LookIcon look={lookOf(member)} size={size} className={className} label={displayName(member)} />;
}

/** Draws one look (also used to show the preset avatars to pick from). */
export function LookIcon({ look, size = 28, className, label }: { look: Look; size?: number; className?: string; label?: string }) {
  const { skin, hair, shirt, style, extra, cap } = look;
  const r = (x: number, y: number, w: number, h: number, fill: string) => <rect x={x} y={y} width={w} height={h} fill={fill} />;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 rounded-full", className)}
      shapeRendering="crispEdges"
    >
      {label && <title>{label}</title>}
      {r(0, 0, 32, 32, "#f1ebe1")}
      {style === "long" && extra !== "cap" && r(7, 9, 18, 15, hair)}
      {r(6, 23, 20, 10, shirt)}
      {r(13, 20, 6, 4, skin)}
      {r(9, 8, 14, 14, skin)}
      {extra !== "cap" ? (
        <>
          {(style === "short" || style === "bun" || style === "long") && (
            <>
              {r(8, 6, 16, 5, hair)}
              {r(8, 9, 3, 6, hair)}
              {r(21, 9, 3, 6, hair)}
            </>
          )}
          {style === "bun" && r(13, 2, 6, 5, hair)}
          {style === "buzz" && r(9, 7, 14, 3, hair)}
          {style === "curly" && (
            <>
              {r(7, 4, 18, 7, hair)}
              {r(7, 9, 3, 8, hair)}
              {r(22, 9, 3, 8, hair)}
            </>
          )}
          {style === "bald" && (
            <>
              {r(8, 12, 2, 4, hair)}
              {r(22, 12, 2, 4, hair)}
            </>
          )}
        </>
      ) : (
        <>
          {r(8, 9, 2, 6, hair)}
          {r(22, 9, 2, 6, hair)}
          {r(7, 5, 18, 5, cap)}
          {r(3, 9, 10, 2, cap)}
        </>
      )}
      {extra === "glasses" ? (
        <>
          {r(10, 13, 5, 3, "#1a1a1a")}
          {r(17, 13, 5, 3, "#1a1a1a")}
          {r(15, 14, 2, 1, "#1a1a1a")}
        </>
      ) : (
        <>
          {r(12, 14, 2, 2, "#2a1a10")}
          {r(18, 14, 2, 2, "#2a1a10")}
        </>
      )}
      {extra === "beard" ? r(10, 17, 12, 6, hair) : r(14, 18, 4, 1, "#9a5a40")}
      {extra === "headphones" && (
        <>
          {r(7, 4, 18, 2, "#26292c")}
          {r(6, 11, 3, 7, "#26292c")}
          {r(23, 11, 3, 7, "#26292c")}
        </>
      )}
    </svg>
  );
}
