# मायkaa by H Studio

Premium ecommerce website for designer sarees and kurtas, with a small Node backend for:

- product catalogue API
- checkout request capture
- newsletter subscriptions

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Deploy on Render

This repo includes `render.yaml`, so Render can deploy it as a Node web service.

Recommended settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment: Node

Runtime order and newsletter data are written to `data/` locally. For a full production store, connect a database before taking real customer orders.
