import { forwardRef, useId, type InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className = "", ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`h-10 w-full rounded-control border border-control bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors duration-200 ease-out focus:border-accent disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  );
});
