import { io } from 'socket.io-client';

async function runTest() {
  console.log('Testing Buzzer socket logic...');

  const serverUrl = 'http://localhost:3000';
  const presenterSocket = io(serverUrl, { path: '/socket.io', autoConnect: true });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout to ' + serverUrl)), 5000);
    presenterSocket.on('connect', () => {
      clearTimeout(timeout);
      console.log('✔ Presenter socket connected successfully');
      resolve();
    });
    presenterSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Request state to get active tokens
  let state: any = await new Promise((resolve) => {
    presenterSocket.emit('request-state');
    presenterSocket.on('state-update', (data) => {
      if (data.buzzerState) resolve(data);
    });
  });

  console.log('✔ State received. Red token:', state.buzzerState.tokens.red.substring(0, 8) + '...');
  console.log('✔ Blue token:', state.buzzerState.tokens.blue.substring(0, 8) + '...');

  const redToken = state.buzzerState.tokens.red;
  const blueToken = state.buzzerState.tokens.blue;

  // Test 1: Connect buzzer with invalid token
  const invalidSocket = io(serverUrl, { path: '/socket.io', autoConnect: true });
  await new Promise<void>((resolve) => invalidSocket.on('connect', () => resolve()));
  
  const authResultInvalid: any = await new Promise((resolve) => {
    invalidSocket.emit('buzzer-auth', { team: 'red', token: 'invalid_expired_token_123' });
    invalidSocket.on('buzzer-auth-result', (res) => resolve(res));
  });

  if (!authResultInvalid.valid) {
    console.log('✔ Security check passed: Invalid/old token was rejected properly:', authResultInvalid.message);
  } else {
    throw new Error('Security check FAILED: Invalid token was accepted!');
  }
  invalidSocket.disconnect();

  // Test 2: Connect Team Red with valid token
  const redBuzzerSocket = io(serverUrl, { path: '/socket.io', autoConnect: true });
  await new Promise<void>((resolve) => redBuzzerSocket.on('connect', () => resolve()));

  const authResultRed: any = await new Promise((resolve) => {
    redBuzzerSocket.emit('buzzer-auth', { team: 'red', token: redToken });
    redBuzzerSocket.on('buzzer-auth-result', (res) => resolve(res));
  });

  if (authResultRed.valid) {
    console.log('✔ Team Red buzzer authorized successfully for team:', authResultRed.teamName);
  } else {
    throw new Error('Team Red buzzer auth failed');
  }

  // Test 3: Connect Team Blue with valid token
  const blueBuzzerSocket = io(serverUrl, { path: '/socket.io', autoConnect: true });
  await new Promise<void>((resolve) => blueBuzzerSocket.on('connect', () => resolve()));

  const authResultBlue: any = await new Promise((resolve) => {
    blueBuzzerSocket.emit('buzzer-auth', { team: 'blue', token: blueToken });
    blueBuzzerSocket.on('buzzer-auth-result', (res) => resolve(res));
  });

  if (authResultBlue.valid) {
    console.log('✔ Team Blue buzzer authorized successfully for team:', authResultBlue.teamName);
  } else {
    throw new Error('Team Blue buzzer auth failed');
  }

  // Reset buzzers first so we start clean
  presenterSocket.emit('buzzer-reset');
  await new Promise((r) => setTimeout(r, 100));

  // Test 4: Team Red presses buzzer
  const buzzPromiseRed = new Promise<any>((resolve) => {
    presenterSocket.once('buzzer-buzz', (res) => resolve(res));
  });

  redBuzzerSocket.emit('buzzer-press', { team: 'red', token: redToken });
  const buzzResultRed = await buzzPromiseRed;
  console.log('✔ Team Red buzz registered! Winner:', buzzResultRed.teamName, `(${buzzResultRed.team})`);

  if (buzzResultRed.team !== 'red') {
    throw new Error('Expected Red team to win the buzz');
  }

  // Verify that Blue buzzing now is rejected / ignored because buzzer is locked
  let unexpectedBuzz = false;
  const listener = () => { unexpectedBuzz = true; };
  presenterSocket.on('buzzer-buzz', listener);
  blueBuzzerSocket.emit('buzzer-press', { team: 'blue', token: blueToken });
  await new Promise((r) => setTimeout(r, 150));
  presenterSocket.off('buzzer-buzz', listener);

  if (!unexpectedBuzz) {
    console.log('✔ Lockout verified: Blue buzz was correctly ignored because buzzer was already locked by Red');
  } else {
    throw new Error('Lockout failed: Second buzz was accepted while locked!');
  }

  // Test 5: Presenter resets buzzer
  const resetPromise = new Promise<void>((resolve) => {
    redBuzzerSocket.once('buzzer-reset', () => resolve());
  });
  presenterSocket.emit('buzzer-reset');
  await resetPromise;
  console.log('✔ Buzzers successfully reset by presenter');

  // Test 6: Blue team buzzes after reset
  const blueBuzzPromise = new Promise<any>((resolve) => {
    presenterSocket.once('buzzer-buzz', (res) => resolve(res));
  });
  blueBuzzerSocket.emit('buzzer-press', { team: 'blue', token: blueToken });
  const blueBuzzResult = await blueBuzzPromise;
  console.log('✔ After reset, Team Blue buzzed successfully:', blueBuzzResult.teamName);

  if (blueBuzzResult.team !== 'blue') {
    throw new Error('Expected Blue team to win after reset');
  }

  // Test 7: Regenerate tokens
  const invalidatedPromise = new Promise<void>((resolve) => {
    redBuzzerSocket.once('buzzer-invalidated', () => resolve());
  });
  presenterSocket.emit('buzzer-regenerate');
  await invalidatedPromise;
  console.log('✔ Regenerate test: Connected buzzers received invalidation notification');

  // Test 8: Old red token is now rejected after regeneration
  const authResultOldToken: any = await new Promise((resolve) => {
    redBuzzerSocket.emit('buzzer-auth', { team: 'red', token: redToken });
    redBuzzerSocket.once('buzzer-auth-result', (res) => resolve(res));
  });

  if (!authResultOldToken.valid) {
    console.log('✔ Regenerated token security verified: Old token rejected after regeneration');
  } else {
    throw new Error('Security check FAILED: Old token still accepted after regeneration!');
  }

  // Disconnect sockets
  presenterSocket.disconnect();
  redBuzzerSocket.disconnect();
  blueBuzzerSocket.disconnect();

  console.log('\n=========================================');
  console.log(' ALL BUZZER TESTS PASSED SUCCESSFULLY! 🚀');
  console.log('=========================================');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
