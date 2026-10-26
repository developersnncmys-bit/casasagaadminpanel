"use client";

// "2026-10-25" → "25/10/2026"
export const ddmmyyyy = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

/**
 * A date box that always reads dd/mm/yyyy. The browser's own date input (whose text follows the
 * computer's language — mm/dd/yyyy on many) stays underneath for the calendar picker; its text is
 * hidden and the date is shown on top as dd/mm/yyyy. Clicking anywhere opens the picker.
 * Takes the same props as <input type="date"> (value is YYYY-MM-DD). A date before `min` (or after
 * `max`) is moved to it, since phone pickers let you choose one anyway.
 */
export default function DateInput({ value, className = "", ...props }) {
  return (
    <span className={`date-input ${value ? "" : "is-empty"} ${className}`}>
      <input
        type="date"
        value={value}
        {...props}
        onChange={(e) => {
          // Phones (iPhone especially) ignore min/max in their date picker — keep the date inside them
          const v = e.target.value;
          const fixed = v && props.min && v < props.min ? props.min : v && props.max && v > props.max ? props.max : v;
          if (fixed !== v) e.target.value = fixed;
          props.onChange?.(e);
        }}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {}
          props.onClick?.(e);
        }}
      />
      <span className="date-shown" aria-hidden="true">{value ? ddmmyyyy(value) : "dd/mm/yyyy"}</span>
    </span>
  );
}
