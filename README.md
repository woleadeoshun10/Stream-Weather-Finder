<<<<<<< HEAD
# Twitch Streams & Weather Mashup

A Node.js web application that combines Twitch live streams with real-time weather data. Search for any game on Twitch and see the top 5 live streams alongside current weather conditions for any city.

## Project Information

**Course:** CSCI 355 (Saturday)  
**Instructor:** Raymond Law  
**Student:** Adewole Adeoshun  
**Student ID:** 24081306  
**Semester:** Fall 2025

## Features

- Search for live Twitch streams by game name
- Display current weather for any city
- Show only LIVE streams (not offline channels)
- Temperature displayed in both Celsius and Fahrenheit
- Real-time weather icons from OpenWeatherMap
- Clickable links to watch streams directly on Twitch
- OAuth 2.0 Client Credentials authentication with token caching
- Synchronous API execution (weather called inside Twitch callback)

## APIs Used

1. **Twitch API** (OAuth 2.0 Client Credentials)
   - OAuth endpoint: https://id.twitch.tv/oauth2/token
   - Game search: https://api.twitch.tv/helix/search/categories
   - Live streams: https://api.twitch.tv/helix/streams

2. **OpenWeatherMap API** (API Key)
   - Weather endpoint: https://api.openweathermap.org/data/2.5/weather

## Prerequisites

- Node.js (v14 or higher)
- Twitch Developer Account
- OpenWeatherMap Account

## Setup Instructions

### 1. Get API Credentials

**Twitch API:**
1. Visit https://dev.twitch.tv/console
2. Create a new application
3. Copy your Client ID and Client Secret

**OpenWeatherMap API:**
1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Copy your API Key

### 2. Configure Credentials

Create the file auth/credentials.json with your API credentials.

### 3. Run the Server

Run: node server.js

You should see: Now Listening on Port 3000

### 4. Access the Application

Open your browser and visit: http://localhost:3000

## Usage

1. Enter a game name (e.g., "League of Legends", "Valorant", "Minecraft")
2. Enter a city name (e.g., "Seoul", "Tokyo", "New York")
3. Click "Search Streams & Weather"
4. View the top 5 live streams and current weather conditions
5. Click on any stream to watch it on Twitch

## Project Structure

CS355-FP-24081306/
- server.js (Main server file)
- html/index.html (Home page form)
- cache/ (OAuth token cache, auto-created)
- auth/credentials.json (API credentials, YOU CREATE THIS)
- README.md (This file)

## How It Works

### Synchronous API Execution

Synchronous execution is guaranteed by calling the weather API inside the Twitch API callback.

### Caching Strategy

- **Twitch OAuth Token:** Cached for 1 hour in ./cache/twitch-token.json
- **Stream Data:** NOT cached (changes too frequently)
- **Weather Data:** NOT cached (conditions change rapidly)

### Error Handling

The application handles:
- Invalid game names
- Invalid city names
- Network errors
- Empty search results
- OAuth failures
- Malformed API responses

## Technical Requirements Met

- Uses only Node.js core modules (fs, http, https)
- OAuth 2.0 Client Credentials authentication
- Synchronous API execution
- Callback pattern (no async/await)
- Token caching (1 hour)
- Error handling and validation
- Multiple requests without server restart
- Resilient to unexpected input (returns 404 where appropriate)

## Troubleshooting

**Server won't start**
- Check that port 3000 is not already in use
- Verify credentials.json exists and has correct format

**Authentication Error**
- Verify Twitch credentials are correct
- Check that credentials.json is properly formatted

**City Not Found**
- Check spelling of city name
- Try major cities (e.g., "Seoul", "Tokyo", "London")

**Game Not Found**
- Check spelling of game name
- Try popular games (e.g., "League of Legends", "Valorant")

**No Live Streams Found**
- The game has no current live streams
- Try a more popular game or try again later

## Notes

- The application only shows LIVE streams (not offline channels)
- Twitch token is cached for 1 hour to optimize performance
- Weather data includes real-time icons from OpenWeatherMap
- All temperatures displayed in both Celsius and Fahrenheit

## License

This project is for educational purposes as part of CSCI 355 coursework.
=======
# Stream-Weather-Finder
CSCI 355 Final Project – Synchronous API mashup using Twitch and OpenWeatherMap
>>>>>>> 603184e45e928c783d80a9477d3eb4f5e6da8444
