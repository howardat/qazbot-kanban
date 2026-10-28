// The printable expense report (A4). Pure HTML builder with no imports so it can be rendered outside the app
// too; the page opens it in a new window and the user saves it as PDF.

type Row = { date: string; vendor: string; description: string; category: string; amount: number; invoices: { name: string }[] };

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER = "#a3a39c";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: number) => new Intl.NumberFormat("ru-RU").format(Math.round(v));
const money = (v: number) => `${num(v)}&nbsp;₸`;
const total = (rs: Row[]) => rs.reduce((s, r) => s + r.amount, 0);
const fmtDate = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Donut of category shares, with a 2px white gap between slices. */
function donut(slices: { v: number; color: string }[], sum: number) {
  const R = 54, r = 36, C = 60;
  const pt = (a: number, rad: number) => `${(C + rad * Math.sin(a)).toFixed(2)} ${(C - rad * Math.cos(a)).toFixed(2)}`;
  if (slices.length === 1) return `<svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="45" fill="none" stroke="${slices[0].color}" stroke-width="18"/></svg>`;
  let acc = 0;
  const paths = slices.map((s) => {
    const a0 = (acc / sum) * 2 * Math.PI;
    acc += s.v;
    const a1 = (acc / sum) * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${pt(a0, R)}A${R} ${R} 0 ${large} 1 ${pt(a1, R)}L${pt(a1, r)}A${r} ${r} 0 ${large} 0 ${pt(a0, r)}Z" fill="${s.color}" stroke="#fff" stroke-width="1.5"/>`;
  });
  return `<svg viewBox="0 0 120 120" width="120" height="120">${paths.join("")}</svg>`;
}

