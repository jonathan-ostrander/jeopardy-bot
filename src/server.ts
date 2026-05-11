import { startBot } from './bot';

// Import the activity server to start it
// The server starts automatically when imported because it calls Bun.serve()
import './activity/server';

async function main() {
  console.log('[Server] Starting Jeopardy Activity Server...');
  
  // Start the Discord bot
  await startBot();
  
  console.log('[Server] All services started successfully!');
}

main().catch(console.error);
