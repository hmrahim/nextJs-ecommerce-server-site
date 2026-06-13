# moom24-server

> Professional E-Commerce REST API — Node.js · Express · MongoDB (Mongoose)

---

## 📁 Folder Structure

```
moom24-server/
├── src/
│   ├── config/
│   │   └── database.js          ← Mongoose connection & events
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js   ← JWT protect + restrictTo(role)
│   │   └── errorHandler.js      ← Global error handler (Mongoose, JWT, etc.)
│   │
│   ├── models/                  ← 16 Mongoose models (schema diagram)
│   │   ├── index.js             ← Barrel export
│   │   ├── User.model.js
│   │   ├── Category.model.js
│   │   ├── Brand.model.js
│   │   ├── Product.model.js
│   │   ├── Warehouse.model.js
│   │   ├── Inventory.model.js
│   │   ├── Cart.model.js
│   │   ├── Coupon.model.js
│   │   ├── Order.model.js
│   │   ├── Payment.model.js
│   │   ├── Shipment.model.js
│   │   ├── Review.model.js
│   │   ├── Wishlist.model.js
│   │   ├── Notification.model.js
│   │   ├── SearchLog.model.js
│   │   └── AuditLog.model.js
│   │
│   ├── controllers/             ← Request handlers (thin, delegate to service)
│   ├── routes/                  ← Express routers
│   ├── services/                ← Business logic (called from controllers)
│   ├── validators/              ← express-validator rule chains + runner
│   │   └── validate.js          ← handleValidation middleware
│   │
│   ├── utils/
│   │   ├── logger.js            ← Winston logger (console + file)
│   │   └── apiHelpers.js        ← ApiError + ApiResponse helpers
│   │
│   ├── app.js                   ← Express app: middleware + routes + error handlers
│   └── server.js                ← Entry point: dotenv → DB → listen → graceful shutdown
│
├── logs/                        ← Winston log files (git-ignored)
├── .env.example                 ← Copy to .env and fill values
├── .eslintrc.js
├── nodemon.json
└── package.json
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set MONGO_URI and JWT_SECRET

# 3. Development (hot-reload)
npm run dev

# 4. Production
npm start
```

---

## 🔌 Adding a New Route

1. Write business logic in `src/services/<module>.service.js`
2. Write controller methods in `src/controllers/<module>.controller.js`
3. Define route handlers in `src/routes/<module>.routes.js`
4. Uncomment the corresponding line in `src/app.js`

---

## 🛡 Auth Flow

```
POST /api/v1/auth/login  →  returns { accessToken, refreshToken }

Authorization: Bearer <accessToken>   (on protected routes)
```

Middleware stacking example:
```js
router.delete('/:id', protect, restrictTo('admin'), handler);
```

---

## 📦 Key Packages

| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `mongoose` | MongoDB ODM |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT auth |
| `helmet` | Security headers |
| `cors` | Cross-origin requests |
| `express-rate-limit` | Rate limiting |
| `express-mongo-sanitize` | NoSQL injection protection |
| `express-validator` | Input validation |
| `winston` | Logging |
| `morgan` | HTTP request logging |
| `compression` | Gzip responses |
| `dotenv` | Environment variables |
| `slugify` | Auto-generate URL slugs |
