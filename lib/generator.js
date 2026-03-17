"use strict";

const fs = require("fs-extra");
const path = require("path");

async function generateProjectFiles(config, targetDir) {
  fs.ensureDirSync(targetDir);

  const deps = buildDeps(config);
  const devDeps = buildDevDeps(config);

  writePackageJson(config, targetDir, deps, devDeps);
  writeEnvFiles(config, targetDir);
  writeGitignore(targetDir);
  writeEnvConfig(config, targetDir); // Zod or dotenv env validator
  writeAppEntry(config, targetDir);
  writeCorsConfig(config, targetDir);
  writeMiddleware(config, targetDir); // errorHandler + notFound + validate + auth
  writeRoutes(config, targetDir);
  writeLogger(config, targetDir); // pino or winston
  writeUtils(config, targetDir);
  writeSwagger(config, targetDir); // always if swagger=true

  if (config.architecture === "mvc") writeMvcStructure(config, targetDir);
  else writeModularStructure(config, targetDir);

  if (config.database !== "none") writeDbConfig(config, targetDir);
  if (config.stripe) writeStripeFiles(config, targetDir);
  if (config.authOptions.length > 0) writeAuthFiles(config, targetDir);
  if (config.extras.includes("socketio")) writeSocketFile(config, targetDir);
  if (config.docker) writeDocker(config, targetDir);
  if (config.testing !== "none") writeTestSetup(config, targetDir);
  if (config.language === "ts") writeTsConfig(targetDir);
  writeReadme(config, targetDir);
}

// ─── Deps ─────────────────────────────────────────────────────────────────────

function buildDeps(c) {
  const d = [
    "express",
    "helmet",
    "cors",
    "dotenv",
    "compression",
    "express-async-errors",
    "http-status-codes",
    "express-validator",
    "morgan",
  ];
  if (c.envValidator === "zod") d.push("zod");
  if (c.logger === "pino") d.push("pino", "pino-http");
  if (c.logger === "winston") d.push("winston");
  if (c.swagger) d.push("swagger-jsdoc", "swagger-ui-express");
  if (c.database === "mongodb") d.push("mongoose");
  if (["postgres", "mysql"].includes(c.database)) d.push("knex");
  if (c.database === "postgres") d.push("pg");
  if (c.database === "mysql") d.push("mysql2");
  if (c.database === "sqlite") d.push("better-sqlite3");
  if (c.database === "redis") d.push("ioredis");
  if (c.useOrm) d.push("@prisma/client");
  if (c.stripe) d.push("stripe");
  if (c.authOptions.includes("jwt")) d.push("jsonwebtoken", "bcryptjs");
  if (c.authOptions.includes("passport"))
    d.push("passport", "passport-jwt", "passport-local");
  if (c.authOptions.includes("session"))
    d.push("express-session", "connect-redis");
  if (c.extras.includes("socketio")) d.push("socket.io");
  if (c.extras.includes("bull")) d.push("bull");
  if (c.extras.includes("nodemailer")) d.push("nodemailer");
  if (c.extras.includes("ratelimit")) d.push("express-rate-limit");
  if (c.extras.includes("multer")) d.push("multer");
  return d;
}

function buildDevDeps(c) {
  const d = [];
  if (c.language === "ts") {
    d.push(
      "typescript",
      "ts-node-dev",
      "@types/node",
      "@types/express",
      "@types/cors",
      "@types/compression",
      "@types/morgan",
    );
    if (c.authOptions.includes("jwt"))
      d.push("@types/jsonwebtoken", "@types/bcryptjs");
    if (c.swagger) d.push("@types/swagger-jsdoc", "@types/swagger-ui-express");
    if (c.extras.includes("multer")) d.push("@types/multer");
  } else {
    d.push("nodemon");
  }
  if (c.useOrm) d.push("prisma");
  if (c.testing === "vitest")
    d.push("vitest", "supertest", "@vitest/coverage-v8");
  if (c.testing === "jest")
    d.push("jest", "supertest", "@types/jest", "@types/supertest", "ts-jest");
  if (c.testing === "mocha") d.push("mocha", "chai", "supertest");
  return d;
}

// ─── package.json ─────────────────────────────────────────────────────────────

function writePackageJson(c, dir, deps, devDeps) {
  const isTs = c.language === "ts";
  const scripts = {};

  if (isTs) {
    scripts.dev = "ts-node-dev --respawn --transpile-only src/app.ts";
    scripts.build = "tsc";
    scripts.start = "node dist/app.js";
    scripts["type-check"] = "tsc --noEmit";
  } else {
    scripts.dev = "nodemon src/app.js";
    scripts.start = "node src/app.js";
  }

  if (c.testing === "vitest") {
    scripts.test = "vitest run";
    scripts["test:watch"] = "vitest";
    scripts["test:coverage"] = "vitest run --coverage";
  } else if (c.testing === "jest") {
    scripts.test = isTs ? "jest --forceExit" : "jest --forceExit";
    scripts["test:watch"] = "jest --watch";
    scripts["test:coverage"] = "jest --coverage --forceExit";
  } else if (c.testing === "mocha") {
    scripts.test = "mocha tests/**/*.test.js";
  }

  if (c.useOrm) {
    scripts["db:generate"] = "prisma generate";
    scripts["db:migrate"] = "prisma migrate dev";
    scripts["db:studio"] = "prisma studio";
  }

  const pkg = {
    name: c.projectName,
    version: "0.1.0",
    description: c.description,
    ...(isTs ? {} : { main: "src/app.js" }),
    scripts,
    dependencies: deps.reduce((a, d) => ({ ...a, [d]: "latest" }), {}),
    devDependencies: devDeps.reduce((a, d) => ({ ...a, [d]: "latest" }), {}),
  };

  if (c.testing === "jest" && isTs) {
    pkg.jest = {
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["**/tests/**/*.test.ts"],
    };
  } else if (c.testing === "jest") {
    pkg.jest = {
      testEnvironment: "node",
      testMatch: ["**/tests/**/*.test.js"],
    };
  }

  if (c.testing === "vitest") {
    pkg.vitest = {
      test: {
        environment: "node",
        globals: true,
        coverage: { reporter: ["text", "lcov"] },
      },
    };
  }

  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(pkg, null, 2),
  );
}

