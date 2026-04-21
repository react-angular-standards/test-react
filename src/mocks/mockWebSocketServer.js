// asit/react-app/src/mocks/mockWebSocketServer.js

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Mock WebSocket server started on ws://localhost:8080');

// Function to generate a more realistic, wave-like data pattern
const generateSineWaveData = (channelId, time) => {
  const amplitude = 50; // Max value deviation from baseline
  const frequency = 0.5; // How many cycles per second
  const baseline = 50;   // The "middle" value
  const value = baseline + amplitude * Math.sin(frequency * 2 * Math.PI * (time / 1000));
  return [channelId, time, value];
};

// Function to generate random noise
const generateRandomData = (channelId, time) => {
    const value = Math.random() * 100; // Random value between 0 and 100
    return [channelId, time, value];
};


wss.on('connection', (ws) => {
  console.log('Client connected');

  // Store the interval ID so we can clear it on disconnection
  let intervalId;

  // Start sending data every 100ms
  intervalId = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        const timestamp = Date.now();

        // Simulate data for 5 different channels
        // The application expects an array of [channelId, timestamp, value]
        const dataPoints = [
            generateSineWaveData(1, timestamp), // Channel 1: Sine wave
            generateRandomData(2, timestamp),   // Channel 2: Random noise
            generateSineWaveData(3, timestamp + 500), // Channel 3: Sine wave, phase shifted
            generateRandomData(4, timestamp),   // Channel 4: Random noise
            generateSineWaveData(5, timestamp - 500), // Channel 5: Sine wave, phase shifted
        ];

        // The front-end seems to process messages one by one.
        // Let's send each data point in its own message.
        dataPoints.forEach(dataPoint => {
             ws.send(JSON.stringify(dataPoint));
        });
    }
  }, 100); // 100ms interval

  ws.on('message', (message) => {
    // The client sends a message with tabUniqueId upon connection.
    // We can log it for debugging but don't need to act on it.
    console.log('Received message from client:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Stop sending data when the client disconnects
    clearInterval(intervalId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(intervalId);
  });
});
