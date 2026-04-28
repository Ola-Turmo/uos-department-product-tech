import { describe, expect, it, beforeEach } from "vitest";
import {
  createInitialConnectorHealthState,
  updateConnectorHealthState,
  computeDepartmentHealthStatus,
  generateToolkitLimitations,
  formatLimitationMessage,
  formatAllLimitations,
  hasImpairedConnectors,
  getImpairedConnectors,
  getRequiredToolkits,
  getToolkitDisplayName,
  type ConnectorHealthState,
} from "../src/connector-health.js";

describe("connector-health", () => {
  describe("getRequiredToolkits", () => {
    it("returns the configured required toolkits", () => {
      const toolkits = getRequiredToolkits();
      expect(toolkits).toContain("github");
      expect(toolkits).toContain("googledrive");
      expect(toolkits).toContain("googledocs");
      expect(toolkits).toContain("slack");
    });

    it("returns a copy, not a mutation risk to the original", () => {
      const toolkits = getRequiredToolkits();
      toolkits.push("fake-toolkit");
      expect(getRequiredToolkits()).not.toContain("fake-toolkit");
    });
  });

  describe("getToolkitDisplayName", () => {
    it("returns known display names", () => {
      expect(getToolkitDisplayName("github")).toBe("GitHub");
      expect(getToolkitDisplayName("googledrive")).toBe("Google Drive");
      expect(getToolkitDisplayName("googledocs")).toBe("Google Docs");
      expect(getToolkitDisplayName("slack")).toBe("Slack");
    });

    it("falls back to toolkitId for unknown toolkits", () => {
      expect(getToolkitDisplayName("unknown-toolkit")).toBe("unknown-toolkit");
    });
  });

  describe("createInitialConnectorHealthState", () => {
    it("creates unknown state for all required toolkits", () => {
      const states = createInitialConnectorHealthState();
      expect(states.length).toBe(getRequiredToolkits().length);
      for (const state of states) {
        expect(state.status).toBe("unknown");
        expect(state.lastChecked).toBeTruthy();
      }
    });

    it("each state has a toolkitId from requiredToolkits", () => {
      const required = getRequiredToolkits();
      const states = createInitialConnectorHealthState();
      for (const state of states) {
        expect(required).toContain(state.toolkitId);
      }
    });
  });

  describe("updateConnectorHealthState", () => {
    let initialStates: ConnectorHealthState[];

    beforeEach(() => {
      initialStates = createInitialConnectorHealthState();
    });

    it("updates status for a matching toolkitId", () => {
      const updated = updateConnectorHealthState(initialStates, "github", "ok");
      const github = updated.find((s) => s.toolkitId === "github");
      expect(github?.status).toBe("ok");
      expect(github?.lastChecked).toBeTruthy();
    });

    it("does not modify other connectors when updating one", () => {
      const updated = updateConnectorHealthState(initialStates, "github", "ok");
      const slack = updated.find((s) => s.toolkitId === "slack");
      expect(slack?.status).toBe("unknown");
    });

    it("sets error message when status is not ok", () => {
      const updated = updateConnectorHealthState(
        initialStates,
        "github",
        "error",
        "Authentication failed"
      );
      const github = updated.find((s) => s.toolkitId === "github");
      expect(github?.status).toBe("error");
      expect(github?.error).toBe("Authentication failed");
    });

    it("clears error when status returns to ok", () => {
      const withError = updateConnectorHealthState(
        initialStates,
        "github",
        "error",
        "Auth failed"
      );
      const cleared = updateConnectorHealthState(withError, "github", "ok");
      const github = cleared.find((s) => s.toolkitId === "github");
      expect(github?.status).toBe("ok");
      expect(github?.error).toBeUndefined();
    });

    it("sets a default limitationMessage when degraded", () => {
      const updated = updateConnectorHealthState(initialStates, "github", "degraded");
      const github = updated.find((s) => s.toolkitId === "github");
      expect(github?.limitationMessage).toBeTruthy();
    });

    it("clears limitationMessage when status returns to ok", () => {
      const degraded = updateConnectorHealthState(initialStates, "github", "degraded");
      const ok = updateConnectorHealthState(degraded, "github", "ok");
      const github = ok.find((s) => s.toolkitId === "github");
      expect(github?.limitationMessage).toBeUndefined();
    });

    it("accepts empty array as initial state", () => {
      const updated = updateConnectorHealthState([], "github", "ok");
      expect(updated).toHaveLength(0);
    });
  });

  describe("hasImpairedConnectors", () => {
    it("returns false when all connectors are ok", () => {
      const states = createInitialConnectorHealthState().map((s) => ({
        ...s,
        status: "ok" as const,
      }));
      expect(hasImpairedConnectors(states)).toBe(false);
    });

    it("returns true when any connector is degraded", () => {
      const states = createInitialConnectorHealthState().map((s) => ({
        ...s,
        status: s.toolkitId === "github" ? "degraded" : "ok",
      }));
      expect(hasImpairedConnectors(states)).toBe(true);
    });

    it("returns true when any connector is in error", () => {
      const states = createInitialConnectorHealthState().map((s) => ({
        ...s,
        status: s.toolkitId === "github" ? "error" : "ok",
      }));
      expect(hasImpairedConnectors(states)).toBe(true);
    });

    it("returns false when all are unknown", () => {
      const states = createInitialConnectorHealthState();
      expect(hasImpairedConnectors(states)).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(hasImpairedConnectors([])).toBe(false);
    });
  });

  describe("getImpairedConnectors", () => {
    it("returns only degraded and error connectors", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString(), error: "fail" },
        { toolkitId: "slack", status: "degraded", lastChecked: new Date().toISOString() },
        { toolkitId: "googledocs", status: "ok", lastChecked: new Date().toISOString() },
      ];
      const impaired = getImpairedConnectors(states);
      expect(impaired).toHaveLength(2);
      expect(impaired.map((s) => s.toolkitId)).toContain("github");
      expect(impaired.map((s) => s.toolkitId)).toContain("slack");
    });

    it("returns empty array when no impaired connectors", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "ok", lastChecked: new Date().toISOString() },
      ];
      expect(getImpairedConnectors(states)).toHaveLength(0);
    });
  });

  describe("computeDepartmentHealthStatus", () => {
    it("returns ok when all connectors are ok", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "ok", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "ok", lastChecked: new Date().toISOString() },
      ];
      expect(computeDepartmentHealthStatus(states)).toBe("ok");
    });

    it("returns error when any connector is in error", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "ok", lastChecked: new Date().toISOString() },
      ];
      expect(computeDepartmentHealthStatus(states)).toBe("error");
    });

    it("returns degraded when connectors are degraded but none in error", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "degraded", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "ok", lastChecked: new Date().toISOString() },
      ];
      expect(computeDepartmentHealthStatus(states)).toBe("degraded");
    });

    it("returns unknown when all connectors are unknown (XAF-007: do not blind-report ok)", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "unknown", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "unknown", lastChecked: new Date().toISOString() },
      ];
      expect(computeDepartmentHealthStatus(states)).toBe("unknown");
    });

    it("returns degraded when some are unknown and some are ok (partially checked)", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "ok", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "unknown", lastChecked: new Date().toISOString() },
      ];
      expect(computeDepartmentHealthStatus(states)).toBe("degraded");
    });

    it("returns ok for empty array", () => {
      expect(computeDepartmentHealthStatus([])).toBe("ok");
    });
  });

  describe("generateToolkitLimitations", () => {
    it("returns empty array when all connectors are ok", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "ok", lastChecked: new Date().toISOString() },
      ];
      expect(generateToolkitLimitations(states)).toHaveLength(0);
    });

    it("returns limitations for degraded connector with correct severity", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "degraded", lastChecked: new Date().toISOString() },
      ];
      const limitations = generateToolkitLimitations(states);
      expect(limitations).toHaveLength(1);
      expect(limitations[0].severity).toBe("medium");
      expect(limitations[0].toolkitId).toBe("github");
    });

    it("returns limitations for error connector with critical severity", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
      ];
      const limitations = generateToolkitLimitations(states);
      expect(limitations).toHaveLength(1);
      expect(limitations[0].severity).toBe("critical");
    });

    it("returns affected workflows for each connector type", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
      ];
      const limitations = generateToolkitLimitations(states);
      expect(limitations[0].affectedWorkflows).toContain("Code reviews");
      expect(limitations[0].affectedWorkflows).toContain("CI/CD pipelines");
    });

    it("includes suggested action", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
      ];
      const limitations = generateToolkitLimitations(states);
      expect(limitations[0].suggestedAction).toContain("Reconnect");
    });

    it("returns limitations for multiple impaired connectors", () => {
      const states: ConnectorHealthState[] = [
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "degraded", lastChecked: new Date().toISOString() },
        { toolkitId: "googledocs", status: "ok", lastChecked: new Date().toISOString() },
      ];
      const limitations = generateToolkitLimitations(states);
      expect(limitations).toHaveLength(2);
    });
  });

  describe("formatLimitationMessage", () => {
    it("formats a limitation with severity and display name", () => {
      const limitations = generateToolkitLimitations([
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
      ]);
      const msg = formatLimitationMessage(limitations[0]);
      expect(msg).toContain("CRITICAL");
      expect(msg).toContain("GitHub");
      expect(msg).toContain("unavailable");
    });
  });

  describe("formatAllLimitations", () => {
    it("returns no limitations message when array is empty", () => {
      const msg = formatAllLimitations([]);
      expect(msg).toContain("No connector limitations detected");
    });

    it("returns a formatted table when limitations exist", () => {
      const limitations = generateToolkitLimitations([
        { toolkitId: "github", status: "error", lastChecked: new Date().toISOString() },
        { toolkitId: "slack", status: "degraded", lastChecked: new Date().toISOString() },
      ]);
      const msg = formatAllLimitations(limitations);
      expect(msg).toContain("CONNECTOR LIMITATIONS DETECTED");
      expect(msg).toContain("GitHub");
      expect(msg).toContain("Slack");
    });
  });
});
