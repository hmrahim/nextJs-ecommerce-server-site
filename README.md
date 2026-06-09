# Moom24 — Production-Ready E-Commerce API

Express + MongoDB + Socket.IO + Stripe, CommonJS, strict MVC.

## Stack
- **Express 4** REST API on `/api`
- **Mongoose 8** models with full indexes/virtuals
- **JWT** access + refresh (httpOnly cookie) auth
- **Socket.IO** for live-chat, notifications, order tracking
- **Stripe** Payment Intents + webhook
- **Cloudinary** signed direct-upload (binary uploads stay on the client; URLs saved server-side)
- **Helmet · CORS · rate-limit · mongo-sanitize · compression** hardened

## Project Layout
```
src/
├── app.js                    # Express bootstrap
├── server.js                 # HTTP + Socket.IO bootstrap
├── config/                   # database connection
├── controllers/              # thin HTTP layer (uses crudFactory + custom handlers)
├── services/                 # reusable business helpers per resource
├── models/                   # mongoose schemas
├── routes/                   # one file per resource + extra/specialised routes
├── middleware/               # auth, error handler
├── validators/               # express-validator chains
├── sockets/                  # Socket.IO server + emit helpers
├── webhooks/                 # stripe.webhook.js (raw body)
└── utils/                    # asyncHandler, crudFactory, pagination, apiHelpers, logger
```

## Quick start
```bash
cp .env.example .env       # fill MONGO_URI, JWT_SECRET, STRIPE_* etc.
npm install
npm run dev                # nodemon
# or
npm start                  # production
```

## Endpoints (high level — all under `/api`)
| Module | Base |
|---|---|
| Auth | `/auth/{register,login,refresh,logout,me,forgot-password,reset-password,change-password}` |
| Products / Categories / Brands / Attributes | `/products`, `/categories`, `/brands`, `/attributes` |
| Cart / Coupon / Wishlist | `/carts/me`, `/coupons/validate`, `/wishlists/me`, `/wishlists/toggle` |
| Orders / Checkout | `/orders/checkout`, `/orders/me`, `/orders/:id/status`, `/orders/:id/cancel` |
| Payments | `/payments/stripe/create-payment-intent`, `/payments/stripe/refund/:id`, `/webhooks/stripe` |
| Inventory / Warehouses | `/inventory`, `/warehouses` |
| Shipments / Tracking / Couriers / Shipping-zones | `/shipments`, `/tracking`, `/couriers`, `/shipping-zones` |
| Promotions / Campaigns / Flash-sales / Bundles | `/promotions`, `/campaigns`, `/flash-sales`, `/bundles` |
| Gift-cards / Affiliates / Payouts | `/gift-cards`, `/affiliates`, `/payouts` |
| Loyalty | `/loyalty/tiers`, `/loyalty/rules`, `/loyalty/accounts` |
| Disputes / Returns / Tickets / Reviews | `/disputes`, `/returns`, `/tickets`, `/reviews` |
| Chat (live) | `/chat/rooms`, `/chat/messages`, `/chat/rooms/:id/messages` |
| Invoices / Transactions / Tax-rules | `/invoices`, `/transactions`, `/tax-rules` |
| Notifications | `/notifications/me`, `/notifications/:id/read`, `/notifications/read-all` |
| Users / Customers | `/users` |
| Visitors / Abandoned-carts / FAQ / Settings | `/visitors`, `/abandoned-carts`, `/faqs`, `/settings` |
| Analytics / Reports | `/analytics/overview`, `/analytics/revenue`, `/analytics/top-products`, `/reports/sales` |
| Uploads | `/upload/signature`, `/upload/save-url` |

Every CRUD resource supports: `?page=&limit=&search=&sort=&from=&to=` and exact filter params (whitelisted per resource).

## Auth header
```
Authorization: Bearer <accessToken>
```
Refresh token is set as `httpOnly` cookie at `/api/auth`. Call `POST /auth/refresh` to rotate.

## Socket.IO
Connect with `{ auth: { token: '<JWT>' } }`.
Events:
- `chat:join`, `chat:message`
- `tracking:subscribe` (orderId)
- Server emits: `order:created`, `order:paid`, `order:status`, `order:cancelled`, `chat:message`

## Stripe
1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
2. Point webhook → `https://your-domain/api/webhooks/stripe`.
3. Client calls `POST /api/payments/stripe/create-payment-intent` to get a `clientSecret`.

## Cloudinary
Client uploads images directly to Cloudinary using a signature from
`POST /api/upload/signature`. The resulting `secure_url` is what you persist
on product/review/profile records — no binary ever touches the API.

## Docker
```bash
docker build -t moom24-api .
docker run --env-file .env -p 5000:5000 moom24-api
```