// ─── .env files ───────────────────────────────────────────────────────────────

function writeEnvFiles(c, dir) {
  const lines = [
    `NODE_ENV=development`,
    `PORT=3000`,
    `APP_NAME=${c.projectName}`,
    "",
  ];
  if (c.database === "mongodb")
    lines.push(`MONGO_URI=mongodb://localhost:27017/${c.projectName}`, "");
  if (["postgres", "mysql"].includes(c.database))
    lines.push(`DATABASE_URL=your_database_url_here`, "");
  if (c.database === "sqlite")
    lines.push(`DATABASE_PATH=./data/${c.projectName}.db`, "");
  if (c.database === "redis")
    lines.push(`REDIS_URL=redis://localhost:6379`, "");
  if (c.authOptions.includes("jwt"))
    lines.push(
      `JWT_SECRET=change_me_use_a_long_random_string_here`,
      `JWT_EXPIRES_IN=7d`,
      "",
    );
  if (c.authOptions.includes("session"))
    lines.push(`SESSION_SECRET=change_me_in_production`, "");
  if (c.stripe) {
    lines.push(
      `# Stripe — https://dashboard.stripe.com/apikeys`,
      `STRIPE_SECRET_KEY=sk_test_your_key_here`,
      `STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here`,
      `STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret`,
      "",
    );
  }
  if (c.extras.includes("nodemailer"))
    lines.push(
      `SMTP_HOST=smtp.gmail.com`,
      `SMTP_PORT=587`,
      `SMTP_USER=`,
      `SMTP_PASS=`,
      "",
    );

  fs.writeFileSync(path.join(dir, ".env"), lines.join("\n"));
  fs.writeFileSync(path.join(dir, ".env.example"), lines.join("\n"));
}

// ─── .gitignore ───────────────────────────────────────────────────────────────

function writeGitignore(dir) {
  fs.writeFileSync(
    path.join(dir, ".gitignore"),
    [
      "node_modules/",
      "dist/",
      "build/",
      ".env",
      "*.log",
      "coverage/",
      ".DS_Store",
      "*.sqlite",
      "uploads/",
    ].join("\n"),
  );
}

// ─── Env config (Zod or plain dotenv) ────────────────────────────────────────

