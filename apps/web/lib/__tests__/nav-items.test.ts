import { describe, it, expect } from "vitest";
import {
  filterNavByRole,
  filterSettingsNavByRole,
  isSettingsRoute,
  NAV_ITEMS,
  SETTINGS_NAV_ITEMS,
} from "@/lib/nav-items";

describe("isSettingsRoute", () => {
  it("matches the settings area routes (in-place sidebar swap trigger)", () => {
    for (const p of [
      "/settings",
      "/settings/notifications",
      "/accounts",
      "/workspaces",
      "/users",
      "/system",
    ]) {
      expect(isSettingsRoute(p)).toBe(true);
    }
  });

  it("does NOT match the main app routes", () => {
    for (const p of [
      "/dashboard",
      "/trades",
      "/strategies",
      "/marketplace",
      "/risk",
      "/reports",
      "/backtest",
      "/tenants",
    ]) {
      expect(isSettingsRoute(p)).toBe(false);
    }
  });

  it("matches on segment boundaries only (no false prefix matches)", () => {
    // "/settings" must not match an unrelated route that merely starts with the
    // same letters.
    expect(isSettingsRoute("/settings-export")).toBe(false);
    expect(isSettingsRoute("/users-archive")).toBe(false);
    // but a real sub-path does match
    expect(isSettingsRoute("/users/123")).toBe(true);
  });
});

describe("filterNavByRole", () => {
  it("returns [] for an undefined role (fail closed)", () => {
    expect(filterNavByRole(undefined)).toEqual([]);
  });

  it("shows the lean primary nav (no admin items) to a TRADER", () => {
    const hrefs = filterNavByRole("TRADER").map((i) => i.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/trades");
    expect(hrefs).toContain("/settings");
    // admin-only items live in the settings nav, never the primary nav
    expect(hrefs).not.toContain("/users");
    expect(hrefs).not.toContain("/workspaces");
  });

  it("never leaks role-gated items (primary nav has none anyway)", () => {
    // every NAV_ITEMS entry is unrestricted; a VIEWER sees them all
    expect(filterNavByRole("VIEWER")).toHaveLength(NAV_ITEMS.length);
  });
});

describe("filterSettingsNavByRole", () => {
  it("returns [] for an undefined role", () => {
    expect(filterSettingsNavByRole(undefined)).toEqual([]);
  });

  it("hides Admin items (Workspaces/Users/System) from a TRADER", () => {
    const hrefs = filterSettingsNavByRole("TRADER").map((i) => i.href);
    expect(hrefs).toContain("/settings"); // General
    expect(hrefs).toContain("/accounts");
    expect(hrefs).toContain("/settings/notifications"); // Alerts
    expect(hrefs).not.toContain("/users");
    expect(hrefs).not.toContain("/workspaces");
    expect(hrefs).not.toContain("/system");
  });

  it("shows Users + System to an ADMIN but Workspaces only to SUPER_ADMIN", () => {
    const admin = filterSettingsNavByRole("ADMIN").map((i) => i.href);
    expect(admin).toContain("/users");
    expect(admin).toContain("/system");
    expect(admin).not.toContain("/workspaces"); // SUPER_ADMIN only

    const superAdmin = filterSettingsNavByRole("SUPER_ADMIN").map((i) => i.href);
    expect(superAdmin).toContain("/workspaces");
    expect(superAdmin).toContain("/users");
    expect(superAdmin).toContain("/system");
  });

  it("every settings route is recognised by isSettingsRoute", () => {
    // guards against adding a settings nav item whose URL wouldn't trigger the
    // in-place sidebar swap.
    for (const item of SETTINGS_NAV_ITEMS) {
      expect(isSettingsRoute(item.href)).toBe(true);
    }
  });
});
