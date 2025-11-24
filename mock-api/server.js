const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load mock data
const dbPath = path.join(__dirname, "db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

// GET /all-test-names
app.get("/all-test-names", (req, res) => {
  res.json(db["all-test-names"]);
});

// POST /config-names
app.post("/config-names", (req, res) => {
  const { TestName } = req.body;

  if (db.configs[TestName]) {
    res.json(db.configs[TestName]);
  } else {
    res.json({ ConfigName: [] });
  }
});

// GET /test-config-details
app.get("/test-config-details", (req, res) => {
  const { TestName, ConfigName } = req.query;
  const key = `${TestName}_${ConfigName}`;

  if (db["test-config-details"][key]) {
    res.json(db["test-config-details"][key]);
  } else {
    res.status(404).json({ error: "Test config details not found" });
  }
});

// POST /filter - Returns filtered data based on request
// Returns data in row-per-channel format: { Timestamp, TestName, ConfigName, Channel, Value }
app.post("/filter", (req, res) => {
  const {
    TestName,
    ConfigName,
    details,
    limit = 10,
    offset = 0,
    startTime,
    endTime,
  } = req.body;

  // Get all channels from the request
  const allChannels = [];
  if (details && details.length > 0) {
    details.forEach((detail) => {
      if (detail.channels) {
        allChannels.push(...detail.channels);
      }
    });
  }

  // Generate mock data - one row per channel per timestamp
  // Total records = timestamps * channels
  const numTimestamps = 50;
  const totalRecords = numTimestamps * Math.max(allChannels.length, 1);

  const allData = [];
  for (let t = 0; t < numTimestamps; t++) {
    const timestamp = new Date(
      Date.now() - (numTimestamps - t) * 60000,
    ).toISOString();
    allChannels.forEach((channel) => {
      allData.push({
        Timestamp: timestamp,
        TestName: TestName,
        ConfigName: ConfigName,
        Channel: channel,
        Value: (Math.random() * 100).toFixed(2),
      });
    });
  }

  // Apply pagination
  const paginatedData = allData.slice(offset, offset + limit);

  res.json({
    data: paginatedData,
    totalCount: totalRecords,
  });
});

// POST /custom-query - Returns custom query results with pagination
app.post("/custom-query", (req, res) => {
  const {
    TestName,
    ConfigName,
    ChannelOperation,
    outputChannelName,
    startTime,
    endTime,
    limit = 10,
    offset = 0,
  } = req.body;

  // Generate mock custom query data
  const totalRecords = 100; // Total mock records available

  // Generate paginated data
  const startIndex = offset;
  const endIndex = Math.min(offset + limit, totalRecords);

  const mockData = [];
  for (let i = startIndex; i < endIndex; i++) {
    mockData.push({
      Timestamp: new Date(
        Date.now() - (totalRecords - i) * 60000,
      ).toISOString(),
      TestName: TestName,
      ConfigName: ConfigName,
      Channel: outputChannelName || "result",
      Value: (Math.random() * 200).toFixed(2),
    });
  }

  res.json({
    data: mockData,
    totalCount: totalRecords,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Mock API Server is running on http://localhost:${PORT}`);
  console.log("\n📋 Available endpoints:");
  console.log("  GET  /all-test-names");
  console.log("  POST /config-names");
  console.log("  GET  /test-config-details");
  console.log("  POST /filter");
  console.log("  POST /custom-query");
  console.log(
    "\n💡 React app should use: REACT_APP_API_URL=http://localhost:3001\n",
  );
});
