<div align="center">

<img src="https://img.shields.io/badge/nodezap-CLI-C0392B?style=for-the-badge&logo=node.js&logoColor=white" alt="nodezap" />

# nodezap ⚡

**Production-ready Express.js app scaffolder — zap in seconds.**

Scaffold a fully configured Express API with TypeScript, Zod env validation, structured logging, Swagger docs, testing infrastructure, Stripe, and more — all wired up before you write a single line of business logic.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![npm](https://img.shields.io/npm/v/nodezap?color=C0392B)](https://www.npmjs.com/package/nodezap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Getting Started](#-getting-started) · [Features](#-features) · [CLI Reference](#-cli-reference) · [Generated Structure](#-generated-project-structure) · [Configuration Options](#-configuration-options) · [Contributing](#-contributing)

</div>

---

## ✨ Features

| Category              | What's included                                                        |
| --------------------- | ---------------------------------------------------------------------- |
| 🔐 **Security**       | `helmet`, `cors` with configurable origins, `express-rate-limit`       |
| 🧪 **Testing**        | Vitest or Jest + `supertest`, pre-wired integration & unit tests       |
| 📋 **Logging**        | Pino (structured JSON) or Winston, `morgan` HTTP logs                  |
| 🌍 **Env validation** | Zod schema — crashes fast with clear error messages on missing vars    |
| 📖 **API Docs**       | Swagger UI / OpenAPI 3.1 with pre-built response schemas               |
| 🗄️ **Databases**      | MongoDB, PostgreSQL, MySQL, SQLite, Redis — pick one                   |
| 💳 **Payments**       | Stripe payment intents, checkout sessions, webhook handler             |
| 🔑 **Auth**           | JWT, Passport.js, or session-based — your choice                       |
| 🏗️ **Architecture**   | MVC or feature-based modular structure                                 |
| 🐳 **DevOps**         | Docker + docker-compose, multi-stage build                             |
| ⚡ **TypeScript**     | Full TS support, `ts-node-dev` hot reload, strict config               |
| 🧩 **Code gen**       | Generate full CRUD modules, controllers, routes after project creation |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`

### Install from npm

```bash
npm install -g nodezap
```

### Or clone and link locally

```bash
git clone https://github.com/radwanfahim/nodezap.git
cd nodezap
npm install
npm link
```

---

### Create your first app

```bash
nodezap new my-api
```

The interactive installer walks you through every choice:

```
  ⚡ nodezap — Production-ready Express apps, zap in seconds.

  ✦ New Project Setup

  ? Project name: my-api
  ? Description: My awesome API
  ? Language: TypeScript (recommended)
  ? Project structure: Modular (feature-based)
  ? Env variable validation: Zod
  ? Logger: Pino
  ? Database: MongoDB (Mongoose)
  ? Use Prisma ORM? No
  ? Integrate Stripe payments? Yes
  ? Authentication: JWT
  ? Include Swagger / OpenAPI docs? Yes
  ? Testing framework: Vitest
  ? Extra features: Rate limiting, Nodemailer
  ? Add Docker support? Yes
  ? Initialize git repo? Yes
  ? Install dependencies now? Yes
```

Then just:

```bash
cd my-api
cp .env.example .env   # fill in your secrets
npm run dev
```

```
🚀 my-api running on http://localhost:3000 [development]
📖 Swagger UI → http://localhost:3000/api-docs
```

---

## 📦 CLI Reference

### `nodezap new <app-name>`

Scaffold a new Express project interactively.

```bash
nodezap new my-api
nodezap new          # prompts for project name
```

---

### `nodezap generate` (alias: `g`)

Generate code inside an **existing** nodezap project. Run from your project root.

#### Generate a full CRUD module

```bash
nodezap generate module <name>
# alias
nodezap g module <name>
```

Creates a complete feature module with controller, routes, service, model, and validation:

```
src/modules/product/
  ├── product.controller.ts
  ├── product.routes.ts
  ├── product.service.ts
  ├── product.model.ts
  └── product.validation.ts
```

Routes are **automatically registered** in `src/routes/index.ts` — no manual wiring.

#### Generate a controller only

```bash
nodezap g controller <name>
```

#### Generate a route file only

```bash
nodezap g route <name>
```

#### Examples

```bash
nodezap g module product
nodezap g module blog-post      # kebab-case supported
nodezap g controller invoice
nodezap g route order
```

---

## 📁 Generated Project Structure

### Modular architecture

```
my-api/
├── src/
│   ├── app.ts                    # Entry point — Express setup
│   ├── config/
│   │   ├── env.ts                # Zod env schema & validation
│   │   └── cors.ts               # CORS options
│   ├── middleware/
│   │   ├── errorHandler.ts       # Global error handler (AppError)
│   │   ├── notFound.ts           # 404 handler
│   │   ├── validate.ts           # express-validator middleware
│   │   └── auth.ts               # JWT authenticate / authorize
│   ├── modules/
│   │   ├── user/
│   │   │   ├── user.controller.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.model.ts
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   └── payments/             # (if Stripe selected)
│   │       ├── stripe.controller.ts
│   │       └── stripe.routes.ts
│   ├── routes/
│   │   └── index.ts              # Central route registry
│   └── utils/
│       ├── logger.ts             # Pino / Winston logger
│       ├── response.ts           # sendSuccess / sendError / sendPaginated
│       ├── catchAsync.ts         # Async error wrapper
│       ├── swagger.ts            # Swagger spec & UI setup
│       └── mailer.ts             # Nodemailer helper (if selected)
├── tests/
│   ├── helpers/
│   │   └── setup.ts              # supertest helpers (api, get, post)
│   ├── integration/
│   │   └── health.test.ts        # Health & 404 integration tests
│   └── unit/
│       └── response.test.ts      # Response utility unit tests
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.test.json
└── README.md
```

### MVC architecture

```
my-api/
├── src/
│   ├── app.ts
│   ├── config/
│   ├── controllers/              # Request handlers
│   ├── middleware/
│   ├── models/                   # Data models
│   ├── routes/                   # Route definitions
│   ├── services/                 # Business logic
│   └── utils/
└── tests/
```

---

## ⚙️ Configuration Options

### Language

| Option                         | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| **TypeScript** _(recommended)_ | Full TS, `ts-node-dev` hot reload, strict `tsconfig`, typed middleware |
| **JavaScript**                 | CommonJS, `nodemon` hot reload                                         |

### Env Validation

| Option                  | Description                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Zod** _(recommended)_ | Schema-validated at startup. Crashes with formatted errors if any required var is missing or wrong type |
| **dotenv only**         | Standard `dotenv` config object, no runtime validation                                                  |

**Example Zod error output:**

```
❌ Invalid environment variables:
  ✖ JWT_SECRET: JWT_SECRET must be at least 32 characters
  ✖ MONGO_URI: Invalid url
  ✖ STRIPE_SECRET_KEY: Invalid input
```

### Logger

| Option                   | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| **Pino** _(recommended)_ | Structured JSON logging, `pino-http` request logs, `pino-pretty` in dev |
| **Winston**              | Multiple transports, file outputs for errors and combined logs          |
| **Morgan only**          | HTTP request logs only, console stub for app logging                    |

### Database

| Option     | Packages          |
| ---------- | ----------------- |
| MongoDB    | `mongoose`        |
| PostgreSQL | `pg` + `knex`     |
| MySQL      | `mysql2` + `knex` |
| SQLite     | `better-sqlite3`  |
| Redis      | `ioredis`         |
| None       | —                 |

> All SQL databases also offer **Prisma ORM** as an optional add-on.

### Testing

| Option                     | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| **Vitest** _(recommended)_ | Fast, ESM-native, same API as Jest. Includes `supertest`, watch mode, coverage |
| **Jest**                   | Battle-tested, wide ecosystem. `ts-jest` for TypeScript                        |
| **Mocha + Chai**           | Classic BDD style                                                              |
| None                       | —                                                                              |

Every testing option includes:

- `tests/helpers/setup.ts` — pre-configured `supertest` helpers
- `tests/integration/health.test.ts` — 3 passing tests out of the box
- `tests/unit/response.test.ts` — unit tests for response utilities

### Authentication

| Option        | Packages                                     |
| ------------- | -------------------------------------------- |
| JWT           | `jsonwebtoken`, `bcryptjs`                   |
| Passport.js   | `passport`, `passport-jwt`, `passport-local` |
| Session-based | `express-session`, `connect-redis`           |

### Extra Features

| Feature           | What's generated                                                                |
| ----------------- | ------------------------------------------------------------------------------- |
| **Stripe**        | Payment intents, checkout sessions, webhook handler with signature verification |
| **Socket.IO**     | `socket.ts` with room management and message broadcasting                       |
| **Rate limiting** | `express-rate-limit` on all `/api/` routes                                      |
| **Nodemailer**    | `utils/mailer.ts` with transport config                                         |
| **Bull**          | Job queue setup                                                                 |
| **Multer**        | File upload middleware                                                          |

---

## 🧩 NPM Scripts (generated app)

| Script                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Start with hot reload (`ts-node-dev` or `nodemon`) |
| `npm start`             | Production start                                   |
| `npm run build`         | Compile TypeScript to `dist/`                      |
| `npm run type-check`    | Type check without emitting                        |
| `npm test`              | Run all tests                                      |
| `npm run test:watch`    | Watch mode                                         |
| `npm run test:coverage` | Coverage report                                    |
| `npm run db:migrate`    | Run Prisma migrations _(if Prisma selected)_       |
| `npm run db:studio`     | Open Prisma Studio _(if Prisma selected)_          |

---

## 🔐 Environment Variables

A `.env.example` is always generated. Copy it to `.env` and fill in your values.

```bash
# Core
NODE_ENV=development
PORT=3000
APP_NAME=my-api

# Database (example: MongoDB)
MONGO_URI=mongodb://localhost:27017/my-api

# Auth
JWT_SECRET=use_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
```

> **With Zod validation**, the app will refuse to start and print exactly which variables are wrong or missing.

---

## 📖 API Documentation (Swagger)

When Swagger is enabled, Swagger UI is available at:

```
http://localhost:3000/api-docs
```

Pre-built response schemas (`SuccessResponse`, `ErrorResponse`, `PaginatedResponse`) are available to `$ref` in your JSDoc comments:

```typescript
/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Product list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
```

---

## 🛡️ Error Handling

Every generated app includes a global error handler in `src/middleware/errorHandler.ts`.

**Throw anywhere in your routes or services:**

```typescript
import { AppError } from "../middleware/errorHandler";

throw new AppError("User not found", 404);
throw new AppError("Invalid credentials", 401);
```

**All errors return consistent JSON:**

```json
{
  "success": false,
  "message": "User not found",
  "statusCode": 404
}
```

Unhandled errors return a generic message in production and include the stack trace in development.

---

## 💳 Stripe Integration

When Stripe is selected, three endpoints are generated:

| Method | Endpoint                            | Description                                  |
| ------ | ----------------------------------- | -------------------------------------------- |
| `POST` | `/api/v1/payments/payment-intent`   | Create a payment intent (custom UI / mobile) |
| `POST` | `/api/v1/payments/checkout-session` | Create a hosted Stripe checkout session      |
| `POST` | `/api/v1/payments/webhook`          | Stripe webhook with signature verification   |

Test webhooks locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

---

## 🐳 Docker

When Docker is selected, a multi-stage `Dockerfile` and `docker-compose.yml` are generated.

```bash
docker-compose up --build
```

---

## 🤝 Contributing

Contributions are very welcome!

```bash
git clone https://github.com/your-username/nodezap.git
cd nodezap
npm install
```

**Project layout:**

```
nodezap/
├── bin/
│   └── index.js            # CLI entry point & banner
├── lib/
│   ├── create-app.js       # Interactive prompts
│   ├── generator.js        # File generation logic
│   └── generate-module.js  # Module / controller / route generator
└── package.json
```

**Test your changes:**

```bash
npm link
mkdir /tmp/test-nodezap && cd /tmp/test-nodezap
nodezap new test-project
```

Please open an issue before submitting a large PR.

---

## 📄 License

MIT © [Radwan Fahim](https://github.com/radwanfahim)

---

<div align="center">

⚡Made with nodezap for the Node.js community

**[⬆ back to top](#nodezap-)**

</div>
