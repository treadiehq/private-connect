/**
 * Private Connect Skill for Moltbot
 * 
 * Access private services by name, from anywhere.
 * https://privateconnect.co
 */

export {
  connect_reach,
  connect_status,
  connect_share,
  connect_join,
  connect_clone,
  connect_list_shares,
  connect_revoke,
  connect_expose,
  connect_expose_gateway,
  connect_reach_gateway,
  toolDefinitions,
} from './tools';

// Skill metadata
export const skillInfo = {
  name: 'private-connect',
  displayName: 'Private Connect',
  description: 'Access private services by name, from anywhere. No VPN or SSH tunnels.',
  version: '1.0.0',
  author: 'Treadie',
  homepage: 'https://privateconnect.co',
  repository: 'https://github.com/treadiehq/private-connect',
  keywords: ['services', 'vpn', 'tunnel', 'infrastructure', 'devops'],
};

