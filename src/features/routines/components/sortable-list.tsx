"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** Liga a alça ao item (é o `setActivatorNodeRef` do dnd-kit). */
  bindActivator: (el: HTMLElement | null) => void;
};

type SortableListProps<T extends { id: string }> = {
  /** id estável do DndContext (evita divergência de ids na hidratação). */
  id: string;
  items: T[];
  /** Nome legível do item, usado nos anúncios do leitor de tela. */
  getLabel: (item: T) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, ctx: { index: number; handle: DragHandleProps; isDragging: boolean }) => ReactNode;
  className?: string;
};

/**
 * Lista reordenável por arrastar (ponteiro/toque pela alça, ou teclado: espaço + setas)
 * com anúncios em português. Os botões subir/descer ficam em `MoveButtons`.
 */
export function SortableList<T extends { id: string }>({
  id,
  items,
  getLabel,
  onMove,
  renderItem,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const label = (itemId: string | number) => {
    const item = items.find((i) => i.id === itemId);
    return item ? getLabel(item) : "item";
  };
  const place = (itemId: string | number) => items.findIndex((i) => i.id === itemId) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${label(active.id)} selecionado, posição ${place(active.id)} de ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} sobre a posição ${place(over.id)} de ${items.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${label(active.id)} movido para a posição ${place(over.id)} de ${items.length}.` : undefined,
    onDragCancel: ({ active }) => `Movimento cancelado. ${label(active.id)} voltou ao lugar.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from !== -1 && to !== -1) onMove(from, to);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para reordenar, pressione espaço para pegar o item, use as setas para mover e espaço de novo para soltar. Esc cancela.",
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle, isDragging) => renderItem(item, { index, handle, isDragging })}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: DragHandleProps, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      {children({ attributes, listeners, bindActivator: setActivatorNodeRef }, isDragging)}
    </li>
  );
}

/** Alça de arrastar (44 px, sem rolagem da página ao tocar). */
export function DragHandle({
  handle: { attributes, listeners, bindActivator },
  label,
}: {
  handle: DragHandleProps;
  label: string;
}) {
  return (
    <button
      type="button"
      ref={bindActivator}
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${label}`}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-5" />
    </button>
  );
}

/** Subir/descer: alternativa acessível ao arrastar. */
export function MoveButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Mover ${label} para cima`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Mover ${label} para baixo`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}
