const { test, expect } = require("@playwright/test");

test("FAQ do Clube mantém apenas uma resposta aberta por vez", async ({ page }) => {
  await page.goto("/clube");

  const questions = page.locator("details[name='clube-faq']");
  await expect(questions).toHaveCount(3);

  await questions.nth(0).locator("summary").click();
  await expect(questions.nth(0)).toHaveAttribute("open", "");
  await expect(questions.nth(1)).not.toHaveAttribute("open", "");
  const firstOpen = await questions.nth(0).boundingBox();
  const secondClosed = await questions.nth(1).boundingBox();
  expect(firstOpen.height).toBeGreaterThan(secondClosed.height + 10);

  await questions.nth(1).locator("summary").click();
  await expect(questions.nth(0)).not.toHaveAttribute("open", "");
  await expect(questions.nth(1)).toHaveAttribute("open", "");
  await expect(questions.nth(2)).not.toHaveAttribute("open", "");
  const firstClosed = await questions.nth(0).boundingBox();
  const secondOpen = await questions.nth(1).boundingBox();
  expect(secondOpen.height).toBeGreaterThan(firstClosed.height + 10);
});
