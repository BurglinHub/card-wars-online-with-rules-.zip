# Card Wars · Online Table

A free browser tabletop prototype generated from the Tabletop Simulator save supplied by the user. It uses PeerJS for peer-to-peer room connections and GitHub Pages for static hosting; no game server or player downloads are required.

## Included

- 46 deck piles / 836 card entries parsed from the supplied TTS save.
- Card faces are cropped from the sprite sheets referenced by the save. Images are **not copied into this repository**; browsers load them from their original Steam Community URLs over HTTPS.
- Rooms for up to 8 players; share a six-character code.
- Each player can select and shuffle a deck, draw privately, play/discard cards, flip cards face down, keep a score, and pass the turn.
- Responsive layout for desktop and mobile browsers.
- `rules.html`: Russian paraphrase of the core rules with links to the original 2013 rulebook.

## Run locally

The app uses ES modules, so open it through a local web server rather than `file://`:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish free with GitHub Pages

1. Create a GitHub repository. If card-image permissions are uncertain, keep the repository private; for a public fan project, first confirm you may publish it.
2. Upload the contents of this folder to the repository root (`index.html`, `style.css`, `src/`, and `data/`).
3. In **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. Open the HTTPS Pages URL. The host creates a room and shares the six-character code; friends open that same URL and enter the code. Nobody installs anything.

## Important limitations

- This is a digital tabletop / free-play prototype, not an official product or complete rules engine. The uploaded save's `Rules` field is empty; exact automated rules need the rulebook and additional implementation.
- The room host's browser tab must stay open. PeerJS's public signaling service is used without a guaranteed SLA; restrictive networks, firewalls, or VPNs can prevent peer-to-peer connections. If you need reliable always-on rooms, add a hosted signaling/TURN or realtime backend.
- Card art and trademarks belong to their respective rights holders. The project references card sheets from URLs present in the user's save; it does not include the image files. Check permissions before publishing or sharing a public fan game.
- The project has not been deployed to a GitHub account. GitHub Pages deployment requires the repository owner to publish it.
