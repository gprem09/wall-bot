# Wall-Bot

A small 3D robot that lives on your wall. It walks around, makes faces, talks to you, and waves back when you wave.

## Setup

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome.

## Use with a projector

1. Connect the projector to your laptop.
2. Drag the browser window to the projector screen.
3. Press `F` for fullscreen.
4. Press `C` and drag the corners to fit your wall. Press `C` again when done.
5. Press `H` to hide the menu.

## Keys

| Key | What it does |
| --- | --- |
| `0` - `9` | Play a move (happy, sad, wave, dance...) |
| `S` | Say something |
| `T` | Turn the camera on or off |
| `B` | Blink |
| `C` | Fit to wall |
| `F` | Fullscreen |
| `H` | Hide the menu |
| `O` | Move the view with the mouse |

## Camera

Press `T` to turn on the webcam. The robot will notice when you come and go, and it waves back when you wave at it. Everything runs on your computer. Nothing is uploaded.

## License

MIT
