import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { TimelineView } from "@/components/TimelineView";
import { addDays, diffDays, type ISODate } from "@/lib/dates";
import type { CardRow, Member, TimelineColumn } from "@/lib/types";

// Plane's chart marks "today" from the browser clock, so the cards are laid out around the real today.
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` as ISODate;
const SIDEBAR_W = 320;

const card = (id: string, startDate: string | null, dueDate: string | null, extra: Partial<CardRow> = {}): CardRow => ({
  id,
  boardId: "b1",
  columnId: "c1",
  title: `Card ${id}`,
  description: "",
  startDate,
  dueDate,
  assigneeIds: [],
  tagIds: [],
  project: null,
  priority: null,
  boardName: "Board",
  columnName: "Todo",
  done: false,
  inProgress: false,
  movedAt: "2026-10-01T00:00:00Z",
  ...extra,
});

const CARDS = [
  card("1", addDays(TODAY, -2), addDays(TODAY, 2), { priority: "high", assigneeIds: ["m1"] }), // 5 days
  card("2", null, addDays(TODAY, 10)), // deadline only
  card("3", null, null), // no dates yet
];

// The groups are kanban columns; "Shipped" is empty, "Backlog" is on another board.
const COLUMNS: TimelineColumn[] = [
  { id: "c1", boardId: "b1", boardName: "Board", name: "Todo", isDone: false, isInProgress: false },
  { id: "c2", boardId: "b1", boardName: "Board", name: "Shipped", isDone: true, isInProgress: false },
  { id: "c9", boardId: "b2", boardName: "Other", name: "Backlog", isDone: false, isInProgress: false },
];
const MEMBERS: Member[] = [{ id: "m1", name: "Aigerim", email: "aigerim@qazbot.test", image: null }];

async function mount(initialView: "week" | "month" | "quarter" = "month", width = 1100, cards = CARDS) {
  const screen = await render(
    <div style={{ width, height: 700, display: "flex", flexDirection: "column" }}>
      <TimelineView today={TODAY} cards={cards} columns={COLUMNS} members={MEMBERS} tags={[]} groupByBoard initialView={initialView} />
    </div>,
  );
  const scroller = screen.container.querySelector<HTMLElement>("[data-timeline-scroll]")!;
  await expect.poll(() => scroller.dataset.chartStart).toBeTruthy();
  await frames();
  return { screen, scroller };
}

const frames = (n = 3) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });

const dayWidth = (scroller: HTMLElement) => Number(scroller.dataset.dayWidth);
const chartStart = (scroller: HTMLElement) => scroller.dataset.chartStart as ISODate;
/** The day right after the sticky sidebar. */
const firstVisibleDay = (scroller: HTMLElement) => addDays(chartStart(scroller), Math.floor(scroller.scrollLeft / dayWidth(scroller)));

async function scrollTo(scroller: HTMLElement, left: number) {
  scroller.scrollLeft = left;
  scroller.dispatchEvent(new Event("scroll"));
  await frames();
}

/** Left edge of the timeline's day 0 on screen. */
const chartOriginX = (scroller: HTMLElement) => scroller.getBoundingClientRect().left + SIDEBAR_W - scroller.scrollLeft;

function bar(scroller: HTMLElement, id: string) {
  return scroller.querySelector<HTMLElement>(`[data-bar="${id}"]`);
}

/** Press on an element, move by dx pixels, release: Plane's drag listens to mouse events on the document. */
async function drag(el: Element, dx: number, whileHeld?: () => void | Promise<void>) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: x, clientY: y }));
  for (let i = 1; i <= 4; i++) document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x + (dx * i) / 4, clientY: y }));
  await frames();
  await whileHeld?.();
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x + dx, clientY: y }));
  await frames();
}

const fill = (scroller: HTMLElement, id: string) => bar(scroller, id)!.querySelector<HTMLElement>('[role="button"]')!;

declare global {
  var __serverActions: [string, unknown[]][] | undefined;
}
/** What the timeline asked the server to save, by action name. */
const calls = (name: string) => (globalThis.__serverActions ?? []).filter(([n]) => n === name).map(([, args]) => args);

const rowIds = (scroller: HTMLElement, column: string) =>
  [...scroller.querySelectorAll<HTMLElement>(`[data-group-id="${column}"] [data-sidebar-row]`)].map((r) => r.dataset.sidebarRow);

/**
 * Drag with pointer events, as dnd-kit listens for them: press on the row's name and move to (x, y).
 * `hold` keeps the pointer there for that many frames before letting go, calling `whileHeld` each frame.
 */
async function pointerDrag(el: Element, x2: number, y2: number, hold = 0, whileHeld?: () => void) {
  const r = el.getBoundingClientRect();
  const x = r.left + 40;
  const y = r.top + r.height / 2;
  const opts = { bubbles: true, isPrimary: true, pointerId: 1, button: 0 };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: x, clientY: y }));
  for (let i = 1; i <= 10; i++) {
    document.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: x + ((x2 - x) * i) / 10, clientY: y + ((y2 - y) * i) / 10 }));
    await frames(1);
  }
  for (let i = 0; i < hold; i++) {
    document.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: x2, clientY: y2 + (i % 2) }));
    await frames(1);
    whileHeld?.();
  }
  document.dispatchEvent(new PointerEvent("pointerup", { ...opts, clientX: x2, clientY: y2 }));
  await frames();
}
const nameOf = (scroller: HTMLElement, id: string) => scroller.querySelector<HTMLElement>(`[data-sidebar-row="${id}"] [data-row-name]`)!;
const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return [r.left + 60, r.top + r.height / 2] as const;
};

afterEach(() => {
  cleanup();
  globalThis.__serverActions = [];
});

describe("the app's timeline look", () => {
  test("header: zoom tabs and the Earlier / Today / Later pager, with the visible dates", async () => {
    const { screen } = await mount();
    await expect.element(screen.getByRole("tab", { name: "Month" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "false");
    await expect.element(screen.getByRole("tab", { name: "Quarter" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Earlier" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Later" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Today" })).toBeVisible();
    await expect.element(screen.getByText(/ to .*, all boards$/)).toBeVisible();
  });

  test("cards are grouped by kanban column, empty columns included, with the board on all-boards", async () => {
    const { scroller } = await mount();
    const headings = [...scroller.querySelectorAll<HTMLElement>("[data-group-label]")].map((h) => h.textContent);
    expect(headings).toEqual([expect.stringMatching(/Board.*Todo.*3/), expect.stringMatching(/Board.*Shipped.*0/), expect.stringMatching(/Other.*Backlog.*0/)]);
    expect(rowIds(scroller, "c1")).toEqual(["1", "2", "3"]);
    expect(rowIds(scroller, "c2")).toEqual([]);
    const rows = [...scroller.querySelectorAll<HTMLElement>("[data-sidebar-row]")];
    expect(rows[0].textContent).toContain("5 days");
    expect(rows[1].textContent).toContain("1 day");
  });

  test("opens on today: today's date is circled and a line marks it", async () => {
    const { scroller } = await mount();
    expect(dayWidth(scroller)).toBe(32);
    const first = firstVisibleDay(scroller);
    const last = addDays(first, Math.floor((scroller.clientWidth - SIDEBAR_W) / 32));
    expect(first <= TODAY && TODAY <= last, `${TODAY} within ${first}..${last}`).toBe(true);
    const todayCell = scroller.querySelector<HTMLElement>(`[data-day="${TODAY}"]`)!;
    expect(todayCell.querySelector(".bg-primary")).not.toBeNull();
    const line = scroller.querySelector<HTMLElement>("[data-today-line]")!.getBoundingClientRect();
    const cell = todayCell.getBoundingClientRect();
    expect(line.left).toBeGreaterThan(cell.left);
    expect(line.right).toBeLessThan(cell.right);
  });

  test("Week and Quarter switch the scale (64px and 14px days)", async () => {
    const { screen, scroller } = await mount();
    await screen.getByRole("tab", { name: "Week" }).click();
    await expect.poll(() => dayWidth(scroller)).toBe(64);
    await expect.element(screen.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    await screen.getByRole("tab", { name: "Quarter" }).click();
    await expect.poll(() => dayWidth(scroller)).toBe(14);
  });

  test("bars are a comfortable height, with the title and no avatars", async () => {
    const { scroller } = await mount();
    const f = fill(scroller, "1");
    expect(f.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    expect(f.textContent).toBe("Card 1");
    expect(f.querySelector("[data-slot=avatar], img")).toBeNull();
  });

  test("bars sit on their dates, in the state colour", async () => {
    const { scroller } = await mount();
    const b = bar(scroller, "1")!;
    const expectedLeft = chartOriginX(scroller) + diffDays(addDays(TODAY, -2), chartStart(scroller)) * 32;
    expect(Math.abs(b.getBoundingClientRect().left - expectedLeft)).toBeLessThanOrEqual(1);
    expect(b.getBoundingClientRect().width).toBe(5 * 32);
    expect(fill(scroller, "1").style.backgroundColor).toContain("color-mix");
  });

  test("a card with only a deadline is a one-day bar on it", async () => {
    const { scroller } = await mount();
    const b = bar(scroller, "2")!.getBoundingClientRect();
    const dueLeft = chartOriginX(scroller) + diffDays(addDays(TODAY, 10), chartStart(scroller)) * 32;
    expect(Math.abs(b.left - dueLeft)).toBeLessThanOrEqual(1);
    expect(b.width).toBe(32);
  });

  // Plane's chart draws a border on every column; here the columns are days, or weeks when zoomed out.
  // Days in week zoom; weeks in month and quarter zoom.
  for (const [view, col] of [["week", 64], ["month", 32 * 7], ["quarter", 14 * 7]] as const) {
    test(`every column has a border (${view})`, async () => {
      const { scroller } = await mount(view);
      const grid = scroller.querySelector<HTMLElement>("[data-grid]")!;
      const style = getComputedStyle(grid);
      expect(style.backgroundImage).toContain("linear-gradient");
      // The first layer is the column lines.
      expect(style.backgroundSize.split(",")[0].trim().split(" ")[0]).toBe(`${col}px`);
      // A line sits on the left edge of each column: check it lines up with the header cells.
      const cells = [...scroller.querySelectorAll<HTMLElement>(view === "week" ? "[data-day]" : "[data-weekstart], [data-week]")].slice(1, 6);
      expect(cells.length).toBeGreaterThanOrEqual(3);
      const gridLeft = grid.getBoundingClientRect().left;
      const pos = style.backgroundPosition.split(",").map((x) => parseFloat(x));
      const lineOffset = ((pos[0] % col) + col) % col;
      for (const c of cells) {
        const x = c.getBoundingClientRect().left - gridLeft;
        expect(Math.abs((((x - lineOffset) % col) + col) % col), `column at ${c.dataset.day ?? c.dataset.week}`).toBeLessThan(0.5);
      }
      const header = scroller.querySelector<HTMLElement>("[data-grid-header]")!;
      expect(getComputedStyle(header).backgroundSize).toBe(style.backgroundSize);
    });
  }

  test("group headings cover the card column: no lines or today line show through", async () => {
    const { scroller } = await mount();
    // Scroll so today's line and many column borders pass under the card column.
    await scrollTo(scroller, scroller.scrollLeft + 400);
    const headings = [...scroller.querySelectorAll<HTMLElement>("[data-group]")];
    expect(headings.length).toBe(3); // one per column
    for (const heading of headings) {
      const r = heading.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      for (const x of [s.left + 10, s.left + 120, s.left + SIDEBAR_W - 4]) {
        const hit = document.elementFromPoint(x, r.top + r.height / 2)!;
        expect(hit.closest("[data-group-label]"), `at x=${Math.round(x - s.left)} in ${heading.textContent}`).not.toBeNull();
      }
      const label = heading.querySelector<HTMLElement>("[data-group-label]")!;
      expect(getComputedStyle(label).backgroundColor).not.toMatch(/rgba\(.*, 0(\.\d+)?\)|transparent/);
    }
  });

  test("with few cards the chart is only as tall as its rows", async () => {
    const { scroller } = await mount();
    const groups = [...scroller.querySelectorAll<HTMLElement>("[data-group-id]")];
    const last = groups[groups.length - 1].getBoundingClientRect();
    expect(scroller.getBoundingClientRect().bottom - last.bottom).toBeLessThan(24);
  });

  test("with many cards the chart fills the space and scrolls down", async () => {
    const many = Array.from({ length: 40 }, (_, i) => card(String(i + 1), addDays(TODAY, i % 10), addDays(TODAY, (i % 10) + 2)));
    const { screen, scroller } = await mount("month", 1100, many);
    const box = screen.container.firstElementChild!.getBoundingClientRect();
    expect(scroller.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom + 1);
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
  });

  test("Later and Earlier scroll by two weeks", async () => {
    const { screen, scroller } = await mount();
    const start = firstVisibleDay(scroller);
    await screen.getByRole("button", { name: "Later" }).click();
    await expect.poll(() => firstVisibleDay(scroller)).toBe(addDays(start, 14));
    await screen.getByRole("button", { name: "Earlier" }).click();
    await expect.poll(() => firstVisibleDay(scroller)).toBe(start);
  });
});

describe("planning in the card column", () => {
  test("each column has + New card, which adds a card to it and stays open for the next", async () => {
    const { screen, scroller } = await mount();
    scroller.querySelector<HTMLElement>('[data-group-id="c2"] [data-add-card]')!.click();
    const input = screen.getByPlaceholder("What needs doing?");
    await expect.element(input).toHaveFocus();
    await userEvent.type(input, "Fresh card{Enter}");
    await expect.poll(() => calls("addCard")).toEqual([["c2", "Fresh card"]]);
    await expect.element(input).toHaveValue("");
  });

  test("Esc closes the new card field without adding anything", async () => {
    const { screen, scroller } = await mount();
    scroller.querySelector<HTMLElement>('[data-group-id="c1"] [data-add-card]')!.click();
    const input = screen.getByPlaceholder("What needs doing?");
    await userEvent.type(input, "Never mind{Escape}");
    await expect.element(input).not.toBeInTheDocument();
    expect(calls("addCard")).toEqual([]);
  });

  test("dragging a row onto another column changes the card's status", async () => {
    const { scroller } = await mount();
    const [x, y] = center(scroller.querySelector('[data-group-id="c2"] [data-group-label]')!);
    await pointerDrag(nameOf(scroller, "1"), x, y + 20);
    await expect.poll(() => rowIds(scroller, "c2")).toEqual(["1"]);
    expect(rowIds(scroller, "c1")).toEqual(["2", "3"]);
    await expect.poll(() => calls("moveCard")).toEqual([["1", "c2", 0]]);
    // Now in a done column: struck through, like done cards.
    expect(nameOf(scroller, "1").querySelector(".line-through")).not.toBeNull();
  });

  test("dragging a row within its column changes the order", async () => {
    const { scroller } = await mount();
    const [x, y] = center(nameOf(scroller, "1"));
    await pointerDrag(nameOf(scroller, "3"), x, y - 10);
    await expect.poll(() => rowIds(scroller, "c1")).toEqual(["3", "1", "2"]);
    await expect.poll(() => calls("moveCard")).toEqual([["3", "c1", 0]]);
  });

  test("dragging a row doesn't scroll the timeline sideways", async () => {
    const { scroller } = await mount();
    const left = scroller.scrollLeft;
    const s = scroller.getBoundingClientRect();
    const [, y] = center(scroller.querySelector('[data-group-id="c2"] [data-group-label]')!);
    // Hold right by the chart's left edge, where auto-scroll would kick in.
    await pointerDrag(nameOf(scroller, "1"), s.left + 4, y, 30);
    expect(scroller.scrollLeft).toBe(left);
  });

  test("hovering a row shows a drag grip in place of its state icon, as on the board", async () => {
    const { scroller } = await mount();
    const name = nameOf(scroller, "1");
    const grip = name.querySelector<SVGElement>("[data-grip]")!;
    expect(getComputedStyle(grip).display).toBe("none");
    await userEvent.hover(name);
    await expect.poll(() => getComputedStyle(grip).display).not.toBe("none");
  });

  // Card 4 is already in "Shipped".
  const WITH_SHIPPED = [...CARDS, card("4", addDays(TODAY, 1), addDays(TODAY, 3), { columnId: "c2" })];

  test("dropping on a column's heading puts the card at the top of that column", async () => {
    const { scroller } = await mount("month", 1100, WITH_SHIPPED);
    const [x, y] = center(scroller.querySelector('[data-group-id="c2"] [data-group-label]')!);
    await pointerDrag(nameOf(scroller, "1"), x, y, 6);
    await expect.poll(() => rowIds(scroller, "c2")).toEqual(["1", "4"]);
    await expect.poll(() => calls("moveCard")).toEqual([["1", "c2", 0]]);
  });

  test("dropping on a column's New card row puts the card at the bottom", async () => {
    const { scroller } = await mount("month", 1100, WITH_SHIPPED);
    const [x, y] = center(scroller.querySelector('[data-group-id="c2"] [data-add-card]')!);
    await pointerDrag(nameOf(scroller, "1"), x, y, 6);
    await expect.poll(() => rowIds(scroller, "c2")).toEqual(["4", "1"]);
    await expect.poll(() => calls("moveCard")).toEqual([["1", "c2", 1]]);
  });

  test("holding a row over a column heading doesn't flicker between columns", async () => {
    const { scroller } = await mount("month", 1100, WITH_SHIPPED);
    const [x, y] = center(scroller.querySelector('[data-group-id="c2"] [data-group-label]')!);
    const seen = new Set<string>();
    await pointerDrag(nameOf(scroller, "1"), x, y, 20, () => seen.add(rowIds(scroller, "c2").join()));
    expect([...seen]).toEqual(["1,4"]);
  });

  test("a row can't be dropped on another board's column", async () => {
    const { scroller } = await mount();
    const [x, y] = center(scroller.querySelector('[data-group-id="c9"] [data-group-label]')!);
    await pointerDrag(nameOf(scroller, "1"), x, y + 20);
    await frames(5);
    expect(rowIds(scroller, "c1")).toEqual(["1", "2", "3"]);
    expect(rowIds(scroller, "c9")).toEqual([]);
    expect(calls("moveCard")).toEqual([]);
  });

  test("a row shows priority and assignees beside its length, and they can be changed there", async () => {
    const { screen, scroller } = await mount();
    const row = scroller.querySelector<HTMLElement>('[data-sidebar-row="1"]')!;
    expect(row.textContent).toContain("5 days");
    const priority = row.querySelector<HTMLElement>('[aria-label="Set priority: High"]')!;
    expect(priority).not.toBeNull();
    expect(row.querySelector('[aria-label="Assignees"]')).not.toBeNull();
    await userEvent.click(priority);
    await screen.getByRole("menuitem", { name: "Urgent" }).click();
    await expect.poll(() => calls("quickUpdateCard")).toEqual([["1", { priority: "urgent" }]]);
    await expect.poll(() => row.querySelector('[aria-label="Set priority: Urgent"]')).not.toBeNull();
  });
});

describe("editing on the chart", () => {
  test("dragging the right edge makes the card longer", async () => {
    const { scroller } = await mount();
    const handle = bar(scroller, "1")!.querySelector('[data-resize="right"]')!;
    await drag(handle, 3 * 32, () => {
      // The new dates show above the bar while it's held.
      expect(bar(scroller, "1")!.textContent).toMatch(/–/);
    });
    const row = scroller.querySelector<HTMLElement>('[data-sidebar-row="1"]')!;
    await expect.poll(() => row.textContent).toContain("8 days");
    expect(bar(scroller, "1")!.getBoundingClientRect().width).toBe(8 * 32);
  });

  // With a real mouse (Playwright), as a person drags: grab just inside the bar's visible edge.
  async function mouseDragEdge(scroller: HTMLElement, id: string, side: "left" | "right", days: number) {
    const f = fill(scroller, id).getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const x = side === "left" ? f.left + 2 : f.right - 2;
    const y = f.top + f.height / 2;
    const handle = document.elementFromPoint(x, y)!;
    await userEvent.dragAndDrop(handle, scroller, { sourcePosition: { x: x - handle.getBoundingClientRect().left, y: y - handle.getBoundingClientRect().top }, targetPosition: { x: x + days * 32 - s.left, y: y - s.top } });
    await frames();
  }

  test("a real mouse drag on the right edge changes the deadline", async () => {
    const { scroller } = await mount();
    await mouseDragEdge(scroller, "1", "right", 3);
    await expect.poll(() => scroller.querySelector('[data-sidebar-row="1"]')!.textContent).toContain("8 days");
  });

  test("a real mouse drag on the left edge changes the start", async () => {
    const { scroller } = await mount();
    const right = bar(scroller, "1")!.getBoundingClientRect().right;
    await mouseDragEdge(scroller, "1", "left", -2);
    await expect.poll(() => scroller.querySelector('[data-sidebar-row="1"]')!.textContent).toContain("7 days");
    expect(bar(scroller, "1")!.getBoundingClientRect().right).toBeCloseTo(right, 0);
  });

  test("rows keep their order after a bar gets new dates", async () => {
    const { scroller } = await mount();
    const order = () => [...scroller.querySelectorAll<HTMLElement>("[data-sidebar-row]")].map((r) => r.dataset.sidebarRow);
    expect(order()).toEqual(["1", "2", "3"]);
    // Move card 1 past card 2's deadline: by date it would now come second.
    await drag(fill(scroller, "1"), 14 * 32);
    await expect.poll(() => scroller.querySelector('[data-sidebar-row="1"]')!.textContent).toContain("5 days");
    expect(order()).toEqual(["1", "2", "3"]);
  });

  test("dragging the left edge moves the start only", async () => {
    const { scroller } = await mount();
    const before = bar(scroller, "1")!.getBoundingClientRect();
    await drag(bar(scroller, "1")!.querySelector('[data-resize="left"]')!, -2 * 32);
    const after = bar(scroller, "1")!.getBoundingClientRect();
    expect(after.left).toBeCloseTo(before.left - 64, 0);
    expect(after.right).toBeCloseTo(before.right, 0);
  });

  test("dragging the bar moves both dates and keeps its length", async () => {
    const { scroller } = await mount();
    const before = bar(scroller, "1")!.getBoundingClientRect();
    await drag(fill(scroller, "1"), 4 * 32);
    const after = bar(scroller, "1")!.getBoundingClientRect();
    expect(after.left).toBeCloseTo(before.left + 128, 0);
    expect(after.width).toBe(before.width);
    expect(scroller.querySelector('[data-sidebar-row="1"]')!.textContent).toContain("5 days");
  });

  test("a card without dates gets them from the + on its row", async () => {
    const { screen, scroller } = await mount();
    expect(bar(scroller, "3")).toBeNull();
    const rowTop = scroller.querySelector('[data-sidebar-row="3"]')!.getBoundingClientRect().top;
    // Hover the chart part of that row, then click the + that follows the pointer.
    const target = document.elementFromPoint(scroller.getBoundingClientRect().left + SIDEBAR_W + 200, rowTop + 20)!;
    await userEvent.hover(target);
    await screen.getByRole("button", { name: /^Schedule Card 3 on/ }).click();
    await expect.poll(() => bar(scroller, "3")).not.toBeNull();
    expect(bar(scroller, "3")!.getBoundingClientRect().width).toBe(32);
  });

  test("clicking a bar opens the card", async () => {
    const { screen, scroller } = await mount();
    fill(scroller, "1").click();
    await expect.element(screen.getByRole("dialog")).toBeVisible();
  });

  test("an arrow on the row jumps back to a bar that's out of view", async () => {
    const { scroller } = await mount();
    await scrollTo(scroller, scroller.scrollLeft + 3 * scroller.clientWidth);
    await expect.poll(() => scroller.querySelector('[data-jump="1"]')).not.toBeNull();
    scroller.querySelector<HTMLElement>('[data-jump="1"]')!.click();
    await frames();
    const r = bar(scroller, "1")!.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(s.left + SIDEBAR_W - 8);
    expect(r.left).toBeLessThan(s.right);
  });

  test("Today brings the view back", async () => {
    const { screen, scroller } = await mount();
    await scrollTo(scroller, scroller.scrollLeft + 3 * scroller.clientWidth);
    await screen.getByRole("button", { name: "Today" }).click();
    await frames();
    const first = firstVisibleDay(scroller);
    const last = addDays(first, Math.floor((scroller.clientWidth - SIDEBAR_W) / 32));
    expect(first <= TODAY && TODAY <= last).toBe(true);
  });

  test("arrow keys on a focused bar move it a day", async () => {
    const { scroller } = await mount();
    const before = bar(scroller, "1")!.getBoundingClientRect().left;
    fill(scroller, "1").focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => Math.round(bar(scroller, "1")!.getBoundingClientRect().left - before)).toBe(32);
  });
});

describe("horizontal scrolling", () => {
  test("swipes at the edge neither navigate back nor scroll the page", async () => {
    const { scroller } = await mount();
    expect(getComputedStyle(scroller).overscrollBehaviorX).toBe("contain");
  });

  for (const view of ["week", "month", "quarter"] as const) {
    test(`scrolls back without limit (${view})`, async () => {
      const { scroller } = await mount(view);
      let day = firstVisibleDay(scroller);
      for (let i = 0; i < 8; i++) {
        await scrollTo(scroller, 0);
        const now = firstVisibleDay(scroller);
        expect(scroller.scrollLeft, "earlier days were added to the left").toBeGreaterThan(0);
        expect(now < day, `moved to days before ${day}`).toBe(true);
        day = now;
      }
      expect(diffDays(TODAY, day)).toBeGreaterThan(365);
    });

    test(`scrolls forward without limit (${view})`, async () => {
      const { scroller } = await mount(view);
      for (let i = 0; i < 8; i++) {
        const before = scroller.scrollWidth;
        await scrollTo(scroller, scroller.scrollWidth);
        expect(scroller.scrollWidth, "later days were added to the right").toBeGreaterThan(before);
      }
      expect(diffDays(firstVisibleDay(scroller), TODAY)).toBeGreaterThan(365);
    });

    test(`wheel scrolls both ways through time (${view})`, async () => {
      const { scroller } = await mount(view);
      const start = firstVisibleDay(scroller);
      let day = start;
      for (let i = 0; i < 25; i++) {
        await userEvent.wheel(scroller, { delta: { x: -600 } });
        await frames(2);
        const now = firstVisibleDay(scroller);
        expect(now <= day, `wheel left never moves later (${day} -> ${now})`).toBe(true);
        day = now;
      }
      expect(diffDays(start, day)).toBeGreaterThanOrEqual(Math.floor((25 * 600 * 0.9) / dayWidth(scroller)));
      for (let i = 0; i < 50; i++) {
        await userEvent.wheel(scroller, { delta: { x: 600 } });
        await frames(2);
        const now = firstVisibleDay(scroller);
        expect(now >= day, `wheel right never moves earlier (${day} -> ${now})`).toBe(true);
        day = now;
      }
      expect(diffDays(day, start)).toBeGreaterThanOrEqual(Math.floor((25 * 600 * 0.9) / dayWidth(scroller)));
    }, 30_000); // 75 real wheel inputs
  }

  test("adding days on the left keeps the same day in view", async () => {
    const { scroller } = await mount();
    let expected = firstVisibleDay(scroller);
    for (let i = 0; i < 40; i++) {
      await scrollTo(scroller, scroller.scrollLeft - 7 * 32);
      expected = addDays(expected, -7);
      expect(firstVisibleDay(scroller)).toBe(expected);
    }
  });

  test("bars stay on their dates after days are added on the left", async () => {
    const { scroller } = await mount();
    for (let i = 0; i < 3; i++) await scrollTo(scroller, 0);
    await scrollTo(scroller, (diffDays(addDays(TODAY, -2), chartStart(scroller)) - 5) * 32);
    const expectedLeft = chartOriginX(scroller) + diffDays(addDays(TODAY, -2), chartStart(scroller)) * 32;
    expect(Math.abs(bar(scroller, "1")!.getBoundingClientRect().left - expectedLeft)).toBeLessThanOrEqual(1);
  });
});
