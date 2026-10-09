import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";
type Shape = "rounded" | "round";

// The primary button is the only place the brand gradient is used, and it has the soft glow.
const variants: Record<Variant, string> = {
  primary: "brand-fill text-brand-text shadow-glow hover:brightness-110",
  secondary: "border border-control bg-surface text-ink hover:bg-raised",
  ghost: "text-ink hover:bg-raised",
  danger: "border border-error bg-surface text-error hover:bg-raised",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

const shapes: Record<Shape, string> = {
  rounded: "rounded-control",
  round: "rounded-full",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", shape = "rounded", className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,opacity,border-color,filter] duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${shapes[shape]} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});
