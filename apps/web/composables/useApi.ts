import type { WorkspaceUsage, Agent } from '~/types';

export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiUrl;

  // Get API key from localStorage (for demo purposes)
  const getApiKey = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('privateconnect_apikey') || '';
    }
    return '';
  };

  const setApiKey = (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privateconnect_apikey', key);
    }
  };

  const headers = () => ({
    'x-api-key': getApiKey(),
  });

  const fetchWorkspace = async (): Promise<WorkspaceUsage | null> => {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    
    try {
      const response = await fetch(`${baseUrl}/v1/workspace`, { headers: headers() });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  };

  const upgradeWorkspace = async () => {
    const response = await fetch(`${baseUrl}/v1/workspace/upgrade`, {
      method: 'POST',
      headers: headers(),
    });
    if (!response.ok) throw new Error('Failed to upgrade');
    return response.json();
  };

  const fetchServices = async () => {
    const response = await fetch(`${baseUrl}/v1/services`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch services');
    return response.json();
  };

  const fetchService = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch service');
    return response.json();
  };

  const fetchServiceDiagnostics = async (id: string, limit: number = 50) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}/diagnostics?limit=${limit}`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch diagnostics');
    return response.json();
  };

  const runCheck = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${id}/check`, {
      method: 'POST',
      headers: headers(),
    });
    if (!response.ok) throw new Error('Failed to run check');
    return response.json();
  };

  const runReachCheck = async (serviceId: string, sourceAgentId: string) => {
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/reach`, {
      method: 'POST',
      headers: {
        ...headers(),
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
    const response = await fetch(`${baseUrl}/v1/agents`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
  };

  const fetchAgent = async (id: string): Promise<Agent> => {
    const response = await fetch(`${baseUrl}/v1/agents/${id}`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch agent');
    return response.json();
  };

  const fetchOnlineAgents = async (): Promise<Agent[]> => {
    const response = await fetch(`${baseUrl}/v1/agents/online`, { headers: headers() });
    if (!response.ok) throw new Error('Failed to fetch online agents');
    return response.json();
  };

  const fetchDiagnostic = async (id: string) => {
    const response = await fetch(`${baseUrl}/v1/diagnostics/${id}`);
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
      headers: {
        ...headers(),
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
      headers: {
        ...headers(),
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
    const response = await fetch(`${baseUrl}/v1/services/${serviceId}/shares`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error('Failed to fetch shares');
    return response.json();
  };

  const revokeShare = async (shareId: string) => {
    const response = await fetch(`${baseUrl}/v1/shares/${shareId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!response.ok) throw new Error('Failed to revoke share');
    return response.json();
  };

  const fetchShareAccessLogs = async (shareId: string) => {
    const response = await fetch(`${baseUrl}/v1/shares/${shareId}/logs`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error('Failed to fetch access logs');
    return response.json();
  };

  return {
    getApiKey,
    setApiKey,
    fetchWorkspace,
    upgradeWorkspace,
    fetchServices,
    fetchService,
    fetchServiceDiagnostics,
    runCheck,
    runReachCheck,
    fetchAgents,
    fetchAgent,
    fetchOnlineAgents,
    fetchDiagnostic,
    fetchDiagnosticByShareToken,
    createExternalService,
    // Shares
    createServiceShare,
    fetchServiceShares,
    revokeShare,
    fetchShareAccessLogs,
  };
}
