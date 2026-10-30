import { expect, test } from "@playwright/test";

test.describe("PWA 可安装性（AC-10 已取消，仅验证安装元数据）", () => {
  test("manifest 可访问且内容完整", async ({ page, request }) => {
    await page.goto("/");

    const href = await page.getAttribute('link[rel="manifest"]', "href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: unknown[];
    };
    expect(manifest.name).toBe("数独");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("图标资源可访问", async ({ request }) => {
    for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
      const response = await request.get(icon);
      expect(response.ok(), `${icon} 应返回 200`).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });

  test("不再注册 Service Worker", async ({ page }) => {
    await page.goto("/");

    const registrations = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      const list = await navigator.serviceWorker.getRegistrations();
      return list.length;
    });

    expect(registrations).toBe(0);
  });
});
