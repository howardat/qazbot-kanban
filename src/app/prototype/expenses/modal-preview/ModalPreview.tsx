"use client";

// PROTOTYPE — the Add record modal pinned open in one state, for screenshots.
import { AddRecordDialog, type Preview } from "../AddRecordDialog";
import { CAT_VARS_CSS, categoriesOf, MOCK_EXPENSES, vendorsOf } from "../mock";

const PRESETS: Record<string, Preview> = {
  empty: {},
  filled: {
    fill: {
      amount: 1_250_000,
      vendor: "Kaspi Magazin",
      date: "2026-10-27",
      category: "Hardware",
      description: "Jetson Orin dev kit for the X2 vision pipeline",
      invoices: [{ name: "invoice-kaspi-2026-10-27.pdf", url: "#" }],
    },
  },
  category: { categoryOpen: true },
  create: { categoryOpen: true, categoryQuery: "Travel insurance" },
};

export function ModalPreview({ state }: { state: string }) {
  return (
    <div className="cat-vars min-h-dvh bg-background">
      <style>{CAT_VARS_CSS}</style>
      <AddRecordDialog
        open
        onOpenChange={() => {}}
        onAdd={() => {}}
        vendors={vendorsOf(MOCK_EXPENSES)}
        categories={categoriesOf(MOCK_EXPENSES)}
        defaultCategory="Hardware"
        preview={PRESETS[state] ?? {}}
      />
    </div>
  );
}
