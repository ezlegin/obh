"use client"

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Input } from "@workspace/ui/components/input"

import {
  formatAmountInput,
  normalizeAmountInput,
  type AmountInputOptions,
} from "@/lib/admin/amount"

type AmountInputProps<T extends FieldValues> = AmountInputOptions & {
  control: Control<T>
  name: FieldPath<T>
  id?: string
  placeholder?: string
  ariaInvalid?: boolean
}

/**
 * Amount field that groups digits with commas while keeping the form value as
 * a plain numeric string for validation and server actions.
 */
function AmountInput<T extends FieldValues>({
  control,
  name,
  id,
  placeholder,
  ariaInvalid,
  allowNegative,
  allowDecimal,
}: AmountInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          id={id}
          ref={field.ref}
          name={field.name}
          value={formatAmountInput(String(field.value ?? ""))}
          onChange={(event) =>
            field.onChange(
              normalizeAmountInput(event.target.value, {
                allowNegative,
                allowDecimal,
              })
            )
          }
          onBlur={field.onBlur}
          inputMode={allowDecimal === false ? "numeric" : "decimal"}
          placeholder={placeholder}
          aria-invalid={ariaInvalid}
          autoComplete="off"
        />
      )}
    />
  )
}

export { AmountInput }
