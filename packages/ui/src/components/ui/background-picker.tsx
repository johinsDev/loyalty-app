"use client"

import { Upload, X } from "lucide-react"

import { cn } from "../../cn"
import { ColorPicker } from "./color-picker"
import { Dropzone, DropzoneArea, DropzoneLabel } from "./dropzone"

export type BackgroundPreset = { key: string; css: string }

/** Brand-safe gradient templates shared by rewards, promos and banners. The
 * value a consumer stores is the raw CSS background string, so a preset, a
 * custom solid color and an uploaded image are interchangeable at the point of
 * use (style.background). */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "mint", css: "linear-gradient(135deg, #1BAD9D, #0e6f64)" },
  { key: "grape", css: "linear-gradient(135deg, #7c5cff, #4527a0)" },
  { key: "sunset", css: "linear-gradient(135deg, #f0a868, #e0467c)" },
  { key: "ocean", css: "linear-gradient(135deg, #3b73d6, #1f3a8a)" },
  { key: "berry", css: "linear-gradient(135deg, #e0467c, #7c1d3f)" },
  { key: "ink", css: "linear-gradient(135deg, #1f2937, #000323)" },
]

/** A background value is an uploaded image when it's a CSS `url(...)`. */
function isImageBackground(value: string): boolean {
  return value.startsWith("url(")
}

interface BackgroundPickerProps {
  /** A CSS background string — a preset's `css`, a custom hex color, or a
   *  `url(...)` for an uploaded image. */
  value: string
  onValueChange: (background: string) => void
  presets?: BackgroundPreset[]
  swatches?: string[]
  /** Label shown next to the custom color when the value isn't a preset. */
  customLabel?: string
  /** Hint shown inside the image drop area. */
  uploadLabel?: string
  /** Accessible label for the "remove uploaded image" button. */
  removeLabel?: string
  className?: string
}

function BackgroundPicker({
  value,
  onValueChange,
  presets = BACKGROUND_PRESETS,
  swatches,
  customLabel,
  uploadLabel = "Drag an image or click",
  removeLabel = "Remove",
  className,
}: BackgroundPickerProps) {
  const matchesPreset = presets.some((p) => p.css === value)
  const isImage = isImageBackground(value)
  // Seed the custom picker with a brand hex unless the value already is one.
  const customColor = matchesPreset || isImage ? "#1BAD9D" : value

  const onDrop = (files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener("load", () =>
      onValueChange(`url("${String(reader.result)}") center/cover no-repeat`)
    )
    reader.readAsDataURL(file)
  }

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
        {!matchesPreset && !isImage && customLabel ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {customLabel}
          </span>
        ) : null}
      </div>

      {isImage ? (
        <div className="border-border flex items-center gap-2 rounded-xl border p-2">
          <span
            className="size-10 rounded-lg"
            style={{ background: value }}
          />
          <span className="text-muted-foreground flex-1 truncate text-xs font-semibold">
            {customLabel ?? uploadLabel}
          </span>
          <button
            type="button"
            onClick={() => onValueChange(presets[0]?.css ?? "#1BAD9D")}
            aria-label={removeLabel}
            className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Dropzone
          accept={{ "image/*": [] }}
          maxFiles={1}
          multiple={false}
          onDrop={onDrop}
        >
          <DropzoneArea className="flex-row gap-2 p-4">
            <Upload className="text-muted-foreground size-4" />
            <DropzoneLabel className="text-xs">{uploadLabel}</DropzoneLabel>
          </DropzoneArea>
        </Dropzone>
      )}
    </div>
  )
}

export { BackgroundPicker, type BackgroundPickerProps }
