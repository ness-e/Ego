import React, { useState } from "react";
import type { FormProps } from "@ego/ui-runtime";
import { Select } from "../ui-kit/Select.js";
import { Input } from "../ui-kit/Input.js";
import { Textarea } from "../ui-kit/Textarea.js";
import { Button } from "../ui-kit/Button.js";

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
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      <div className="mb-4 border-b border-hairline pb-3">
        <h3 className="text-sm font-semibold text-ink">{props.title}</h3>
        {props.description && <p className="mt-0.5 text-xs text-faint">{props.description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {props.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="flex items-center justify-between text-xs font-medium text-ink">
              <span>
                {field.label}
                {field.required && <span className="ml-1 text-error">*</span>}
              </span>
            </label>

            {/* Los controles de texto/número/área usan el `Input`/`Textarea` del
                kit: su borde base es `border-strong` con anillo `brand` en
                foco (nunca `border-hairline` como único indicador) y el
                mensaje de error va con `role="alert"` + `aria-errormessage`. */}
            {field.type === "text" && (
              <Input
                type="text"
                placeholder={field.placeholder}
                value={String(values[field.name] ?? "")}
                onChange={(e) => handleChange(field.name, e.target.value)}
                error={errors[field.name]}
              />
            )}

            {field.type === "number" && (
              <Input
                type="number"
                placeholder={field.placeholder}
                value={Number(values[field.name] ?? 0)}
                onChange={(e) => handleChange(field.name, Number(e.target.value))}
                error={errors[field.name]}
                className="font-mono"
              />
            )}

            {field.type === "select" && (
              <>
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
                />
                {errors[field.name] && (
                  <span role="alert" className="text-xs text-error">
                    {errors[field.name]}
                  </span>
                )}
              </>
            )}

            {field.type === "switch" && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`field-${field.name}`}
                  checked={Boolean(values[field.name])}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  className="rounded-[var(--radius-card)] border-strong bg-raised accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <label htmlFor={`field-${field.name}`} className="cursor-pointer text-xs text-dim">
                  {values[field.name] ? "Activado" : "Desactivado"}
                </label>
                {errors[field.name] && (
                  <span role="alert" className="text-xs text-error">
                    {errors[field.name]}
                  </span>
                )}
              </div>
            )}

            {field.type === "textarea" && (
              <Textarea
                rows={3}
                placeholder={field.placeholder}
                value={String(values[field.name] ?? "")}
                onChange={(e) => handleChange(field.name, e.target.value)}
                error={errors[field.name]}
                className="font-mono"
              />
            )}
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-hairline pt-2">
          {isSubmitted && <span className="text-xs text-success">✓ Enviado con éxito</span>}
          <div className="ml-auto">
            <Button type="submit" variant="primary" size="sm">
              {props.submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
