"use client";

import { useMemo, useState } from "react";
import { LocateFixed } from "lucide-react";
import { getContentType, isVisible, type FieldDef, type FormValues, type PayloadResult } from "@/lib/payloads";
import { initialValues, useStudio } from "@/lib/store/studio";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

const TIME_ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();

function FormField({ field, values, error }: { field: FieldDef; values: FormValues; error?: string }) {
  const setField = useStudio((s) => s.setField);
  const touch = useStudio((s) => s.touch);
  const id = `field-${field.name}`;
  const raw = values[field.name];
  const value = typeof raw === "string" ? raw : "";
  const common = { name: field.name, onBlur: () => touch(field.name), placeholder: field.placeholder, autoComplete: field.autoComplete ?? "off", inputMode: field.inputMode };

  if (field.kind === "checkbox") {
    return <Checkbox id={id} label={field.label} help={field.help} checked={raw === true} onChange={(e) => setField(field.name, e.target.checked)} />;
  }
  if (field.kind === "segmented") {
    return (
      <Segmented
        label={field.label}
        name={field.name}
        value={value || field.options![0]!.value}
        options={field.options!}
        onChange={(v) => setField(field.name, v)}
      />
    );
  }
  const counter = field.maxLength && value.length > field.maxLength * 0.6 ? `${value.length}/${field.maxLength}` : undefined;
  return (
    <Field id={id} label={field.label} help={field.help} error={error} required={field.required} counter={counter}>
      {(a11y) => {
        switch (field.kind) {
          case "textarea":
            return <Textarea {...a11y} {...common} value={value} rows={4} onChange={(e) => setField(field.name, e.target.value)} />;
          case "select":
            return (
              <Select {...a11y} name={field.name} value={value || field.options![0]!.value} onChange={(e) => setField(field.name, e.target.value)}>
                {field.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            );
          case "timezone":
            return (
              <Select {...a11y} name={field.name} value={value || "UTC"} onChange={(e) => setField(field.name, e.target.value)}>
                {(TIME_ZONES.includes(value) || !value ? TIME_ZONES : [value, ...TIME_ZONES]).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            );
          case "datetime": {
            const allDay = values.allDay === true;
            return (
              <Input
                {...a11y}
                {...common}
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? value.slice(0, 10) : value.length === 10 ? `${value}T09:00` : value}
                onChange={(e) => setField(field.name, allDay && e.target.value ? `${e.target.value}T00:00` : e.target.value)}
              />
            );
          }
          case "date":
            return <Input {...a11y} {...common} type="date" value={value} onChange={(e) => setField(field.name, e.target.value)} />;
          case "number":
            return <Input {...a11y} {...common} type="text" inputMode={field.inputMode ?? "decimal"} value={value} onChange={(e) => setField(field.name, e.target.value)} />;
          case "password":
            return <Input {...a11y} {...common} type="text" spellCheck={false} value={value} onChange={(e) => setField(field.name, e.target.value)} />;
          default:
            return (
              <Input
                {...a11y}
                {...common}
                type={field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : "text"}
                spellCheck={field.kind === "text"}
                value={value}
                onChange={(e) => setField(field.name, e.target.value)}
              />
            );
        }
      }}
    </Field>
  );
}

function UseMyLocation() {
  const setField = useStudio((s) => s.setField);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  if (typeof navigator !== "undefined" && !("geolocation" in navigator)) return null;
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        loading={state.busy}
        icon={<LocateFixed className="size-4" aria-hidden="true" />}
        onClick={() => {
          setState({ busy: true });
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setField("latitude", pos.coords.latitude.toFixed(6));
              setField("longitude", pos.coords.longitude.toFixed(6));
              setState({ busy: false });
            },
            (err) => setState({ busy: false, error: err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Your location could not be determined." }),
            { enableHighAccuracy: true, timeout: 10_000 },
          );
        }}
      >
        Use my current location
      </Button>
      {state.error && (
        <p className="text-sm text-danger-700" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function ContentForm({ result }: { result: PayloadResult }) {
  const typeId = useStudio((s) => s.typeId);
  const draft = useStudio((s) => s.drafts[s.typeId]);
  const touched = useStudio((s) => s.touched);
  const values = useMemo(() => draft ?? initialValues(typeId), [draft, typeId]);
  const type = getContentType(typeId)!;
  // Validate even an untouched form so "Download" can reveal required-field errors.
  const errors = useMemo(() => (result.status === "invalid" ? result.errors : result.status === "empty" ? type.validate({ ...type.defaults, ...values }) : {}), [result, type, values]);
  const visible = type.fields.filter((f) => isVisible(f, values));

  return (
    <section aria-labelledby="content-title" className="rounded-modal border border-line bg-white p-4 sm:p-5">
      <div className="mb-4">
        <h2 id="content-title" className="text-base font-semibold">
          2. {type.label} content
        </h2>
        <p className="text-sm text-ink-2">{type.description}</p>
      </div>
      {type.hostingNote && (
        <Notice tone="info" title="Static link — no hosting yet" className="mb-4">
          {type.hostingNote}
        </Notice>
      )}
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate aria-describedby="form-status">
        {visible.map((f) => (
          <div key={f.name} className={cn(f.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
            {f.section && <h3 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{f.section}</h3>}
            <FormField field={f} values={values} error={touched[f.name] ? errors[f.name] : undefined} />
          </div>
        ))}
        {typeId === "location" && (
          <div className="sm:col-span-2">
            <UseMyLocation />
          </div>
        )}
      </form>
      <p id="form-status" className="sr-only" aria-live="polite">
        {result.status === "ok" ? "Content is valid; the preview is up to date." : result.status === "invalid" ? `${Object.keys(errors).length} field(s) need attention.` : ""}
      </p>
    </section>
  );
}
