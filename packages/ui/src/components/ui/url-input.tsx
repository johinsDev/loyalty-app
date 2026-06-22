"use client"

import { cn } from "../../cn"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "./input-group"

export interface UrlInputProps {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function UrlInput({
  value,
  onChange,
  placeholder,
  className,
  id,
}: UrlInputProps) {
  return (
    <InputGroup className={cn("h-10 rounded-xl", className)}>
      <InputGroupAddon align="inline-start">
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
    </InputGroup>
  )
}
