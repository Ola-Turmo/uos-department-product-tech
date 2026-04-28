import { describe, expect, it, beforeEach } from "vitest";
import { LaunchReadinessService } from "../src/launch-readiness-service.js";
import type {
  LaunchReadinessState,
  CreateReadinessPacketParams,
  SubmitReadinessPacketParams,
  ReadinessEvidence,
  ReadinessRisk,
  ReadinessMitigation,
} from "../src/types.js";

function makeEvidence(overrides: Partial<ReadinessEvidence> = {}): Omit<ReadinessEvidence, "id"> {
  return {
    type: "technical",
    title: "Test evidence",
    description: "Test description",
    source: "Test source",
    confidence: "high",
    tags: [],
    collectedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function makeRisk(overrides: Partial<ReadinessRisk> = {}): Omit<ReadinessRisk, "id"> {
  return {
    title: "Test risk",
    description: "Test risk description",
    severity: "medium",
    likelihood: "possible",
    impact: "significant",
    mitigationStatus: "pending",
    ...overrides,
  };
}

function makeMitigation(riskId: string, overrides: Partial<ReadinessMitigation> = {}): Omit<ReadinessMitigation, "id" | "riskId"> {
  return {
    title: "Test mitigation",
    description: "Test mitigation description",
    status: "planned",
    ...overrides,
  };
}

describe("LaunchReadinessService", () => {
  let service: LaunchReadinessService;

  beforeEach(() => {
    service = new LaunchReadinessService();
  });

  describe("createPacket", () => {
    it("creates a packet with draft status and zero score", () => {
      const params: CreateReadinessPacketParams = {
        initiativeId: "init-1",
        initiativeName: "Test Launch",
        ownerRoleKey: "product-management-lead",
      };
      const packet = service.createPacket(params);

      expect(packet.id).toBeTruthy();
      expect(packet.initiativeId).toBe("init-1");
      expect(packet.initiativeName).toBe("Test Launch");
      expect(packet.status).toBe("draft");
      expect(packet.decision).toBe("deferred");
      expect(packet.readinessScore).toBe(0);
      expect(packet.evidence).toHaveLength(0);
      expect(packet.risks).toHaveLength(0);
      expect(packet.decisionRationale).toBe("");
    });

    it("persists the packet in state", () => {
      const params: CreateReadinessPacketParams = {
        initiativeId: "init-2",
        initiativeName: "Another Launch",
        ownerRoleKey: "technology-platform-lead",
      };
      const packet = service.createPacket(params);
      const retrieved = service.getPacket(packet.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.initiativeName).toBe("Another Launch");
    });

    it("multiple packets are independent", () => {
      const p1 = service.createPacket({ initiativeId: "init-a", initiativeName: "A", ownerRoleKey: "pm-lead" });
      const p2 = service.createPacket({ initiativeId: "init-b", initiativeName: "B", ownerRoleKey: "tech-lead" });
      expect(service.getPacketsByInitiative("init-a")).toHaveLength(1);
      expect(service.getPacketsByInitiative("init-b")).toHaveLength(1);
    });
  });

  describe("getPacketsByInitiative", () => {
    it("returns all packets for an initiative", () => {
      service.createPacket({ initiativeId: "init-multi", initiativeName: "First", ownerRoleKey: "pm-lead" });
      service.createPacket({ initiativeId: "init-multi", initiativeName: "Second", ownerRoleKey: "pm-lead" });
      const packets = service.getPacketsByInitiative("init-multi");
      expect(packets).toHaveLength(2);
    });

    it("returns empty array for unknown initiative", () => {
      expect(service.getPacketsByInitiative("nonexistent")).toHaveLength(0);
    });
  });

  describe("getActivePackets", () => {
    it("excludes superseded packets", () => {
      service.createPacket({ initiativeId: "init-1", initiativeName: "Active", ownerRoleKey: "pm-lead" });
      const superseded = service.createPacket({ initiativeId: "init-2", initiativeName: "Superseded", ownerRoleKey: "pm-lead" });
      service.submitPacket({
        packetId: superseded.id,
        decision: "go",
        decisionRationale: "superseded by another packet",
        decisionByRoleKey: "pm-lead",
      });
      // Mark as superseded manually via update
      service.getPacket(superseded.id)!.status = "superseded";

      const active = service.getActivePackets();
      expect(active.map((p) => p.initiativeName)).not.toContain("Superseded");
    });
  });

  describe("addEvidence", () => {
    it("adds evidence and recalculates score", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      expect(service.getPacket(packet.id)!.readinessScore).toBe(0);

      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      const updated = service.getPacket(packet.id)!;
      expect(updated.evidence).toHaveLength(1);
      expect(updated.readinessScore).toBeGreaterThan(0);
    });

    it("returns undefined for unknown packetId", () => {
      const result = service.addEvidence("nonexistent", makeEvidence());
      expect(result).toBeUndefined();
    });

    it("evidence gets an auto-generated id", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const evidence = service.addEvidence(packet.id, makeEvidence());
      expect(evidence?.id).toBeTruthy();
    });
  });

  describe("addRisk", () => {
    it("adds risk and recalculates score", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });

      service.addRisk(packet.id, makeRisk({ severity: "high", mitigationStatus: "pending" }));
      const updated = service.getPacket(packet.id)!;
      expect(updated.risks).toHaveLength(1);
      // High unresolved risk should reduce score
      expect(updated.readinessScore).toBeLessThan(100);
    });

    it("returns undefined for unknown packetId", () => {
      const result = service.addRisk("nonexistent", makeRisk());
      expect(result).toBeUndefined();
    });

    it("risk gets an auto-generated id", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const risk = service.addRisk(packet.id, makeRisk());
      expect(risk?.id).toBeTruthy();
    });
  });

  describe("addMitigation", () => {
    it("adds mitigation linked to a risk", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const risk = service.addRisk(packet.id, makeRisk({ severity: "critical" }));
      expect(risk).toBeDefined();

      const mitigation = service.addMitigation(packet.id, risk!.id, makeMitigation(risk!.id, { status: "completed" }));
      expect(mitigation).toBeDefined();
      expect(mitigation?.riskId).toBe(risk!.id);

      const updated = service.getPacket(packet.id)!;
      expect(updated.mitigations).toHaveLength(1);
      // Completed mitigation should not reduce score
      expect(updated.readinessScore).toBeGreaterThanOrEqual(0);
    });

    it("returns undefined when risk does not exist", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const result = service.addMitigation(packet.id, "nonexistent-risk", makeMitigation("nonexistent-risk"));
      expect(result).toBeUndefined();
    });
  });

  describe("score calculation", () => {
    it("score is 0 with no evidence", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      expect(service.getPacket(packet.id)!.readinessScore).toBe(0);
    });

    it("high confidence evidence scores 100%", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      expect(service.getPacket(packet.id)!.readinessScore).toBe(100);
    });

    it("medium confidence evidence scores 60%", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "medium" }));
      expect(service.getPacket(packet.id)!.readinessScore).toBe(60);
    });

    it("low confidence evidence scores 30%", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "low" }));
      expect(service.getPacket(packet.id)!.readinessScore).toBe(30);
    });

    it("multiple evidence items average correctly", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      service.addEvidence(packet.id, makeEvidence({ confidence: "low" }));
      // Average = (1.0 + 0.3) / 2 = 0.65 → 65
      expect(service.getPacket(packet.id)!.readinessScore).toBe(65);
    });

    it("unresolved critical risk reduces score by 10", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      // 100 - 10 = 90
      expect(service.getPacket(packet.id)!.readinessScore).toBe(90);
    });

    it("unresolved high risk reduces score by 10", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      service.addRisk(packet.id, makeRisk({ severity: "high", mitigationStatus: "pending" }));
      // 100 - 10 = 90
      expect(service.getPacket(packet.id)!.readinessScore).toBe(90);
    });

    it("completed mitigation does not reduce score — but unresolved risk penalty still applies", () => {
      // The scoring formula only looks at risk.mitigationStatus, not mitigation.status.
      // Adding a completed mitigation does not change the risk's mitigationStatus.
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      const risk = service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addMitigation(packet.id, risk!.id, makeMitigation(risk!.id, { status: "completed" }));
      // Score: 100 (high evidence) - 10 (unresolved critical risk, mitigationStatus is still "pending") = 90
      expect(service.getPacket(packet.id)!.readinessScore).toBe(90);
    });

    it("incomplete mitigation reduces score by 5 each on top of risk penalty", () => {
      // The incomplete mitigation penalty is additional to the unresolved risk penalty.
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      const risk = service.addRisk(packet.id, makeRisk({ severity: "high", mitigationStatus: "pending" }));
      service.addMitigation(packet.id, risk!.id, makeMitigation(risk!.id, { status: "in-progress" }));
      // Score: 100 (high evidence) - 10 (unresolved high risk) - 5 (incomplete mitigation) = 85
      expect(service.getPacket(packet.id)!.readinessScore).toBe(85);
    });

    it("score is clamped to 0 minimum", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "low" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      // Could go negative, should be clamped to 0
      expect(service.getPacket(packet.id)!.readinessScore).toBeGreaterThanOrEqual(0);
      expect(service.getPacket(packet.id)!.readinessScore).toBeLessThanOrEqual(100);
    });
  });

  describe("submitPacket", () => {
    it("sets status to approved for go decision", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.submitPacket({
        packetId: packet.id,
        decision: "go",
        decisionRationale: "All checks passed",
        decisionByRoleKey: "pm-lead",
      });
      const updated = service.getPacket(packet.id)!;
      expect(updated.status).toBe("approved");
      expect(updated.decision).toBe("go");
      expect(updated.decidedAt).toBeTruthy();
    });

    it("sets status to rejected for no-go decision", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.submitPacket({
        packetId: packet.id,
        decision: "no-go",
        decisionRationale: "Critical risks unresolved",
        decisionByRoleKey: "pm-lead",
      });
      const updated = service.getPacket(packet.id)!;
      expect(updated.status).toBe("rejected");
      expect(updated.decision).toBe("no-go");
    });

    it("generates follow-up items for unresolved critical risks on no-go", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addRisk(packet.id, makeRisk({ title: "Security hole", severity: "critical", mitigationStatus: "pending" }));
      service.submitPacket({
        packetId: packet.id,
        decision: "no-go",
        decisionRationale: "Critical risk",
        decisionByRoleKey: "pm-lead",
      });
      const updated = service.getPacket(packet.id)!;
      expect(updated.followUpItems.some((f) => f.title.includes("Security hole"))).toBe(true);
    });

    it("does not duplicate follow-up items for the same risk", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addRisk(packet.id, makeRisk({ title: "Security hole", severity: "critical", mitigationStatus: "pending" }));
      service.submitPacket({
        packetId: packet.id,
        decision: "no-go",
        decisionRationale: "First submit",
        decisionByRoleKey: "pm-lead",
      });
      // Submit again - follow-up should not duplicate
      service.submitPacket({
        packetId: packet.id,
        decision: "no-go",
        decisionRationale: "Second submit",
        decisionByRoleKey: "pm-lead",
      });
      const updated = service.getPacket(packet.id)!;
      const securityItems = updated.followUpItems.filter((f) => f.title.includes("Security hole"));
      expect(securityItems).toHaveLength(1);
    });
  });

  describe("generatePacketReport", () => {
    it("returns summary statistics for a packet", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ type: "technical", confidence: "high" }));
      service.addEvidence(packet.id, makeEvidence({ type: "operational", confidence: "medium" }));
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      service.addRisk(packet.id, makeRisk({ severity: "low", mitigationStatus: "pending" }));

      const report = service.generatePacketReport(packet.id);
      expect(report).toBeDefined();
      expect(report!.summary.totalEvidence).toBe(2);
      expect(report!.summary.totalRisks).toBe(2);
      expect(report!.summary.unresolvedCriticalRisks).toBe(1);
      expect(report!.summary.risksBySeverity.critical).toBe(1);
      expect(report!.summary.risksBySeverity.low).toBe(1);
    });

    it("recommends no-go when unresolved critical risks exist", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addRisk(packet.id, makeRisk({ severity: "critical", mitigationStatus: "pending" }));
      const report = service.generatePacketReport(packet.id);
      expect(report!.recommendation).toContain("no-go");
    });

    it("recommends deferred when score < 50", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "low" }));
      // low confidence = 30, no risks = 30
      const report = service.generatePacketReport(packet.id);
      expect(report!.recommendation).toContain("deferred");
    });

    it("recommends go when score >= 75 and no unresolved criticals", () => {
      const packet = service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      service.addEvidence(packet.id, makeEvidence({ confidence: "high" }));
      const report = service.generatePacketReport(packet.id);
      expect(report!.recommendation).toContain("go");
    });

    it("returns undefined for unknown packetId", () => {
      const report = service.generatePacketReport("nonexistent");
      expect(report).toBeUndefined();
    });
  });

  describe("state persistence", () => {
    it("getState returns current state", () => {
      service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const state = service.getState();
      expect(Object.keys(state.packets).length).toBe(1);
    });

    it("loadState restores state", () => {
      service.createPacket({ initiativeId: "init-1", initiativeName: "Test", ownerRoleKey: "pm-lead" });
      const state = service.getState();

      const newService = new LaunchReadinessService();
      newService.loadState(state);
      expect(Object.keys(newService.getState().packets).length).toBe(1);
    });
  });
});
