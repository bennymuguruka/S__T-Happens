# S\*\*T Happens

A multiplayer party card game prototype with a shared Unity host screen and browser-based player controllers. Players compare unfortunate scenarios by placing a new card into their personal scale of revealed **Misery Index** values.

The repository contains a Node.js game server, a Unity host application, and a lightweight HTML/JavaScript controller that players can open on their phones. Supabase supplies the scenario cards; Socket.IO carries room, session, and round events.

**Development status:** room creation, joining, reconnection, dealing, and one placement submission per player are implemented. The full game loop is still being built: reveal delivery has known issues, and scoring, pity voting, subsequent rounds, and winner selection are not implemented. See [current limitations](#current-limitations) before running a playtest.

## Contents

- [Game concept and rules](#game-concept-and-rules)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Running a playtest](#running-a-playtest)
- [Configuration reference](#configuration-reference)
- [Socket.IO protocol](#socketio-protocol)
- [Sessions and reconnection](#sessions-and-reconnection)
- [Development and validation](#development-and-validation)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)
- [Design references and licensing](#design-references-and-licensing)

## Game concept and rules

Each player begins with two revealed cards, sorted from lowest to highest Misery Index. The Unity screen presents a shared scenario while hiding its index. Players choose the gap in their own scale where they think that scenario belongs.

For example, a scale with indices `20.0` and `65.0` has three choices:

```text
Position 0       Position 1       Position 2
    |    [20.0]      |    [65.0]      |
```

The phone displays a **Place here** button for each gap. A placement is an integer from `0` through the number of cards in that player's scale, inclusive. Only one accepted submission is allowed per round, and the server records its arrival time.

### Implemented rules

- A separate host creates a room; the host is not counted as a player.
- At least **two connected players** are required to start.
- Room codes contain six uppercase hexadecimal characters. Enter the code exactly as displayed; the server does not normalize its case.
- Usernames are trimmed, must contain 1–20 characters, and must be unique within the room. Uniqueness is case-sensitive.
- Players can join only while the room is in the lobby.
- Starting a game requires at least `2 × number of room players + 1` valid cards: two per player and one shared scenario.
- Starting cards are drawn from a shuffled deck and sorted by Misery Index.
- The active scenario's index is omitted from the `roundStarted` payload. Players receive their own revealed scale, not the active scenario.
- Duplicate, non-integer, out-of-range, and locked-round submissions are rejected.
- Once every player currently in the room has submitted, the round is locked. The current reveal implementation is incomplete.

### Intended scoring and win condition

The [gameplay notes accompanying the UI references](docs/ui-references/README.md) establish the following intended rules. **These are design requirements, not working scoring features yet.**

| Outcome | Points | Card awarded |
| --- | ---: | --- |
| Fastest correct placement | 15 | Yes |
| Any other correct placement | 7 | Yes |
| Incorrect placement | 0 | No |
| Winning the pity vote | 3 | No pity-to-card conversion |

When someone reaches 100 points, finish the round, including pity voting, then award the win to the highest score. Fixed round counts, player caps, and tie-breaking rules have not been established. Equal-index placement behavior also needs to be defined when correctness evaluation is implemented.

## Architecture

```text
Unity host screen ------------------+
  room controls, lobby, scenario    |
                                    | Socket.IO / HTTP :8000
Player browsers --------------------+------ Node.js game server
  join form, personal scale                rooms, sessions, deck, round
        |                                           |
        | HTTP :5500                                | Supabase query
        v                                           v
Static server for SH_UserClient                cards table
```

The Node process owns room membership and round state. It reads the card catalog from Supabase when the host starts a game, validates each card, creates a shuffled in-memory deck, and distributes the initial state. Supabase is used for card retrieval; this code does not persist games, scores, or sessions there.

The Unity application is the shared display and host controller. Its persistent `NetworkManager` maintains the Socket.IO connection, and `SessionController` caches snapshots and switches scenes as room state changes.

The player application is plain HTML and JavaScript with no build step. It loads Socket.IO 4.8.3 from a CDN, derives the game server hostname from the page URL, and stores its session token in browser `sessionStorage`.

The Express server exposes `GET /`, which returns `S**T Happens Server Running`. It does **not** serve the player HTML. Run a separate static server for `SH_UserClient`.

## Repository layout

```text
.
├── SH_GameServer/
│   ├── package.json
│   ├── package-lock.json
│   └── server/
│       ├── server.js           # HTTP, Socket.IO, sessions, event handlers
│       ├── rooms.js            # Room membership, start checks, initial deal
│       ├── round.js            # Placement validation, submission times, lock
│       ├── cards.js            # Card data validation
│       ├── decks.js            # Shuffle and draw
│       ├── card-repository.js  # Supabase rows -> Card instances
│       ├── supabaseClient.js   # Environment-based database client
│       └── test-cards.js       # Manual database read check
├── SH_UnityClient/
│   ├── Assets/
│   │   ├── Scenes/             # Menu, Lobby, Game Scene
│   │   ├── Scripts/            # Networking, snapshots, scene controllers
│   │   ├── Art/                # Logo
│   │   ├── Fonts/              # Lilita One and Maiden Orange assets
│   │   ├── Plugins/            # ZXing QR code library
│   │   └── Prefabs/            # Lobby player item
│   ├── Packages/               # Unity package manifest and lockfile
│   └── ProjectSettings/        # Editor version, scenes, project configuration
├── SH_UserClient/
│   ├── client-game.html       # Player page and Socket.IO CDN import
│   └── client-game.js         # Session, join, scale, placement UI
└── docs/ui-references/         # Proposed visual directions and gameplay notes
```

Unity's `Assets/_Recovery` directory contains recovery scenes. Use the scenes under `Assets/Scenes` for the normal application flow.

## Requirements

| Requirement | Purpose / version |
| --- | --- |
| Git and Git LFS | Clone source and retrieve binary assets such as images, fonts, and the ZXing DLL. |
| Node.js **22 or newer** and npm | The locked Supabase dependencies require Node `>=22.0.0`. |
| Unity Hub and Unity **6000.5.1f1** | Exact editor version recorded in `SH_UnityClient/ProjectSettings/ProjectVersion.txt`. Install build support for your target if exporting a player. |
| Supabase project with readable card data | Required by the server; credentials must be supplied locally. |
| Modern browser | Runs the phone controller and supports `sessionStorage`. |
| Python 3, or another static HTTP server | Serves the player page; Python is only needed for the example command below. |

The server lockfile includes Express 5.2.1, Socket.IO 4.8.3, and `@supabase/supabase-js` 2.117.2. `@supabase/ssr` is declared but is not used by the current server code.

Unity resolves SocketIOUnity from its Git dependency, alongside URP 17.5.0, Input System 1.19.0, and Unity UI 2.5.0. Keep both package lockfiles in version control. Internet access is needed for dependency downloads, the hosted Supabase project, and the browser's Socket.IO CDN script.

## Local setup

The simplest arrangement runs the Node server, static server, and Unity host on the same computer. Phones connect to that computer over the same local network.

### 1. Clone and retrieve assets

```powershell
git clone https://github.com/bennymuguruka/S__T-Happens.git
cd S__T-Happens
git lfs install
git lfs pull
```

The branch containing this README can be selected with `git switch Card-Mechanics` if the clone starts on another branch. If you already have the repository, use your existing checkout.

### 2. Prepare the card catalog

The repository does not include database migrations or a seed dataset. Supply a `cards` table in the schema exposed to the Supabase client, normally `public`, with these fields:

| Database column | Application field | Required value |
| --- | --- | --- |
| `id` | `cardID` | UUID string in `8-4-4-4-12` hexadecimal format. A PostgreSQL `uuid` column is suitable. |
| `scenario_text` | `scenarioText` | Non-empty text after trimming. |
| `misery_index` | `miseryIndex` | A finite JSON number from `0` to `100`, with at most one decimal place. A numeric column such as `numeric(4,1)` is suitable. |

For example, a valid row returned by the database could look like this:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "scenario_text": "You spill coffee on your favourite shirt.",
  "misery_index": 18.5
}
```

This is illustrative data, not an included seed record. Provide at least **five valid cards for two players**, seven for three players, and so on. One invalid returned row causes the card load to fail. Numeric strings such as `"18.5"` are rejected by the application's validator.

The server calls `from("cards").select("id, scenario_text, misery_index")`; the configured credentials must be allowed to read those fields. The query has no pagination, so deck size is limited to the rows returned by the database API.

### 3. Configure and start the game server

From the repository root:

```powershell
cd SH_GameServer
npm ci
```

Create `SH_GameServer/.env` locally with your project values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_SUPABASE_SECRET_KEY=YOUR_SERVER_SIDE_SUPABASE_KEY
```

These names are the exact names used in [supabaseClient.js](SH_GameServer/server/supabaseClient.js). Despite the `NEXT_` prefixes, this project does not use Next.js. The secret key belongs only on the server; do not place it in the browser controller or Unity assets. `.env` is ignored by Git.

Start the process from `SH_GameServer`:

```powershell
node --env-file=.env server/server.js
```

Node's `--env-file` option loads the local configuration. The application does not automatically load `.env` through `dotenv`. If the variables are already provided by your shell or process manager, use `node server/server.js` instead.

Expected console output:

```text
Server running in http://localhost:8000
```

Open [the local server status endpoint](http://localhost:8000/) to confirm the process is listening. This checks HTTP availability only; card retrieval happens when starting a game or running the card check below.

There is currently no `npm start` script. The actual entry point is `server/server.js`; `package.json`'s `main` value does not point to that file.

### 4. Serve the player controller

Open a second terminal **at the repository root**:

```powershell
python -m http.server 5500 --bind 0.0.0.0 --directory SH_UserClient
```

On the development computer, open [the player page](http://localhost:5500/client-game.html). On a phone, replace `localhost` with the computer's LAN IPv4 address:

```text
http://<HOST_LAN_IP>:5500/client-game.html
http://<HOST_LAN_IP>:5500/client-game.html?roomCode=<ROOM_CODE>
```

On Windows, `ipconfig` shows the address of the active network adapter. Allow the local servers through the firewall on your private network if necessary. Phones must be able to reach TCP ports **5500** and **8000** on the host. Guest Wi-Fi or client isolation can prevent this.

Serve only `SH_UserClient`, as in the command above. Serving the repository root could also expose server configuration files. The browser connects to `http://<page-hostname>:8000`, so the static page and game server must share a hostname with the current code. Opening the HTML directly through `file://` is not supported by that address construction.

### 5. Configure the Unity host

1. Add **`SH_UnityClient`** as the project folder in Unity Hub and open it with Unity **6000.5.1f1**. Allow package resolution and asset import to finish.
2. Verify the server URI in [NetworkManager.cs](SH_UnityClient/Assets/Scripts/NetworkManager.cs), inside `ConnectToServer()`. It is currently `http://localhost:8000`, which works when Unity and Node run on the same computer. If they run on different computers, replace `localhost` with the Node server's reachable address.
3. Update `joinUrl` in [LobbyController.cs](SH_UnityClient/Assets/Scripts/LobbyController.cs), inside `SetRoomCode()`, to point to your static server. For the command in step 4, the C# string should be:

   ```csharp
   string joinUrl = $"http://<HOST_LAN_IP>:5500/client-game.html?roomCode={roomCode}";
   ```

   Replace `<HOST_LAN_IP>` with your computer's address. The committed URL contains a developer-specific LAN address and `/SH_UserClient/client-game.html`, which assumes a different static-server root. Both the host and path must match your setup. This URL and the Socket.IO URI are source-code settings, not Inspector fields.
4. Open `Assets/Scenes/Game Scene.unity`. Select the **GameController** object and assign the scene's **MiseryIndex** TextMeshPro UI component to **Misery Text** in the Inspector. This reference is currently unassigned in the committed scene; `DisplayRound()` dereferences it before updating the scenario text. Save the scene.
5. Open **`Assets/Scenes/Menu.unity`** and enter Play mode. Start from Menu so its persistent `NetworkManager` and `SessionController` are created.

The enabled build scenes are **Menu**, **Lobby**, and **Game Scene**, in that order. `EditorBuildSettings.asset` also contains a disabled, stale `SampleScene` entry; it is not part of the enabled build. Keep the enabled scene names intact because `SessionController` loads them by name.

## Running a playtest

1. Keep the Node game server and player static server running.
2. Start the Unity host from Menu and wait for the connection to become ready. Use the menu's start control to create a room.
3. The Lobby displays a room code, QR code, and player list. Scan the configured QR code or open the player page manually and enter the exact room code.
4. Join from at least two separate browser sessions or devices, using different usernames. For testing on one computer, use separate browser profiles or independently opened tabs. Duplicating an existing tab may copy its session token and replace the original connection.
5. Start the game from the Unity lobby. The server loads cards, checks player and deck requirements, deals two cards per player, and starts the first round.
6. The host displays the scenario with `??` for its index, provided the scene reference above is assigned. Each phone displays its sorted scale and three placement choices.
7. Each player selects a gap once. Successful submissions switch the phone to a waiting screen. The server locks the round when all remaining room players have submitted.

**The current prototype stops here.** Do not expect a complete reveal, score update, or next-round transition. See [current limitations](#current-limitations) for the exact gaps.

To repeat the playtest from the current game screen, stop Unity Play mode, allow the server's 30-second host disconnect grace period to expire, and start again from Menu. Restarting the Node process also clears all rooms and sessions, including any other running playtests. The Lobby's Back control explicitly leaves and closes the host's room.

## Configuration reference

| Setting | Current value / location |
| --- | --- |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` in the server environment. |
| Supabase server key | `NEXT_SUPABASE_SECRET_KEY` in the server environment. |
| Game server port | `8000`, hardcoded in `server/server.js`; there is no `PORT` environment setting. |
| Unity Socket.IO URL | `http://localhost:8000` in `NetworkManager.ConnectToServer()`. |
| Browser Socket.IO URL | `http://${window.location.hostname}:8000` in `client-game.js`. |
| QR join URL | Hardcoded in `LobbyController.SetRoomCode()`; update both hostname and path. |
| Player static server port | `5500` in this guide; supplied by your static server command. |
| Reconnection grace period | `30_000` ms in `server/server.js`. |
| Browser placement acknowledgement timeout | `5000` ms in `client-game.js`. |
| Socket.IO allowed origins | `*` in `server/server.js`. |

Changing a server port requires updating the relevant clients. The current clients explicitly use HTTP. HTTPS hosting requires corresponding secure endpoint changes; a secure page cannot simply reuse the current HTTP Socket.IO address.

## Socket.IO protocol

Event names are case-sensitive. In particular, **`join room` contains a space**. This is a Socket.IO protocol, not a plain WebSocket JSON API. Clients first register a session and wait for `sessionReady` before sending room requests.

### Client to server

| Event | Arguments | Purpose / response |
| --- | --- | --- |
| `registerSession` | Previous token string, or empty/null for a new session | Returns `sessionReady`, then `sessionRestored` or `sessionReset`. |
| `createRoom` | None | Creates a host-owned room; returns `roomCreated` or `sessionError`. |
| `join room` | `roomCode`, `username` as separate arguments | Joins a lobby; returns `playerAdded`, `joinError`, or `sessionError`. |
| `startGame` | None | Host-only start; errors use `startGameError`. Success distributes room, scenario, and scale events. |
| `submitPlacement` | Integer `position`, acknowledgement callback | Responds with `{ "success": true }` or `{ "success": false, "message": "..." }`. A callback is required; otherwise the handler returns without processing. |
| `leaveRoom` | None | Removes a player, or closes the entire room when sent by its host. |

### Server to client

| Event | Payload | Recipient / behavior |
| --- | --- | --- |
| `sessionReady` | Token string | Registering socket; retain it for reconnection. |
| `sessionRestored` | `{ roomCode, role, state, hasSubmitted, players }` | Reconnecting room member; each player entry contains `username` and `score`. |
| `sessionReset` | None | Clears local room state when no membership remains. |
| `roomCreated` | Room-code string | Host; opens the lobby. |
| `playerJoined` | Username string | Host; updates the lobby roster. |
| `playerAdded` | None | Joining player; switches to the lobby waiting state. |
| `playerLeft` | Username string | Remaining room sockets after explicit leave or disconnect expiry. |
| `stateChanged` | State string | Room sockets; starting the game emits `playing`. |
| `roundStarted` | `{ cardID, scenarioText }` | Host only; deliberately excludes the active card's index. |
| `playerCards` | Array of `{ cardID, scenarioText, miseryIndex }` | Individual player; their own revealed scale, sent at start and restoration. |
| `roundRevealed` | Currently `{ cardID: [id], miseryIndex: [number] }` | Currently sent only to the player whose submission completes the round. This delivery and array-shaped payload are known defects. |
| `roomClosed` | None | Room sockets when the host leaves or times out. |
| `sessionError` | Message string | Requesting socket; invalid session or membership operation. |
| `joinError` | `code`, `username`, or a validation message | Joining socket; invalid code, duplicate username, or other join failure. |
| `startGameError` | Message string | Requesting host/socket; includes player count, state, or card-loading failures. |

Room state currently advances from `lobby` to `playing`. Closing a room deletes it. The browser has handlers for `finished` and `closed`, but there is no server transition that finishes a game yet; `roomClosed` drives the browser's closed-screen behavior.

## Sessions and reconnection

The server generates a random 32-byte token, encoded as a hexadecimal string, for each new session. A session maps that token to a socket, optional room code, and role. Room membership and submissions use the token so a new socket can recover the same player.

- The browser keeps the token under `sessionStorage["sessionToken"]`. Refreshing the same tab can restore membership while the server still retains it.
- Unity keeps its token only in the running `NetworkManager`. A new application or Play-mode session does not retain it.
- Re-registering an existing token replaces and disconnects the previous socket associated with it. Do not share tokens between players.
- A disconnected member has **30 seconds** to reconnect. Expiry removes a player and emits `playerLeft`; host expiry closes the entire room.
- Explicit `leaveRoom` is immediate and does not wait for the grace period.
- Player restoration includes `hasSubmitted` and the player's cards. Host restoration includes the roster, room state, and current scenario. Reveal state is not replayed.
- If a placement acknowledgement times out after five seconds, the browser re-registers its session to check whether the server accepted the answer before allowing further input.

All of this state lives in one Node process. Restarting it loses the room, deck, submissions, and session tokens; reconnecting clients then register fresh sessions.

## Development and validation

### Available checks

There is no automated application test suite or CI workflow committed in this repository. `npm test` is the generated placeholder and intentionally exits with an error. Unity includes the Test Framework package, but no project test cases are included.

To check database connectivity and card validation, run this from `SH_GameServer` after configuring `.env`:

```powershell
node --env-file=.env server/test-cards.js
```

The script reads the card catalog, prints the loaded count and first card, and exits nonzero on failure. It does not create or modify database rows. A zero count still requires attention: the script can finish successfully with an empty catalog, while a game cannot start without enough cards.

For JavaScript syntax checks, run from the repository root in PowerShell:

```powershell
Get-ChildItem SH_GameServer/server/*.js | ForEach-Object { node --check $_.FullName }
node --check SH_UserClient/client-game.js
```

These checks do not verify network behavior, Unity serialization, or gameplay correctness. The [playtest walkthrough](#running-a-playtest) is the current integration check.

Useful manual cases include an incorrect room code, duplicate username, starting with fewer than two players, insufficient cards, refreshing after submitting, reconnecting before the grace period, and a host disconnect longer than 30 seconds. Expect the reveal and progression issues listed below.

### Where to make changes

| Change | Starting point |
| --- | --- |
| Card format and validation | `cards.js` and `card-repository.js` |
| Deck behavior and starting hands | `decks.js` and `rooms.js` |
| Placement validation and round completion | `round.js` and the `submitPlacement` handler in `server.js` |
| Session lifecycle and event protocol | `server.js`, Unity `NetworkManager.cs`, and `client-game.js` |
| Host scene transitions and cached state | Unity `SessionController.cs` and snapshot classes |
| Lobby, QR code, and host scenario display | Unity `LobbyController.cs`, `GameController.cs`, and their scenes |
| Player controls and feedback | `SH_UserClient/client-game.html` and `client-game.js` |

When changing an event payload, update the server, browser handlers, and relevant Unity snapshot types together. Avoid including an unrevealed Misery Index in scenario-start payloads. Reconnection snapshots should remain consistent with the live event path.

Commit Unity `.meta` files with their assets so GUID references remain stable. Retrieve Git LFS assets before investigating missing fonts, images, or DLLs. Generated Unity caches and `node_modules` are ignored; preserve the tracked manifests and lockfiles instead.

## Troubleshooting

| Symptom | Likely cause / action |
| --- | --- |
| `No database URL found`, `No database Key found`, or Supabase key initialization error | Supply both required environment values. Run with `--env-file=.env` from `SH_GameServer`, or export the variables first. |
| `npm start` fails, or `node server.js` cannot find a file | Use `node --env-file=.env server/server.js` from `SH_GameServer`. |
| `Failed to load cards: ...` | Check the Supabase URL, server credentials, exposed schema, table/column names, and read access. Run the card check script. |
| Card validation fails | Check UUIDs, blank scenario text, numeric types, the 0–100 range, and decimal precision. One invalid returned card prevents startup of a game. |
| `Not enough players` | Join at least two connected player sessions in addition to the Unity host. |
| `Not enough cards` | Provide at least `2 × room player count + 1` valid returned cards. Disconnected players may remain in that count during the grace period. |
| Player page stays on `Connecting...` | Check the browser console, CDN access, and that the Socket.IO script loaded. |
| `Cannot reach the server. Retrying...` | Verify Node is running on the page's hostname at port 8000. Check firewall, Wi-Fi isolation, and HTTP/HTTPS consistency. |
| QR code opens the wrong address or returns 404 | Update the hardcoded `joinUrl` host and path. Serving `SH_UserClient` directly uses `/client-game.html`. |
| Unity fails to import SocketIOUnity, ZXing, fonts, or images | Check Git availability for package resolution, run `git lfs pull`, and let Unity reimport. |
| Unity throws `NullReferenceException` when the round starts | Assign GameController's **Misery Text** field to the scene's **MiseryIndex** TMP component, and start Play mode from Menu. |
| Room code is rejected | Use the exact uppercase code and verify the host room has not closed. |
| A browser tab disconnects when another connects | They may be using the same session token. Test with separate browser profiles or independently opened sessions. |
| Index stays hidden or phones wait after all answers | The current reveal event is sent to the wrong recipient and has the wrong field shapes; next-round progression is also absent. |
| A room disappears after a connection loss | Host disconnect expiry closes the room after 30 seconds. A server restart clears all in-memory state. |

## Current limitations

These are observable implementation gaps and useful starting points for further development:

1. **Reveal delivery is incomplete.** `submitPlacement` uses `socket.emit`, so only the final submitting player receives `roundRevealed`. That browser has no handler for it. Unity listens for the event but is not its recipient, and its `RoundRevealSnapshot` expects scalar `string`/`decimal` fields while the server sends arrays.
2. **The game scene needs a serialized reference assigned.** `GameController.miseryText` is null in the committed scene. The Unity setup above describes the required assignment.
3. **There is no complete game loop.** Correctness evaluation, score changes, awarded cards, pity voting, advancing rounds, and winner selection are not wired up. Scores are initialized to zero and included in snapshots, but never updated. `Room.startRound()` is currently called only during game startup.
4. **Round completion has no timer or departure recheck.** Completion is checked only when a placement is accepted. If an unsubmitted player leaves after everyone else has answered, removing that player does not itself lock or reveal the round. Disconnected players remain members during their grace period.
5. **Restoration is partial.** Reconnecting hosts receive the current scenario without an index; locked/revealed round state is not replayed as a reveal. There is no persistent recovery after restarting the server or Unity host.
6. **Networking is configured in source.** Ports and client URLs are hardcoded. There is no environment-based client configuration, deployment setup, or shared production URL.
7. **The browser UI is a functional prototype.** It has minimal styling, no displayed active scenario, and no player-facing leave button despite the server supporting `leaveRoom`.
8. **Operational features are limited.** Rooms and sessions are process-local, origins are unrestricted, session tokens act as bearer credentials, and the project has no account authentication, rate limiting, or multi-instance state coordination. The documented HTTP setup is for local development; public hosting needs additional work.
9. **The database is provisioned separately.** No migrations or seed cards are included, and card retrieval does not page through large catalogs.

## Design references and licensing

The [UI reference collection](docs/ui-references/README.md) contains possible component styles, host and phone layouts, and scoring displays. They are exploratory designs, not screenshots of the implemented application. The current direction uses yellow, black, and white, bold type, rounded panels, and colorful player identities. Gameplay notes take precedence over controls or rules shown in the mockups.

The server's `package.json` declares `ISC`, but the repository currently has no top-level license file establishing terms for the whole project. Third-party packages, bundled fonts, and other assets retain their respective licensing requirements; do not assume the server metadata licenses every asset in the repository.
