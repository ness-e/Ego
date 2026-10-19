import { useState, useRef, useEffect, useId, type KeyboardEvent } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "./cva.js";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  title?: string;
  id?: string;
  name?: string;
}

/**
 * T13/STAB-13: Select accesible (role=combobox + role=listbox + role=option)
 * Diseñado específicamente para ser 100% libre de <select> nativos (cero menús del SO),
 * compatible con Happy-DOM sin colisiones de FocusScope/RangeError en Dialogs,
 * y con target interactivo >=44px (min-h-11 min-w-11).
 */
export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  options = [],
  ariaLabel,
  placeholder = "Seleccionar...",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  title,
  id: customId,
  name,
}: SelectProps) {
  const autoId = useId();
  const selectId = customId ?? autoId;
  const listboxId = `${selectId}-listbox`;

  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? options[0]?.value ?? ""
  );
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (disabled && next) return;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const selectedIndex = options.findIndex((opt) => opt.value === activeValue);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Sincronizar índice resaltado cuando cambia el valor o al abrir
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === activeValue);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, activeValue, options]);

  // Click outside listener para cerrar el listbox
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectOption = (option: SelectOption) => {
    if (option.disabled) return;
    if (!isControlled) {
      setUncontrolledValue(option.value);
    }
    onValueChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
      case "Tab":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;

      case "ArrowDown": {
        e.preventDefault();
        let next = highlightedIndex + 1;
        while (next < options.length && options[next]?.disabled) {
          next++;
        }
        if (next < options.length) {
          setHighlightedIndex(next);
        }
        break;
      }

      case "ArrowUp": {
        e.preventDefault();
        let prev = highlightedIndex - 1;
        while (prev >= 0 && options[prev]?.disabled) {
          prev--;
        }
        if (prev >= 0) {
          setHighlightedIndex(prev);
        }
        break;
      }

      case "Home": {
        e.preventDefault();
        const first = options.findIndex((opt) => !opt.disabled);
        if (first >= 0) setHighlightedIndex(first);
        break;
      }

      case "End": {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i]?.disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
        break;
      }

      case "Enter":
      case " ": {
        e.preventDefault();
        const opt = options[highlightedIndex];
        if (opt && !opt.disabled) {
          handleSelectOption(opt);
        }
        break;
      }

      default: {
        // Tipo-ahead simple (primer carácter alfanumérico)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const char = e.key.toLowerCase();
          const matchIdx = options.findIndex(
            (opt, idx) =>
              idx > highlightedIndex &&
              !opt.disabled &&
              opt.label.toLowerCase().startsWith(char)
          );
          if (matchIdx >= 0) {
            setHighlightedIndex(matchIdx);
          } else {
            const wrapIdx = options.findIndex(
              (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(char)
            );
            if (wrapIdx >= 0) setHighlightedIndex(wrapIdx);
          }
        }
      }
    }
  };

  const selectedOption = options.find((opt) => opt.value === activeValue);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0
            ? `${listboxId}-opt-${highlightedIndex}`
            : undefined
        }
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "inline-flex min-h-11 min-w-11 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#1e1e22] px-3 py-2 text-xs text-zinc-200 transition-colors cursor-pointer select-none",
          "hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-black",
          "disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <CaretDown
          size={14}
          className={cn(
            "shrink-0 text-zinc-400 transition-transform duration-150",
            isOpen && "rotate-180 text-white"
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={cn(
            "absolute left-0 top-[calc(100%+4px)] z-50 min-w-[8rem] w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#1e1e22] p-1 text-xs text-zinc-200 shadow-2xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95",
            contentClassName
          )}
        >
          {options.length === 0 ? (
            <div className="px-2.5 py-2 text-zinc-500 text-center">Sin opciones</div>
          ) : (
            options.map((option, idx) => {
              const isSelected = option.value === activeValue;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={option.value}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onClick={() => handleSelectOption(option)}
                  onMouseEnter={() => {
                    if (!option.disabled) setHighlightedIndex(idx);
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2 text-xs outline-none transition-colors",
                    isSelected
                      ? "bg-white/15 text-white font-medium"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white",
                    isHighlighted && !isSelected && "bg-white/10 text-white",
                    option.disabled && "pointer-events-none opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check size={14} className="ml-2 shrink-0 text-brand" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Input oculto sólo para soporte de nombre de campo en forms tradicionales si aplica */}
      {name && <input type="hidden" name={name} value={activeValue} />}
    </div>
  );
}
