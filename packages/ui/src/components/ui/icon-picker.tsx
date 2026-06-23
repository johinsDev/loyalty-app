"use client"

import { cn } from "../../cn"
import { Input } from "./input"

const DEFAULT_EMOJIS = ["🎁", "🧋", "🍮", "⬆️", "🎉", "🎂", "🔑", "⭐"]

interface IconPickerProps {
  value: string
  onValueChange: (emoji: string) => void
  /** Quick-pick emoji presets. */
  emojis?: string[]
  /** Label shown next to the free-form custom emoji field. */
  customLabel?: string
  className?: string
}

/** Emoji icon picker: a quick-pick grid plus a free-form field for any custom
 * emoji. The selected value rings in the grid when it matches a preset. */
function IconPicker({
  value,
  onValueChange,
  emojis = DEFAULT_EMOJIS,
  customLabel,
  className,
}: IconPickerProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onValueChange(emoji)}
            className={cn(
              "grid aspect-square place-items-center rounded-2xl text-2xl outline-none transition-colors",
              value === emoji
                ? "bg-primary/10 ring-primary ring-2"
                : "bg-muted/50 hover:bg-muted"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          maxLength={8}
          aria-label={customLabel}
          className="h-10 w-16 rounded-xl text-center text-xl"
        />
        {customLabel ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {customLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export { IconPicker, type IconPickerProps }
