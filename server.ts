import { createServer } from 'http';
import { parse } from 'url';
import { networkInterfaces } from 'os';
import { randomBytes } from 'crypto';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { getRandomLetters, Language } from './lib/hexLayout';
import { checkWin, Team } from './lib/winDetection';
import { getQuestions, addQuestion, updateQuestion, deleteQuestion } from './lib/questions';

function getLocalIPs(): { ip: string, name: string }[] {
  const nets = networkInterfaces();
  const results: { ip: string, name: string }[] = [];
  for (const [name, iface] of Object.entries(nets)) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ ip: net.address, name });
      }
    }
  }

  // Prioritize physical Wi-Fi / WLAN adapters first, then physical Ethernet, and deprioritize virtual/hyper-v adapters
  results.sort((a, b) => {
    const isVirtualA = /vethernet|vmware|vmnet|virtual|loopback|pseudo/i.test(a.name);
    const isVirtualB = /vethernet|vmware|vmnet|virtual|loopback|pseudo/i.test(b.name);
    const isWifiA = /wi-?fi|wlan|wireless/i.test(a.name) && !isVirtualA;
    const isWifiB = /wi-?fi|wlan|wireless/i.test(b.name) && !isVirtualB;
    const isEthA = /eth|lan/i.test(a.name) && !isVirtualA;
    const isEthB = /eth|lan/i.test(b.name) && !isVirtualB;

    if (isWifiA && !isWifiB) return -1;
    if (!isWifiA && isWifiB) return 1;
    if (isEthA && !isEthB) return -1;
    if (!isEthA && isEthB) return 1;
    if (!isVirtualA && isVirtualB) return -1;
    if (isVirtualA && !isVirtualB) return 1;
    return 0;
  });

  return results;
}

