import { GameManager } from '../../game/GameManager';
import { exchangeToken, getUserId } from './auth';
import { SocketHandler } from './socketHandler';

const gameManager = new GameManager();
const socketHandler = new SocketHandler(gameManager);

const port = parseInt(process.env.PORT || '3000');

const server = Bun.serve({
  port,
  async fetch(req, server) {
    const url = new URL(req.url);

    // CORS headers for development
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers, status: 204 });
    }

    // WebSocket upgrade endpoint
    if (url.pathname === '/ws') {
      const channelId = url.searchParams.get('channelId');
      const accessToken = url.searchParams.get('token');
      console.log('[WS] Upgrade request, channelId:', channelId, 'hasToken:', !!accessToken);

      if (!channelId || !accessToken) {
        return new Response('Missing channelId or token', { status: 400 });
      }

      try {
        const userId = await getUserId(accessToken);
        console.log('[WS] Token valid, userId:', userId);
        const success = server.upgrade(req, {
          data: { userId, channelId, accessToken },
        });
        if (success) {
          console.log('[WS] Upgrade successful for user:', userId);
          return undefined;
        }
        return new Response('WebSocket upgrade failed', { status: 400 });
      } catch (error) {
        console.error('[WS] Token validation failed:', error);
        return new Response('Invalid token', { status: 401 });
      }
    }

    // OAuth2 token exchange
    // Discord proxy strips '/.proxy' prefix, so check both paths
    if ((url.pathname === '/.proxy/api/token' || url.pathname === '/api/token') && req.method === 'POST') {
      console.log('[Server] Token exchange request, pathname:', url.pathname, 'host:', url.host);
      try {
        const body = await req.json();
        const { code } = body;
        
        if (!code) {
          return new Response('Missing code', { status: 400 });
        }

        const tokenData = await exchangeToken(code);
        return Response.json(tokenData, { headers });
      } catch (error) {
        console.error('[Server] Token exchange error:', error);
        return new Response((error as Error).message, { status: 400, headers });
      }
    }

    // Static files - serve the built activity client
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const file = Bun.file('dist/activity/client/index.html');
      if (await file.exists()) {
        let html = await file.text();
        // Inject the Discord client ID for runtime access
        const clientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.CLIENT_ID || '';
        html = html.replace('"{{DISCORD_CLIENT_ID}}"', JSON.stringify(clientId));
        return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html' } });
      }
    }

    // Try to serve other static files
    const staticPath = `dist/activity/client${url.pathname}`;
    const file = Bun.file(staticPath);
    if (await file.exists()) {
      const contentType = getContentType(url.pathname);
      return new Response(file, { headers: { ...headers, 'Content-Type': contentType } });
    }

    return new Response('Not Found', { status: 404, headers });
  },

  websocket: {
    open(ws) {
      socketHandler.registerSocket(ws);
    },
    message(ws, message) {
      socketHandler.handleMessage(ws, message as string);
    },
    close(ws) {
      socketHandler.removeSocket(ws);
    },
  },
});

function getContentType(path: string): string {
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

console.log(`[Server] Activity server running on port ${port}`);

export { gameManager };
