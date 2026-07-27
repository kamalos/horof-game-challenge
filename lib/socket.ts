import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = () => {
  if (typeof window === 'undefined') return null;
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/socket.io',
      autoConnect: true,
    });
  }
  return socket;
};

export const useSocket = () => {
  const [connected, setConnected] = useState(false);
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = initSocket();
    if (!s) return;
    
    setCurrentSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    if (s.connected) {
      setConnected(true);
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: currentSocket, connected };
};
