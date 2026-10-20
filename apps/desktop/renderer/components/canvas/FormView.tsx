import React, { useState } from "react";
import type { FormProps } from "@ego/ui-runtime";
import { Select } from "../ui-kit/Select.js";

interface FormViewProps {
  props: FormProps;
  onSubmit?: (formId: string, actionId: string, values: Record<string, unknown>) => void;
}

export const FormView: React.FC<FormViewProps> = ({ props, onSubmit }) => {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    props.fields.forEach((f) => {
      if (f.defaultValue !== undefined) {
        initial[f.name] = f.defaultValue;
      } else if (f.type === "switch") {
        initial[f.name] = false;
      } else if (f.type === "number") {
        initial[f.name] = 0;
      } else {
        initial[f.name] = "";
      }
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (name: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    props.fields.forEach((f) => {
      if (f.required && (values[f.name] === "" || values[f.name] === undefined)) {
        newErrors[f.name] = "Este campo es requerido";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitted(true);
    onSubmit?.(props.id, props.actionId, values);
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      <div className="pb-3 border-b border-hairline mb-4">
        <h3 className="font-semibold text-sm text-ink">{props.title}</h3>
        {props.description && <p className="text-xs text-dim mt-0.5">{props.description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {props.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink flex items-center justify-between">
              <span>
                {field.label}
                {field.required && <span className="text-rose-400 ml-1">*</span>}
              </span>
            </label>

            {field.type === "text" && (
              <input
                type="text"
                placeholder={field.placeholder}
                value={String(values[field.name] ?? "")}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded-md bg-raised border border-hairline px-3 py-1.5 text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-ink"
              />
            )}

            {field.type === "number" && (
              <input
                type="number"
                placeholder={field.placeholder}
                value={Number(values[field.name] ?? 0)}
                onChange={(e) => handleChange(field.name, Number(e.target.value))}
                className="w-full rounded-md bg-raised border border-hairline px-3 py-1.5 text-xs text-ink font-mono focus:outline-none focus:ring-1 focus:ring-ink"
              />
            )}

            {field.type === "select" && (
              <Select
                ariaLabel={field.label ?? field.name}
                value={String(values[field.name] ?? "")}
                onValueChange={(v) => handleChange(field.name, v)}
                placeholder="Seleccionar una opción…"
                options={[
                  { value: "", label: "Seleccionar una opción…" },
                  ...(field.options ?? []).map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  })),
                ]}
                triggerClassName="w-full rounded-md bg-raised border border-hairline px-3 py-1.5 text-xs text-ink"
              />
            )}

            {field.type === "switch" && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id={`field-${field.name}`}
                  checked={Boolean(values[field.name])}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  className="rounded border-hairline bg-raised accent-ink"
                />
                <label htmlFor={`field-${field.name}`} className="text-xs text-dim cursor-pointer">
                  {values[field.name] ? "Activado" : "Desactivado"}
                </label>
              </div>
            )}

            {field.type === "textarea" && (
              <textarea
                rows={3}
                placeholder={field.placeholder}
                value={String(values[field.name] ?? "")}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded-md bg-raised border border-hairline px-3 py-1.5 text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-ink font-mono"
              />
            )}

            {errors[field.name] && (
              <span className="text-[11px] text-rose-400">{errors[field.name]}</span>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 border-t border-hairline">
          {isSubmitted && <span className="text-xs text-emerald-400">✓ Enviado con éxito</span>}
          <div className="ml-auto">
            <button
              type="submit"
              className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 transition-opacity"
            >
              {props.submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
