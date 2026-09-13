import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "grey" | "danger" | "ghost";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-primary-weak text-primary hover:bg-primary-weak-hover",
  grey: "bg-grey-100 text-grey-700 hover:bg-grey-200",
  danger: "bg-danger-weak text-danger hover:bg-[#ffdfe1]",
  ghost: "text-grey-600 hover:bg-grey-100",
};

const sizes: Record<Size, string> = {
  lg: "h-14 px-5 rounded-2xl text-[17px]",
  md: "h-11 px-4 rounded-xl text-[15px]",
  sm: "h-8 px-3 rounded-lg text-[13px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="size-5" /> : children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl bg-white p-6", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-medium text-grey-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-grey-500">{hint}</span>}
    </label>
  );
}

const inputBase =
  "block w-full bg-grey-100 px-4 text-grey-900 placeholder:text-grey-400 outline-none ring-primary/60 transition focus:bg-white focus:ring-2";

export function Input({ className, compact, ...props }: ComponentProps<"input"> & { compact?: boolean }) {
  return (
    <input
      className={cn(inputBase, compact ? "h-11 rounded-xl px-3.5 text-[15px]" : "h-14 rounded-2xl text-[16px]", className)}
      {...props}
    />
  );
}

export function Textarea({ className, compact, ...props }: ComponentProps<"textarea"> & { compact?: boolean }) {
  return (
    <textarea
      className={cn(
        inputBase,
        "leading-relaxed",
        compact ? "rounded-xl px-3.5 py-2.5 text-[15px]" : "rounded-2xl py-3.5 text-[16px]",
        className,
      )}
      {...props}
    />
  );
}

/** 모바일 화면 아래에 고정되는 버튼 영역 */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-md bg-linear-to-t from-white from-75% to-white/0 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-8">
        {children}
      </div>
    </div>
  );
}

type Tone = "blue" | "grey" | "green" | "red" | "orange";
const tones: Record<Tone, string> = {
  blue: "bg-primary-weak text-primary",
  grey: "bg-grey-100 text-grey-600",
  green: "bg-success-weak text-success",
  red: "bg-danger-weak text-danger",
  orange: "bg-warning-weak text-warning",
};

export function Badge({ tone = "grey", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="animate-fade-up text-[14px] font-medium text-danger">{children}</p>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-grey-200", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

export function ScoreRing({ score, max = 100, size = 140 }: { score: number; max?: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(1, Math.max(0, score / max));
  const color = ratio >= 0.8 ? "#3182f6" : ratio >= 0.5 ? "#fe9800" : "#f04452";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f2f4f6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-bold tracking-tight text-grey-900">{score}</span>
        <span className="text-[13px] text-grey-500">/ {max}점</span>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 text-5xl">{icon}</div>
      <p className="text-[18px] font-bold text-grey-800">{title}</p>
      {description && <p className="mt-2 text-[15px] leading-relaxed text-grey-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={cn(
          "animate-fade-up max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        {(title || onClose) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            {title && <h2 className="text-[20px] font-bold text-grey-900">{title}</h2>}
            {onClose && (
              <button type="button" onClick={onClose} className="-m-2 rounded-full p-2 text-grey-500 hover:bg-grey-100" aria-label="닫기">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-6"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
