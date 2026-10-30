import { io, Socket } from 'socket.io-client';

// Use same host on port 5000 in dev or current origin with proxy
const SOCKET_URL = window.location.port === '5173' ? 'http://localhost:5000' : '/';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
