"use client";

import { Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Food } from "@/features/nutrition/domain/nutrition";
import { FoodSearch } from "./food-search";

type FoodPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto inicial da busca (ex.: o nome do item do plano). */
  initialQuery?: string;
  selectedId?: string | null;
  onSelect: (food: Food) => void;
  /** Quando presente, mostra "Remover vínculo". */
  onClear?: () => void;
  itemLabel?: string;
};

/** Busca na TACO (e nos alimentos próprios), sem acento. Valores por 100 g. */
export function FoodPicker({ open, onOpenChange, ...props }: FoodPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 p-0">
        {/* Montado só aberto: a busca sempre começa do nome do item. */}
        {open && <PickerBody {...props} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  initialQuery = "",
  selectedId,
  onSelect,
  onClear,
  itemLabel,
  close,
}: Omit<FoodPickerProps, "open" | "onOpenChange"> & { close: () => void }) {
  return (
    <>
      <DialogHeader className="min-w-0 space-y-3 p-5 pr-14 pb-3 text-left">
        <DialogTitle>Alimento</DialogTitle>
        <DialogDescription>
          {itemLabel ? `Para "${itemLabel}". ` : ""}Valores por 100 g.
        </DialogDescription>
      </DialogHeader>
      <FoodSearch
        initialQuery={initialQuery}
        selectedId={selectedId}
        onSelect={(food) => {
          onSelect(food);
          close();
        }}
        footer={
          onClear &&
          selectedId && (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                onClear();
                close();
              }}
            >
              <Unlink aria-hidden />
              Remover vínculo
            </Button>
          )
        }
      />
    </>
  );
}
