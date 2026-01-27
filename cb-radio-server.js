// CB Rádió Szerver v2.0 - Jelszavas Csatornák
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=*, camera=*');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

app.use(express.static('.'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, perMessageDeflate: false, clientTracking: true });

// Csatorna tárolás - jelszavakkal
const channels = {}; // { channelId: { users: [], password: 'hash', isPrivate: bool } }
const channelPasswords = {}; // { channelId: 'passwordHash' }

// Jelszó hash függvény
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

wss.on('connection', (ws, req) => {
  let currentChannel = null;
  let userId = generateId();
  
  console.log(`✅ User connected: ${userId}`);
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'create-private-channel':
          handleCreatePrivateChannel(ws, data.channel, data.password, userId);
          break;
          
        case 'join-channel':
          handleJoinChannel(ws, data.channel, userId, data.password);
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
          
        case 'check-channel':
          handleCheckChannel(ws, data.channel);
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
  
  function handleCreatePrivateChannel(ws, channelId, password, userId) {
    // Ellenőrzés: már létezik a csatorna?
    if (channels[channelId]) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'A csatorna már létezik!'
      }));
      return;
    }
    
    // Privát csatorna létrehozása
    const passwordHash = hashPassword(password);
    channelPasswords[channelId] = passwordHash;
    
    channels[channelId] = {
      users: [],
      isPrivate: true,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    
    console.log(`🔒 Privát csatorna létrehozva: ${channelId} by ${userId}`);
    
    // Automatikusan csatlakozás
    handleJoinChannel(ws, channelId, userId, password);
    
    ws.send(JSON.stringify({
      type: 'channel-created',
      channelId: channelId
    }));
  }
  
  function handleCheckChannel(ws, channelId) {
    const isPrivate = channelPasswords[channelId] ? true : false;
    const exists = channels[channelId] ? true : false;
    
    ws.send(JSON.stringify({
      type: 'channel-info',
      channelId: channelId,
      isPrivate: isPrivate,
      exists: exists,
      userCount: exists ? channels[channelId].users.length : 0
    }));
  }
  
  function handleJoinChannel(ws, channelId, userId, password = null) {
    // Kilépés az előző csatornából
    if (currentChannel) {
      handleLeaveChannel(ws, currentChannel, userId);
    }
    
    // Ellenőrzés: privát csatorna?
    if (channelPasswords[channelId]) {
      const passwordHash = password ? hashPassword(password) : null;
      
      if (passwordHash !== channelPasswords[channelId]) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Hibás jelszó!',
          errorCode: 'WRONG_PASSWORD'
        }));
        return;
      }
    }
    
    // Csatorna létrehozása ha nem létezik (nyilvános)
    if (!channels[channelId]) {
      channels[channelId] = {
        users: [],
        isPrivate: false
      };
    }
    
    // Felhasználó hozzáadása
    channels[channelId].users.push({ ws, userId });
    currentChannel = channelId;
    
    const peers = channels[channelId].users
      .filter(client => client.userId !== userId)
      .map(client => client.userId);
    
    ws.send(JSON.stringify({
      type: 'channel-joined',
      channelId,
      userId,
      peers,
      isPrivate: channels[channelId].isPrivate
    }));
    
    broadcastToChannel(channelId, {
      type: 'peer-joined',
      userId
    }, userId);
    
    console.log(`📻 ${userId} → Ch${channelId} (${channels[channelId].users.length} users, private: ${channels[channelId].isPrivate})`);
  }
  
  function handleLeaveChannel(ws, channelId, userId) {
    if (!channelId || !channels[channelId]) return;
    
    channels[channelId].users = channels[channelId].users.filter(
      client => client.userId !== userId
    );
    
    if (channels[channelId].users.length === 0) {
      // Privát csatorna törlése ha üres
      if (channels[channelId].isPrivate) {
        delete channelPasswords[channelId];
        console.log(`🗑️ Privát csatorna törölve: ${channelId}`);
      }
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
    
    channels[channelId].users.forEach(client => {
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

// API Endpoints
app.get('/health', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.users.length, 0);
  const privateChannels = Object.values(channels).filter(ch => ch.isPrivate).length;
  
  res.json({ 
    status: 'ok',
    channels: Object.keys(channels).length,
    privateChannels: privateChannels,
    totalUsers: totalUsers,
    version: '2.0'
  });
});

app.get('/channels', (req, res) => {
  const channelList = Object.keys(channels).map(id => ({
    id: parseInt(id),
    userCount: channels[id].users.length,
    isPrivate: channels[id].isPrivate
  }));
  
  res.json({ channels: channelList });
});

app.get('/', (req, res) => {
  const totalUsers = Object.values(channels).reduce((sum, ch) => sum + ch.users.length, 0);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>CB Radio Server v2.0</title>
    <style>body{font-family:Arial;background:#1a1a1a;color:#fff;padding:40px;text-align:center}h1{color:#4CAF50}.box{background:#2a2a2a;padding:20px;border-radius:8px;display:inline-block;margin:20px}.new{color:#FFD700}</style>
    </head>
    <body>
      <h1>📻 CB Radio Server v2.0</h1>
      <div class="box">
        <h2>✅ Server Online</h2>
        <p>WebSocket: <code>wss://${req.get('host')}</code></p>
        <p>Channels: ${Object.keys(channels).length}</p>
        <p>Users: ${totalUsers}</p>
        <p class="new">🔒 Private Channels: Enabled!</p>
      </div>
      <p><a href="/cb-radio-standalone.html" style="color:#4CAF50">📱 Open CB Radio</a></p>
      <p><a href="/channels" style="color:#4CAF50">📊 View Channels (API)</a></p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════╗
║  📻 CB RADIO SERVER v2.0     ║
║  🔒 Private Channels: ON     ║
║  Port: ${PORT}               ║
╚══════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
