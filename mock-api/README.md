# Mock API Server

This mock API server provides test data for the Historical Data application.

## Setup

The mock API server is already installed with the project dependencies.

## Running the Mock API Server

1. Start the mock API server:
   ```bash
   npm run mock-api
   ```

   The server will run on `http://localhost:3001`

2. In a separate terminal, start the React app:
   ```bash
   npm start
   ```

   The React app will run on `http://localhost:3000` and connect to the mock API.

## Available Endpoints

- `GET /all-test-names` - Returns all test names
- `POST /config-names` - Returns config names for a test
  ```json
  { "TestName": "Battery_Test_01" }
  ```
- `GET /test-config-details?TestName=Battery_Test_01&ConfigName=Config_A` - Returns test configuration details
- `POST /filter` - Returns filtered data
  ```json
  {
    "TestName": "Battery_Test_01",
    "ConfigName": "Config_A",
    "details": [
      {
        "cardType": "Voltage",
        "channels": [1, 2, 3, 4]
      }
    ],
    "limit": 10,
    "offset": 0
  }
  ```
- `POST /custom-query` - Returns custom query results
  ```json
  {
    "TestName": "Battery_Test_01",
    "ConfigName": "Config_A",
    "ChannelOperation": "1 + 2",
    "outputChannelName": "Sum_Ch1_Ch2"
  }
  ```

## Test Data

The mock server includes the following test data:

### Tests
- Battery_Test_01 (Configs: Config_A, Config_B, Config_C)
- Battery_Test_02 (Configs: Config_X, Config_Y)
- Motor_Performance_Test (Configs: Standard, High_Load)
- Sensor_Calibration_Test (Configs: Default, Precision)

### Channel Types
- Voltage channels: 1-5
- Current channels: 5-8
- Temperature channels: 9-12, 25-27
- RPM channels: 15-16
- Torque channels: 20-21

## Modifying Test Data

Edit `mock-api/db.json` to add or modify test data. The server will automatically use the updated data.

## Environment Configuration

The React app uses the `.env.development` file to point to the mock API:
```
REACT_APP_API_URL=http://localhost:3001
```

For production, create a `.env.production` file with your actual API URL.
