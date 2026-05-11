import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

client.on(Events.Ready, () => {
  console.log(`[Bot] Logged in as ${client.user?.tag}!`);
  console.log(`[Bot] Activity is ready to launch.`);
});

export async function startBot(): Promise<void> {
  await client.login(process.env.DISCORD_TOKEN);
}

export { client };
