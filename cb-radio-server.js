const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();

// CORS - Mindent engedélyez
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// PERMISSIONS POLICY - TELJES ENGEDÉLY
app.use((req, res, next) => {
    // Permissions-Policy - Modern browsers
    res.setHeader('Permissions-Policy', 'microphone=*, camera=*, geolocation=*');
    // Access-Control headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Statikus fájlok
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
  
  console.log(`✅ User: ${userId}`);
  
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
      console.error('Message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`Bye: ${userId}`);
    handleLeaveChannel(ws, currentChannel, userId);
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
    
    console.log(`Ch${channelId}: ${userId} (${channels[channelId].length} users)`);
  }
  
  function handleLeaveChannel(ws, channelId, userId) {
    if (!channelId || !channels[channelId]) return;
    
    channels[channelId] = channels[channelId].filter(
      client => client.userId !== userId
    );
    
    if (channels[channelId].length === 0) {
      delete channels[channelId];
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
    
    channels[channelId].forEach(client => {
      if (client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

app.get('/health', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  res.json({ 
    status: 'ok',
    channels: Object.keys(channels).length,
    totalUsers: totalUsers
  });
});

app.get('/', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.length, 0);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>CB Radio Server</title>
    <style>body{font-family:Arial;background:#1a1a1a;color:#fff;padding:40px;text-align:center}h1{color:#4CAF50}.box{background:#2a2a2a;padding:20px;border-radius:8px;display:inline-block;margin:20px}</style>
    </head>
    <body>
      <h1>📻 CB Radio Server</h1>
      <div class="box">
        <h2>✅ Server Online</h2>
        <p>WebSocket: <code>wss://${req.get('host')}</code></p>
        <p>Channels: ${Object.keys(channels).length}</p>
        <p>Users: ${totalUsers}</p>
      </div>
      <p><a href="/cb-radio-standalone.html" style="color:#4CAF50">📱 Open CB Radio</a></p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════╗
║  📻 CB RADIO SERVER         ║
║  Port: ${PORT}              ║
║  Permissions: FULL ACCESS   ║
╚══════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
