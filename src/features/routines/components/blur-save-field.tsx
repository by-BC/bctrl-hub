"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BlurSaveFieldProps = {
  label: string;
  value: string;
  /** Valida e grava; devolve a mensagem de erro, ou null quando aceitou. */
  onSave: (value: string) => string | null;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  labelClassName?: string;
};

/**
 * Campo de texto que grava ao sair (blur) ou com Enter (campo de uma linha).
 * Mantém o rascunho local; não grava se nada mudou.
 */
export function BlurSaveField({
  label,
  value,
  onSave,
  multiline,
  placeholder,
  maxLength,
  className,
  labelClassName,
}: BlurSaveFieldProps) {
  const ids = { field: useId(), error: useId() };
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (draft.trim() === value.trim()) {
      setError(null);
      return;
    }
    setError(onSave(draft));
  }

  const common = {
    id: ids.field,
    value: draft,
    placeholder,
    maxLength,
    onBlur: commit,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? ids.error : undefined,
    className: "text-base",
  } as const;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={ids.field} className={labelClassName}>
        {label}
      </Label>
      {multiline ? (
        <Textarea {...common} rows={2} className="min-h-11 text-base" onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <Input
          {...common}
          className="h-11 text-base"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      )}
      {error && (
        <p id={ids.error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
