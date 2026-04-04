/**
 * Launch Readiness Service
 * VAL-DEPT-PRODUCT-TECH-001: Launch readiness packet closes the loop from idea to go or no-go
 * 
 * Combines research inputs, technical and operational evidence, reliability risks,
 * mitigations, and explicit go/no-go framing on top of shared platform services.
 */

import type {
  LaunchReadinessPacket,
  ReadinessEvidence,
  ReadinessRisk,
  ReadinessMitigation,
  ReadinessDecision,
  FollowUpItem,
  CreateReadinessPacketParams,
  UpdateReadinessPacketParams,
  SubmitReadinessPacketParams,
  LaunchReadinessState,
} from "./types.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function calculateReadinessScore(
  evidence: ReadinessEvidence[],
  risks: ReadinessRisk[],
  mitigations: ReadinessMitigation[]
): number {
  if (evidence.length === 0) return 0;

  // Weight evidence by confidence
  const evidenceScore = evidence.reduce((sum, e) => {
    const weights = { high: 1.0, medium: 0.6, low: 0.3 };
    return sum + weights[e.confidence];
  }, 0) / evidence.length;

  // Reduce score for unresolved critical/high risks
  const unresolvedCriticalRisks = risks.filter(
    (r) => (r.severity === "critical" || r.severity === "high") && r.mitigationStatus !== "completed"
  ).length;

  // Reduce score for incomplete critical mitigations
  const incompleteMitigations = mitigations.filter(
    (m) => m.status !== "completed" && m.status !== "failed"
  ).length;

  // Calculate final score (0-100)
  let score = evidenceScore * 100;
  score -= unresolvedCriticalRisks * 10;
  score -= incompleteMitigations * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export class LaunchReadinessService {
  private state: LaunchReadinessState;

  constructor(initialState?: LaunchReadinessState) {
    this.state = initialState ?? {
      packets: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Create a new launch readiness packet
   */
  createPacket(params: CreateReadinessPacketParams): LaunchReadinessPacket {
    const now = new Date().toISOString();
    const packet: LaunchReadinessPacket = {
      id: generateId(),
      initiativeId: params.initiativeId,
      initiativeName: params.initiativeName,
      ownerRoleKey: params.ownerRoleKey,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      evidence: [],
      risks: [],
      mitigations: [],
      decision: "deferred",
      decisionRationale: "",
      followUpItems: [],
      readinessScore: 0,
      evidenceLinks: [],
    };

    this.state.packets[packet.id] = packet;
    this.state.lastUpdated = now;
    return packet;
  }

  /**
   * Get a readiness packet by ID
   */
  getPacket(packetId: string): LaunchReadinessPacket | undefined {
    return this.state.packets[packetId];
  }

  /**
   * Get all packets for an initiative
   */
  getPacketsByInitiative(initiativeId: string): LaunchReadinessPacket[] {
    return Object.values(this.state.packets).filter(
      (p) => p.initiativeId === initiativeId
    );
  }

  /**
   * Get all active (non-superseded) packets
   */
  getActivePackets(): LaunchReadinessPacket[] {
    return Object.values(this.state.packets).filter(
      (p) => p.status !== "superseded"
    );
  }

  /**
   * Update a readiness packet with new evidence, risks, or mitigations
   */
  updatePacket(params: UpdateReadinessPacketParams): LaunchReadinessPacket | undefined {
    const packet = this.state.packets[params.packetId];
    if (!packet) return undefined;

    if (params.evidence) {
      packet.evidence = [...packet.evidence, ...params.evidence];
    }

    if (params.risks) {
      // Merge risks, avoiding duplicates by ID
      const existingRiskIds = new Set(packet.risks.map((r) => r.id));
      const newRisks = params.risks.filter((r) => !existingRiskIds.has(r.id));
      packet.risks = [...packet.risks, ...newRisks];
    }

    if (params.mitigations) {
      // Merge mitigations, avoiding duplicates by ID
      const existingMitigationIds = new Set(packet.mitigations.map((m) => m.id));
      const newMitigations = params.mitigations.filter(
        (m) => !existingMitigationIds.has(m.id)
      );
      packet.mitigations = [...packet.mitigations, ...newMitigations];
    }

    if (params.decision) {
      packet.decision = params.decision;
    }

    if (params.decisionRationale !== undefined) {
      packet.decisionRationale = params.decisionRationale;
    }

    if (params.decisionByRoleKey) {
      packet.decisionByRoleKey = params.decisionByRoleKey;
    }

    // Recalculate readiness score
    packet.readinessScore = calculateReadinessScore(
      packet.evidence,
      packet.risks,
      packet.mitigations
    );

    packet.updatedAt = new Date().toISOString();
    this.state.lastUpdated = packet.updatedAt;

    return packet;
  }

  /**
   * Add evidence to a packet
   */
  addEvidence(packetId: string, evidence: Omit<ReadinessEvidence, "id">): ReadinessEvidence | undefined {
    const packet = this.state.packets[packetId];
    if (!packet) return undefined;

    const newEvidence: ReadinessEvidence = {
      ...evidence,
      id: generateId(),
    };

    packet.evidence.push(newEvidence);
    packet.updatedAt = new Date().toISOString();

    // Recalculate readiness score
    packet.readinessScore = calculateReadinessScore(
      packet.evidence,
      packet.risks,
      packet.mitigations
    );

    this.state.lastUpdated = packet.updatedAt;
    return newEvidence;
  }

  /**
   * Add a risk to a packet
   */
  addRisk(packetId: string, risk: Omit<ReadinessRisk, "id">): ReadinessRisk | undefined {
    const packet = this.state.packets[packetId];
    if (!packet) return undefined;

    const newRisk: ReadinessRisk = {
      ...risk,
      id: generateId(),
    };

    packet.risks.push(newRisk);
    packet.updatedAt = new Date().toISOString();

    // Recalculate readiness score
    packet.readinessScore = calculateReadinessScore(
      packet.evidence,
      packet.risks,
      packet.mitigations
    );

    this.state.lastUpdated = packet.updatedAt;
    return newRisk;
  }

  /**
   * Add a mitigation to a packet
   */
  addMitigation(
    packetId: string,
    riskId: string,
    mitigation: Omit<ReadinessMitigation, "id" | "riskId">
  ): ReadinessMitigation | undefined {
    const packet = this.state.packets[packetId];
    if (!packet) return undefined;

    // Verify risk exists
    const risk = packet.risks.find((r) => r.id === riskId);
    if (!risk) return undefined;

    const newMitigation: ReadinessMitigation = {
      ...mitigation,
      id: generateId(),
      riskId,
    };

    packet.mitigations.push(newMitigation);
    packet.updatedAt = new Date().toISOString();

    // Recalculate readiness score
    packet.readinessScore = calculateReadinessScore(
      packet.evidence,
      packet.risks,
      packet.mitigations
    );

    this.state.lastUpdated = packet.updatedAt;
    return newMitigation;
  }

  /**
   * Add a follow-up item for unresolved risks or evidence gaps
   */
  addFollowUpItem(
    packetId: string,
    item: Omit<FollowUpItem, "id">
  ): FollowUpItem | undefined {
    const packet = this.state.packets[packetId];
    if (!packet) return undefined;

    const newItem: FollowUpItem = {
      ...item,
      id: generateId(),
    };

    packet.followUpItems.push(newItem);
    packet.updatedAt = new Date().toISOString();
    this.state.lastUpdated = packet.updatedAt;

    return newItem;
  }

  /**
   * Submit a readiness packet with decision
   */
  submitPacket(params: SubmitReadinessPacketParams): LaunchReadinessPacket | undefined {
    const packet = this.state.packets[params.packetId];
    if (!packet) return undefined;

    // Generate follow-up items for unresolved risks
    const unresolvedRisks = packet.risks.filter(
      (r) => r.severity === "critical" && r.mitigationStatus !== "completed"
    );

    for (const risk of unresolvedRisks) {
      const existingFollowUp = packet.followUpItems.find(
        (f) => f.relatedRiskId === risk.id
      );

      if (!existingFollowUp) {
        packet.followUpItems.push({
          id: generateId(),
          title: `Resolve: ${risk.title}`,
          description: risk.description,
          relatedRiskId: risk.id,
          status: "open",
          priority: risk.severity as FollowUpItem["priority"],
          ownerRoleKey: risk.ownerRoleKey,
        });
      }
    }

    packet.decision = params.decision;
    packet.decisionRationale = params.decisionRationale;
    packet.decisionByRoleKey = params.decisionByRoleKey;
    packet.decidedAt = new Date().toISOString();

    // Update status based on decision
    switch (params.decision) {
      case "go":
      case "conditional-go":
        packet.status = "approved";
        break;
      case "no-go":
        packet.status = "rejected";
        break;
      case "deferred":
        packet.status = "draft";
        break;
    }

    packet.updatedAt = new Date().toISOString();
    this.state.lastUpdated = packet.updatedAt;

    return packet;
  }

  /**
   * Generate a readiness packet report with all linked evidence
   */
  generatePacketReport(packetId: string): {
    packet: LaunchReadinessPacket;
    summary: {
      totalEvidence: number;
      evidenceByType: Record<string, number>;
      totalRisks: number;
      risksBySeverity: Record<string, number>;
      unresolvedCriticalRisks: number;
      totalMitigations: number;
      completedMitigations: number;
      openFollowUpItems: number;
      readinessScore: number;
    };
    recommendation: string;
  } | undefined {
    const packet = this.state.packets[packetId];
    if (!packet) return undefined;

    const evidenceByType: Record<string, number> = {};
    for (const e of packet.evidence) {
      evidenceByType[e.type] = (evidenceByType[e.type] ?? 0) + 1;
    }

    const risksBySeverity: Record<string, number> = {};
    for (const r of packet.risks) {
      risksBySeverity[r.severity] = (risksBySeverity[r.severity] ?? 0) + 1;
    }

    const unresolvedCriticalRisks = packet.risks.filter(
      (r) => r.severity === "critical" && r.mitigationStatus !== "completed"
    ).length;

    const completedMitigations = packet.mitigations.filter(
      (m) => m.status === "completed"
    ).length;

    const openFollowUpItems = packet.followUpItems.filter(
      (f) => f.status === "open" || f.status === "in-progress"
    ).length;

    // Generate recommendation
    let recommendation: string;
    if (unresolvedCriticalRisks > 0) {
      recommendation = "no-go: Unresolved critical risks must be addressed before proceeding.";
    } else if (packet.readinessScore < 50) {
      recommendation = "deferred: Additional evidence and risk mitigation required.";
    } else if (packet.readinessScore < 75) {
      recommendation = "conditional-go: Address remaining follow-up items before launch.";
    } else {
      recommendation = "go: Initiative is ready for launch.";
    }

    return {
      packet,
      summary: {
        totalEvidence: packet.evidence.length,
        evidenceByType,
        totalRisks: packet.risks.length,
        risksBySeverity,
        unresolvedCriticalRisks,
        totalMitigations: packet.mitigations.length,
        completedMitigations,
        openFollowUpItems,
        readinessScore: packet.readinessScore,
      },
      recommendation,
    };
  }

  /**
   * Get current state for persistence
   */
  getState(): LaunchReadinessState {
    return this.state;
  }

  /**
   * Load state from persistence
   */
  loadState(state: LaunchReadinessState): void {
    this.state = state;
  }
}