function writeEnvConfig(c, dir) {
  const cfgDir = path.join(dir, "src", "config");
  fs.ensureDirSync(cfgDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  if (c.envValidator === "zod") {
    const zodEnvTs = `import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1),
${c.database === "mongodb" ? "  MONGO_URI: z.string().url(),\n" : ""}${["postgres", "mysql"].includes(c.database) ? "  DATABASE_URL: z.string().url(),\n" : ""}${c.database === "sqlite" ? "  DATABASE_PATH: z.string().min(1),\n" : ""}${c.database === "redis" ? "  REDIS_URL: z.string().url(),\n" : ""}${c.authOptions.includes("jwt") ? "  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),\n  JWT_EXPIRES_IN: z.string().default('7d'),\n" : ""}${c.authOptions.includes("session") ? "  SESSION_SECRET: z.string().min(1),\n" : ""}${c.stripe ? "  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),\n  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),\n  STRIPE_WEBHOOK_SECRET: z.string().optional(),\n" : ""}${c.extras.includes("nodemailer") ? "  SMTP_HOST: z.string().min(1),\n  SMTP_PORT: z.coerce.number().default(587),\n  SMTP_USER: z.string().email().optional(),\n  SMTP_PASS: z.string().optional(),\n" : ""}});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const formatted = _parsed.error.issues
    .map(i => \`  ✖ \${i.path.join('.')}: \${i.message}\`)
    .join('\\n');
  console.error(\`\\n❌ Invalid environment variables:\\n\${formatted}\\n\`);
  process.exit(1);
}

export const env = _parsed.data;
export type Env = z.infer<typeof envSchema>;
`;

    const zodEnvJs = `const { z } = require('zod');
require('dotenv/config');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1),
${c.database === "mongodb" ? "  MONGO_URI: z.string().url(),\n" : ""}${["postgres", "mysql"].includes(c.database) ? "  DATABASE_URL: z.string().url(),\n" : ""}${c.database === "sqlite" ? "  DATABASE_PATH: z.string().min(1),\n" : ""}${c.database === "redis" ? "  REDIS_URL: z.string().url(),\n" : ""}${c.authOptions.includes("jwt") ? "  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),\n  JWT_EXPIRES_IN: z.string().default('7d'),\n" : ""}${c.authOptions.includes("session") ? "  SESSION_SECRET: z.string().min(1),\n" : ""}${c.stripe ? "  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),\n  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),\n  STRIPE_WEBHOOK_SECRET: z.string().optional(),\n" : ""}});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const formatted = _parsed.error.issues
    .map(i => \`  ✖ \${i.path.join('.')}: \${i.message}\`)
    .join('\\n');
  console.error(\`\\n❌ Invalid environment variables:\\n\${formatted}\\n\`);
  process.exit(1);
}

const env = _parsed.data;
module.exports = { env };
`;
    fs.writeFileSync(
      path.join(cfgDir, `env.${ext}`),
      isTs ? zodEnvTs : zodEnvJs,
    );
  } else {
    // Plain dotenv
    const plain = isTs
      ? `import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_NAME: process.env.APP_NAME || '${c.projectName}',
${c.database === "mongodb" ? "  MONGO_URI: process.env.MONGO_URI || '',\n" : ""}${["postgres", "mysql"].includes(c.database) ? "  DATABASE_URL: process.env.DATABASE_URL || '',\n" : ""}${c.authOptions.includes("jwt") ? "  JWT_SECRET: process.env.JWT_SECRET || '',\n  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',\n" : ""}${c.stripe ? "  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',\n" : ""}};
`
      : `require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_NAME: process.env.APP_NAME || '${c.projectName}',
${c.database === "mongodb" ? "  MONGO_URI: process.env.MONGO_URI || '',\n" : ""}${["postgres", "mysql"].includes(c.database) ? "  DATABASE_URL: process.env.DATABASE_URL || '',\n" : ""}${c.authOptions.includes("jwt") ? "  JWT_SECRET: process.env.JWT_SECRET || '',\n  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',\n" : ""}${c.stripe ? "  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',\n" : ""}};

module.exports = { env };
`;
    fs.writeFileSync(path.join(cfgDir, `env.${ext}`), plain);
  }

  // CORS config
  fs.writeFileSync(
    path.join(cfgDir, `cors.${ext}`),
    isTs
      ? `import { CorsOptions } from 'cors';

export const corsOptions: CorsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};
`
      : `const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = { corsOptions };
`,
  );
}

// ─── Logger (pino / winston / morgan-only) ────────────────────────────────────

function writeLogger(c, dir) {
  const utilsDir = path.join(dir, "src", "utils");
  fs.ensureDirSync(utilsDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  if (c.logger === "pino") {
    fs.writeFileSync(
      path.join(utilsDir, `logger.${ext}`),
      isTs
        ? `import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

export default logger;
`
        : `const pino = require('pino');

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

module.exports = logger;
`,
    );
  } else if (c.logger === "winston") {
    fs.writeFileSync(
      path.join(utilsDir, `logger.${ext}`),
      isTs
        ? `import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack }) =>
      \`\${timestamp} [\${level}]: \${stack || message}\`
    ),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/app.log' }),
  ],
});

export default logger;
`
        : `const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack }) =>
      \`\${timestamp} [\${level}]: \${stack || message}\`
    ),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/app.log' }),
  ],
});

module.exports = logger;
`,
    );
  } else {
    // morgan only — stub logger that delegates to console
    fs.writeFileSync(
      path.join(utilsDir, `logger.${ext}`),
      isTs
        ? `const logger = {
  debug: (...args: unknown[]) => process.env.NODE_ENV !== 'production' && console.debug('[debug]', ...args),
  info:  (...args: unknown[]) => console.info('[info]', ...args),
  warn:  (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
};

export default logger;
`
        : `const logger = {
  debug: (...args) => process.env.NODE_ENV !== 'production' && console.debug('[debug]', ...args),
  info:  (...args) => console.info('[info]',  ...args),
  warn:  (...args) => console.warn('[warn]',  ...args),
  error: (...args) => console.error('[error]', ...args),
};

module.exports = logger;
`,
    );
  }
}

// ─── App entry ────────────────────────────────────────────────────────────────

function writeAppEntry(c, dir) {
  const srcDir = path.join(dir, "src");
  fs.ensureDirSync(srcDir);
  const isTs = c.language === "ts";
  const hasSocket = c.extras.includes("socketio");
  const hasRateLimit = c.extras.includes("ratelimit");
  const loggerImport = isTs
    ? `import logger from './utils/logger';`
    : `const logger = require('./utils/logger');`;
  const corsImport = isTs
    ? `import { corsOptions } from './config/cors';`
    : `const { corsOptions } = require('./config/cors');`;
  const envImport = isTs
    ? `import { env } from './config/env';`
    : `const { env } = require('./config/env');`;
  const pinoHttp =
    c.logger === "pino"
      ? isTs
        ? `import pinoHttp from 'pino-http';`
        : `const pinoHttp = require('pino-http');`
      : "";

  const code = isTs
    ? `import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
${hasRateLimit ? "import rateLimit from 'express-rate-limit';" : ""}
${hasSocket ? "import { createServer } from 'http';\nimport { Server } from 'socket.io';" : ""}
${c.swagger ? "import { swaggerUi, swaggerSpec } from './utils/swagger';" : ""}
${pinoHttp}
${corsImport}
${envImport}
${loggerImport}
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();
${hasSocket ? "const httpServer = createServer(app);\nconst io = new Server(httpServer, { cors: corsOptions as any });" : ""}

// ── Security & Core ────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
${c.logger === "pino" ? "app.use(pinoHttp({ logger }));" : "app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));"}

${
  hasRateLimit
    ? `// ── Rate Limiting ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — try again later.' },
});
app.use('/api/', limiter);
`
    : ""
}
${
  c.swagger
    ? `// ── Swagger UI ─────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
`
    : ""
}
// ── Health ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, uptime: process.uptime(), env: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Error Handling ──────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

${hasSocket ? "// ── Socket.IO ──────────────────────────────────────────────\nrequire('./socket').default(io);\n" : ""}
const server = ${hasSocket ? "httpServer" : "app"}.listen(env.PORT, () => {
  logger.info(\`🚀 \${env.APP_NAME} running on http://localhost:\${env.PORT} [\${env.NODE_ENV}]\`);
${c.swagger ? "  logger.info(`📖 Swagger UI → http://localhost:${env.PORT}/api-docs`);\n" : ""}});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully…');
  server.close(() => process.exit(0));
});

export default app;
`
    : `require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
${hasRateLimit ? "const rateLimit = require('express-rate-limit');" : ""}
${hasSocket ? "const { createServer } = require('http');\nconst { Server } = require('socket.io');" : ""}
${c.swagger ? "const { swaggerUi, swaggerSpec } = require('./utils/swagger');" : ""}
${c.logger === "pino" ? "const pinoHttp = require('pino-http');" : ""}
const { corsOptions } = require('./config/cors');
const { env } = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const app = express();
${hasSocket ? "const httpServer = createServer(app);\nconst io = new Server(httpServer, { cors: corsOptions });" : ""}

// ── Security & Core ─────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
${c.logger === "pino" ? "app.use(pinoHttp({ logger }));" : "app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));"}

${
  hasRateLimit
    ? `// ── Rate Limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — try again later.' },
});
app.use('/api/', limiter);
`
    : ""
}${
        c.swagger
          ? `// ── Swagger UI ───────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
`
          : ""
      }
// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, uptime: process.uptime(), env: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

