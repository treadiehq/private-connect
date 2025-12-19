interface User {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface Workspace {
  id: string;
  name: string;
  apiKey: string;
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const authState = reactive<AuthState>({
  user: null,
  workspace: null,
  isLoading: true,
  isAuthenticated: false,
});

export function useAuth() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiUrl;

  const register = async (email: string, workspaceName: string) => {
    const response = await fetch(`${baseUrl}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, workspaceName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  };

  const login = async (email: string) => {
    const response = await fetch(`${baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  };

  const verifyMagicLink = async (token: string): Promise<{
    user: User;
    workspace: Workspace | null;
    isNewUser: boolean;
  }> => {
    const response = await fetch(`${baseUrl}/v1/auth/verify?token=${token}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }

    const data = await response.json();
    
    // Update auth state
    authState.user = data.user;
    authState.workspace = data.workspace;
    authState.isAuthenticated = true;
    
    // Also store API key in localStorage for backward compatibility
    if (data.workspace?.apiKey) {
      localStorage.setItem('privateconnect_apikey', data.workspace.apiKey);
    }

    return {
      user: data.user,
      workspace: data.workspace,
      isNewUser: data.isNewUser || false,
    };
  };

  const logout = async () => {
    try {
      await fetch(`${baseUrl}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // Ignore errors
    }

    // Clear state
    authState.user = null;
    authState.workspace = null;
    authState.isAuthenticated = false;
    
    // Clear localStorage
    localStorage.removeItem('privateconnect_apikey');
  };

  const fetchCurrentUser = async () => {
    authState.isLoading = true;
    
    try {
      const response = await fetch(`${baseUrl}/v1/auth/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        authState.user = null;
        authState.workspace = null;
        authState.isAuthenticated = false;
        return null;
      }

      const data = await response.json();
      authState.user = data.user;
      authState.workspace = data.workspace;
      authState.isAuthenticated = true;
      
      // Also store API key in localStorage for backward compatibility
      if (data.workspace?.apiKey) {
        localStorage.setItem('privateconnect_apikey', data.workspace.apiKey);
      }

      return data;
    } catch (e) {
      authState.user = null;
      authState.workspace = null;
      authState.isAuthenticated = false;
      return null;
    } finally {
      authState.isLoading = false;
    }
  };

  return {
    // State
    user: computed(() => authState.user),
    workspace: computed(() => authState.workspace),
    isLoading: computed(() => authState.isLoading),
    isAuthenticated: computed(() => authState.isAuthenticated),
    
    // Methods
    register,
    login,
    verifyMagicLink,
    logout,
    fetchCurrentUser,
  };
}

