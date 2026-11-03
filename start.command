#!/bin/bash
# Double-click this file (on a Mac) to start the game.
# It runs a tiny local web server and opens the game in your browser.
# Close this window (or press Ctrl+C) to stop it.
cd "$(dirname "$0")"
PORT=8123
echo ""
echo "  Starting the game at http://localhost:$PORT"
echo "  Leave this window open while you play. Close it to stop."
echo ""
(sleep 1 && open "http://localhost:$PORT") &
python3 -m http.server $PORT