${hasSocket ? "// ── Socket.IO ──────────────────────────────────────────────\nrequire('./socket')(io);\n" : ""}
const server = ${hasSocket ? "httpServer" : "app"}.listen(env.PORT, () => {
  logger.info(\`🚀 \${env.APP_NAME} running on http://localhost:\${env.PORT} [\${env.NODE_ENV}]\`);
${c.swagger ? "  logger.info(`📖 Swagger UI → http://localhost:${env.PORT}/api-docs`);\n" : ""}});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down…');
  server.close(() => process.exit(0));
});

module.exports = app;
`;

  const ext = isTs ? "ts" : "js";
  fs.writeFileSync(path.join(srcDir, `app.${ext}`), code);
}

// ─── CORS config (already written inside writeEnvConfig) ─────────────────────
function writeCorsConfig() {} // no-op — handled above

// ─── Middleware ───────────────────────────────────────────────────────────────

function writeMiddleware(c, dir) {
  const mwDir = path.join(dir, "src", "middleware");
  fs.ensureDirSync(mwDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  // ── Global Error Handler ───────────────────────────────────
  fs.writeFileSync(
    path.join(mwDir, `errorHandler.${ext}`),
    isTs
      ? `import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import logger from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  errors?: unknown[];
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error & { statusCode?: number; errors?: unknown[] }, _req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = (err as AppError).statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const isOperational = (err as AppError).isOperational ?? false;

  // Log every error; for unhandled ones include full stack
  if (!isOperational) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ message: err.message, statusCode }, 'Operational error');
  }

  const response: ErrorResponse = {
    success: false,
    message: isOperational ? err.message : 'An unexpected error occurred',
    statusCode,
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};
`
      : `const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const isOperational = err.isOperational ?? false;

  if (!isOperational) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn(\`Operational error [\${statusCode}]: \${err.message}\`);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'An unexpected error occurred',
    statusCode,
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = { AppError, errorHandler };
`,
  );

  // ── 404 Not Found ─────────────────────────────────────────
  fs.writeFileSync(
    path.join(mwDir, `notFound.${ext}`),
    isTs
      ? `import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const notFound = (req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: \`Cannot \${req.method} \${req.originalUrl}\`,
    statusCode: StatusCodes.NOT_FOUND,
  });
};
`
      : `const { StatusCodes } = require('http-status-codes');

const notFound = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: \`Cannot \${req.method} \${req.originalUrl}\`,
    statusCode: StatusCodes.NOT_FOUND,
  });
};

module.exports = { notFound };
`,
  );

  // ── Validation ────────────────────────────────────────────
  fs.writeFileSync(
    path.join(mwDir, `validate.${ext}`),
    isTs
      ? `import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: 'Validation failed',
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      errors: errors.array().map(e => ({ field: (e as any).param, message: e.msg })),
    });
    return;
  }
  next();
};
`
      : `const { validationResult } = require('express-validator');
const { StatusCodes } = require('http-status-codes');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: 'Validation failed',
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      errors: errors.array().map(e => ({ field: e.param, message: e.msg })),
    });
  }
  next();
};

module.exports = { validate };
`,
  );

  // ── JWT Auth ──────────────────────────────────────────────
  if (c.authOptions.includes("jwt")) {
    fs.writeFileSync(
      path.join(mwDir, `auth.${ext}`),
      isTs
        ? `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

export interface JwtPayload {
  id: string;
  email: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'No token provided', statusCode: 401 });
    return;
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as JwtPayload;
    next();
  } catch {
    res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token', statusCode: 401 });
  }
};

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Insufficient permissions', statusCode: 403 });
      return;
    }
    next();
  };
`
        : `const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'No token provided', statusCode: 401 });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token', statusCode: 401 });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Insufficient permissions', statusCode: 403 });
  }
  next();
};

module.exports = { authenticate, authorize };
`,
    );
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function writeRoutes(c, dir) {
  const routesDir = path.join(dir, "src", "routes");
  fs.ensureDirSync(routesDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  fs.writeFileSync(
    path.join(routesDir, `index.${ext}`),
    isTs
      ? `import { Router } from 'express';
// import userRoutes from './user.routes';

const router = Router();

// router.use('/users', userRoutes);

router.get('/', (_req, res) => {
  res.json({ success: true, version: '1.0.0', message: 'API is running' });
});

export default router;
`
      : `const { Router } = require('express');
// const userRoutes = require('./user.routes');

const router = Router();

// router.use('/users', userRoutes);

router.get('/', (_req, res) => {
  res.json({ success: true, version: '1.0.0', message: 'API is running' });
});

module.exports = router;
`,
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function writeUtils(c, dir) {
  const utilsDir = path.join(dir, "src", "utils");
  fs.ensureDirSync(utilsDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  // Response helpers
  fs.writeFileSync(
    path.join(utilsDir, `response.${ext}`),
    isTs
      ? `import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T | null = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

export const sendError = (res: Response, message = 'Error', statusCode = 400, errors?: unknown[]) =>
  res.status(statusCode).json({ success: false, message, statusCode, ...(errors && { errors }) });

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const sendPaginated = <T>(res: Response, data: T[], pagination: PaginationMeta) =>
  res.json({ success: true, data, pagination });
`
      : `const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message = 'Error', statusCode = 400, errors = null) =>
  res.status(statusCode).json({ success: false, message, statusCode, ...(errors && { errors }) });

const sendPaginated = (res, data, pagination) =>
  res.json({ success: true, data, pagination });

module.exports = { sendSuccess, sendError, sendPaginated };
`,
  );

  // catchAsync
  fs.writeFileSync(
    path.join(utilsDir, `catchAsync.${ext}`),
    isTs
      ? `import { Request, Response, NextFunction, RequestHandler } from 'express';

const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

export default catchAsync;
`
      : `const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = catchAsync;
`,
  );

  if (c.extras.includes("nodemailer")) {
    fs.writeFileSync(
      path.join(utilsDir, `mailer.${ext}`),
      isTs
        ? `import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

interface MailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export const sendMail = (opts: MailOptions) =>
  transporter.sendMail({
    from: \`"\${process.env.APP_NAME}" <\${process.env.SMTP_USER}>\`,
    ...opts,
  });
`
        : `const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendMail = ({ to, subject, html, text }) =>
  transporter.sendMail({
    from: \`"\${process.env.APP_NAME}" <\${process.env.SMTP_USER}>\`,
    to, subject, html, text,
  });

module.exports = { sendMail };
`,
    );
  }
}

// ─── Swagger ──────────────────────────────────────────────────────────────────

function writeSwagger(c, dir) {
  if (!c.swagger) return;
  const utilsDir = path.join(dir, "src", "utils");
  fs.ensureDirSync(utilsDir);
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";

  fs.writeFileSync(
    path.join(utilsDir, `swagger.${ext}`),
    isTs
      ? `import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: process.env.APP_NAME || 'API',
      version: '1.0.0',
      description: 'Auto-generated API documentation',
      contact: { name: 'API Support', email: 'support@example.com' },
    },
    servers: [
      { url: \`http://localhost:\${process.env.PORT || 3000}/api/v1\`, description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/modules/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };
`
      : `const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: process.env.APP_NAME || 'API',
      version: '1.0.0',
      description: 'Auto-generated API documentation',
    },
    servers: [
      { url: \`http://localhost:\${process.env.PORT || 3000}/api/v1\`, description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/modules/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };
`,
  );
}

// ─── MVC Structure ────────────────────────────────────────────────────────────

function writeMvcStructure(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  ["controllers", "models", "services"].forEach((d) => {
    fs.ensureDirSync(path.join(dir, "src", d));
  });

  fs.writeFileSync(
    path.join(dir, "src", "controllers", `user.controller.${ext}`),
    isTs
      ? `import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess, sendPaginated } from '../utils/response';

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
export const getAllUsers = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  // const { data, total } = await UserService.findAll({ page, limit });
  sendPaginated(res, [], { page, limit, total: 0, totalPages: 0 });
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  sendSuccess(res, { id }, 'User retrieved');
};

export const createUser = async (req: Request, res: Response) => {
  sendSuccess(res, req.body, 'User created', StatusCodes.CREATED);
};

export const updateUser = async (req: Request, res: Response) => {
  sendSuccess(res, { id: req.params.id, ...req.body }, 'User updated');
};

export const deleteUser = async (_req: Request, res: Response) => {
  sendSuccess(res, null, 'User deleted');
};
`
      : `const { StatusCodes } = require('http-status-codes');
const { sendSuccess, sendPaginated } = require('../utils/response');

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: User list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  sendPaginated(res, [], { page, limit, total: 0, totalPages: 0 });
};

const getUserById = async (req, res) => sendSuccess(res, { id: req.params.id }, 'User retrieved');
const createUser = async (req, res) => sendSuccess(res, req.body, 'User created', StatusCodes.CREATED);
const updateUser = async (req, res) => sendSuccess(res, { id: req.params.id, ...req.body }, 'User updated');
const deleteUser = async (_req, res) => sendSuccess(res, null, 'User deleted');

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };
`,
  );

  fs.writeFileSync(
    path.join(dir, "src", "routes", `user.routes.${ext}`),
    isTs
      ? `import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/user.controller';
// import { authenticate } from '../middleware/auth';

const router = Router();

// router.use(authenticate);

router.get('/', query('page').optional().isInt({ min: 1 }), validate, getAllUsers);
router.get('/:id', param('id').notEmpty(), validate, getUserById);
router.post('/', body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 }), validate, createUser);
router.patch('/:id', param('id').notEmpty(), validate, updateUser);
router.delete('/:id', param('id').notEmpty(), validate, deleteUser);

export default router;
`
      : `const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/user.controller');
// const { authenticate } = require('../middleware/auth');

const router = Router();

// router.use(authenticate);

router.get('/', query('page').optional().isInt({ min: 1 }), validate, getAllUsers);
router.get('/:id', param('id').notEmpty(), validate, getUserById);
router.post('/', body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 }), validate, createUser);
router.patch('/:id', param('id').notEmpty(), validate, updateUser);
router.delete('/:id', param('id').notEmpty(), validate, deleteUser);

module.exports = router;
`,
  );
}

// ─── Modular Structure ────────────────────────────────────────────────────────

function writeModularStructure(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  const modulesDir = path.join(dir, "src", "modules");
  const userDir = path.join(modulesDir, "user");
  fs.ensureDirSync(userDir);

  fs.writeFileSync(
    path.join(userDir, `user.controller.${ext}`),
    isTs
      ? `import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess, sendPaginated } from '../../utils/response';
// import UserService from './user.service';

export const getAllUsers = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  sendPaginated(res, [], { page, limit, total: 0, totalPages: 0 });
};

export const getUserById = async (req: Request, res: Response) => {
  sendSuccess(res, { id: req.params.id }, 'User retrieved');
};

export const createUser = async (req: Request, res: Response) => {
  sendSuccess(res, req.body, 'User created', StatusCodes.CREATED);
};

export const updateUser = async (req: Request, res: Response) => {
  sendSuccess(res, { id: req.params.id, ...req.body }, 'User updated');
};

export const deleteUser = async (_req: Request, res: Response) => {
  sendSuccess(res, null, 'User deleted');
};
`
      : `const { StatusCodes } = require('http-status-codes');
const { sendSuccess, sendPaginated } = require('../../utils/response');

const getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  sendPaginated(res, [], { page, limit, total: 0, totalPages: 0 });
};
const getUserById = async (req, res) => sendSuccess(res, { id: req.params.id }, 'User retrieved');
const createUser = async (req, res) => sendSuccess(res, req.body, 'User created', StatusCodes.CREATED);
const updateUser = async (req, res) => sendSuccess(res, { id: req.params.id, ...req.body }, 'User updated');
const deleteUser = async (_req, res) => sendSuccess(res, null, 'User deleted');

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };
`,
  );

  fs.writeFileSync(
    path.join(userDir, `user.routes.${ext}`),
    isTs
      ? `import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validate';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from './user.controller';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', param('id').notEmpty(), validate, getUserById);
router.post('/', body('email').isEmail(), body('password').isLength({ min: 8 }), validate, createUser);
router.patch('/:id', param('id').notEmpty(), validate, updateUser);
router.delete('/:id', param('id').notEmpty(), validate, deleteUser);

export default router;
`
      : `const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validate');
const ctrl = require('./user.controller');

const router = Router();

router.get('/', ctrl.getAllUsers);
router.get('/:id', param('id').notEmpty(), validate, ctrl.getUserById);
router.post('/', body('email').isEmail(), validate, ctrl.createUser);
router.patch('/:id', param('id').notEmpty(), validate, ctrl.updateUser);
router.delete('/:id', param('id').notEmpty(), validate, ctrl.deleteUser);

module.exports = router;
`,
  );

  fs.writeFileSync(
    path.join(userDir, `user.service.${ext}`),
    isTs
      ? `interface FindAllOptions {
  page?: number;
  limit?: number;
  filters?: Record<string, unknown>;
}

const UserService = {
  async findAll({ page = 1, limit = 20 }: FindAllOptions = {}) {
    // TODO: implement DB query
    return { data: [], total: 0 };
  },
  async findById(id: string) {
    // TODO: implement DB query
    return null;
  },
  async create(data: Record<string, unknown>) {
    // TODO: implement DB insert
    return data;
  },
  async update(id: string, data: Record<string, unknown>) {
    // TODO: implement DB update
    return { id, ...data };
  },
  async remove(id: string) {
    // TODO: implement DB delete
    return true;
  },
};

export default UserService;
`
      : `const UserService = {
  async findAll({ page = 1, limit = 20 } = {}) {
    return { data: [], total: 0 };
  },
  async findById(id) { return null; },
  async create(data) { return data; },
  async update(id, data) { return { id, ...data }; },
  async remove(id) { return true; },
};

module.exports = UserService;
`,
  );
}

// ─── DB config ────────────────────────────────────────────────────────────────

function writeDbConfig(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  const cfgDir = path.join(dir, "src", "config");
  fs.ensureDirSync(cfgDir);

  let code = "";
  if (c.database === "mongodb") {
    code = isTs
      ? `import mongoose from 'mongoose';
import logger from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!, { serverSelectionTimeoutMS: 5000 });
    logger.info(\`MongoDB connected: \${conn.connection.host}\`);
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};
`
      : `const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    logger.info(\`MongoDB connected: \${conn.connection.host}\`);
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
`;
  } else if (["postgres", "mysql"].includes(c.database)) {
    const client = c.database === "postgres" ? "pg" : "mysql2";
    code = isTs
      ? `import knex from 'knex';

const db = knex({
  client: '${client}',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: { tableName: 'knex_migrations', directory: './migrations' },
});

export default db;
`
      : `const knex = require('knex');

const db = knex({
  client: '${client}',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

module.exports = db;
`;
  } else if (c.database === "sqlite") {
    code = isTs
      ? `import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '../../data/app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
logger.info('SQLite connected');

export default db;
`
      : `const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '../../data/app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
logger.info('SQLite connected');

module.exports = db;
`;
  } else if (c.database === "redis") {
    code = isTs
      ? `import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

export default redis;
`
      : `const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

module.exports = redis;
`;
  }
  fs.writeFileSync(path.join(cfgDir, `database.${ext}`), code);
}

// ─── Auth files ───────────────────────────────────────────────────────────────

function writeAuthFiles(c, dir) {
  if (!c.authOptions.includes("jwt")) return;
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  const arch = c.architecture;

  const ctrlDir =
    arch === "mvc"
      ? path.join(dir, "src", "controllers")
      : path.join(dir, "src", "modules", "auth");
  fs.ensureDirSync(ctrlDir);

  fs.writeFileSync(
    path.join(ctrlDir, `auth.controller.${ext}`),
    isTs
      ? `import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '${arch === "mvc" ? "../" : "../../"}utils/response';
import { AppError } from '${arch === "mvc" ? "../" : "../../"}middleware/errorHandler';

const signToken = (payload: object) =>
  jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const hashed = await bcrypt.hash(password, 12);
  // TODO: const user = await UserService.create({ email, password: hashed, name });
  const user = { id: 'new-id', email, name };
  const token = signToken({ id: user.id, email: user.email });
  sendSuccess(res, { user, token }, 'Account created', StatusCodes.CREATED);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  // TODO: const user = await UserService.findByEmail(email);
  // if (!user || !(await bcrypt.compare(password, user.password)))
  //   throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  const user = { id: 'user-id', email };
  const token = signToken({ id: user.id, email: user.email });
  sendSuccess(res, { user, token }, 'Logged in');
};

export const me = async (req: Request, res: Response) => {
  sendSuccess(res, req.user, 'Profile retrieved');
};
`
      : `const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('${arch === "mvc" ? "../" : "../../"}utils/response');

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const register = async (req, res) => {
  const { email, password, name } = req.body;
  const hashed = await bcrypt.hash(password, 12);
  const user = { id: 'new-id', email, name };
  const token = signToken({ id: user.id, email: user.email });
  sendSuccess(res, { user, token }, 'Account created', StatusCodes.CREATED);
};

const login = async (req, res) => {
  const { email } = req.body;
  const user = { id: 'user-id', email };
  const token = signToken({ id: user.id, email: user.email });
  sendSuccess(res, { user, token }, 'Logged in');
};

const me = async (req, res) => sendSuccess(res, req.user, 'Profile retrieved');

module.exports = { register, login, me };
`,
  );

  const routesDir =
    arch === "mvc"
      ? path.join(dir, "src", "routes")
      : path.join(dir, "src", "modules", "auth");

  fs.writeFileSync(
    path.join(routesDir, `auth.routes.${ext}`),
    isTs
      ? `import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '${arch === "mvc" ? "../" : "../../"}middleware/validate';
import { authenticate } from '${arch === "mvc" ? "../" : "../../"}middleware/auth';
import { register, login, me } from '${arch === "mvc" ? "../controllers/" : "./"}auth.controller';

const router = Router();

router.post('/register',
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate, register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate, login
);

router.get('/me', authenticate, me);

export default router;
`
      : `const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('${arch === "mvc" ? "../" : "../../"}middleware/validate');
const { authenticate } = require('${arch === "mvc" ? "../" : "../../"}middleware/auth');
const { register, login, me } = require('${arch === "mvc" ? "../controllers/" : "./"}auth.controller');

const router = Router();

router.post('/register',
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  validate, register
);
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate, login
);
router.get('/me', authenticate, me);

module.exports = router;
`,
  );
}

// ─── Stripe files ─────────────────────────────────────────────────────────────

function writeStripeFiles(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  const arch = c.architecture;

  const ctrlDir =
    arch === "mvc"
      ? path.join(dir, "src", "controllers")
      : path.join(dir, "src", "modules", "payments");
  fs.ensureDirSync(ctrlDir);

  fs.writeFileSync(
    path.join(ctrlDir, `stripe.controller.${ext}`),
    isTs
      ? `import { Request, Response } from 'express';
import Stripe from 'stripe';
import { sendSuccess } from '${arch === "mvc" ? "../" : "../../"}utils/response';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { amount, currency = 'usd', metadata = {} } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
  sendSuccess(res, { clientSecret: paymentIntent.client_secret }, 'Payment intent created');
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const { items, successUrl, cancelUrl } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: items,
    mode: 'payment',
    success_url: successUrl || \`\${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: cancelUrl || \`\${req.headers.origin}/cancel\`,
  });
  sendSuccess(res, { sessionId: session.id, url: session.url }, 'Checkout session created');
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    res.status(400).json({ success: false, message: 'Webhook signature verification failed' });
    return;
  }
  switch (event.type) {
    case 'payment_intent.succeeded':
      // TODO: fulfill order
      break;
    case 'checkout.session.completed':
      // TODO: provision access / send email
      break;
  }
  res.json({ received: true });
};
`
      : `const Stripe = require('stripe');
const { sendSuccess } = require('${arch === "mvc" ? "../" : "../../"}utils/response');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

const createPaymentIntent = async (req, res) => {
  const { amount, currency = 'usd', metadata = {} } = req.body;
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency, metadata,
    automatic_payment_methods: { enabled: true },
  });
  sendSuccess(res, { clientSecret: pi.client_secret }, 'Payment intent created');
};

const createCheckoutSession = async (req, res) => {
  const { items, successUrl, cancelUrl } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: items,
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  sendSuccess(res, { sessionId: session.id, url: session.url }, 'Checkout session created');
};

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ success: false, message: 'Webhook signature verification failed' });
  }
  switch (event.type) {
    case 'payment_intent.succeeded': break;
    case 'checkout.session.completed': break;
  }
  res.json({ received: true });
};

module.exports = { createPaymentIntent, createCheckoutSession, handleWebhook };
`,
  );

  const routesDir =
    arch === "mvc"
      ? path.join(dir, "src", "routes")
      : path.join(dir, "src", "modules", "payments");

  fs.writeFileSync(
    path.join(routesDir, `stripe.routes.${ext}`),
    isTs
      ? `import { Router } from 'express';
import express from 'express';
import { createPaymentIntent, createCheckoutSession, handleWebhook } from '${arch === "mvc" ? "../controllers/" : "./"}stripe.controller';

const router = Router();

// Webhook must receive raw body — register BEFORE express.json() in app.ts
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.post('/payment-intent', createPaymentIntent);
router.post('/checkout-session', createCheckoutSession);

export default router;
`
      : `const { Router } = require('express');
const express = require('express');
const { createPaymentIntent, createCheckoutSession, handleWebhook } = require('${arch === "mvc" ? "../controllers/" : "./"}stripe.controller');

const router = Router();

router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
router.post('/payment-intent', createPaymentIntent);
router.post('/checkout-session', createCheckoutSession);

module.exports = router;
`,
  );
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

function writeSocketFile(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  fs.writeFileSync(
    path.join(dir, "src", `socket.${ext}`),
    isTs
      ? `import { Server, Socket } from 'socket.io';
import logger from './utils/logger';

export default (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    logger.info(\`Socket connected: \${socket.id}\`);

    socket.on('join-room', (room: string) => {
      socket.join(room);
      socket.to(room).emit('user-joined', { id: socket.id });
    });

    socket.on('message', ({ room, data }: { room: string; data: unknown }) => {
      io.to(room).emit('message', { from: socket.id, data, timestamp: new Date() });
    });

    socket.on('disconnect', () => {
      logger.info(\`Socket disconnected: \${socket.id}\`);
    });
  });
};
`
      : `const logger = require('./utils/logger');

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(\`Socket connected: \${socket.id}\`);
    socket.on('join-room', (room) => { socket.join(room); socket.to(room).emit('user-joined', { id: socket.id }); });
    socket.on('message', ({ room, data }) => { io.to(room).emit('message', { from: socket.id, data, timestamp: new Date() }); });
    socket.on('disconnect', () => logger.info(\`Socket disconnected: \${socket.id}\`));
  });
};
`,
  );
}

// ─── Docker ───────────────────────────────────────────────────────────────────

function writeDocker(c, dir) {
  const isTs = c.language === "ts";
  fs.writeFileSync(
    path.join(dir, "Dockerfile"),
    isTs
      ? `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "dist/app.js"]
`
      : `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM deps AS runner
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "src/app.js"]
`,
  );

  fs.writeFileSync(
    path.join(dir, ".dockerignore"),
    "node_modules\n.env\n*.log\ncoverage\ndist\n",
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function writeTestSetup(c, dir) {
  const isTs = c.language === "ts";
  const ext = isTs ? "ts" : "js";
  const testFramework = c.testing;

  const testsDir = path.join(dir, "tests");
  const integDir = path.join(testsDir, "integration");
  const unitDir = path.join(testsDir, "unit");
  const helpersDir = path.join(testsDir, "helpers");
  [integDir, unitDir, helpersDir].forEach((d) => fs.ensureDirSync(d));

  // Test helper / setup
  fs.writeFileSync(
    path.join(helpersDir, `setup.${ext}`),
    isTs
      ? `import request from 'supertest';
import app from '../../src/app';

export const api = request(app);

// Convenience helpers
export const get = (url: string, token?: string) => {
  const req = api.get(\`/api/v1\${url}\`);
  if (token) req.set('Authorization', \`Bearer \${token}\`);
  return req;
};

export const post = (url: string, body: object, token?: string) => {
  const req = api.post(\`/api/v1\${url}\`).send(body);
  if (token) req.set('Authorization', \`Bearer \${token}\`);
  return req;
};
`
      : `const request = require('supertest');
const app = require('../../src/app');

const api = request(app);

const get = (url, token) => {
  const req = api.get(\`/api/v1\${url}\`);
  if (token) req.set('Authorization', \`Bearer \${token}\`);
  return req;
};

const post = (url, body, token) => {
  const req = api.post(\`/api/v1\${url}\`).send(body);
  if (token) req.set('Authorization', \`Bearer \${token}\`);
  return req;
};

module.exports = { api, get, post };
`,
  );

  // Integration: health check
  const testBody =
    testFramework === "mocha"
      ? isTs
        ? `import { expect } from 'chai';
import { api } from '../helpers/setup';

describe('Health endpoint', () => {
  it('GET /health → 200', async () => {
    const res = await api.get('/health');
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
  });

  it('unknown route → 404', async () => {
    const res = await api.get('/not-found');
    expect(res.status).to.equal(404);
    expect(res.body.success).to.be.false;
  });
});
`
        : `const { expect } = require('chai');
const { api } = require('../helpers/setup');

describe('Health endpoint', () => {
  it('GET /health → 200', async () => {
    const res = await api.get('/health');
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
  });
  it('unknown route → 404', async () => {
    const res = await api.get('/not-found');
    expect(res.status).to.equal(404);
  });
});
`
      : isTs
        ? `import { describe, it, expect } from '${testFramework === "vitest" ? "vitest" : "@jest/globals"}';
import { api } from '../helpers/setup';

describe('Health endpoint', () => {
  it('GET /health returns 200', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.uptime).toBeDefined();
  });

  it('unknown route returns 404', async () => {
    const res = await api.get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('API root returns success', async () => {
    const res = await api.get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
`
        : `const { describe, it, expect } = require('${testFramework === "vitest" ? "vitest" : "@jest/globals"}');
const { api } = require('../helpers/setup');

describe('Health endpoint', () => {
  it('GET /health returns 200', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('unknown route returns 404', async () => {
    const res = await api.get('/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
`;

  fs.writeFileSync(path.join(integDir, `health.test.${ext}`), testBody);

  // Unit test: response helper
  fs.writeFileSync(
    path.join(unitDir, `response.test.${ext}`),
    testFramework === "vitest" || testFramework === "jest"
      ? isTs
        ? `import { describe, it, expect, vi } from '${testFramework === "vitest" ? "vitest" : "@jest/globals"}';
import { sendSuccess, sendError } from '../../src/utils/response';
import { Response } from 'express';

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Response helpers', () => {
  it('sendSuccess sets success: true', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'OK', 200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'OK' }));
  });

  it('sendError sets success: false', () => {
    const res = mockRes();
    sendError(res, 'Not found', 404);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
`
        : `const { describe, it, expect, vi } = require('${testFramework === "vitest" ? "vitest" : "@jest/globals"}');
const { sendSuccess, sendError } = require('../../src/utils/response');

const mockRes = () => {
  const res = {};
  res.status = jest.fn ? jest.fn().mockReturnValue(res) : vi.fn().mockReturnValue(res);
  res.json = jest.fn ? jest.fn().mockReturnValue(res) : vi.fn().mockReturnValue(res);
  return res;
};

describe('Response helpers', () => {
  it('sendSuccess sets success: true', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'OK', 200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('sendError sets success: false', () => {
    const res = mockRes();
    sendError(res, 'Oops', 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
`
      : "// TODO: add unit tests\n",
  );
}

// ─── tsconfig ─────────────────────────────────────────────────────────────────

function writeTsConfig(dir) {
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          lib: ["ES2022"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist", "tests"],
      },
      null,
      2,
    ),
  );

  // tsconfig for tests
  fs.writeFileSync(
    path.join(dir, "tsconfig.test.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        include: ["src/**/*", "tests/**/*"],
        compilerOptions: { rootDir: "." },
      },
      null,
      2,
    ),
  );
}

// ─── README ───────────────────────────────────────────────────────────────────

function writeReadme(c, dir) {
  const ext = c.language === "ts" ? "ts" : "js";
  fs.writeFileSync(
    path.join(dir, "README.md"),
    `# ${c.projectName}

${c.description}

## Stack

- **Runtime**: Node.js + Express.js ${c.language === "ts" ? "(TypeScript)" : "(JavaScript)"}
- **Security**: Helmet, CORS, express-validator
- **Env validation**: ${c.envValidator === "zod" ? "Zod (schema-validated, crashes fast on missing vars)" : "dotenv"}
- **Logger**: ${c.logger}${c.logger !== "morgan" ? " + Morgan HTTP logs" : ""}
- **Database**: ${c.database === "none" ? "None" : c.database}${c.useOrm ? " + Prisma ORM" : ""}
${c.swagger ? "- **API Docs**: Swagger UI at `/api-docs`\n" : ""}${c.stripe ? "- **Payments**: Stripe (payment intents + checkout + webhooks)\n" : ""}${c.authOptions.length ? `- **Auth**: ${c.authOptions.join(", ")}\n` : ""}${c.testing !== "none" ? `- **Testing**: ${c.testing} + supertest\n` : ""}

## Getting Started

\`\`\`bash
cp .env.example .env    # Fill in your secrets
npm install
npm run dev             # Start with hot reload
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start with ${c.language === "ts" ? "ts-node-dev" : "nodemon"} (hot reload) |
| \`npm start\` | Production start |
${c.language === "ts" ? "| `npm run build` | Compile TypeScript |\n| `npm run type-check` | Type check without emitting |\n" : ""}${c.testing !== "none" ? `| \`npm test\` | Run tests |\n| \`npm run test:watch\` | Watch mode |\n| \`npm run test:coverage\` | Coverage report |\n` : ""}${c.useOrm ? "| `npm run db:migrate` | Run Prisma migrations |\n| `npm run db:studio` | Prisma Studio |\n" : ""}

## Project Structure

\`\`\`
src/
├── app.${ext}                  Entry point
├── config/
│   ├── env.${ext}              Env schema & validation (${c.envValidator})
│   └── cors.${ext}             CORS options
├── middleware/
│   ├── errorHandler.${ext}     Global error handler (AppError)
│   ├── notFound.${ext}         404 handler
│   ├── validate.${ext}         express-validator middleware
│   └── auth.${ext}             JWT authentication
├── routes/
│   └── index.${ext}            Route registrations
${
  c.architecture === "mvc"
    ? `├── controllers/            Request handlers
├── models/                 Data models
└── services/               Business logic`
    : `└── modules/                Feature modules
    └── <feature>/
        ├── <feature>.controller.${ext}
        ├── <feature>.routes.${ext}
        ├── <feature>.service.${ext}
        └── <feature>.model.${ext}`
}
\`\`\`
${c.swagger ? `\n## API Documentation\n\nSwagger UI: http://localhost:3000/api-docs\n` : ""}
## Generate Modules

\`\`\`bash
nodezap generate module <name>       # Full CRUD module
nodezap generate controller <name>   # Controller only
nodezap generate route <name>        # Route file only
\`\`\`
`,
  );
}

module.exports = { generateProjectFiles };
