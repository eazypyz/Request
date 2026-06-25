# HTTP Request Repeater

A professional, web-based HTTP Request Repeater inspired by Burp Suite Repeater. Built entirely with HTML, CSS, and JavaScript — no build tools required. Deploys instantly to GitHub Pages.

![Dark Theme](https://img.shields.io/badge/theme-dark-1E1E1E)
![Responsive](https://img.shields.io/badge/responsive-yes-007ACC)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Request Editor
- Raw HTTP request editing with line numbers
- Syntax highlighting for JSON/XML in responses
- Auto-format request (reorder headers, pretty-print JSON body)
- Multi-tab support (create, duplicate, close tabs)

### Response Viewer
- Status code with color coding (success=green, redirect=yellow, error=red)
- Response time and size display
- Raw, Preview, Headers, and Cookies tabs
- Pretty print for JSON, XML, and HTML

### Repeater
- Send button with loading indicator
- Duplicate tab for quick iteration
- Clear request button
- Request history (last 100 requests)
- Response comparison (previous vs current)

### Import & Export
- Import cURL commands automatically
- Export as cURL (copy to clipboard)
- Export as JSON file download

### User Experience
- Draggable resizer between request/response panels
- Smooth animations and transitions
- Keyboard shortcuts:
  - `Ctrl + Enter` — Send Request
  - `Ctrl + T` — New Tab
  - `Ctrl + W` — Close Tab
  - `Escape` — Close Modals
- Mobile-first responsive design
- Touch-friendly buttons

### Responsive Layout
- **Desktop**: Horizontal split panels with draggable resizer
- **Tablet**: Compact layout with scrollable tabs
- **Mobile**: Tab switcher between Request and Response panels

## Quick Start

### Deploy to GitHub Pages

1. Fork this repository
2. Go to **Settings → Pages**
3. Select **Deploy from a branch** → `main` / `root`
4. Your app will be live at `https://yourusername.github.io/http-repeater`

### Local Development

```bash
git clone https://github.com/yourusername/http-repeater.git
cd http-repeater
# Open index.html in your browser, or use a local server:
npx serve .
```

## CORS Proxy Setup

Since the app runs in the browser, you need a CORS proxy to send requests to external APIs.

### Option 1: Cloudflare Worker (Recommended - Free)

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/)
2. Create a new Worker
3. Paste the code from `proxy/worker.js`
4. Save and deploy
5. Copy the Worker URL (e.g., `https://your-worker.workers.dev/proxy`)
6. Paste it in the app Settings → Proxy URL

### Option 2: Node.js Proxy (Self-hosted)

```bash
cd proxy
npm install
npm start
# Proxy runs at http://localhost:3000/proxy
```

### Option 3: Public CORS Proxy (Testing only)

For quick testing, you can use a public CORS proxy. Note: **Do not use for production or sensitive data**.

## Project Structure

```
http-repeater/
├── index.html              # Main application entry point
├── css/
│   └── style.css           # Dark theme styles, responsive layout
├── js/
│   ├── utils.js            # HTTP parsing, cURL conversion, formatting
│   ├── editor.js           # Custom textarea editor with line numbers
│   └── app.js              # Main application logic
├── proxy/
│   ├── worker.js           # Cloudflare Worker proxy
│   ├── server.js           # Node.js/Express proxy
│   └── package.json        # Node.js dependencies
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages deployment
└── README.md               # This file
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Send the current request |
| `Ctrl + T` | Create a new tab |
| `Ctrl + W` | Close the active tab |
| `Escape` | Close any open modal |
| `Tab` | Insert 2 spaces in editor |
| `Enter` | Auto-indent based on previous line |

## Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+ modules)
- **Editor**: Custom lightweight textarea with line numbers (no heavy dependencies)
- **HTTP**: Fetch API with proxy for CORS
- **Storage**: localStorage for settings and history
- **Deployment**: GitHub Pages (static hosting)
- **Proxy**: Cloudflare Worker or Node.js/Express

## Customization

### Colors

Edit `css/style.css` to change the theme:

```css
:root {
  --bg-primary: #1E1E1E;    /* Main background */
  --bg-panel: #252526;      /* Panel background */
  --border-color: #3C3C3C;  /* Borders */
  --primary: #007ACC;       /* Primary buttons */
  --success: #4CAF50;       /* Success status */
  --redirect: #FFC107;      /* Redirect status */
  --error: #F44336;         /* Error status */
}
```

### Default Request

Edit `js/app.js` to change the default request template:

```javascript
const DEFAULT_REQUEST = `GET https://your-api.com/endpoint HTTP/1.1
Host: your-api.com
User-Agent: HTTP-Repeater/1.0
Accept: */*
Connection: close
`;
```

## License

MIT License — feel free to use, modify, and distribute.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
