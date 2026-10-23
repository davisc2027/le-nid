import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, phrase: string, extra = "") => page.goto(`/dev/speak?phrase=${encodeURIComponent(phrase)}${extra}`);
const mic = (page: Page) => page.getByTestId("speak-mic");
const result = (page: Page) => page.getByTestId("speak-result");

test("@speech say it, replay, retry, continue", async ({ page }) => {
  await open(page, "Très");
  await mic(page).click();
  await expect(mic(page)).toHaveAttribute("data-recstate", "recording");
  await expect(mic(page)).toHaveAttribute("data-recstate", "done", { timeout: 8000 });
  await expect(result(page)).toHaveAttribute("data-state", "success");

  await page.evaluate(() => {
    const w = window as unknown as { __events: string[] };
    w.__events = [];
    window.addEventListener("speak-playback", (e) => w.__events.push((e as CustomEvent<string>).detail));
  });
  await page.getByTestId("shadow-all").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __events: string[] }).__events), { timeout: 15000 }).toEqual(["model", "me", "model", "end"]);

  await page.getByTestId("speak-retry").click();
  await expect(mic(page)).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  await mic(page).click();
  await expect(result(page)).toBeVisible({ timeout: 10000 });
  await page.getByTestId("speak-continue").click();
  await expect(page.getByTestId("dev-done")).toHaveText("Done");
});

test("@rising a question that goes up", async ({ page }) => {
  await open(page, "Ça va ?");
  await mic(page).click();
  await expect(result(page)).toHaveAttribute("data-state", "success", { timeout: 10000 });
  await expect(page.getByText("Your voice went up at the end")).toBeVisible();
});

test("@falling a question that falls gets a gentle nudge", async ({ page }) => {
  await open(page, "Ça va ?");
  await mic(page).click();
  await expect(result(page)).toHaveAttribute("data-state", "near-miss", { timeout: 10000 });
  await expect(result(page).getByRole("img", { name: "Your voice" })).toBeVisible();
});

test("@silence no speech heard", async ({ page }) => {
  await open(page, "Très");
  await mic(page).click();
  await expect(result(page)).toHaveAttribute("data-state", "no-speech", { timeout: 9000 });
  await expect(result(page)).toContainText("I didn't hear anything");
  await expect(page.getByTestId("shadow-me")).toHaveCount(0);
});

test("@denied microphone off never traps the learner", async ({ page }) => {
  await open(page, "Très");
  await mic(page).click();
  await expect(result(page)).toHaveAttribute("data-state", "denied");
  await expect(result(page)).toContainText("Microphone off");
  await page.getByTestId("speak-continue").click();
  await expect(page.getByTestId("dev-done")).toHaveText("Done");
});

test("@speech practice mode has no Can't speak now", async ({ page }) => {
  await open(page, "Très", "&mode=practice");
  await expect(page.getByTestId("speak-cant")).toHaveCount(0);
  await page.getByTestId("speak-skip").click();
  await expect(page.getByTestId("dev-done")).toHaveText("Done");
});
