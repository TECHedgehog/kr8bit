import React from "react";

interface Kr8bitLogoProps {
  /** Width in pixels. Height auto-scales (mark is ~400×440 ratio). */
  size?: number;
  /** Show the "kr8bit" wordmark text next to the mark */
  showWordmark?: boolean;
  className?: string;
}

/**
 * Kr8bit logo mark — pixel-art crate with cartridge and "8" cutout.
 * Inline SVG, no external dependencies, crisp at any size.
 */
export function Kr8bitLogo({
  size = 40,
  showWordmark = false,
  className = "",
}: Kr8bitLogoProps) {
  const height = Math.round(size * (440 / 400));

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 440"
        width={size}
        height={height}
        shapeRendering="crispEdges"
        aria-label="kr8bit"
        role="img"
      >
        {/* Crate bottom shadow */}
        <rect x="20" y="418" width="360" height="12" rx="4" fill="#1a0e50"/>

        {/* Crate back / top surface */}
        <rect x="20" y="155" width="360" height="20" fill="#3B22A8"/>

        {/* Left side panel */}
        <rect x="20" y="155" width="44" height="270" fill="#3B22A8"/>
        <rect x="20" y="155" width="8"  height="270" fill="#2A1870"/>

        {/* Right side panel */}
        <rect x="336" y="155" width="44" height="270" fill="#3B22A8"/>
        <rect x="372" y="155" width="8"  height="270" fill="#2A1870"/>

        {/* Bottom edge */}
        <rect x="20" y="405" width="360" height="20" fill="#3B22A8"/>
        <rect x="20" y="415" width="360" height="8"  fill="#2A1870"/>

        {/* Main front face */}
        <rect x="64" y="155" width="272" height="250" fill="#4F2ED0"/>

        {/* Top lip */}
        <rect x="20" y="148" width="360" height="16" fill="#3B22A8"/>
        <rect x="20" y="148" width="360" height="4"  fill="#6B48E8"/>

        {/* Corner bolts */}
        <rect x="24"  y="152" width="16" height="16" fill="#2A1870"/>
        <rect x="27"  y="155" width="10" height="10" fill="#1a0e50"/>
        <rect x="360" y="152" width="16" height="16" fill="#2A1870"/>
        <rect x="363" y="155" width="10" height="10" fill="#1a0e50"/>
        <rect x="24"  y="398" width="16" height="16" fill="#2A1870"/>
        <rect x="27"  y="401" width="10" height="10" fill="#1a0e50"/>
        <rect x="360" y="398" width="16" height="16" fill="#2A1870"/>
        <rect x="363" y="401" width="10" height="10" fill="#1a0e50"/>

        {/* Side slats */}
        {[200, 230, 260, 290, 320, 350, 380].map((y) => (
          <React.Fragment key={y}>
            <rect x="28"  y={y} width="36" height="4" fill="#2A1870"/>
            <rect x="336" y={y} width="36" height="4" fill="#2A1870"/>
          </React.Fragment>
        ))}

        {/* "8" — top hole */}
        <rect x="84" y="170" width="232" height="90"  fill="#121218" rx="8"/>
        {/* "8" — bottom hole */}
        <rect x="84" y="290" width="232" height="100" fill="#121218" rx="8"/>

        {/* Pixel corner accents */}
        <rect x="84"  y="170" width="12" height="12" fill="#3B22A8"/>
        <rect x="304" y="170" width="12" height="12" fill="#3B22A8"/>
        <rect x="84"  y="248" width="12" height="12" fill="#3B22A8"/>
        <rect x="304" y="248" width="12" height="12" fill="#3B22A8"/>
        <rect x="84"  y="290" width="12" height="12" fill="#3B22A8"/>
        <rect x="304" y="290" width="12" height="12" fill="#3B22A8"/>
        <rect x="84"  y="378" width="12" height="12" fill="#3B22A8"/>
        <rect x="304" y="378" width="12" height="12" fill="#3B22A8"/>

        {/* Hole depth shadows */}
        <rect x="84" y="170" width="232" height="3" fill="#0a0a14"/>
        <rect x="84" y="290" width="232" height="3" fill="#0a0a14"/>

        {/* Cartridge body */}
        <rect x="140" y="4"   width="120" height="168" rx="4" fill="#2C2C3A"/>
        <rect x="140" y="4"   width="4"   height="168" fill="#3C3C4E"/>
        <rect x="256" y="4"   width="4"   height="168" fill="#1C1C26"/>
        <rect x="140" y="168" width="120" height="4"   fill="#1C1C26"/>

        {/* Connector teeth */}
        {[148, 172, 196, 220, 244].map((x) => (
          <rect key={x} x={x} y="156" width="16" height="16" fill="#121218"/>
        ))}

        {/* Label */}
        <rect x="148" y="12"  width="104" height="136" rx="2" fill="#E8E8F0"/>
        <rect x="148" y="12"  width="104" height="3"   fill="#C8C8D8"/>
        <rect x="148" y="12"  width="3"   height="136" fill="#C8C8D8"/>

        {/* Space Invader — classic Type-B alien, green */}
        {/* Row 0 */}
        <rect x="172" y="36" width="8" height="8" fill="#39FF6A"/>
        <rect x="212" y="36" width="8" height="8" fill="#39FF6A"/>
        {/* Row 1 */}
        <rect x="180" y="44" width="8" height="8" fill="#39FF6A"/>
        <rect x="204" y="44" width="8" height="8" fill="#39FF6A"/>
        {/* Row 2 */}
        {[172,180,188,196,204,212,220].map((x) => (
          <rect key={x} x={x} y="52" width="8" height="8" fill="#39FF6A"/>
        ))}
        {/* Row 3 */}
        {[164,172,188,196,204,220,228].map((x) => (
          <rect key={x} x={x} y="60" width="8" height="8" fill="#39FF6A"/>
        ))}
        {/* Row 4 */}
        {[156,164,172,180,188,196,204,212,220,228,236].map((x) => (
          <rect key={x} x={x} y="68" width="8" height="8" fill="#39FF6A"/>
        ))}
        {/* Row 5 */}
        {[156,172,180,188,196,204,212,220,236].map((x) => (
          <rect key={x} x={x} y="76" width="8" height="8" fill="#39FF6A"/>
        ))}
        {/* Row 6 */}
        {[156,172,236].map((x) => (
          <rect key={x} x={x} y="84" width="8" height="8" fill="#39FF6A"/>
        ))}
        {/* Row 7 */}
        {[180,188,204,212].map((x) => (
          <rect key={x} x={x} y="92" width="8" height="8" fill="#39FF6A"/>
        ))}

        {/* Label divider + lower strip */}
        <rect x="148" y="108" width="104" height="2"  fill="#C8C8D8"/>
        <rect x="156" y="114" width="88"  height="28" rx="2" fill="#D0D0E0"/>
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily: "'Courier New', 'Lucida Console', monospace",
            fontWeight: 700,
            fontSize: size * 0.65,
            letterSpacing: "-0.03em",
            color: "#F2F2F7",
            userSelect: "none",
          }}
        >
          kr<span style={{ color: "#8B5CF6" }}>8</span>bit
        </span>
      )}
    </div>
  );
}

export default Kr8bitLogo;
