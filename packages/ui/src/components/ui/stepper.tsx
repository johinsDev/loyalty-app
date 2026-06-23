"use client"

import { cn } from "../../cn"

export interface StepperStep {
  /** Stable key — matches the backend wizard step key. */
  key: string
  /** Human label shown next to the indicator. */
  label: string
}

export interface StepperProps {
  steps: StepperStep[]
  /** Current step key (the backend's `state.current`). */
  current: string
  /** Completed step keys (the backend's `state.completed`). */
  completed: string[]
  /** Optional navigation — only completed/current steps are clickable. */
  onSelect?: (key: string) => void
  className?: string
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  )
}

/**
 * Presentational stepper for server-driven wizards. It renders whatever the
 * backend reports (`current` + `completed`) and never decides the order — the
 * `@loyalty/api` wizard owns that. See `.claude/skills/wizard/SKILL.md`.
 */
export function Stepper({
  steps,
  current,
  completed,
  onSelect,
  className,
}: StepperProps) {
  const done = new Set(completed)

  return (
    <ol
      className={cn("flex w-full items-center gap-2", className)}
      aria-label="Progress"
    >
      {steps.map((step, i) => {
        const isCompleted = done.has(step.key)
        const isCurrent = step.key === current
        const state = isCurrent
          ? "current"
          : isCompleted
            ? "completed"
            : "upcoming"
        const clickable = !!onSelect && (isCompleted || isCurrent)

        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              data-state={state}
              aria-current={isCurrent ? "step" : undefined}
              disabled={!clickable}
              onClick={clickable ? () => onSelect?.(step.key) : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
                clickable && "hover:bg-muted",
                !clickable && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  state === "completed" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "current" &&
                    "border-primary text-primary ring-2 ring-primary/30",
                  state === "upcoming" &&
                    "border-border text-muted-foreground",
                )}
              >
                {isCompleted ? <CheckIcon /> : i + 1}
              </span>
              <span
                className={cn(
                  // Labels are hidden on mobile except for the current step, so
                  // the row never overflows narrow screens; all show from `sm`.
                  "truncate",
                  !isCurrent && "hidden sm:inline",
                  state === "upcoming" && "text-muted-foreground",
                  state === "current" && "font-medium text-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