function generateSecureToken(): string {
  return randomBytes(16).toString('hex');
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Buzzer State
interface BuzzerState {
  enabled: boolean;
  buzzedTeam: Team | null;
  buzzedAt: number | null;
  tokens: { red: string; blue: string };
  connectedDevices: { red: boolean; blue: boolean };
}

let buzzerState: BuzzerState = {
  enabled: true,
  buzzedTeam: null,
  buzzedAt: null,
  tokens: {
    red: generateSecureToken(),
    blue: generateSecureToken(),
  },
  connectedDevices: {
    red: false,
    blue: false,
  },
};

function regenerateBuzzerTokens() {
  buzzerState.tokens = {
    red: generateSecureToken(),
    blue: generateSecureToken(),
  };
  buzzerState.buzzedTeam = null;
  buzzerState.buzzedAt = null;
  buzzerState.enabled = true;
  buzzerState.connectedDevices = {
    red: false,
    blue: false,
  };
}

// Game State in Memory
let hexOwnership: Record<string, Team | null> = {};
let hexLetters = getRandomLetters();
let activeHexId: string | null = null;
let jokerStatus = { red: true, blue: true };
let teamNames = { red: 'Team RED', blue: 'Team BLUE' };
let winner: Team | null = null;
let winningPath: string[] = [];
let language: Language = 'ar';
let showSplash = false;

function resetGameState() {
  hexOwnership = {};
  hexLetters = getRandomLetters(language);
  activeHexId = null;
  jokerStatus = { red: true, blue: true };
  winner = null;
  winningPath = [];
  regenerateBuzzerTokens();
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      const { pathname, query } = parsedUrl;

      // Network IPs endpoint for QR code host configuration
      if (pathname === '/api/network-ips' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(getLocalIPs()));
        return;
      }

      // Simple REST API Routing
      if (pathname === '/api/questions') {
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET') {
          let questions = getQuestions();
          if (query.letter) {
            const queryLetter = query.letter as string;
            questions = questions.filter((q) =>
              q.letter.toLowerCase() === queryLetter.toLowerCase() ||
              q.letter === queryLetter
            );
          }
          if (query.category) {
            questions = questions.filter((q) => q.category.toLowerCase() === (query.category as string).toLowerCase());
          }
          res.statusCode = 200;
          res.end(JSON.stringify(questions));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            const newQ = JSON.parse(body);
            const added = addQuestion(newQ);
            res.statusCode = 201;
            res.end(JSON.stringify(added));
          });
          return;
        }
      }

      if (pathname?.startsWith('/api/questions/') && req.method === 'PUT') {
        const id = pathname.split('/').pop()!;
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          const updatedData = JSON.parse(body);
          const updated = updateQuestion(id, updatedData);
          if (updated) {
            res.statusCode = 200;
            res.end(JSON.stringify(updated));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        });
        return;
      }

      if (pathname?.startsWith('/api/questions/') && req.method === 'DELETE') {
        const id = pathname.split('/').pop()!;
        const success = deleteQuestion(id);
        res.setHeader('Content-Type', 'application/json');
        if (success) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
        return;
      }

      // Default Next.js request handler
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    // Send initial state to newly connected client
    socket.on('request-state', () => {
      socket.emit('state-update', {
        hexOwnership,
        hexLetters,
        activeHexId,
        jokerStatus,
        teamNames,
        winner,
        winningPath,
        language,
        showSplash,
        buzzerState,
        localIPs: getLocalIPs(),
      });
      if (winner) {
        socket.emit('show-winner', { team: winner, winningPath });
      }
    });

    // Buzzer Authentication for mobile client
    socket.on('buzzer-auth', ({ team, token }: { team: Team; token: string }) => {
      const isValid = (team === 'red' || team === 'blue') && buzzerState.tokens[team] === token;
      if (!isValid) {
        socket.emit('buzzer-auth-result', {
          valid: false,
          message: 'This QR code is expired or invalid for this game session. Please scan the latest QR code from the presenter screen.',
        });
        return;
      }

      socket.data.team = team;
      socket.data.token = token;
      socket.join(`buzzer-${team}`);
      buzzerState.connectedDevices[team] = true;

      socket.emit('buzzer-auth-result', {
        valid: true,
        team,
        teamName: teamNames[team],
        buzzerState: {
          enabled: buzzerState.enabled,
          buzzedTeam: buzzerState.buzzedTeam,
          buzzedAt: buzzerState.buzzedAt,
        },
      });

      // Broadcast device connection status to presenter & board
      io.emit('buzzer-device-status', buzzerState.connectedDevices);
      io.emit('state-update', { buzzerState });
    });

    // Buzzer Press event from mobile client
    socket.on('buzzer-press', ({ team, token }: { team: Team; token: string }) => {
      // Validate credentials
      if (!team || buzzerState.tokens[team] !== token) {
        socket.emit('buzzer-error', { message: 'Invalid or expired token.' });
        return;
      }

      // Check if buzzers are enabled and not already buzzed
      if (!buzzerState.enabled || buzzerState.buzzedTeam !== null) {
        return;
      }

      // First valid buzz locks the buzzer
      buzzerState.buzzedTeam = team;
      buzzerState.buzzedAt = Date.now();
      buzzerState.enabled = false;

      // Broadcast buzz event to everyone
      io.emit('buzzer-buzz', {
        team,
        teamName: teamNames[team],
        timestamp: buzzerState.buzzedAt,
      });

      io.emit('buzzer-update', {
        enabled: buzzerState.enabled,
        buzzedTeam: buzzerState.buzzedTeam,
        buzzedAt: buzzerState.buzzedAt,
      });

      io.emit('state-update', { buzzerState });
    });

    // Presenter resets the buzzers
    socket.on('buzzer-reset', () => {
      buzzerState.buzzedTeam = null;
      buzzerState.buzzedAt = null;
      buzzerState.enabled = true;

      io.emit('buzzer-update', {
        enabled: buzzerState.enabled,
        buzzedTeam: null,
        buzzedAt: null,
      });
      io.emit('buzzer-reset');
      io.emit('state-update', { buzzerState });
    });

    // Presenter toggles buzzer lock
    socket.on('buzzer-toggle-lock', (forceState?: boolean) => {
      buzzerState.enabled = forceState !== undefined ? forceState : !buzzerState.enabled;
      io.emit('buzzer-update', {
        enabled: buzzerState.enabled,
        buzzedTeam: buzzerState.buzzedTeam,
        buzzedAt: buzzerState.buzzedAt,
      });
      io.emit('state-update', { buzzerState });
    });

    // Presenter regenerates buzzer QR tokens for a new game or security refresh
    socket.on('buzzer-regenerate', () => {
      regenerateBuzzerTokens();
      // Notify all connected buzzers that old tokens are now invalid
      io.emit('buzzer-invalidated');
      io.emit('buzzer-tokens-updated', buzzerState.tokens);
      io.emit('buzzer-device-status', buzzerState.connectedDevices);
      io.emit('buzzer-update', {
        enabled: buzzerState.enabled,
        buzzedTeam: null,
        buzzedAt: null,
      });
      io.emit('state-update', { buzzerState });
    });

    socket.on('hex-claimed', ({ hexId, team }: { hexId: string; team: Team }) => {
      if (!winner) {
        hexOwnership[hexId] = team;
        activeHexId = null;

        const winResult = checkWin(hexOwnership);
        if (winResult.winner) {
          winner = winResult.winner;
          winningPath = winResult.path;
          io.emit('show-winner', { team: winner, winningPath });
        }

        io.emit('state-update', { hexOwnership, activeHexId, winner, winningPath });
      }
    });

    socket.on('hex-unclaimed', ({ hexId }: { hexId: string }) => {
      if (!winner && hexOwnership[hexId]) {
        hexOwnership[hexId] = null;
        activeHexId = null;
        io.emit('state-update', { hexOwnership, activeHexId });
      }
    });

    socket.on('active-hex', ({ hexId }: { hexId: string | null }) => {
      activeHexId = hexId;
      io.emit('state-update', { activeHexId });
    });

    socket.on('joker-used', ({ team }: { team: Team }) => {
      if (jokerStatus[team]) {
        jokerStatus[team] = false;
        io.emit('state-update', { jokerStatus });
      }
    });

    socket.on('joker-restore', ({ team }: { team: Team }) => {
      jokerStatus[team] = true;
      io.emit('state-update', { jokerStatus });
    });

    socket.on('update-team-names', (names: { red: string; blue: string }) => {
      teamNames = names;
      io.emit('state-update', { teamNames });
    });

    socket.on('toggle-splash', (splashState?: boolean) => {
      showSplash = splashState !== undefined ? splashState : !showSplash;
      io.emit('state-update', { showSplash });
    });

    socket.on('set-language', ({ lang }: { lang: Language }) => {
      language = lang;
      hexLetters = getRandomLetters(language);
      io.emit('state-update', { language, hexLetters });
    });

    socket.on('game-reset', (options?: { keepLetters: boolean }) => {
      const oldLetters = hexLetters;
      resetGameState();
      if (options?.keepLetters) {
        hexLetters = oldLetters;
      }
      // Broadcast that previous buzzer sessions are invalidated for the new game
      io.emit('buzzer-invalidated');
      io.emit('game-reset');
      io.emit('state-update', {
        hexOwnership,
        hexLetters,
        activeHexId,
        jokerStatus,
        teamNames,
        winner,
        winningPath,
        buzzerState,
        localIPs: getLocalIPs(),
      });
    });

    socket.on('disconnect', () => {
      const team = socket.data?.team as Team | undefined;
      if (team && (team === 'red' || team === 'blue')) {
        const room = io.sockets.adapter.rooms.get(`buzzer-${team}`);
        if (!room || room.size === 0) {
          buzzerState.connectedDevices[team] = false;
          io.emit('buzzer-device-status', buzzerState.connectedDevices);
          io.emit('state-update', { buzzerState });
        }
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0';
  server.listen(Number(PORT), HOST, () => {
    const localIPs = getLocalIPs();
    console.log('');
    console.log('   \x1b[1m\x1b[32m✔ Beehive Game is running!\x1b[0m');
    console.log('');
    console.log(`   \x1b[36mLocal:    \x1b[0mhttp://localhost:${PORT}`);
    if (localIPs.length > 0) {
      localIPs.forEach(({ ip, name }) => {
        console.log(`   \x1b[36mNetwork:  \x1b[0mhttp://${ip}:${PORT}   \x1b[33m← ${name}\x1b[0m`);
      });
    } else {
      console.log(`   \x1b[36mNetwork:  \x1b[0munknown`);
    }
    console.log('');
  });
});
