"use client";

// Category picker: the shared TagSelect with one pick. A category that doesn't exist yet is created
// from what was typed, since categories are just the names already used.
import { useT } from "@/components/I18nProvider";
import { TagSelect } from "@/components/TagSelect";
import { catColor } from "./data";

export function CategorySelect({
  value,
  onChange,
  categories,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  className?: string;
}) {
  const tx = useT().expenses;
  // A just-created category isn't in `categories` until a saved expense uses it; list it anyway so it shows as picked.
  const all = value && !categories.includes(value) ? [...categories, value] : categories;
  return (
    <TagSelect
      options={all.map((c) => ({ id: c, name: c, color: catColor(c, all) }))}
      selected={value ? [value] : []}
      onToggle={onChange}
      onCreate={onChange}
      labels={{ placeholder: tx.category, search: tx.searchCategories, add: tx.addCategory, empty: tx.noCategories }}
      className={className}
    />
  );
}
