export interface Workspace {
  id: string;
  name: string;
  plan: 'FREE' | 'PRO';
}

export interface WorkspaceUsage {
  workspace: Workspace;
  usage: {
    services: number;
    agents: number;
  };
  limits: {
    maxServices: number;
    diagnosticHistoryLimit: number;
  };
  canAddService: boolean;
}

export interface Agent {
  id: string;
  workspaceId: string;
  name?: string;
  label: string;
  lastSeenAt: string;
  connectedAt: string | null; // When the agent connected (for uptime tracking)
  isOnline: boolean;
  createdAt: string;
  services?: Service[];
}

export interface Service {
  id: string;
  workspaceId: string;
  agentId: string | null;  // null for external services
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort: number | null;
  protocol: string;
  status: 'OK' | 'FAIL' | 'UNKNOWN';
  isExternal: boolean;     // true for external target services
  isPublic: boolean;       // true for publicly accessible via subdomain
  publicSubdomain: string | null;  // e.g., "abc123" -> abc123.privateconnect.co
  lastCheckedAt: string | null;
  createdAt: string;
  agent?: Agent;
  diagnostics?: DiagnosticResult[];
}

export interface TlsDetails {
  valid: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  selfSigned?: boolean;
  error?: string;
}

export interface HttpDetails {
  statusCode?: number;
  statusMessage?: string;
  responseTime?: number;
  error?: string;
}

export interface DiagnosticResult {
  id: string;
  serviceId: string;
  sourceAgentId: string | null;
  sourceLabel: string | null;
  perspective: 'hub' | 'agent';
  createdAt: string;
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus: string | null;
  tlsDetails: string | null; // JSON string
  httpStatus: string | null;
  httpDetails: string | null; // JSON string
  latencyMs: number | null;
  message: string;
  raw: string | null;
  shareToken: string | null;
  sourceAgent?: {
    id: string;
    label: string;
    name?: string;
  };
  service?: {
    id: string;
    name: string;
    targetHost: string;
    targetPort: number;
  };
}
