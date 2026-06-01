"use client";
/* Cadence — shared primitives: Icon (Lucide), Avatar, StatusBadge, Mark. */
import type { CSSProperties } from "react";
import { icons, type LucideProps } from "lucide-react";
import { STATUS, type Status } from "@/lib/data";

/* Anything renderable as an avatar — members and the current user both qualify. */
type AvatarLike = { name: string; initials: string; color: string };

function toPascal(name: string): string {
  return name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

/* Lucide icon wrapped in a sized span so context CSS (.btn .ic, etc.) controls layout. */
export function Icon({ name, size = 18, strokeWidth = 1.9, className = "", style }: IconProps) {
  const Glyph = (icons as Record<string, React.ComponentType<LucideProps>>)[toPascal(name)];
  return (
    <span
      className={"ic " + className}
      style={{ display: "inline-flex", width: size, height: size, ...style }}
    >
      {Glyph ? <Glyph width={size} height={size} strokeWidth={strokeWidth} /> : null}
    </span>
  );
}

/* Member avatar — initials on a tinted chip. */
export function Avatar({ member, size = 24 }: { member?: AvatarLike | null; size?: number }) {
  if (!member) return null;
  return (
    <span
      className="avatar"
      title={member.name}
      style={{ background: member.color, width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {member.initials}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className="badge" style={{ background: s.soft, color: s.color }}>
      <span className="dot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/* The Cadence logomark (rising rhythm bars). */
export function Mark({ size = 32, radius = 9 }: { size?: number; radius?: number }) {
  const bars = [size * 0.28, size * 0.45, size * 0.62];
  const w = Math.max(2.5, size * 0.09);
  return (
    <span
      className="mark-el"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--accent)",
        display: "inline-flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: size * 0.08,
        paddingBottom: size * 0.24,
        boxSizing: "border-box",
        flex: "none",
      }}
    >
      {bars.map((h, i) => (
        <i key={i} style={{ display: "block", width: w, height: h, borderRadius: w / 2, background: "#fff" }} />
      ))}
    </span>
  );
}