export function reportHtml(input: Row[], title: string, opts: { categories?: string[]; preparedBy?: string; generatedAt?: Date } = {}) {
  const rows = [...input].sort((a, b) => a.date.localeCompare(b.date));
  const order = opts.categories ?? [...new Set(rows.map((r) => r.category))];
  const colorOf = (c: string) => (order.indexOf(c) >= 0 && order.indexOf(c) < 8 ? PALETTE[order.indexOf(c)] : OTHER);
  const sum = total(rows);
  const withInvoice = rows.filter((r) => r.invoices.length).length;
  const missing = rows.length - withInvoice;
  const generated = opts.generatedAt ?? new Date();
  const span = rows.length ? `${fmtDate(rows[0].date)} – ${fmtDate(rows.at(-1)!.date)}` : "—";

  const cats = [...new Set(rows.map((r) => r.category))]
    .map((c) => ({ c, v: total(rows.filter((r) => r.category === c)), n: rows.filter((r) => r.category === c).length, color: colorOf(c) }))
    .sort((a, b) => b.v - a.v);
  const top = cats[0]?.v ?? 1;

  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))];
  const byMonth = months.map((m) => ({ m, rows: rows.filter((r) => r.date.startsWith(m)) }));
  const monthName = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const topMonth = Math.max(1, ...byMonth.map((x) => total(x.rows)));

  const kpi = (label: string, value: string, note = "") =>
    `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${note ? `<div class="kpi-note">${note}</div>` : ""}</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Expense report — ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 16mm 14mm 18mm;
  @bottom-left { content: "Qazbot · Expense report · ${esc(title).replace(/"/g, "'")}"; font: 7.5pt Inter, sans-serif; color: #8a8a85; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt Inter, sans-serif; color: #8a8a85; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { html { background: #e9e9e6; } }
body { font: 9pt/1.45 Inter, -apple-system, "Segoe UI", sans-serif; color: #1d1d1b; margin: 0; font-feature-settings: "tnum" 1, "cv11" 1; }
.sheet { background: #fff; max-width: 210mm; margin: 0 auto; padding: 0; }
@media screen { .sheet { margin: 24px auto; padding: 16mm 14mm; box-shadow: 0 2px 16px rgba(0,0,0,.08); } }
.muted { color: #6b6b66; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

header.top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 1px solid #e4e4e0; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 11pt; letter-spacing: -.01em; }
.brand-mark { width: 18px; height: 18px; border-radius: 5px; background: #1d1d1b; color: #fff; display: grid; place-items: center; font-size: 9pt; }
.eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 7pt; font-weight: 600; color: #8a8a85; margin-top: 18px; }
h1 { font-size: 22pt; line-height: 1.1; letter-spacing: -.02em; margin: 4px 0 2px; font-weight: 700; }
.meta { text-align: right; font-size: 8pt; color: #6b6b66; line-height: 1.7; }
.meta b { color: #1d1d1b; font-weight: 500; }

.kpis { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; margin: 18px 0 22px; border: 1px solid #e4e4e0; border-radius: 8px; overflow: hidden; }
.kpi { padding: 10px 14px; border-left: 1px solid #e4e4e0; }
.kpi:first-child { border-left: 0; background: #f7f7f5; }
.kpi-label { font-size: 7.5pt; color: #6b6b66; font-weight: 500; }
.kpi-value { font-size: 13pt; font-weight: 600; margin-top: 2px; letter-spacing: -.01em; white-space: nowrap; }
.kpi:first-child .kpi-value { font-size: 17pt; }
.kpi-note { font-size: 7.5pt; color: #6b6b66; margin-top: 1px; }
.kpi-note.warn { color: #b25e00; }

h2 { font-size: 10pt; font-weight: 600; margin: 0 0 8px; letter-spacing: -.005em; }
section { margin-bottom: 22px; break-inside: avoid; }
.split { display: grid; grid-template-columns: 1.25fr 1fr; gap: 24px; }
.cat-wrap { display: flex; gap: 16px; align-items: center; }
table { width: 100%; border-collapse: collapse; }
.cats td { padding: 4px 0; border-bottom: 1px solid #f0f0ed; vertical-align: middle; }
.cats tr:last-child td { border-bottom: 0; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; vertical-align: 1px; }
.bar { height: 5px; background: #f0f0ed; border-radius: 3px; overflow: hidden; width: 60px; display: inline-block; vertical-align: middle; margin-left: 8px; }
.bar > i { display: block; height: 100%; border-radius: 3px; }
.months td { padding: 3.5px 0; border-bottom: 1px solid #f0f0ed; }
.months tr:last-child td { border-bottom: 0; }
.mbar { height: 5px; background: #2a78d6; border-radius: 3px; }

.detail th { font-size: 7.5pt; font-weight: 600; color: #6b6b66; text-align: left; padding: 6px 8px; border-bottom: 1px solid #1d1d1b; text-transform: uppercase; letter-spacing: .04em; }
.detail td { padding: 5.5px 8px; border-bottom: 1px solid #ececea; vertical-align: top; }
.detail tr { break-inside: avoid; }
.detail tr.month td { background: #f7f7f5; font-weight: 600; padding-top: 7px; padding-bottom: 7px; border-bottom: 1px solid #e4e4e0; }
.detail tr.month td.n { color: #1d1d1b; }
.detail td.desc { color: #4a4a46; }
.detail td.date { color: #6b6b66; white-space: nowrap; }
.inv-ok { color: #1b7d4f; font-weight: 500; white-space: nowrap; }
.inv-miss { color: #b25e00; font-weight: 500; white-space: nowrap; }
.detail tfoot { display: table-row-group; } /* print the grand total once, at the end, not on every page */
.detail tfoot td { border-top: 2px solid #1d1d1b; border-bottom: 0; font-weight: 700; font-size: 10pt; padding-top: 8px; }

.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; break-inside: avoid; }
.sign div { border-top: 1px solid #1d1d1b; padding-top: 5px; font-size: 7.5pt; color: #6b6b66; display: flex; justify-content: space-between; }
.empty { padding: 40px; text-align: center; color: #8a8a85; border: 1px dashed #d4d4d0; border-radius: 8px; }
</style></head><body><div class="sheet">

<header class="top">
  <div>
    <div class="brand"><span class="brand-mark">Q</span>Qazbot</div>
    <div class="eyebrow">Expense report</div>
    <h1>${esc(title)}</h1>
    <div class="muted">${span}</div>
  </div>
  <div class="meta">
    <div>Generated <b>${generated.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b></div>
    ${opts.preparedBy ? `<div>Prepared by <b>${esc(opts.preparedBy)}</b></div>` : ""}
    <div>Currency <b>KZT (₸)</b></div>
  </div>
</header>

${rows.length === 0 ? `<div class="empty" style="margin-top:24px">No expenses in this period.</div>` : `
<div class="kpis">
  ${kpi("Total spent", money(sum), `${months.length} month${months.length === 1 ? "" : "s"}`)}
  ${kpi("Expenses", String(rows.length), `${cats.length} categor${cats.length === 1 ? "y" : "ies"}`)}
  ${kpi("Average", money(sum / rows.length), "per expense")}
  ${kpi("Invoices", `${withInvoice}/${rows.length}`, missing ? `<span class="kpi-note warn">${missing} missing</span>` : "all attached")}
