import Image from "next/image";
import { clsx } from "clsx";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  src,
  size = 42,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <div
        className={clsx("relative shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size }}
      >
        <Image src={src} alt="" fill className="object-cover" sizes={`${size}px`} />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#C4B5FD] to-[#F0ABFC] font-extrabold text-white",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(name)}
    </div>
  );
}
