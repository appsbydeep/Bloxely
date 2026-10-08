export interface AIWorkspaceInput {
  brainDump: string;
  localDate: string;
  timeZone: string;
}

/** Providers return untrusted plan data; Bloxely validates and builds the WorkspacePlan. */
export interface AIWorkspacePlanner {
  generatePlanData(input: AIWorkspaceInput): Promise<unknown>;
}

export class AIPlannerTransportError extends Error {
  constructor(public readonly category: 'upstream' | 'invalid_output', public readonly status?: number) {
    super('AI plan generation failed.');
  }
}
