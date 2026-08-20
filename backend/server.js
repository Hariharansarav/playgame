// backend/server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import registerSocketHandlers from './handlers/socketHandler.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Serve static assets in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Basic health check route
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', service: 'Rummy Multiplayer Game Server' });
});


const httpServer = createServer(app);

// Initialize Socket.io with open CORS rules for multiplayer local networks
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins dynamically to support local development and hosted clients
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Register handlers
registerSocketHandlers(io);

// Wildcard route to serve index.html for client SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(` Championship Rummy Server running on: http://localhost:${PORT}`);
  console.log(` Accessible on local network at: http://<your-ip>:${PORT}`);
  console.log(`==================================================`);
});
