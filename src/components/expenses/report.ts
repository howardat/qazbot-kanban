// The printable expense report: one table in an app-style card (Inter, app greys, category pills) with a total
// row. Pure HTML builder with no imports; the page opens it in a new window and the user saves it as PDF.

type Row = { date: string; vendor: string; description: string; category: string; amount: number; invoices: { name: string; url: string }[] };

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER = "#8a8a85";
// App tokens (src/app/globals.css, light theme).
const FG = "oklch(0.1689 0.0021 286.18)";
const MUTED = "oklch(0.4176 0.0072 239.98)";
const BORDER = "oklch(0.912 0.005 265)";
const FILL = "oklch(0.94 0.005 265)";
const CANVAS = "oklch(0.962 0.004 265)";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))}&nbsp;₸`;
const fmtDate = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** "Attached" links to the invoice; extra invoices on the same expense follow as numbered links. */
function invoiceCell(invoices: Row["invoices"]) {
  if (!invoices.length) return `<span class="miss">Missing</span>`;
  const link = (inv: Row["invoices"][number], label: string) => `<a href="${esc(inv.url)}" title="${esc(inv.name)}">${label}</a>`;
  return [link(invoices[0], "Attached"), ...invoices.slice(1).map((inv, i) => link(inv, String(i + 2)))].join(" · ");
}

export function reportHtml(input: Row[], title: string, opts: { categories?: string[] } = {}) {
  const rows = [...input].sort((a, b) => a.date.localeCompare(b.date));
  const order = opts.categories ?? [...new Set(rows.map((r) => r.category))];
  const colorOf = (c: string) => (order.indexOf(c) >= 0 && order.indexOf(c) < 8 ? PALETTE[order.indexOf(c)] : OTHER);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Expenses · ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: A4; margin: 16mm 14mm; }
body { margin: 0; font: 9pt/1.4 Inter, -apple-system, "Segoe UI", sans-serif; color: ${FG}; font-feature-settings: "tnum" 1; }
@media screen { body { max-width: 210mm; margin: 24px auto; padding: 0 14mm; } }
h1 { font-size: 13pt; font-weight: 600; margin: 0 0 12px; }
.card { border: 1px solid ${BORDER}; border-radius: 10px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
th { background: ${CANVAS}; font-size: 7.5pt; font-weight: 500; color: ${MUTED}; text-align: left; padding: 7px 10px; border-bottom: 1px solid ${BORDER}; }
td { padding: 7px 10px; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
.n { text-align: right; white-space: nowrap; }
.m { color: ${MUTED}; }
.strong { font-weight: 500; }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 18px; padding: 0 7px; border-radius: 5px; background: ${FILL}; color: ${MUTED}; font-size: 7.5pt; font-weight: 500; white-space: nowrap; }
.dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
a { color: oklch(0.55 0.22 293); text-decoration: none; }
a:hover { text-decoration: underline; }
.miss { color: #b45309; font-weight: 500; }
tfoot { display: table-row-group; } /* the total prints once, at the end */
tfoot td { border-bottom: 0; background: ${CANVAS}; font-weight: 600; }
.empty { padding: 32px; text-align: center; color: ${MUTED}; }
</style></head><body>
<h1>Expenses · ${esc(title)}</h1>
<div class="card">
${
  rows.length === 0
    ? `<div class="empty">No expenses in this period.</div>`
    : `<table>
  <thead><tr><th>Date</th><th>Vendor</th><th>Description</th><th>Category</th><th>Invoice</th><th class="n">Amount</th></tr></thead>
  <tbody>
    ${rows
      .map(
        (r) => `<tr><td class="m">${fmtDate(r.date)}</td><td class="strong">${esc(r.vendor)}</td><td class="m">${esc(r.description)}</td>
      <td><span class="pill"><span class="dot" style="background:${colorOf(r.category)}"></span>${esc(r.category)}</span></td>
      <td>${invoiceCell(r.invoices)}</td><td class="n strong">${money(r.amount)}</td></tr>`,
      )
      .join("")}
  </tbody>
  <tfoot><tr><td colspan="5">Total · ${rows.length} expense${rows.length === 1 ? "" : "s"}</td><td class="n">${money(total)}</td></tr></tfoot>
</table>`
}
</div>
</body></html>`;
}

/** Opens the report in a new window and prints it once the font has loaded. */
export function printReport(rows: Row[], title: string, opts?: { categories?: string[] }) {
  const w = window.open("", "_blank");
  if (!w) return;
  const autoPrint = `<script>addEventListener("load", () => document.fonts.ready.then(() => print()))</script>`;
  w.document.write(reportHtml(rows, title, opts).replace("</body>", `${autoPrint}</body>`));
  w.document.close();
}
