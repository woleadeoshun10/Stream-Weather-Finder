/*
Project
*/

const fs = require("fs"); // file system module
const http = require("http"); // http module - to create web server
const https = require("https"); // https module - to make requets to external APIs

// Load my API credentials from the credentials file
const credentials = require("./auth/credentials.json");
const twitch_client_id =
  process.env.TWITCH_CLIENT_ID || credentials.twitch.client_id;
const twitch_client_secret =
  process.env.TWITCH_CLIENT_SECRET || credentials.twitch.client_secret;
const weather_api_key =
  process.env.WEATHER_API_KEY || credentials.openweathermap.api_key;

// Server configuration
const host = "localhost";
const port = process.env.PORT || 3000;

// Set up cache directory for storing tokens
const cache_dir = "./cache";
if (!fs.existsSync(cache_dir)) {
  fs.mkdirSync(cache_dir); // check if cache folder exits, otherwise its created
}

// Create the HTTP server
const server = http.createServer();

server.on("listening", listen_handler);
server.listen(port);

function listen_handler() {
  console.log(`Now Listening on Port ${port}`);
}

// Main request handler - routes all incoming requests
server.on("request", request_handler);

function request_handler(req, res) {
  console.log(`New Request from ${req.socket.remoteAddress} for ${req.url}`);

  //Route 1: Home page - serve the user the  HTML form
  if (req.url === "/") {
    const form = fs.createReadStream("html/index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    form.pipe(res);
  }
  // Route 2: Search endpoint for handling form submission
  else if (req.url.startsWith("/search")) {
    handle_search(req, res);
  }
  // Route 3: Everything else gets 404 response
  else {
    not_found(res);
  }
}

// Handle the search request from the user
function handle_search(req, res) {
  // extract the query parameters (game and city)
  const user_input = new URL(req.url, `https://${req.headers.host}`)
    .searchParams;
  const game = user_input.get("game");
  const city = user_input.get("city");

  // verify that both inputs exist and aren't empty
  if (!game || game === "" || !city || city === "") {
    not_found(res);
    return;
  }

  console.log(`Searching for game: ${game}, city: ${city}`);

  //get Twitch token first, then search streams
  get_twitch_token((access_token) => {
    search_twitch_game(game, access_token, city, res);
  });
}

// respond with a 404 response
function not_found(res) {
  res.writeHead(404, { "Content-Type": "text/html" });
  res.end(`<h1>404 Not Found</h1><p><a href="/">Go back home</a></p>`);
}

// Helper function to read data from response streams
function process_stream(stream, callback, ...args) {
  let body = "";
  stream.on("data", (chunk) => (body += chunk));
  stream.on("end", () => callback(body, ...args));
}

// STEP 1: Get Twitch OAuth token using Client Credentials flow
function get_twitch_token(callback) {
  const cache_file = `${cache_dir}/twitch-token.json`;

  // Check if I already have a cached token
  if (fs.existsSync(cache_file)) {
    const cache = JSON.parse(fs.readFileSync(cache_file));
    const age = Date.now() - cache.timestamp;
    const one_hour = 60 * 60 * 1000;

    // If the cached token is less than 1 hour old, use it
    if (age < one_hour) {
      console.log("Using cached Twitch token");
      callback(cache.access_token);
      return;
    }
  }

  // if there is no valid cache request a new token from Twitch
  console.log("Getting new Twitch token...");

  const token_endpoint = "https://id.twitch.tv/oauth2/token";

  // use the POST method to get token with my credentials on twitch token endpoint
  const post_data = new URLSearchParams({
    client_id: twitch_client_id,
    client_secret: twitch_client_secret,
    grant_type: "client_credentials",
  }).toString();

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  // make the request to Twitch's OAuth endpoint
  const token_request = https.request(token_endpoint, options);

  // handle network errors that may occur when the post request is made
  token_request.on("error", (error) => {
    console.error("Twitch token request failed:", error);
    callback(null);
  });

  token_request.on("response", (stream) =>
    process_stream(stream, receive_twitch_token, callback)
  );
  token_request.end(post_data); // send the OAuth POST request with credentials
}

// handle the OAuth token response from Twitch
function receive_twitch_token(body, callback) {
  try {
    const token_data = JSON.parse(body);

    // check if we actually got a token ,twitch returns error if credentials are wrong
    if (!token_data.access_token) {
      console.error("Twitch token error:", token_data);
      callback(null);
      return;
    }

    const access_token = token_data.access_token;

    // save the token to cache so I don't have to request it again for 1 hour
    const cache_file = `${cache_dir}/twitch-token.json`;
    fs.writeFileSync(
      cache_file,
      JSON.stringify({
        access_token: access_token,
        timestamp: Date.now(),
      })
    );

    console.log("Twitch token received and cached");
    callback(access_token);
  } catch (error) {
    console.error("Error parsing Twitch token response:", error);
    callback(null);
  }
}

// STEP 2a: search for the game by name to get its game_id
function search_twitch_game(game, access_token, city, res) {
  // check if we got a valid token
  if (!access_token) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Authentication Error</h1>
            <p>Could not authenticate with Twitch. Please try again later.</p>
            <p><a href="/">Go back home</a></p>
        `);
    return;
  }

  const game_search_endpoint = `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(
    game
  )}`;

  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Client-Id": twitch_client_id,
    },
  };

  console.log("Searching for game on Twitch...");

  const game_request = https.request(game_search_endpoint, options);

  // handle network errors
  game_request.on("error", (error) => {
    console.error("Twitch game search failed:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Search Error</h1>
            <p>Could not search Twitch. Please try again.</p>
            <p><a href="/">Go back home</a></p>
        `);
  });

  game_request.on("response", (stream) =>
    process_stream(stream, receive_game_info, access_token, city, res, game)
  );
  game_request.end();
}

