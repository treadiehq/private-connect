import { Injectable } from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns';
import * as https from 'https';
import * as http from 'http';

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
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus?: string;
  tlsDetails?: TlsDetails;
  httpStatus?: string;
  httpDetails?: HttpDetails;
  latencyMs?: number;
  message: string;
  raw?: string;
}

@Injectable()
export class DiagnosticsService {
  private readonly TIMEOUT_MS = 5000;

  /**
   * Run comprehensive diagnostics through the tunnel port on localhost.
   * This proves the tunnel is working end-to-end.
   */
  async runDiagnostics(
    tunnelPort: number,
    originalHost: string,
    originalPort: number,
    protocol?: string,
  ): Promise<DiagnosticResult> {
    const result: DiagnosticResult = {
      dnsStatus: 'SKIP',
      tcpStatus: 'UNKNOWN',
      message: '',
    };

    // For tunnel diagnostics, we connect to localhost:tunnelPort
    // DNS is not applicable since we're connecting to localhost
    result.dnsStatus = 'OK (localhost)';

    // TCP Connect test
    const startTime = Date.now();
    try {
      await this.tcpConnect('127.0.0.1', tunnelPort);
      result.tcpStatus = 'OK';
      result.latencyMs = Date.now() - startTime;
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      result.tcpStatus = 'FAIL';
      result.message = `TCP failed: ${err.code || err.message}`;
      return result;
    }

    // Determine if we should test TLS
    const shouldTestTls = this.shouldTestTls(originalPort, protocol);
    
    if (shouldTestTls) {
      const tlsResult = await this.tlsConnectWithDetails('127.0.0.1', tunnelPort, originalHost);
      result.tlsStatus = tlsResult.valid ? 'OK' : 'FAIL';
      result.tlsDetails = tlsResult;
      
      if (!tlsResult.valid && tlsResult.error) {
        result.message = `TLS: ${tlsResult.error}`;
      }
    }

    // HTTP(S) health check for web services
    const shouldTestHttp = this.shouldTestHttp(originalPort, protocol);
    
    if (shouldTestHttp) {
      const useHttps = shouldTestTls && result.tlsStatus === 'OK';
      const httpResult = await this.httpHealthCheck('127.0.0.1', tunnelPort, useHttps);
      result.httpStatus = httpResult.statusCode && httpResult.statusCode < 500 ? 'OK' : 'FAIL';
      result.httpDetails = httpResult;
      
      if (httpResult.error) {
        result.message = result.message 
          ? `${result.message}; HTTP: ${httpResult.error}`
          : `HTTP: ${httpResult.error}`;
      }
    }

    if (!result.message) {
      result.message = 'OK';
    }

    return result;
  }

  /**
   * Run diagnostics directly against an external target (no tunnel).
   * Used for external target services like HCP Vault, cloud APIs, etc.
   */
  async runExternalDiagnostics(
    targetHost: string,
    targetPort: number,
    protocol?: string,
  ): Promise<DiagnosticResult> {
    const result: DiagnosticResult = {
      dnsStatus: 'UNKNOWN',
      tcpStatus: 'UNKNOWN',
      message: '',
    };

    // DNS resolution
    const startTime = Date.now();
    let resolvedHost: string;
    try {
      const dnsResult = await this.dnsLookup(targetHost);
      resolvedHost = dnsResult.address;
      result.dnsStatus = `OK (${resolvedHost})`;
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      result.dnsStatus = 'FAIL';
      result.message = `DNS failed: ${err.code || err.message}`;
      return result;
    }

    // TCP Connect test
    try {
      await this.tcpConnect(targetHost, targetPort);
      result.tcpStatus = 'OK';
      result.latencyMs = Date.now() - startTime;
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
      result.tcpStatus = 'FAIL';
      result.message = `TCP failed: ${err.code || err.message}`;
      return result;
    }

    // TLS test
    const shouldTestTls = this.shouldTestTls(targetPort, protocol);
    
    if (shouldTestTls) {
      const tlsResult = await this.tlsConnectWithDetails(targetHost, targetPort, targetHost);
      result.tlsStatus = tlsResult.valid ? 'OK' : 'FAIL';
      result.tlsDetails = tlsResult;
      
      if (!tlsResult.valid && tlsResult.error) {
        result.message = `TLS: ${tlsResult.error}`;
      }
    }

    // HTTP(S) health check for web services
    const shouldTestHttp = this.shouldTestHttp(targetPort, protocol);
    
    if (shouldTestHttp) {
      const useHttps = shouldTestTls && result.tlsStatus === 'OK';
      const httpResult = await this.httpHealthCheck(targetHost, targetPort, useHttps);
      result.httpStatus = httpResult.statusCode && httpResult.statusCode < 500 ? 'OK' : 'FAIL';
      result.httpDetails = httpResult;
      
      if (httpResult.error) {
        result.message = result.message 
          ? `${result.message}; HTTP: ${httpResult.error}`
          : `HTTP: ${httpResult.error}`;
      }
    }

    if (!result.message) {
      result.message = 'OK';
    }

    return result;
  }

  /**
   * Determine if TLS should be tested based on port and protocol
   */
  private shouldTestTls(port: number, protocol?: string): boolean {
    if (protocol === 'https') return true;
    if (protocol === 'http') return false;
    
    // Common TLS ports
    const tlsPorts = [443, 8443, 9443, 5432, 3306, 6379, 27017, 636];
    return tlsPorts.includes(port);
  }

  /**
   * Determine if HTTP health check should be run
   */
  private shouldTestHttp(port: number, protocol?: string): boolean {
    if (protocol === 'http' || protocol === 'https') return true;
    
    // Common HTTP ports
    const httpPorts = [80, 443, 8080, 8443, 3000, 3001, 4000, 5000, 8000, 9000];
    return httpPorts.includes(port);
  }

  /**
   * Direct DNS lookup (for debugging, not used in tunnel mode)
   */
  async dnsLookup(hostname: string): Promise<{ address: string; family: number }> {
    return new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
  }

  /**
   * TCP connection test
   */
  private tcpConnect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('timeout'));
      }, this.TIMEOUT_MS);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.end();
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * TLS handshake with detailed certificate validation
   */
  private tlsConnectWithDetails(host: string, port: number, servername: string): Promise<TlsDetails> {
    return new Promise((resolve) => {
      // First try with certificate validation
      const socket = tls.connect({
        host,
        port,
        servername,
        rejectUnauthorized: true,
      });

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ valid: false, error: 'Connection timeout' });
      }, this.TIMEOUT_MS);

      socket.on('secureConnect', () => {
        clearTimeout(timeout);
        
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        
        const details: TlsDetails = {
          valid: authorized,
          issuer: cert.issuer?.O || cert.issuer?.CN,
          subject: cert.subject?.CN,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          selfSigned: cert.issuer?.CN === cert.subject?.CN,
        };

        // Calculate days until expiry
        if (cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          details.daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (details.daysUntilExpiry < 0) {
            details.valid = false;
            details.error = 'Certificate expired';
          } else if (details.daysUntilExpiry < 30) {
            details.error = `Certificate expires in ${details.daysUntilExpiry} days`;
          }
        }

        if (!authorized) {
          const authError = socket.authorizationError;
          details.error = authError ? String(authError) : 'Certificate validation failed';
        }

        socket.end();
        resolve(details);
      });

      socket.on('error', (err: Error & { code?: string }) => {
        clearTimeout(timeout);
        
        // Try again without validation to get more details
        this.tlsConnectWithoutValidation(host, port, servername, err).then(resolve);
      });
    });
  }

  /**
   * TLS connect without validation - to get certificate details even when invalid
   */
  private tlsConnectWithoutValidation(
    host: string, 
    port: number, 
    servername: string,
    originalError: Error & { code?: string }
  ): Promise<TlsDetails> {
    return new Promise((resolve) => {
      const socket = tls.connect({
        host,
        port,
        servername,
        rejectUnauthorized: false,
      });

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ 
          valid: false, 
          error: this.formatTlsError(originalError) 
        });
      }, this.TIMEOUT_MS);

      socket.on('secureConnect', () => {
        clearTimeout(timeout);
        
        const cert = socket.getPeerCertificate();
        
        const details: TlsDetails = {
          valid: false,
          issuer: cert.issuer?.O || cert.issuer?.CN,
          subject: cert.subject?.CN,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          selfSigned: cert.issuer?.CN === cert.subject?.CN,
          error: this.formatTlsError(originalError),
        };

        // Check expiry
        if (cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          details.daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        socket.end();
        resolve(details);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve({ 
          valid: false, 
          error: this.formatTlsError(originalError) 
        });
      });
    });
  }

  /**
   * Format TLS error into human-readable message
   */
  private formatTlsError(err: Error & { code?: string }): string {
    const code = err.code || err.message;
    
    const errorMap: Record<string, string> = {
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'Certificate signed by unknown authority',
      'SELF_SIGNED_CERT_IN_CHAIN': 'Self-signed certificate in chain',
      'DEPTH_ZERO_SELF_SIGNED_CERT': 'Self-signed certificate',
      'CERT_HAS_EXPIRED': 'Certificate has expired',
      'ERR_TLS_CERT_ALTNAME_INVALID': 'Certificate hostname mismatch',
      'HOSTNAME_MISMATCH': 'Certificate hostname mismatch',
      'UNABLE_TO_GET_ISSUER_CERT': 'Unable to get issuer certificate',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY': 'Unable to get local issuer certificate',
      'CERT_UNTRUSTED': 'Certificate not trusted',
      'CERT_REJECTED': 'Certificate rejected',
      'ECONNREFUSED': 'Connection refused',
      'ECONNRESET': 'Connection reset',
      'timeout': 'Connection timeout',
    };

    return errorMap[code] || `TLS error: ${code}`;
  }

  /**
   * HTTP(S) health check - tries common health endpoints
   */
  private httpHealthCheck(host: string, port: number, useHttps: boolean): Promise<HttpDetails> {
    return new Promise((resolve) => {
      const protocol = useHttps ? https : http;
      const endpoints = ['/', '/health', '/healthz', '/api/health'];
      
      this.tryHttpEndpoint(protocol, host, port, endpoints, 0, useHttps).then(resolve);
    });
  }

  /**
   * Try HTTP endpoints in sequence
   */
  private tryHttpEndpoint(
    protocol: typeof http | typeof https,
    host: string,
    port: number,
    endpoints: string[],
    index: number,
    useHttps: boolean,
  ): Promise<HttpDetails> {
    return new Promise((resolve) => {
      if (index >= endpoints.length) {
        resolve({ error: 'No healthy endpoint found' });
        return;
      }

      const startTime = Date.now();
      const endpoint = endpoints[index];
      
      const options: https.RequestOptions = {
        hostname: host,
        port,
        path: endpoint,
        method: 'GET',
        timeout: this.TIMEOUT_MS,
        rejectUnauthorized: false, // Already validated TLS separately
      };

      const req = protocol.request(options as http.RequestOptions, (res) => {
        const responseTime = Date.now() - startTime;
        
        // Consume response data
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode && res.statusCode < 400) {
            resolve({
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              responseTime,
            });
          } else if (index < endpoints.length - 1) {
            // Try next endpoint
            this.tryHttpEndpoint(protocol, host, port, endpoints, index + 1, useHttps).then(resolve);
          } else {
            resolve({
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              responseTime,
            });
          }
        });
      });

      req.on('error', (err: Error & { code?: string }) => {
        if (index < endpoints.length - 1) {
          // Try next endpoint
          this.tryHttpEndpoint(protocol, host, port, endpoints, index + 1, useHttps).then(resolve);
        } else {
          resolve({ error: err.code || err.message });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'Request timeout' });
      });

      req.end();
    });
  }
}
