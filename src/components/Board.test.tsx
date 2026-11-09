import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { BoardMenu, BoardTitle } from "@/components/Board";
import type { BoardInfo } from "@/components/BoardSettings";

const { renameBoard } = vi.hoisted(() => ({ renameBoard: vi.fn() }));
vi.mock("@/app/actions", async (original) => ({ ...(await original<typeof import("@/app/actions")>()), renameBoard }));

const board: BoardInfo = { id: "b1", name: "Roadmap", room: "back_office", roomBoards: {}, createdBy: null, memberIds: [], canManage: true };
const title = () => page.getByRole("textbox", { name: "Board name" });

beforeEach(() => {
  renameBoard.mockReset();
  renameBoard.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("board title in the breadcrumb", () => {
  test("Enter saves the trimmed name", async () => {
    await render(<BoardTitle board={board} />);
    await title().fill("  Launch plan  ");
    await userEvent.keyboard("{Enter}");
    expect(renameBoard).toHaveBeenCalledExactlyOnceWith("b1", "Launch plan");
    await expect.element(title()).toHaveValue("Launch plan");
  });

  test("Escape puts the name back without saving", async () => {
    await render(<BoardTitle board={board} />);
    await title().fill("Oops");
    await userEvent.keyboard("{Escape}");
    expect(renameBoard).not.toHaveBeenCalled();
    await expect.element(title()).toHaveValue("Roadmap");
  });

  test("an empty name puts the old one back", async () => {
    await render(<BoardTitle board={board} />);
    await title().fill("   ");
    await userEvent.keyboard("{Enter}");
    expect(renameBoard).not.toHaveBeenCalled();
    await expect.element(title()).toHaveValue("Roadmap");
  });

  test("a failed save puts the old name back", async () => {
    renameBoard.mockRejectedValue(new Error("nope"));
    await render(<BoardTitle board={board} />);
    await title().fill("Launch plan");
    await userEvent.keyboard("{Enter}");
    await expect.element(title()).toHaveValue("Roadmap");
  });
});

describe("rename from the board menu", () => {
  const openDialog = async () => {
    await render(<BoardMenu board={board} members={[]} canDelete={false} />);
    await page.getByRole("button", { name: "Board options" }).click();
    await page.getByRole("menuitem", { name: "Rename board" }).click();
    await expect.element(title()).toHaveValue("Roadmap");
  };
  const confirm = () => page.getByRole("button", { name: "Rename", exact: true });

  test("saves the new name and closes", async () => {
    await openDialog();
    await title().fill("Launch plan");
    await confirm().click();
    expect(renameBoard).toHaveBeenCalledExactlyOnceWith("b1", "Launch plan");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    // Radix blocks clicks on the page while a menu or dialog is up; closing must give them back.
    await expect.poll(() => document.body.style.pointerEvents).not.toBe("none");
  });

  test("an unchanged name closes without saving", async () => {
    await openDialog();
    await confirm().click();
    expect(renameBoard).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  test("an empty name can't be saved", async () => {
    await openDialog();
    await title().fill("   ");
    await expect.element(confirm()).toBeDisabled();
  });

  test("stays open when the save fails", async () => {
    renameBoard.mockRejectedValue(new Error("nope"));
    await openDialog();
    await title().fill("Launch plan");
    await confirm().click();
    await expect.element(title()).toHaveValue("Launch plan");
    await expect.element(confirm()).toBeEnabled();
  });
});
