/**
 * Incident Learning Service
 * VAL-DEPT-PRODUCT-TECH-002: Incident learning converts into tracked roadmap, enablement, or reliability action
 * 
 * Ingest incident learnings, link them to affected initiatives, and translate them
 * into persistent roadmap, enablement, or reliability actions on top of shared platform services.
 */

import type {
  IncidentLearning,
  IncidentLearningReport,
  PersistentAction,
  ActionKind,
  IncidentSeverity,
  IncidentStatus,
  IngestIncidentLearningParams,
  CreatePersistentActionParams,
  LinkActionToInitiativeParams,
  UpdateActionStatusParams,
  IncidentLearningState,
} from "./types.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export class IncidentLearningService {
  private state: IncidentLearningState;

  constructor(initialState?: IncidentLearningState) {
    this.state = initialState ?? {
      learnings: {},
      actions: {},
      reports: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Ingest an incident learning and generate suggested actions
   */
  ingestLearning(params: IngestIncidentLearningParams): IncidentLearningReport {
    const now = new Date().toISOString();

    const learning: IncidentLearning = {
      id: generateId(),
      incidentId: params.incidentId,
      incidentTitle: params.incidentTitle,
      incidentSeverity: params.incidentSeverity,
      incidentStatus: params.incidentStatus,
      occurredAt: params.occurredAt,
      resolvedAt: params.resolvedAt,
      rootCause: params.rootCause,
      lessonsLearned: params.lessonsLearned,
      whatWentWell: params.whatWentWell,
      whatCouldImprove: params.whatCouldImprove,
      affectedInitiatives: params.affectedInitiatives,
      affectedSystems: params.affectedSystems,
      userImpact: params.userImpact,
      capturedByRoleKey: params.capturedByRoleKey,
      capturedAt: now,
    };

    this.state.learnings[learning.id] = learning;

    // Generate suggested actions based on the learning
    const suggestedActions = this.generateSuggestedActions(learning);

    // Create the actions in the system
    const createdActions: PersistentAction[] = [];
    for (const actionParams of suggestedActions) {
      const action = this.createAction({
        ...actionParams,
        learningId: learning.id,
      });
      if (action) {
        createdActions.push(action);
      }
    }

    // Generate the report
    const report: IncidentLearningReport = {
      id: generateId(),
      incidentId: params.incidentId,
      learning,
      actions: createdActions,
      totalActionsProposed: createdActions.length,
      totalActionsApproved: 0, // Will be updated as actions are approved
      totalActionsCompleted: 0, // Will be updated as actions are completed
      generatedAt: now,
      generatedByRoleKey: params.capturedByRoleKey,
    };

    this.state.reports[report.id] = report;
    this.state.lastUpdated = now;

    // Update action counts in the report
    this.updateReportActionCounts(report.id);

    return report;
  }

  /**
   * Generate suggested actions based on incident learning
   */
  private generateSuggestedActions(
    learning: IncidentLearning
  ): Array<Omit<CreatePersistentActionParams, "learningId">> {
    const actions: Array<Omit<CreatePersistentActionParams, "learningId">> = [];

    // Determine priority based on incident severity
    const priorityMap: Record<IncidentSeverity, PersistentAction["priority"]> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };
    const priority = priorityMap[learning.incidentSeverity];

    // Action 1: Address root cause - always create a reliability action
    actions.push({
      title: `Address root cause: ${learning.rootCause.substring(0, 100)}`,
      description: `Implement fix for the root cause identified in incident ${learning.incidentId}: ${learning.rootCause}`,
      kind: "reliability",
      priority,
      linkedInitiatives: learning.affectedInitiatives,
    });

    // Action 2: Create enablement/playbook if there are lessons learned
    if (learning.lessonsLearned.length > 0) {
      actions.push({
        title: `Create playbook from incident ${learning.incidentId}`,
        description: `Document lessons learned and create a playbook to prevent recurrence:\n${learning.lessonsLearned.map((l) => `- ${l}`).join("\n")}`,
        kind: "enablement",
        priority,
        linkedInitiatives: learning.affectedInitiatives,
      });
    }

    // Action 3: Update documentation if systems were affected
    if (learning.affectedSystems.length > 0) {
      actions.push({
        title: `Update runbooks for affected systems`,
        description: `Review and update runbooks for affected systems: ${learning.affectedSystems.join(", ")}`,
        kind: "documentation",
        priority: learning.incidentSeverity === "critical" || learning.incidentSeverity === "high" ? "high" : "medium",
        linkedInitiatives: learning.affectedInitiatives,
      });
    }

    // Action 4: Process improvement if what could improve has items
    if (learning.whatCouldImprove.length > 0) {
      actions.push({
        title: `Process improvement: ${learning.incidentTitle}`,
        description: `Implement improvements based on what could be better:\n${learning.whatCouldImprove.map((w) => `- ${w}`).join("\n")}`,
        kind: "process",
        priority: "medium",
        linkedInitiatives: learning.affectedInitiatives,
      });
    }

    // Action 5: Roadmap item if critical/high severity
    if (learning.incidentSeverity === "critical" || learning.incidentSeverity === "high") {
      actions.push({
        title: `Roadmap item: Address ${learning.incidentTitle}`,
        description: `Add to roadmap to prevent recurrence of ${learning.incidentSeverity} incident affecting: ${learning.affectedSystems.join(", ")}`,
        kind: "roadmap",
        priority,
        linkedInitiatives: learning.affectedInitiatives,
      });
    }

    return actions;
  }

  /**
   * Create a persistent action
   */
  createAction(params: CreatePersistentActionParams): PersistentAction | undefined {
    // Verify learning exists
    const learning = this.state.learnings[params.learningId];
    if (!learning) return undefined;

    const now = new Date().toISOString();

    const action: PersistentAction = {
      id: generateId(),
      title: params.title,
      description: params.description,
      kind: params.kind,
      priority: params.priority,
      sourceIncidentId: learning.incidentId,
      sourceLearningId: params.learningId,
      linkedInitiatives: params.linkedInitiatives,
      status: "proposed",
      ownerRoleKey: params.ownerRoleKey,
      createdAt: now,
      updatedAt: now,
      dueDate: params.dueDate,
      evidenceIds: [],
      notes: [],
    };

    this.state.actions[action.id] = action;
    this.state.lastUpdated = now;

    // Update any reports that include this learning
    this.updateReportsForAction(action.id);

    return action;
  }

  /**
   * Get an action by ID
   */
  getAction(actionId: string): PersistentAction | undefined {
    return this.state.actions[actionId];
  }

  /**
   * Get all actions for an initiative
   */
  getActionsByInitiative(initiativeId: string): PersistentAction[] {
    return Object.values(this.state.actions).filter((a) =>
      a.linkedInitiatives.includes(initiativeId)
    );
  }

  /**
   * Get all actions from a specific incident
   */
  getActionsByIncident(incidentId: string): PersistentAction[] {
    return Object.values(this.state.actions).filter(
      (a) => a.sourceIncidentId === incidentId
    );
  }

  /**
   * Get all actions by kind
   */
  getActionsByKind(kind: ActionKind): PersistentAction[] {
    return Object.values(this.state.actions).filter((a) => a.kind === kind);
  }

  /**
   * Get all actions by status
   */
  getActionsByStatus(status: PersistentAction["status"]): PersistentAction[] {
    return Object.values(this.state.actions).filter((a) => a.status === status);
  }

  /**
   * Get open (non-completed, non-deferred, non-rejected) actions
   */
  getOpenActions(): PersistentAction[] {
    return Object.values(this.state.actions).filter(
      (a) => !["completed", "deferred", "rejected"].includes(a.status)
    );
  }

  /**
   * Link an action to an additional initiative
   */
  linkActionToInitiative(params: LinkActionToInitiativeParams): PersistentAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    if (!action.linkedInitiatives.includes(params.initiativeId)) {
      action.linkedInitiatives.push(params.initiativeId);
      action.updatedAt = new Date().toISOString();
      this.state.lastUpdated = action.updatedAt;
    }

    return action;
  }

  /**
   * Unlink an action from an initiative
   */
  unlinkActionFromInitiative(params: LinkActionToInitiativeParams): PersistentAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    action.linkedInitiatives = action.linkedInitiatives.filter(
      (id) => id !== params.initiativeId
    );
    action.updatedAt = new Date().toISOString();
    this.state.lastUpdated = action.updatedAt;

    return action;
  }

  /**
   * Update action status
   */
  updateActionStatus(params: UpdateActionStatusParams): PersistentAction | undefined {
    const action = this.state.actions[params.actionId];
    if (!action) return undefined;

    action.status = params.status;
    action.updatedAt = new Date().toISOString();

    if (params.notes && params.notes.length > 0) {
      action.notes.push(...params.notes);
    }

    if (params.status === "completed") {
      action.completedAt = new Date().toISOString();
    }

    this.state.lastUpdated = action.updatedAt;

    // Update any reports that include this action
    this.updateReportActionCountsForAction(params.actionId);

    return action;
  }

  /**
   * Approve an action
   */
  approveAction(actionId: string, approverRoleKey: string): PersistentAction | undefined {
    const action = this.state.actions[actionId];
    if (!action) return undefined;

    action.status = "approved";
    action.ownerRoleKey = approverRoleKey;
    action.updatedAt = new Date().toISOString();
    this.state.lastUpdated = action.updatedAt;

    this.updateReportActionCountsForAction(actionId);

    return action;
  }

  /**
   * Start working on an action
   */
  startAction(actionId: string): PersistentAction | undefined {
    return this.updateActionStatus({
      actionId,
      status: "in-progress",
    });
  }

  /**
   * Complete an action
   */
  completeAction(actionId: string, notes?: string[]): PersistentAction | undefined {
    return this.updateActionStatus({
      actionId,
      status: "completed",
      notes,
    });
  }

  /**
   * Get a learning by ID
   */
  getLearning(learningId: string): IncidentLearning | undefined {
    return this.state.learnings[learningId];
  }

  /**
   * Get a report by ID
   */
  getReport(reportId: string): IncidentLearningReport | undefined {
    return this.state.reports[reportId];
  }

  /**
   * Get reports by incident
   */
  getReportsByIncident(incidentId: string): IncidentLearningReport[] {
    return Object.values(this.state.reports).filter(
      (r) => r.incidentId === incidentId
    );
  }

  /**
   * Generate a summary of all incident learnings and actions
   */
  generateSummary(): {
    totalLearnings: number;
    totalActions: number;
    actionsByKind: Record<ActionKind, number>;
    actionsByStatus: Record<PersistentAction["status"], number>;
    openActionsByPriority: Record<PersistentAction["priority"], number>;
    averageActionsPerIncident: number;
  } {
    const learnings = Object.values(this.state.learnings);
    const actions = Object.values(this.state.actions);

    const actionsByKind: Record<ActionKind, number> = {
      roadmap: 0,
      enablement: 0,
      reliability: 0,
      process: 0,
      documentation: 0,
    };

    const actionsByStatus: Record<PersistentAction["status"], number> = {
      proposed: 0,
      approved: 0,
      "in-progress": 0,
      completed: 0,
      deferred: 0,
      rejected: 0,
    };

    const openActionsByPriority: Record<PersistentAction["priority"], number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const action of actions) {
      actionsByKind[action.kind]++;
      actionsByStatus[action.status]++;

      if (!["completed", "deferred", "rejected"].includes(action.status)) {
        openActionsByPriority[action.priority]++;
      }
    }

    return {
      totalLearnings: learnings.length,
      totalActions: actions.length,
      actionsByKind,
      actionsByStatus,
      openActionsByPriority,
      averageActionsPerIncident:
        learnings.length > 0 ? actions.length / learnings.length : 0,
    };
  }

  /**
   * Update report counts after action status change
   */
  private updateReportActionCounts(reportId: string): void {
    const report = this.state.reports[reportId];
    if (!report) return;

    report.totalActionsProposed = report.actions.length;
    report.totalActionsApproved = report.actions.filter(
      (a) => a.status === "approved" || a.status === "in-progress" || a.status === "completed"
    ).length;
    report.totalActionsCompleted = report.actions.filter(
      (a) => a.status === "completed"
    ).length;
  }

  /**
   * Update all reports that contain a specific action
   */
  private updateReportsForAction(actionId: string): void {
    for (const report of Object.values(this.state.reports)) {
      if (report.actions.some((a) => a.id === actionId)) {
        this.updateReportActionCounts(report.id);
      }
    }
  }

  /**
   * Update report counts for a specific action
   */
  private updateReportActionCountsForAction(actionId: string): void {
    for (const report of Object.values(this.state.reports)) {
      const actionIndex = report.actions.findIndex((a) => a.id === actionId);
      if (actionIndex >= 0) {
        // Refresh the action from state
        const updatedAction = this.state.actions[actionId];
        if (updatedAction) {
          report.actions[actionIndex] = updatedAction;
        }
        this.updateReportActionCounts(report.id);
      }
    }
  }

  /**
   * Get current state for persistence
   */
  getState(): IncidentLearningState {
    return this.state;
  }

  /**
   * Load state from persistence
   */
  loadState(state: IncidentLearningState): void {
    this.state = state;
  }
}
