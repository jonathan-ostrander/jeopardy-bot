export async function exchangeToken(code: string): Promise<{ access_token: string; expires_in: number } > {
  const clientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.CLIENT_ID;
  console.log('[Auth] Exchanging token, clientId:', clientId, 'redirect_uri:', 'https://127.0.0.1');

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://127.0.0.1',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Auth] Token exchange failed:', error);
    throw new Error(`Token exchange failed: ${error}`);
  }

  console.log('[Auth] Token exchange successful');
  return response.json();
}

export async function getUserId(accessToken: string): Promise<string> {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();
  return data.id;
}
