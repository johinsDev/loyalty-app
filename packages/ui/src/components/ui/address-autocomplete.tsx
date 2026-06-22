"use client"

import * as React from "react"
import { MapPin } from "lucide-react"

import { cn } from "../../cn"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface AddressSuggestion {
  description: string
  placeId?: string
}

export interface AddressAutocompleteProps {
  value: string
  onValueChange: (v: string) => void
  onSelect?: (place: AddressSuggestion) => void
  placeholder?: string
  apiKey?: string
  className?: string
}

const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete"

interface PlacePrediction {
  placePrediction?: {
    placeId?: string
    text?: { text?: string }
  }
}

export function AddressAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder,
  apiKey,
  className,
}: AddressAutocompleteProps) {
  const effectiveKey = apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([])
  const [open, setOpen] = React.useState(false)
  // Skip the fetch effect on the change that came from selecting a suggestion.
  const skipNextFetch = React.useRef(false)

  React.useEffect(() => {
    if (!effectiveKey) {
      return
    }
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    if (!value.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(PLACES_AUTOCOMPLETE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": effectiveKey,
          },
          body: JSON.stringify({ input: value }),
          signal: controller.signal,
        })
        const data = (await res.json()) as { suggestions?: PlacePrediction[] }
        const parsed = (data.suggestions ?? [])
          .map((s) => ({
            description: s.placePrediction?.text?.text ?? "",
            placeId: s.placePrediction?.placeId,
          }))
          .filter((s) => s.description.length > 0)
        setSuggestions(parsed)
        setOpen(parsed.length > 0)
      } catch {
        // Swallow errors (including aborts) — show no suggestions.
        setSuggestions([])
        setOpen(false)
      }
    }, 250)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [value, effectiveKey])

  function handleSelect(place: AddressSuggestion) {
    skipNextFetch.current = true
    onValueChange(place.description)
    onSelect?.(place)
    setSuggestions([])
    setOpen(false)
  }

  const input = (
    <div className={cn("relative w-full", className)}>
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-xl border border-input bg-input/30 pr-4 pl-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
    </div>
  )

  // Without a key we act as a plain text input (usable in design / Storybook).
  if (!effectiveKey) {
    return input
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<div>{input}</div>} />
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-(--anchor-width) gap-0 p-1"
        // Keep focus in the input when the listbox opens.
        initialFocus={false}
      >
        <ul role="listbox" className="flex flex-col">
          {suggestions.map((s) => (
            <li key={s.placeId ?? s.description} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
