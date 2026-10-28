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
  return (
    <TagSelect
      options={categories.map((c) => ({ id: c, name: c, color: catColor(c, categories) }))}
      selected={value ? [value] : []}
      onToggle={onChange}
      onCreate={onChange}
      labels={{ placeholder: tx.category, search: tx.searchCategories, add: tx.addCategory, empty: tx.noCategories }}
      className={className}
    />
  );
}
