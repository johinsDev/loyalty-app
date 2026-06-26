"use client"

import * as React from "react"
import { MapPin } from "lucide-react"

import { cn } from "../../cn"

export interface AddressSuggestion {
  description: string
  placeId?: string
  /** Filled on selection via Place Details (when a key + placeId are present). */
  lat?: number
  lng?: number
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
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/"

/** Resolve a placeId to its lat/lng via Place Details (best-effort). */
async function fetchPlaceLocation(
  placeId: string,
  key: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`${PLACE_DETAILS_URL}${placeId}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location" },
    })
    const data = (await res.json()) as {
      location?: { latitude?: number; longitude?: number }
    }
    const lat = data.location?.latitude
    const lng = data.location?.longitude
    return lat != null && lng != null ? { lat, lng } : null
  } catch {
    return null
  }
}

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

  async function handleSelect(place: AddressSuggestion) {
    skipNextFetch.current = true
    onValueChange(place.description)
    setSuggestions([])
    setOpen(false)
    const loc =
      place.placeId && effectiveKey
        ? await fetchPlaceLocation(place.placeId, effectiveKey)
        : null
    onSelect?.(loc ? { ...place, ...loc } : place)
  }

  const showDropdown = Boolean(effectiveKey) && open && suggestions.length > 0

  // Full-width suggestions dropdown anchored to the input — a plain absolutely
  // positioned list (no popover positioner) so it always matches the input width.
  return (
    <div className={cn("relative w-full", className)}>
      <MapPin className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-xl border border-input bg-transparent pr-4 pl-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      />
      {showDropdown ? (
        <ul
          role="listbox"
          className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 flex w-full flex-col gap-0.5 rounded-xl p-1 shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.map((s) => (
            <li key={s.placeId ?? s.description} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown fires before the input's blur, so the select isn't lost.
                onMouseDown={(e) => {
                  e.preventDefault()
                  void handleSelect(s)
                }}
                className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors"
              >
                <MapPin className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
