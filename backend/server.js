// backend/server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import registerSocketHandlers from './handlers/socketHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*', // Allow all origins for play across different local systems
}));

app.use(express.json());

// Basic health check route
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', service: 'Rummy Multiplayer Game Server' });
});

const httpServer = createServer(app);

// Initialize Socket.io with open CORS rules for multiplayer local networks
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

// Register handlers
registerSocketHandlers(io);

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(` Championship Rummy Server running on: http://localhost:${PORT}`);
  console.log(` Accessible on local network at: http://<your-ip>:${PORT}`);
  console.log(`==================================================`);
});
