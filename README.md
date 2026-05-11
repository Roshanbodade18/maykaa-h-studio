# मायkaa by H Studio

Production-ready saree ecommerce website with:

- real product images from the saree collection
- advanced filters and sorting
- persistent cart and coupon support
- mobile OTP signup flow
- password login with hashed credentials
- checkout steps: cart, address, payment, confirmation
- protected order history
- newsletter capture
- SMS notification logging hook
- Razorpay-ready payment configuration hooks

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Demo Auth

In local development the OTP API returns `devOtp` so the signup flow can be tested without an SMS provider. In production, connect Twilio, MSG91, or Fast2SMS and remove OTP exposure.

## Environment Variables

```text
JWT_SECRET=replace-with-long-random-secret
RAZORPAY_KEY_ID=optional-production-key
RAZORPAY_KEY_SECRET=optional-production-secret
SMS_PROVIDER=twilio-or-msg91
```

## Data Storage

This deployment uses local JSON files for lightweight persistence. It is suitable for demos and early validation. Before accepting real payments/orders at scale, connect MongoDB or another managed database because free Render instances do not provide durable disk persistence by default.

## Deploy on Render

This repo includes `render.yaml`.

Recommended settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment: Node
