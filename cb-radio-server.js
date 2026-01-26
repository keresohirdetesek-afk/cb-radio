// WebRTC Szignalizációs Szerver CB Rádióhoz
// Telepítendő csomagok: npm install ws express cors

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('.'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Csatornák és felhasználók nyilvántartása
const channels = {}; // { channelId: [clients] }

wss.on('connection', (ws) => {
  let currentChannel = null;
  let userId = generateId();
  
  console.log(`Új felhasználó csatlakozott: ${userId}`);
  
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
          // WebRTC szignalizáció továbbítása
          broadcastToChannel(currentChannel, data, userId);
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
      console.error('Üzenet feldolgozási hiba:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`Felhasználó kilépett: ${userId}`);
    handleLeaveChannel(ws, currentChannel, userId);
  });
  
  function handleJoinChannel(ws, channelId, userId) {
    // Kilépés az előző csatornából
    if (currentChannel) {
      handleLeaveChannel(ws, currentChannel, userId);
    }
    
    // Csatlakozás az új csatornához
    if (!channels[channelId]) {
      channels[channelId] = [];
    }
    
    channels[channelId].push({ ws, userId });
    currentChannel = channelId;
    
    // Tájékoztatás a többi felhasználóról
    const peers = channels[channelId]
      .filter(client => client.userId !== userId)
      .map(client => client.userId);
    
    ws.send(JSON.stringify({
      type: 'channel-joined',
      channelId,
      userId,
      peers
    }));
    
    // Értesítés a többieknek az új felhasználóról
    broadcastToChannel(channelId, {
      type: 'peer-joined',
      userId
    }, userId);
    
    console.log(`${userId} csatlakozott a ${channelId}. csatornához`);
  }
  
  function handleLeaveChannel(ws, channelId, userId) {
    if (!channelId || !channels[channelId]) return;
    
    channels[channelId] = channels[channelId].filter(
      client => client.userId !== userId
    );
    
    // Csatorna törlése ha üres
    if (channels[channelId].length === 0) {
      delete channels[channelId];
    } else {
      // Értesítés a többieknek
      broadcastToChannel(channelId, {
        type: 'peer-left',
        userId
      }, userId);
    }
    
    console.log(`${userId} kilépett a ${channelId}. csatornából`);
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

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    channels: Object.keys(channels).length,
    totalUsers: Object.values(channels).reduce((sum, ch) => sum + ch.length, 0)
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CB Rádió szerver fut a ${PORT} porton`);
});
