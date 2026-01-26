// WebRTC Szignalizációs Szerver CB Rádióhoz
// Railway + Permissions Policy FIX

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

// PERMISSIONS POLICY FIX - Mikrofon engedélyezése
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
    res.setHeader('Feature-Policy', 'microphone *; camera *');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Statikus fájlok kiszolgálása
app.use(express.static('.'));

const server = http.createServer(app);

const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false,
  clientTracking: true
});

const channels = {};

wss.on('connection', (ws, req) => {
  let currentChannel = null;
  let userId = generateId();
  
  console.log(`✅ Új felhasználó: ${userId}`);
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
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
          // FIX: from field hozzáadása
          const messageWithFrom = { ...data, from: userId };
          broadcastToChannel(currentChannel, messageWithFrom, userId);
          break;
          
        case 'start-transmission':
          broadcastToChannel(currentChannel, {
            type: 'peer-transmitting',
            userId: userId,
            transmitting: true
          }, userId);
          break;
          
        case 'stop-transmission':
          broadcastToChannel(currentChannel, {
            type: 'peer-transmitting',
            userId: userId,
            transmitting: false
          }, userId);
          break;
      }
    } catch (error) {
      console.error('❌ Üzenet hiba:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`👋 Kilépett: ${userId}`);
    handleLeaveChannel(ws, currentChannel, userId);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket hiba (${userId}):`, error);
  });
  
  function handleJoinChannel(ws, channelId, userId) {
    if (currentChannel) {
      handleLeaveChannel(ws, currentChannel, userId);
    }
    
    if (!channels[channelId]) {
      channels[channelId] = [];
    }
    
    channels[channelId].push({ ws, userId });
    currentChannel = channelId;
    
    const peers = channels[channelId]
      .filter(client => client.userId !== userId)
      .map(client => client.userId);
    
    ws.send(JSON.stringify({
      type: 'channel-joined',
      channelId,
      userId,
      peers
    }));
    
    broadcastToChannel(channelId, {
      type: 'peer-joined',
      userId
    }, userId);
    
    console.log(`📻 ${userId} → csatorna ${channelId} (${channels[channelId].length} fő)`);
  }
  
  function handleLeaveChannel(ws, channelId, userId) {
    if (!channelId || !channels[channelId]) return;
    
    channels[channelId] = channels[channelId].filter(
      client => client.userId !== userId
    );
    
    if (channels[channelId].length === 0) {
      delete channels[channelId];
      console.log(`🗑️  Csatorna ${channelId} törölve`);
    } else {
      broadcastToChannel(channelId, {
        type: 'peer-left',
        userId
      }, userId);
    }
  }
  
  function broadcastToChannel(channelId, message, excludeUserId = null) {
    if (!channelId || !channels[channelId]) return;
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    channels[channelId].forEach(client => {
      if (client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
        sentCount++;
      }
    });
    
    if (sentCount > 0 && message.type !== 'ice-candidate') {
      console.log(`📡 ${message.type} → ${sentCount} fő (csatorna: ${channelId})`);
    }
  }
});

// Heartbeat
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('💀 Timeout - kapcsolat lezárva');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check
app.get('/health', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  res.json({ 
    status: 'ok',
    channels: Object.keys(channels).length,
    totalUsers: totalUsers,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CB Rádió Szerver</title>
      <style>
        body { font-family: Arial; background: #1a1a1a; color: #fff; padding: 40px; text-align: center; }
        h1 { color: #4CAF50; }
        .status { background: #2a2a2a; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px; }
      </style>
    </head>
    <body>
      <h1>📻 CB Rádió Szerver</h1>
      <div class="status">
        <h2>✅ Szerver működik!</h2>
        <p>WebSocket: <code>wss://${req.get('host')}</code></p>
        <p>Aktív csatornák: ${Object.keys(channels).length}</p>
        <p>Összes felhasználó: ${totalUsers}</p>
      </div>
      <p><a href="/cb-radio-standalone.html" style="color: #4CAF50;">📱 CB Rádió Megnyitása</a></p>
      <p><a href="/test.html" style="color: #4CAF50;">🔧 Teszt Oldal</a></p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   📻 CB RÁDIÓ SZERVER ELINDULT        ║
╠════════════════════════════════════════╣
║   Port: ${PORT}                        
║   Permissions Policy: ENABLED         ║
║   Mikrofon: ENGEDÉLYEZVE              ║
╚════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM - leállás...');
  server.close(() => {
    console.log('👋 Szerver leállt');
    process.exit(0);
  });
});
