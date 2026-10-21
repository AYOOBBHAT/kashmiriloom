import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M16 16.5 20.5 21" />
    </svg>
  );
}

export function IconBag(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 8.5h11l-.7 11h-9.6l-.7-11z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7.5h16M4 12h16M4 16.5h12" />
    </svg>
  );
}

export function IconRupee(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5.5h10M7 9.5h10" />
      <path d="M8 5.5c2.2 0 6.2.4 6.2 4.2S10.2 14 7.5 14L15 20" />
    </svg>
  );
}

export function IconWeave(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" />
      <path d="M8 5v14M12 5v14M16 5v14" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" />
      <path d="M8 9.5h8M8 12.5h6M8 15.5h4" />
    </svg>
  );
}

export function IconCare(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.8-7 9-7 9z" />
    </svg>
  );
}
