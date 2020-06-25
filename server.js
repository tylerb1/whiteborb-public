// Imports
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const history = require('connect-history-api-fallback');
const path = require('path');
const { Pool } = require('pg');

// Server setup
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3000;

app.use(history({
  disableDotRule: false,
  verbose: true
}));
app.use(express.static(path.join(__dirname, '/dist')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/dist/index.html'));
});
server.listen(port);

// Database connection
let pool;
if (process.env.PORT) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  pool = new Pool({
    // Your local database connection info goes here!
    // See https://node-postgres.com/ for details
  });
}

// Socket events
io.on('connection', (socket) => {
  io.emit('got-connected');

  socket.on('disconnect', () => {
    io.emit('got-disconnected');
  });

  socket.on('join-room', async (data) => {
    await socket.join(data.roomName);
    const client = await pool.connect();
    const res = await client.query(`
      SELECT boards.state 
      FROM boards 
      WHERE boards.name = '${data.roomName}';
    `);
    client.release();
    if (res.rows.length > 0 && ("state" in res.rows[0])) {
      io.to(data.roomName).emit('send-board-data', { canvasData: res.rows[0].state });
    }
  });

  socket.on('send-board-data', async (data) => {
    socket.broadcast.to(data.roomName).emit('send-board-data', data);
    const client = await pool.connect();
    await client.query(`
      INSERT INTO boards(state, name, last_updated) 
      VALUES($1, $2, $3) 
      ON CONFLICT (name) DO UPDATE 
      SET state = EXCLUDED.state, last_updated = EXCLUDED.last_updated;
    `, [data.canvasData, data.roomName, new Date()])
    client.release();
  });
});