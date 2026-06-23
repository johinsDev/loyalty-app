"use client"

import { cn } from "../../cn"
import { ColorPicker } from "./color-picker"

export type BackgroundPreset = { key: string; css: string }

/** Brand-safe gradient templates shared by rewards, promos and banners. The
 * value a consumer stores is the raw CSS background string, so a preset and a
 * custom solid color are interchangeable at the point of use (style.background). */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "mint", css: "linear-gradient(135deg, #1BAD9D, #0e6f64)" },
  { key: "grape", css: "linear-gradient(135deg, #7c5cff, #4527a0)" },
  { key: "sunset", css: "linear-gradient(135deg, #f0a868, #e0467c)" },
  { key: "ocean", css: "linear-gradient(135deg, #3b73d6, #1f3a8a)" },
  { key: "berry", css: "linear-gradient(135deg, #e0467c, #7c1d3f)" },
  { key: "ink", css: "linear-gradient(135deg, #1f2937, #000323)" },
]

interface BackgroundPickerProps {
  /** A CSS background string — either a preset's `css` or a custom hex color. */
  value: string
  onValueChange: (background: string) => void
  presets?: BackgroundPreset[]
  swatches?: string[]
  /** Label shown next to the custom color when the value isn't a preset. */
  customLabel?: string
  className?: string
}

function BackgroundPicker({
  value,
  onValueChange,
  presets = BACKGROUND_PRESETS,
  swatches,
  customLabel,
  className,
}: BackgroundPickerProps) {
  const matchesPreset = presets.some((p) => p.css === value)
  // When the value is a preset (gradient), seed the custom picker with a brand
  // hex; otherwise the value already is the custom hex.
  const customColor = matchesPreset ? "#1BAD9D" : value

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-label={p.key}
            onClick={() => onValueChange(p.css)}
            style={{ background: p.css }}
            className={cn(
              "h-12 rounded-xl outline-none transition-transform",
              value === p.css
                ? "ring-foreground ring-offset-card ring-2 ring-offset-2"
                : "hover:scale-105"
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ColorPicker
          value={customColor}
          onValueChange={onValueChange}
          swatches={swatches}
        />
        {!matchesPreset && customLabel ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {customLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export { BackgroundPicker, type BackgroundPickerProps }
