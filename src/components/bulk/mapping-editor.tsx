"use client";

import { CONTENT_TYPES, getContentType, type ContentTypeId } from "@/lib/payloads";
import { autoMapType, typesInUse, type BulkMapping, type ColumnRef } from "@/lib/bulk/mapping";
import type { Table } from "@/lib/bulk/parse";
import { Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";

function refToSelect(ref: ColumnRef | undefined): string {
  if (!ref || ref.kind === "none") return "none";
  return ref.kind === "column" ? `col:${ref.index}` : "value";
}

export function MappingEditor({ table, mapping, onChange }: { table: Table; mapping: BulkMapping; onChange: (m: BulkMapping) => void }) {
  const types = typesInUse(table, mapping.typeSource);
  const columnOptions = table.headers.map((h, i) => ({ value: `col:${i}`, label: `${h} (e.g. “${(table.rows[0]?.[i] ?? "").slice(0, 24)}”)` }));

  const setTypeSource = (source: BulkMapping["typeSource"]) => {
    const next: BulkMapping = { ...mapping, typeSource: source, fields: { ...mapping.fields } };
    for (const id of typesInUse(table, source)) next.fields[id] ??= autoMapType(getContentType(id)!, table.headers);
    onChange(next);
  };
  const setRef = (type: ContentTypeId, field: string, ref: ColumnRef) =>
    onChange({ ...mapping, fields: { ...mapping.fields, [type]: { ...(mapping.fields[type] ?? {}), [field]: ref } } });

  return (
    <div className="space-y-5">
      <Segmented
        label="Which QR type is each row?"
        name="type-source"
        value={mapping.typeSource.kind}
        options={[
          { value: "fixed", label: "Same type for every row" },
          { value: "column", label: "Read the type from a column" },
        ]}
        onChange={(kind) => setTypeSource(kind === "fixed" ? { kind: "fixed", type: types[0] ?? "url" } : { kind: "column", index: 0 })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {mapping.typeSource.kind === "fixed" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            QR type
            <Select data-testid="bulk-fixed-type" value={mapping.typeSource.type} onChange={(e) => setTypeSource({ kind: "fixed", type: e.target.value as ContentTypeId })}>
              {CONTENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type column
            <Select data-testid="bulk-type-column" value={mapping.typeSource.index} onChange={(e) => setTypeSource({ kind: "column", index: Number(e.target.value) })}>
              {table.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </Select>
            <span className="text-xs font-normal text-ink-2">Values like “url”, “wifi”, “vCard”, “Website” or “Bitcoin”.</span>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          File name column (optional)
          <Select data-testid="bulk-name-column" value={mapping.nameColumn ?? ""} onChange={(e) => onChange({ ...mapping, nameColumn: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">Automatic (row number + content)</option>
            {table.headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {types.length === 0 && <p className="text-sm text-danger-700">No known QR types were found in the type column.</p>}
      {types.map((id) => {
        const type = getContentType(id)!;
        const refs = mapping.fields[id] ?? {};
        return (
          <fieldset key={id} className="rounded-card border border-line p-4" data-mapping-type={id}>
            <legend className="px-1 text-sm font-semibold">{type.label} fields</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {type.fields.map((f) => {
                const ref = refs[f.name];
                const sel = refToSelect(ref);
                const selectId = `map-${id}-${f.name}`;
                return (
                  <div key={f.name} className="flex flex-col gap-1">
                    <label htmlFor={selectId} className="text-sm font-medium">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
                      {f.visible && <span className="ml-1 text-xs font-normal text-ink-3">(when applicable)</span>}
                    </label>
                    <Select
                      id={selectId}
                      data-field={`${id}.${f.name}`}
                      value={sel}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRef(id, f.name, v === "none" ? { kind: "none" } : v === "value" ? { kind: "value", value: "" } : { kind: "column", index: Number(v.slice(4)) });
                      }}
                    >
                      <option value="none">{f.kind === "checkbox" || f.kind === "select" || f.kind === "segmented" ? "Not used (default)" : "Not used"}</option>
                      {columnOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                      <option value="value">Same value for every row…</option>
                    </Select>
                    {ref?.kind === "value" && (
                      <Input
                        aria-label={`${f.label} value for every row`}
                        value={ref.value}
                        placeholder={f.options ? f.options.map((o) => o.value).join(" / ") : f.placeholder}
                        onChange={(e) => setRef(id, f.name, { kind: "value", value: e.target.value })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
