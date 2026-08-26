import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CollectionsIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <rect x="4" y="5" width="11" height="15" rx="2" />
      <path d="M17 8h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2" />
    </svg>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c1.4-3.6 4.2-5.5 7-5.5s5.6 1.9 7 5.5" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(14)} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      {...props}
    >
      <path d="M12 20s-7-4.4-7-9.3A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.7C19 15.6 12 20 12 20z" />
    </svg>
  );
}

export function BookmarkIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      {...props}
    >
      <path d="M6 4h12v17l-6-4.5L6 21z" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M14 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M10 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

export function VerifiedIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12 2l2.3 1.7 2.8-.3 1 2.6 2.4 1.5-.7 2.8.7 2.8-2.4 1.5-1 2.6-2.8-.3L12 22l-2.3-1.7-2.8.3-1-2.6L3.5 16l.7-2.8-.7-2.8L5.9 8l1-2.6 2.8.3z"
      />
      <path
        d="m8.5 12 2.4 2.4 4.6-4.8"
        stroke="#fff"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l2.4 6.4L21 11l-6.6 2.6L12 20l-2.4-6.4L3 11l6.6-2.6z" />
    </svg>
  );
}

export function SidebarToggleIcon(props: IconProps) {
  return (
    <svg {...base(17)} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(22)} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AlignLeftIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  );
}

export function AlignCenterIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(20)} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...base(16)} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.4M6.4 6.4A15.6 15.6 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.87" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base()} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M3 16.5 8.5 12l3.5 3 4-4 5 5" />
    </svg>
  );
}
