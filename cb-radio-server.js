// WebRTC Szignalizációs Szerver CB Rádióhoz - DEBUG VERSION
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const channels = {};

wss.on('connection', (ws) => {
  let currentChannel = null;
  let userId = generateId();
  
  console.log(`✅ Új felhasználó csatlakozott: ${userId}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📩 Üzenet ${userId}: ${data.type}`);
      
      switch (data.type) {
        case 'join-channel':
          handleJoinChannel(ws, data.channel, userId);
          break;
          
        case 'leave-channel':
          handleLeaveChannel(ws, currentChannel, userId);
          break;
          
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          console.log(`🔄 Továbbítás: ${data.type} → csatorna ${currentChannel}`);
          const messageWithFrom = { ...data, from: userId };
          broadcastToChannel(currentChannel, messageWithFrom, userId);
          break;
          
        case 'start-transmission':
          console.log(`🎤 ${userId} adás kezdés`);
          broadcastToChannel(currentChannel, {
            type: 'peer-transmitting',
            userId: userId,
            transmitting: true
          }, userId);
          break;
          
        case 'stop-transmission':
          console.log(`🔇 ${userId} adás vége`);
          broadcastToChannel(currentChannel, {
            type: 'peer-transmitting',
            userId: userId,
            transmitting: false
          }, userId);
          break;
      }
    } catch (error) {
      console.error(`❌ Üzenet hiba (${userId}):`, error);
    }
  });
  
  ws.on('close', () => {
    console.log(`👋 Felhasználó kilépett: ${userId}`);
    handleLeaveChannel(ws, currentChannel, userId);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket hiba (${userId}):`, error.message);
  });
  
  function handleJoinChannel(ws, channelId, userId) {
    if (currentChannel) {
      handleLeaveChannel(ws, currentChannel, userId);
    }
    
    if (!channels[channelId]) {
      channels[channelId] = [];
      console.log(`🆕 Csatorna létrehozva: ${channelId}`);
    }
    
    channels[channelId].push({ ws, userId });
    currentChannel = channelId;
    
    const peers = channels[channelId]
      .filter(client => client.userId !== userId)
      .map(client => client.userId);
    
    console.log(`📻 ${userId} → csatorna ${channelId} (${channels[channelId].length} fő, peers: ${peers.length})`);
    
    // Küldjük el a channel-joined üzenetet
    ws.send(JSON.stringify({
      type: 'channel-joined',
      channelId,
      userId,
      peers
    }));
    console.log(`✉️  channel-joined küldve → ${userId} (peers: [${peers.join(', ')}])`);
    
    // KRITIKUS: Értesítsük a többi felhasználót!
    if (peers.length > 0) {
      const peerJoinedMsg = {
        type: 'peer-joined',
        userId
      };
      console.log(`📢 BROADCAST peer-joined → ${peers.length} felhasználónak, új peer: ${userId}`);
      broadcastToChannel(channelId, peerJoinedMsg, userId);
    } else {
      console.log(`ℹ️  Nincs más peer a csatornán, nem kell broadcast`);
    }
  }
  
  function handleLeaveChannel(ws, channelId, userId) {
    if (!channelId || !channels[channelId]) return;
    
    console.log(`🚪 ${userId} kilép csatorna ${channelId}-ból`);
    
    channels[channelId] = channels[channelId].filter(
      client => client.userId !== userId
    );
    
    if (channels[channelId].length === 0) {
      delete channels[channelId];
      console.log(`🗑️  Csatorna ${channelId} törölve (üres)`);
    } else {
      console.log(`📢 BROADCAST peer-left → ${channels[channelId].length} felhasználónak, kilépő: ${userId}`);
      broadcastToChannel(channelId, {
        type: 'peer-left',
        userId
      }, userId);
    }
  }
  
  function broadcastToChannel(channelId, message, excludeUserId = null) {
    if (!channelId || !channels[channelId]) {
      console.log(`⚠️  Broadcast hiba: csatorna ${channelId} nem létezik`);
      return;
    }
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    channels[channelId].forEach(client => {
      if (client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
          console.log(`  → ${message.type} elküldve: ${client.userId}`);
        } catch (error) {
          console.error(`  ❌ Küldési hiba ${client.userId}:`, error.message);
        }
      }
    });
    
    console.log(`✅ Broadcast kész: ${message.type} → ${sentCount} felhasználónak`);
  }
});

// Heartbeat minden 30 másodpercben
const interval = setInterval(() => {
  let activeCount = 0;
  let deadCount = 0;
  
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      deadCount++;
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
    activeCount++;
  });
  
  if (deadCount > 0) {
    console.log(`💀 Heartbeat: ${deadCount} kapcsolat lezárva, ${activeCount} aktív`);
  }
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
  console.log('🔴 WebSocket szerver leállítva');
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check endpoint
app.get('/health', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  const channelStats = Object.keys(channels).map(id => ({
    channel: id,
    users: channels[id].length
  }));
  
  res.json({ 
    status: 'ok',
    version: 'v1.0-debug',
    channels: Object.keys(channels).length,
    totalUsers: totalUsers,
    channelDetails: channelStats,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>CB Radio Server</title>
    <style>body{font-family:monospace;background:#000;color:#0f0;padding:20px}h1{color:#0f0}</style>
    </head>
    <body>
      <h1>📻 CB RADIO SERVER v1.0-DEBUG</h1>
      <pre>
Status: ✅ ONLINE
Channels: ${Object.keys(channels).length}
Total Users: ${totalUsers}
WebSocket: wss://${req.get('host')}

Channel Details:
${Object.keys(channels).map(id => 
  `  Ch${id}: ${channels[id].length} users (${channels[id].map(c => c.userId).join(', ')})`
).join('\n') || '  (no active channels)'}
      </pre>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════╗
║  📻 CB RADIO SERVER v1.0-DEBUG    ║
║  Port: ${PORT}                     ║
║  Debug Mode: ENABLED               ║
╚════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM jelzés, leállítás...');
  server.close(() => {
    console.log('👋 Szerver leállt');
    process.exit(0);
  });
});
