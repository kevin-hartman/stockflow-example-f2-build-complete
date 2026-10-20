import { useId, useState } from "react";

interface Props {
  testId: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Offer a "Use new location" option for a typed value not on record. */
  creatable?: boolean;
  /** Called when an option is picked from the listbox (not on every keystroke). */
  onSelect?: (value: string) => void;
}

/** Accessible (creatable) combobox: an input with a listbox anchored under it. */
export function LocationCombobox({ testId, label, value, options, onChange, creatable = false, onSelect }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const typed = value.trim();
  const matches = options.filter((o) => o.toLowerCase().includes(typed.toLowerCase()));
  const offerNew = creatable && typed !== "" && !options.includes(typed);

  function choose(option: string) {
    onChange(option);
    onSelect?.(option);
    setOpen(false);
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        data-testid={testId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (matches.length > 0 || offerNew) && (
        <ul id={listId} role="listbox" aria-label={label} className="search__results">
          {offerNew && (
            <li
              role="option"
              aria-selected={false}
              className="btn btn--ghost btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(typed)}
            >
              Use new location "{typed}"
            </li>
          )}
          {matches.map((o) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              className="btn btn--ghost btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
