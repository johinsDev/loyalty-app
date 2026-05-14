"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import type { Accept } from "react-dropzone";

import { FileUpload } from "./file-upload";

interface RHFFileUploadProps<TForm extends FieldValues> {
  name: FieldPath<TForm>;
  control: Control<TForm>;
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  disk?: string;
  label?: string;
  description?: string;
  className?: string;
}

/**
 * react-hook-form bridge for the connected `<FileUpload>`. Stores the
 * field value as `string[]` (array of download URLs). For single-file
 * fields (avatar, single doc), the form schema typically narrows to
 * `string | null` — pluck the first URL out at submit time.
 *
 * @example
 *   const form = useForm<{ avatar: string[] }>({ defaultValues: { avatar: [] } });
 *   <RHFFileUpload
 *     name="avatar"
 *     control={form.control}
 *     accept={{ "image/*": [] }}
 *     maxFiles={1}
 *   />
 */
export function RHFFileUpload<TForm extends FieldValues>({
  name,
  control,
  accept,
  maxFiles,
  maxSize,
  multiple,
  disabled,
  disk,
  label,
  description,
  className,
}: RHFFileUploadProps<TForm>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FileUpload
          value={(field.value as string[] | null) ?? []}
          onChange={field.onChange}
          {...(accept && { accept })}
          {...(maxFiles !== undefined && { maxFiles })}
          {...(maxSize !== undefined && { maxSize })}
          {...(multiple !== undefined && { multiple })}
          disabled={disabled || field.disabled}
          {...(disk && { disk })}
          {...(label && { label })}
          {...(description && { description })}
          {...(className && { className })}
        />
      )}
    />
  );
}