</div>

<div class="split">
  <section>
    <h2>By category</h2>
    <div class="cat-wrap">
      ${donut(cats.map((c) => ({ v: c.v, color: c.color })), sum)}
      <table class="cats"><tbody>
        ${cats.map((c) => `<tr><td><span class="dot" style="background:${c.color}"></span>${esc(c.c)} <span class="muted">· ${c.n}</span></td>
          <td class="n">${money(c.v)}</td>
          <td class="n muted" style="width:34px">${Math.round((c.v / sum) * 100)}%</td>
          <td style="width:68px"><span class="bar"><i style="width:${(c.v / top) * 100}%;background:${c.color}"></i></span></td></tr>`).join("")}
      </tbody></table>
    </div>
  </section>
  <section>
    <h2>By month</h2>
    <table class="months"><tbody>
      ${byMonth.map(({ m, rows: rs }) => `<tr><td style="width:96px">${monthName(m)}</td>
        <td><div class="mbar" style="width:${(total(rs) / topMonth) * 100}%"></div></td>
        <td class="n" style="width:96px">${money(total(rs))}</td></tr>`).join("")}
    </tbody></table>
  </section>
</div>

<section style="break-inside:auto">
  <h2>All expenses</h2>
  <table class="detail">
    <thead><tr><th style="width:72px">Date</th><th>Vendor</th><th>Description</th><th style="width:92px">Category</th><th style="width:78px">Invoice</th><th class="n" style="width:96px">Amount</th></tr></thead>
    <tbody>
      ${byMonth.map(({ m, rows: rs }) => `<tr class="month"><td colspan="5">${monthName(m)} <span class="muted" style="font-weight:400">· ${rs.length}</span></td><td class="n">${money(total(rs))}</td></tr>
        ${rs.map((r) => `<tr><td class="date">${fmtDate(r.date)}</td><td>${esc(r.vendor)}</td><td class="desc">${esc(r.description)}</td>
          <td><span class="dot" style="background:${colorOf(r.category)}"></span>${esc(r.category)}</td>
          <td>${r.invoices.length ? `<span class="inv-ok">✓ ${r.invoices.length > 1 ? r.invoices.length : "Attached"}</span>` : `<span class="inv-miss">Missing</span>`}</td>
          <td class="n">${money(r.amount)}</td></tr>`).join("")}`).join("")}
    </tbody>
    <tfoot><tr><td colspan="5">Total · ${rows.length} expenses</td><td class="n">${money(sum)}</td></tr></tfoot>
  </table>
</section>

<div class="sign"><div><span>Prepared by</span><span>Date</span></div><div><span>Approved by</span><span>Date</span></div></div>
`}
</div></body></html>`;
}

/** Opens the report in a new window and prints it once the font has loaded. */
export function printReport(rows: Row[], title: string, opts?: { categories?: string[]; preparedBy?: string }) {
  const w = window.open("", "_blank");
  if (!w) return;
  const autoPrint = `<script>addEventListener("load", () => document.fonts.ready.then(() => print()))</script>`;
  w.document.write(reportHtml(rows, title, opts).replace("</body>", `${autoPrint}</body>`));
  w.document.close();
}
