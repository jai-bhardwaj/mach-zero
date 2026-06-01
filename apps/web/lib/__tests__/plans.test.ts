import { describe, it, expect } from "vitest";
import { hasFeature, getLimit, getPlanFeatures } from "../plans";

describe("plan tiers", () => {
  describe("FREE", () => {
    it("has no premium features", () => {
      expect(hasFeature("FREE", "live_mode")).toBe(false);
      expect(hasFeature("FREE", "api_access")).toBe(false);
      expect(hasFeature("FREE", "dedicated_engine")).toBe(false);
      expect(hasFeature("FREE", "audit_log_export")).toBe(false);
    });

    it("limits match documented free quotas", () => {
      expect(getLimit("FREE", "maxStrategies")).toBe(1);
      expect(getLimit("FREE", "maxAccounts")).toBe(1);
      expect(getLimit("FREE", "maxUsers")).toBe(1);
      expect(getLimit("FREE", "maxAlerts")).toBe(0);
    });
  });

  describe("PRO", () => {
    it("includes live_mode + api_access (the headline gates)", () => {
      expect(hasFeature("PRO", "live_mode")).toBe(true);
      expect(hasFeature("PRO", "api_access")).toBe(true);
      expect(hasFeature("PRO", "audit_log_export")).toBe(true);
      expect(hasFeature("PRO", "multi_user")).toBe(true);
    });

    it("does NOT include enterprise-only features", () => {
      expect(hasFeature("PRO", "dedicated_engine")).toBe(false);
      expect(hasFeature("PRO", "priority_support")).toBe(false);
    });

    it("limits scale beyond FREE but are bounded", () => {
      expect(getLimit("PRO", "maxStrategies")).toBeGreaterThan(
        getLimit("FREE", "maxStrategies")
      );
      expect(getLimit("PRO", "maxStrategies")).toBeLessThan(
        Number.POSITIVE_INFINITY
      );
    });
  });

  describe("ENTERPRISE", () => {
    it("includes everything", () => {
      expect(hasFeature("ENTERPRISE", "live_mode")).toBe(true);
      expect(hasFeature("ENTERPRISE", "api_access")).toBe(true);
      expect(hasFeature("ENTERPRISE", "dedicated_engine")).toBe(true);
      expect(hasFeature("ENTERPRISE", "priority_support")).toBe(true);
    });

    it("limits are unbounded", () => {
      expect(getLimit("ENTERPRISE", "maxStrategies")).toBe(
        Number.POSITIVE_INFINITY
      );
      expect(getLimit("ENTERPRISE", "maxAccounts")).toBe(
        Number.POSITIVE_INFINITY
      );
    });
  });

  it("getPlanFeatures returns FREE for an unknown plan tier (defensive)", () => {
    // Cast to bypass TS — runtime guard is what matters.
    const result = getPlanFeatures("UNKNOWN" as never);
    expect(result.features.size).toBe(0);
    expect(result.limits.maxStrategies).toBe(1);
  });
});
