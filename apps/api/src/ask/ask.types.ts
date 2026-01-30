export interface AskRequest {
  service: string;
  question: string;
}

export interface AskReceipt {
  method: string;
  path: string;
  url: string;
  status: number | null;
  latencyMs: number;
  ok: boolean;
  error?: string;
  bodySnippet?: string;
}

export type ReachabilityClassification = 'PUBLIC_OR_LOCAL' | 'UNREACHABLE_OR_PRIVATE';

export interface Reachability {
  reachable: boolean;
  classification: ReachabilityClassification;
  reason?: string;
}

export interface BlockedAction {
  method: string;
  path: string;
  reason: string;
}

export interface AskResponse {
  answer: string;
  baseUrl: string;
  receipts: AskReceipt[];
  reachability: Reachability;
  blockedActions: BlockedAction[];
}
