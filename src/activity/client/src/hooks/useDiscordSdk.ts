import { useState, useEffect } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || (window as any).__DISCORD_CLIENT_ID__;

interface AuthState {
  discordSdk: DiscordSDK | null;
  accessToken: string | null;
  userId: string | null;
  username: string | null;
  channelId: string | null;
  guildId: string | null;
  ready: boolean;
  error: string | null;
}

export function useDiscordSdk(): AuthState {
  const [state, setState] = useState<AuthState>({
    discordSdk: null,
    accessToken: null,
    userId: null,
    username: null,
    channelId: null,
    guildId: null,
    ready: false,
    error: null,
  });

  useEffect(() => {
    async function setup() {
      try {
        console.log('[Discord SDK] Starting setup, clientId:', DISCORD_CLIENT_ID);
        if (!DISCORD_CLIENT_ID) {
          throw new Error('DISCORD_CLIENT_ID is not set - check that VITE_DISCORD_CLIENT_ID is set during build or available at runtime');
        }
        const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);
        console.log('[Discord SDK] Instance created');

        await discordSdk.ready();
        console.log('[Discord SDK] SDK ready, channelId:', discordSdk.channelId, 'guildId:', discordSdk.guildId);

        console.log('[Discord SDK] Requesting authorization...');
        const { code } = await discordSdk.commands.authorize({
          client_id: DISCORD_CLIENT_ID,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify'],
        });
        console.log('[Discord SDK] Authorization code received');

        console.log('[Discord SDK] Exchanging token at /.proxy/api/token...');
        const response = await fetch('/.proxy/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        console.log('[Discord SDK] Token exchange response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Discord SDK] Token exchange failed:', errorText);
          throw new Error('Failed to exchange token: ' + errorText);
        }

        const tokenData = await response.json();
        console.log('[Discord SDK] Token data received, expires_in:', tokenData.expires_in);
        const access_token = tokenData.access_token;

        console.log('[Discord SDK] Authenticating with Discord...');
        const authResult = await discordSdk.commands.authenticate({
          access_token,
        });
        console.log('[Discord SDK] Authentication complete');

        const user = (authResult as any)?.user;
        console.log('[Discord SDK] User:', user?.username || user?.global_name, 'id:', user?.id);

        setState({
          discordSdk,
          accessToken: access_token,
          userId: user?.id || null,
          username: user?.username || user?.global_name || 'Player',
          channelId: discordSdk.channelId || null,
          guildId: discordSdk.guildId || null,
          ready: true,
          error: null,
        });
        console.log('[Discord SDK] Setup complete, ready=true');
      } catch (error) {
        console.error('[Discord SDK] Setup error:', error);
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }

    setup();
  }, []);

  return state;
}