// STEP 2b: process the game search results
function receive_game_info(body, access_token, city, res, game_name) {
  try {
    const game_data = JSON.parse(body);
    const games = game_data.data || [];

    // check if we found the game
    if (games.length === 0) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
                <h1>Game Not Found</h1>
                <p>Couldn't find "${game_name}" on Twitch.</p>
                <p>Please check the spelling and try again.</p>
                <p><a href="/">Go back home</a></p>
            `);
      return;
    }

    // get the first matching game's ID
    const game_id = games[0].id;
    console.log(`Found game: ${games[0].name} (ID: ${game_id})`);

    // now search for LIVE streams of this game
    get_live_streams(game_id, access_token, city, res);
  } catch (error) {
    console.error("Error parsing game search results:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Error</h1>
            <p>Something went wrong while searching for the game.</p>
            <p><a href="/">Go back home</a></p>
        `);
  }
}

// STEP 2c: i want to  search for LIVE streams of the game searched
function get_live_streams(game_id, access_token, city, res) {
  // get up to 20 live streams for this game
  const streams_endpoint = `https://api.twitch.tv/helix/streams?game_id=${game_id}&first=20`;

  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Client-Id": twitch_client_id,
    },
  };

  console.log("Getting live streams...");

  const streams_request = https.request(streams_endpoint, options);
  // handle network errors
  streams_request.on("error", (error) => {
    console.error("Twitch streams request failed:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Error</h1>
            <p>Could not retrieve streams from Twitch.</p>
            <p><a href="/">Go back home</a></p>
        `);
  });

  streams_request.on("response", (stream) =>
    process_stream(stream, receive_twitch_streams, city, res)
  );
  streams_request.end();
}

// STEP 2d: process the live streams from Twitch
function receive_twitch_streams(body, city, res) {
  try {
    const twitch_data = JSON.parse(body);
    const streams = twitch_data.data || [];

    // check if there are any live streams
    if (streams.length === 0) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
                <h1>No Live Streams Found</h1>
                <p>There are no live streams for this game right now.</p>
                <p>Try again later or search for a different game.</p>
                <p><a href="/">Go back home</a></p>
            `);
      return;
    }

    console.log(`Found ${streams.length} LIVE streams. Now getting weather...`);

    // SYNCHRONOUS EXECUTION: Immediately call the weather API
    get_weather_data(city, streams, res);
  } catch (error) {
    console.error("Error parsing Twitch streams:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Error</h1>
            <p>Something went wrong while processing stream data.</p>
            <p><a href="/">Go back home</a></p>
        `);
  }
}

// STEP 3: get weather data from OpenWeatherMap called inside the Twitch callback, making it synchronous
function get_weather_data(city, streams, res) {
  const weather_endpoint = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&appid=${weather_api_key}&units=metric`;

  console.log("Getting weather data...");

  const weather_request = https.get(weather_endpoint, (weather_response) => {
    process_stream(weather_response, receive_weather_data, streams, city, res);
  });

  // handle network errors
  weather_request.on("error", (error) => {
    console.error("Weather API request failed:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
              <h1>Weather Error</h1>
              <p>Could not retrieve weather data.</p>
              <p><a href="/">Go back home</a></p>
          `);
  });
}

// process the weather data response
function receive_weather_data(body, streams, city, res) {
  try {
    const weather_data = JSON.parse(body);

    // check if the city was found
    if (weather_data.cod === "404" || !weather_data.main) {
      console.error(`Weather API error: City "${city}" not found`);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
                <h1>City Not Found</h1>
                <p>Could not find weather data for "${city}".</p>
                <p>Please check the city name and try again.</p>
                <p><a href="/">Go back home</a></p>
            `);
      return;
    }

    console.log("Weather data received. Generating response...");

    // now I have data from BOTH APIs - combine them into one HTML page
    generate_final_response(streams, weather_data, city, res);
  } catch (error) {
    console.error("Error parsing weather data:", error);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
            <h1>Weather Error</h1>
            <p>Could not process weather data.</p>
            <p><a href="/">Go back home</a></p>
        `);
  }
}

// STEP 4: generate the final HTML page with both API results
function generate_final_response(streams, weather_data, city, res) {
  // get the top 5 streams from the results
  const top_streams = streams.slice(0, 5);

  // build HTML for each stream card with clickable links to Twitch
  let streams_html = top_streams
    .map(
      (stream) =>
        `
        <div class="stream-card">
            <h3>
                <a href="https://twitch.tv/${
                  stream.user_login
                }" target="_blank">
                    ${stream.user_name}
                </a>
            </h3>
            <p><strong>Game:</strong> ${stream.game_name || "N/A"}</p>
            <p><strong>Title:</strong> ${stream.title || "N/A"}</p>
            <p><strong>Status:</strong> 🔴 LIVE</p>
            <p><strong>Viewers:</strong> ${stream.viewer_count.toLocaleString()}</p>
            <p><a href="https://twitch.tv/${
              stream.user_login
            }" target="_blank" class="watch-link">Watch Stream →</a></p>
        </div>
    `
    )
    .join("");

  // extract weather information from the API response
  const weather_desc = weather_data.weather
    ? weather_data.weather[0].description
    : "N/A";
  const weather_icon = weather_data.weather
    ? weather_data.weather[0].icon
    : "01d";
  const temp_celsius = weather_data.main
    ? Math.round(weather_data.main.temp)
    : "N/A";
  const temp_fahrenheit = weather_data.main
    ? Math.round((weather_data.main.temp * 9) / 5 + 32)
    : "N/A";
  const feels_like_celsius = weather_data.main
    ? Math.round(weather_data.main.feels_like)
    : "N/A";
  const feels_like_fahrenheit = weather_data.main
    ? Math.round((weather_data.main.feels_like * 9) / 5 + 32)
    : "N/A";
  const humidity = weather_data.main ? weather_data.main.humidity : "N/A";

  // get the weather icon image from OpenWeatherMap
  const weather_icon_url = `https://openweathermap.org/img/wn/${weather_icon}@2x.png`;

  // build the complete HTML page with both stream and weather data
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream & Weather Results</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 20px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #6441a5;
            text-align: center;
        }
        .container {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
        }
        .streams-section, .weather-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stream-card {
            border-left: 4px solid #6441a5;
            padding: 15px;
            margin-bottom: 15px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .stream-card h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .stream-card p {
            margin: 5px 0;
            color: #666;
            font-size: 14px;
        }
        .stream-card a {
            color: #6441a5;
            text-decoration: none;
            font-weight: bold;
        }
        .stream-card a:hover {
            color: #503080;
            text-decoration: underline;
        }
        .watch-link {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background-color: #6441a5;
            color: white !important;
            border-radius: 4px;
            text-decoration: none !important;
            font-size: 14px;
        }
        .watch-link:hover {
            background-color: #503080;
        }
        .weather-section {
            position: sticky;
            top: 20px;
            height: fit-content;
        }
        .weather-icon {
            text-align: center;
            margin: 10px 0;
        }
        .weather-icon img {
            width: 100px;
            height: 100px;
        }
        .temp {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            color: #333;
            line-height: 1.2;
        }
        .temp-unit {
            font-size: 18px;
            color: #666;
            display: block;
            margin-top: 5px;
        }
        .weather-detail {
            margin: 10px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
        }
        .back-link {
            text-align: center;
            margin-top: 20px;
        }
        .back-link a {
            color: #6441a5;
            text-decoration: none;
            font-weight: bold;
        }
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>🎮 Top Streams & Weather for ${city}</h1>
    
    <div class="container">
        <div class="streams-section">
            <h2>Top Live Streams</h2>
            ${streams_html}
        </div>
        
        <div class="weather-section">
            <h2>Weather in ${city}</h2>
            <div class="weather-icon">
                <img src="${weather_icon_url}" alt="${weather_desc}">
            </div>
            <div class="temp">
                ${temp_celsius}°C / ${temp_fahrenheit}°F
            </div>
            <div class="weather-detail">
                <strong>Condition:</strong> ${weather_desc}
            </div>
            <div class="weather-detail">
                <strong>Feels Like:</strong> ${feels_like_celsius}°C / ${feels_like_fahrenheit}°F
            </div>
            <div class="weather-detail">
                <strong>Humidity:</strong> ${humidity}%
            </div>
        </div>
    </div>
    
    <div class="back-link">
        <a href="/">← Search Again</a>
    </div>
</body>
</html>
    `;

  // send the complete HTML page back to the user
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

