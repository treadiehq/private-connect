import type { WorkspaceUsage, Agent } from '~/types';

export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiUrl;

  // Base fetch options - use session cookie for authentication
  const fetchOptions = () => ({
    headers: {} as Record<string, string>,
    credentials: 'include' as RequestCredentials,
  });

  const fetchWorkspace = async (): Promise<WorkspaceUsage | null> => {
    try {
      const response = await fetch(`${baseUrl}/v1/workspace`, fetchOptions());
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  };

  const upgradeWorkspace = async () => {
    const response = await fetch(`${baseUrl}/v1/workspace/upgrade`, {
      method: 'POST',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to upgrade');
    return response.json();
  };

  const fetchServices = async () => {
    const response = await fetch(`${baseUrl}/v1/services`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch services');
    return response.json();
  };

  const fetchService = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch service');
    return response.json();
  };

  const fetchServiceDiagnostics = async (id: string, limit: number = 50) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}/diagnostics?limit=${limit}`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch diagnostics');
    return response.json();
  };

  const runCheck = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}/check`, {
      method: 'POST',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to run check');
    return response.json();
  };

  const runReachCheck = async (serviceId: string, sourceAgentId: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/reach`, {
      method: 'POST',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceAgentId,
        mode: 'tcp',
        timeoutMs: 5000,
      }),
    });
    if (!response.ok) throw new Error('Failed to run reach check');
    return response.json();
  };

  const fetchAgents = async (): Promise<Agent[]> => {
    const response = await fetch(`${baseUrl}/v1/agents`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
  };

  const fetchAgent = async (id: string): Promise<Agent> => {
    const response = await fetch(`${baseUrl}/v1/agents/${id}`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch agent');
    return response.json();
  };

  const deleteAgent = async (id: string): Promise<{ success: boolean; deleted: boolean }> => {
    const response = await fetch(`${baseUrl}/v1/agents/${id}`, {
      method: 'DELETE',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to delete agent');
    return response.json();
  };

  const fetchOnlineAgents = async (): Promise<Agent[]> => {
    const response = await fetch(`${baseUrl}/v1/agents/online`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch online agents');
    return response.json();
  };

  const fetchDiagnostic = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/diagnostics/${id}`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch diagnostic');
    return response.json();
  };

  const fetchDiagnosticByShareToken = async (token: string) => {
    const response = await fetch(`${baseUrl}/v1/diagnostics/share/${token}`);
    if (!response.ok) throw new Error('Failed to fetch diagnostic');
    return response.json();
  };

  const createExternalService = async (
    name: string,
    targetHost: string,
    targetPort: number,
    protocol: string = 'auto',
  ) => {
    const response = await fetch(`${baseUrl}/v1/services/external`, {
      method: 'POST',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        targetHost,
        targetPort,
        protocol,
      }),
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to create external service');
    }
    
    return response.json();
  };

  // Service Shares API
  const createServiceShare = async (
    serviceId: string,
    data: {
      name: string;
      description?: string;
      expiresIn?: '1h' | '24h' | '7d' | '30d' | 'never';
      allowedPaths?: string[];
      allowedMethods?: string[];
      rateLimitPerMin?: number;
    }
  ) => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/shares`, {
      method: 'POST',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create share');
    }
    
    return response.json();
  };

  const fetchServiceShares = async (serviceId: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/shares`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch shares');
    return response.json();
  };

  const revokeShare = async (shareId: string) => {
    const response = await fetch(`${baseUrl}/v1/shares/${shareId}`, {
      method: 'DELETE',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to revoke share');
    return response.json();
  };

  const fetchShareAccessLogs = async (shareId: string) => {
    const response = await fetch(`${baseUrl}/v1/shares/${shareId}/logs`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch access logs');
    return response.json();
  };

  const deleteService = async (serviceId: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}`, {
      method: 'DELETE',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to delete service');
    return response.json();
  };

  // Subdomain (custom public URL) — uses same base URL and auth as other API calls
  const checkSubdomain = async (
    serviceId: string,
    subdomain: string,
  ): Promise<{ valid: boolean; available?: boolean; error?: string; subdomain?: string; publicUrl?: string | null }> => {
    const value = subdomain?.toLowerCase().trim() || '';
    if (!value) return { valid: false, error: 'Subdomain is required' };
    const response = await fetch(
      `${baseUrl}/v1/services/${serviceId}/subdomain/check?subdomain=${encodeURIComponent(value)}`,
      fetchOptions(),
    );
    if (!response.ok) return { valid: false, error: 'Failed to check availability' };
    return response.json();
  };

  const setSubdomain = async (
    serviceId: string,
    subdomain: string | null,
  ): Promise<{ success: boolean; service?: { id: string; publicSubdomain: string | null; isPublic: boolean; publicUrl: string | null }; error?: string }> => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/subdomain`, {
      method: 'PATCH',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subdomain: subdomain?.toLowerCase().trim() || null }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.message || data.error || 'Failed to save subdomain';
      const err = new Error(msg) as Error & { data?: { message?: string } };
      err.data = { message: msg };
      throw err;
    }
    return data;
  };

  const updateService = async (
    serviceId: string,
    data: { name?: string },
  ): Promise<{ success: boolean; service?: { id: string; name: string; [key: string]: unknown } }> => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}`, {
      method: 'PATCH',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = result.message || result.error || 'Failed to update service';
      const err = new Error(msg) as Error & { data?: { message?: string } };
      err.data = { message: msg };
      throw err;
    }
    return result;
  };

  const checkMcpStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/v1/agents/by-capability/mcp-server`, fetchOptions());
      if (!response.ok) return false;
      const data = await response.json();
      // Check if any agents with mcp-server capability are online
      return data.agents && data.agents.some((agent: Agent) => agent.isOnline);
    } catch {
      return false;
    }
  };

  // Audit API
  const fetchAuditLog = async (options?: {
    limit?: number;
    agentId?: string;
    serviceId?: string;
    type?: 'agent' | 'share' | 'session' | 'diagnostic';
    since?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.agentId) params.set('agentId', options.agentId);
    if (options?.serviceId) params.set('serviceId', options.serviceId);
    if (options?.type) params.set('type', options.type);
    if (options?.since) params.set('since', options.since);
    
    const response = await fetch(`${baseUrl}/v1/audit?${params}`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  };

  const fetchAuditStats = async () => {
    const response = await fetch(`${baseUrl}/v1/audit/stats`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch audit stats');
    return response.json();
  };

  // Tunnels API
  const fetchTunnels = async () => {
    const response = await fetch(`${baseUrl}/v1/tunnels`, fetchOptions());
    if (!response.ok) throw new Error('Failed to fetch tunnels');
    return response.json();
  };

  const createTunnel = async (data: {
    target: string;
    name?: string;
    protocol?: string;
    agentId: string;
    isPublic?: boolean;
  }) => {
    const response = await fetch(`${baseUrl}/v1/tunnels`, {
      method: 'POST',
      ...fetchOptions(),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create tunnel');
    return response.json();
  };

  const deleteTunnel = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/tunnels/${id}`, {
      method: 'DELETE',
      ...fetchOptions(),
    });
    if (!response.ok) throw new Error('Failed to delete tunnel');
    return response.json();
  };

  const apiFetch = async (path: string, options?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions(),
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Request failed: ${response.status}`);
    }
    return response.json();
  };

  return {
    apiFetch,
    fetchWorkspace,
    upgradeWorkspace,
    fetchServices,
    fetchService,
    fetchServiceDiagnostics,
    runCheck,
    runReachCheck,
    fetchAgents,
    fetchAgent,
    deleteAgent,
    fetchOnlineAgents,
    fetchDiagnostic,
    fetchDiagnosticByShareToken,
    createExternalService,
    // Shares
    createServiceShare,
    fetchServiceShares,
    revokeShare,
    fetchShareAccessLogs,
    // Service management
    deleteService,
    checkSubdomain,
    setSubdomain,
    updateService,
    // MCP status
    checkMcpStatus,
    // Audit
    fetchAuditLog,
    fetchAuditStats,
    // Tunnels
    fetchTunnels,
    createTunnel,
    deleteTunnel,
  };
}
