import { PrismaClient } from "@prisma/client";
import { expect, type Browser, type Page } from "@playwright/test";

export const db = new PrismaClient({ datasources: { db: { url: "file:./test.db" } } });

/** Signs in through the real screen using the on-screen demo code. One context per person. */
export async function signIn(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/sign-in");
  await page.fill("input[type=email]", email);
  await page.click("button[type=submit]");
  await page.locator("button.font-mono").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  return page;
}

export const toast = (page: Page, text: string | RegExp) => expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
export const userByEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } });
