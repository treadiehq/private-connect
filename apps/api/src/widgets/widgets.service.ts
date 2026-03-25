import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharesService } from '../shares/shares.service';
import { escapeHtml, escapeJsString, sanitizeCssColor } from '../common/security';

export interface WidgetConfig {
  shareToken: string;
  serviceName: string;
  serviceType: string;
  expiresAt: Date | null;
  buttonText: string;
  buttonColor: string;
  showServiceInfo: boolean;
}

@Injectable()
export class WidgetsService {
  constructor(
    private prisma: PrismaService,
    private sharesService: SharesService,
  ) {}

  /**
   * Get widget configuration for a share token
   */
  async getWidgetConfig(shareToken: string): Promise<WidgetConfig | null> {
    const share = await this.prisma.serviceShare.findUnique({
      where: { token: shareToken },
      include: {
        service: {
          select: {
            name: true,
            targetPort: true,
            protocol: true,
          },
        },
      },
    });

    if (!share || share.revokedAt) {
      return null;
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      return null;
    }

    return {
      shareToken: share.token,
      serviceName: share.service.name,
      serviceType: this.detectServiceType(share.service.targetPort, share.service.protocol),
      expiresAt: share.expiresAt,
      buttonText: `Connect to ${share.service.name}`,
      buttonColor: '#06b6d4', // cyan-500
      showServiceInfo: true,
    };
  }

  /**
   * Generate embeddable JavaScript widget
   */
  generateEmbedScript(shareToken: string, baseUrl: string): string {
    // Sanitize inputs for defense-in-depth (prevent JS string injection)
    const safeToken = escapeJsString(shareToken);
    const safeBaseUrl = escapeJsString(baseUrl);
    
    return `
(function() {
  'use strict';
  
  var SHARE_TOKEN = '${safeToken}';
  var BASE_URL = '${safeBaseUrl}';
  
  // Create widget container
  var container = document.createElement('div');
  container.id = 'pc-widget-' + SHARE_TOKEN;
  container.innerHTML = '<div style="display:inline-block;font-family:system-ui,-apple-system,sans-serif;">' +
    '<button id="pc-connect-btn" style="' +
    'background:linear-gradient(135deg,#06b6d4,#0891b2);' +
    'color:white;' +
    'border:none;' +
    'padding:12px 24px;' +
    'border-radius:8px;' +
    'font-size:14px;' +
    'font-weight:500;' +
    'cursor:pointer;' +
    'transition:all 0.2s;' +
    'box-shadow:0 2px 8px rgba(6,182,212,0.3);' +
    '">' +
    '<span style="display:flex;align-items:center;gap:8px;">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>' +
    '<path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>' +
    '</svg>' +
    '<span>Connect</span>' +
    '</span>' +
    '</button>' +
    '</div>';
  
  // Hover effects
  var btn = container.querySelector('#pc-connect-btn');
  btn.onmouseover = function() {
    this.style.transform = 'translateY(-1px)';
    this.style.boxShadow = '0 4px 12px rgba(6,182,212,0.4)';
  };
  btn.onmouseout = function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 2px 8px rgba(6,182,212,0.3)';
  };
  
  // Click handler
  btn.onclick = function() {
    window.open(BASE_URL + '/share/' + SHARE_TOKEN, '_blank', 'width=800,height=600');
  };
  
  // Insert widget
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  currentScript.parentNode.insertBefore(container, currentScript);
})();
`.trim();
  }

  /**
   * Generate embeddable HTML button
   */
  generateEmbedButton(shareToken: string, baseUrl: string, options?: {
    text?: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
  }): string {
    // Sanitize all inputs to prevent XSS and CSS injection
    const text = escapeHtml(options?.text || 'Connect');
    const color = sanitizeCssColor(options?.color || '#06b6d4');
    const safeToken = escapeHtml(shareToken);
    const safeBaseUrl = escapeHtml(baseUrl);
    const padding = options?.size === 'small' ? '8px 16px' : options?.size === 'large' ? '16px 32px' : '12px 24px';
    const fontSize = options?.size === 'small' ? '12px' : options?.size === 'large' ? '16px' : '14px';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    .pc-connect-btn {
      background: ${color};
      color: white;
      border: none;
      padding: ${padding};
      border-radius: 8px;
      font-size: ${fontSize};
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .pc-connect-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .pc-connect-btn svg {
      width: 16px;
      height: 16px;
    }
  </style>
</head>
<body>
  <a href="${safeBaseUrl}/share/${safeToken}" target="_blank" class="pc-connect-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
      <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
    </svg>
    <span>${text}</span>
  </a>
</body>
</html>
`.trim();
  }

  /**
   * Detect service type from port
   */
  private detectServiceType(port: number, protocol?: string): string {
    if (protocol && protocol !== 'auto') return protocol;
    
    const portTypes: Record<number, string> = {
      5432: 'postgresql',
      3306: 'mysql',
      6379: 'redis',
      27017: 'mongodb',
      9200: 'elasticsearch',
      3000: 'http',
      8080: 'http',
      443: 'https',
      80: 'http',
    };
    
    return portTypes[port] || 'tcp';
  }
}
