import { createServer } from 'http';
import { parse } from 'url';
import { networkInterfaces } from 'os';
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
  return results;
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Game State in Memory
let hexOwnership: Record<string, Team | null> = {};
let hexLetters = getRandomLetters();
let activeHexId: string | null = null;
let jokerStatus = { red: true, blue: true };
let teamNames = { red: 'Team ORANGE', blue: 'Team GREEN' };
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
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      const { pathname, query } = parsedUrl;

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
      });
      if (winner) {
        socket.emit('show-winner', { team: winner, winningPath });
      }
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
      io.emit('game-reset');
      io.emit('state-update', {
        hexOwnership,
        hexLetters,
        activeHexId,
        jokerStatus,
        teamNames,
        winner,
        winningPath,
      });
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
