// The printable expense report, always in Russian: a heading with the exact dates covered, a short summary,
// then one plain table (date, vendor, description, invoice, amount) with the total at the end. No people
// and no category tags. Pure HTML builder with no imports; the page opens it in a new window and the user
// saves it as PDF.

type Row = { date: string; vendor: string; description: string; amount: number; invoices: { name: string; url: string }[] };

/** What the report covers: the exact dates, and the categories it was narrowed to (none means all). */
export type ReportScope = { from: string; to: string; categories?: string[] };

const FG = "#1f1f23";
const MUTED = "#5b6168";
const BORDER = "#e3e5ea";
const BAND = "#f6f7f9";
const LINK = "#5b3fd1";
const WARN = "#b45309";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))}&nbsp;₸`;
/** 2026-10-01 → 01.10.2026 */
export const ruDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};
export const reportPeriod = (s: ReportScope) => `с ${ruDate(s.from)} по ${ruDate(s.to)}`;

/** "Открыть" links to the invoice; extra invoices on the same expense follow as numbered links. */
function invoiceCell(invoices: Row["invoices"]) {
  if (!invoices.length) return `<span class="miss">нет</span>`;
  const link = (inv: Row["invoices"][number], label: string) => `<a href="${esc(inv.url)}" title="${esc(inv.name)}">${esc(label)}</a>`;
  return [link(invoices[0], "открыть"), ...invoices.slice(1).map((inv, i) => link(inv, String(i + 2)))].join(", ");
}

export function reportHtml(input: Row[], scope: ReportScope, today = new Date().toISOString().slice(0, 10)) {
  const rows = [...input].sort((a, b) => a.date.localeCompare(b.date));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const missing = rows.filter((r) => !r.invoices.length).length;
  const title = `Отчёт о расходах ${reportPeriod(scope)}`;
  const facts = [
    scope.categories?.length ? `Категории: <b>${esc(scope.categories.join(", "))}</b>` : "",
    `Расходов: <b>${rows.length}</b>`,
    `Итого: <b>${money(total)}</b>`,
    missing ? `Без счёта: <b class="miss">${missing}</b>` : "",
  ].filter(Boolean);

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: A4; margin: 18mm 16mm; }
body { margin: 0; font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: ${FG}; font-variant-numeric: tabular-nums; }
@media screen { body { max-width: 210mm; margin: 32px auto; padding: 0 16mm; } }
h1 { font-size: 16pt; font-weight: 600; margin: 0 0 4px; }
.made { color: ${MUTED}; font-size: 9pt; margin: 0 0 16px; }
.facts { display: flex; flex-wrap: wrap; gap: 6px 24px; padding: 10px 14px; margin: 0 0 18px; background: ${BAND}; border-radius: 8px; }
.facts b { font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
th { font-size: 9pt; font-weight: 600; color: ${MUTED}; text-align: left; padding: 8px 10px; border-bottom: 1.5px solid ${FG}; }
td { padding: 9px 10px; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
tbody tr:nth-child(even) td { background: ${BAND}; }
.date { white-space: nowrap; }
.desc { color: ${MUTED}; }
.n { text-align: right; white-space: nowrap; }
a { color: ${LINK}; text-decoration: none; }
.miss { color: ${WARN}; }
tfoot { display: table-row-group; } /* the total prints once, at the end */
tfoot td { border-top: 1.5px solid ${FG}; border-bottom: 0; font-weight: 600; font-size: 11.5pt; padding-top: 10px; }
.empty { padding: 40px; text-align: center; color: ${MUTED}; border: 1px solid ${BORDER}; border-radius: 8px; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="made">Сформирован ${ruDate(today)}</p>
<div class="facts">${facts.map((f) => `<span>${f}</span>`).join("")}</div>
${
  rows.length === 0
    ? `<div class="empty">За этот период расходов нет.</div>`
    : `<table>
  <thead><tr><th>Дата</th><th>Поставщик</th><th>Описание</th><th>Счёт</th><th class="n">Сумма</th></tr></thead>
  <tbody>
    ${rows
      .map(
        (r) =>
          `<tr><td class="date">${ruDate(r.date)}</td><td>${esc(r.vendor)}</td><td class="desc">${esc(r.description)}</td><td>${invoiceCell(r.invoices)}</td><td class="n">${money(r.amount)}</td></tr>`,
      )
      .join("")}
  </tbody>
  <tfoot><tr><td colspan="4">Итого: ${rows.length} ${plural(rows.length, "расход", "расхода", "расходов")}</td><td class="n">${money(total)}</td></tr></tfoot>
</table>`
}
</body></html>`;
}

/** Opens the report in a new window and prints it. */
export function printReport(rows: Row[], scope: ReportScope) {
  const w = window.open("", "_blank");
  if (!w) return;
  const autoPrint = `<script>addEventListener("load", () => print())</script>`;
  w.document.write(reportHtml(rows, scope).replace("</body>", `${autoPrint}</body>`));
  w.document.close();
}
