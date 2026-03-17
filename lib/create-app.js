"use strict";

const inquirer = require("inquirer");
const chalk = require("chalk");
const ora = require("ora");
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");
const { generateProjectFiles } = require("./generator");

async function createApp(projectNameArg) {
  console.log(chalk.bold.hex("#F7C59F")("  ✦ New Project Setup\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: chalk.white("  Project name:"),
      default: projectNameArg || "my-express-app",
      validate: (v) =>
        /^[a-z0-9-_]+$/.test(v) ||
        "Use lowercase letters, numbers, hyphens only",
    },
    {
      type: "input",
      name: "description",
      message: chalk.white("  Description:"),
      default: "An Express.js application",
    },
    {
      type: "list",
      name: "language",
      message: chalk.white("  Language:"),
      choices: [
        { name: "TypeScript  (recommended — industry standard)", value: "ts" },
        { name: "JavaScript (CommonJS)", value: "js" },
      ],
    },
    {
      type: "list",
      name: "architecture",
      message: chalk.white("  Project structure:"),
      choices: [
        { name: "MVC  (controllers / routes / models)", value: "mvc" },
        { name: "Modular  (feature-based modules)", value: "modular" },
      ],
    },
    {
      type: "list",
      name: "envValidator",
      message: chalk.white("  Env variable validation:"),
      choices: [
        {
          name: "Zod  (type-safe schema — crashes fast on missing vars)",
          value: "zod",
        },
        { name: "dotenv only  (no runtime validation)", value: "dotenv" },
      ],
    },
    {
      type: "list",
      name: "logger",
      message: chalk.white("  Logger:"),
      choices: [
        {
          name: "Pino  (structured JSON, high-performance — recommended)",
          value: "pino",
        },
        {
          name: "Winston  (feature-rich, multiple transports)",
          value: "winston",
        },
        {
          name: "Morgan only  (HTTP request logs, no structured logging)",
          value: "morgan",
        },
      ],
    },
    {
      type: "list",
      name: "database",
      message: chalk.white("  Database:"),
      choices: [
        { name: "None", value: "none" },
        { name: "MongoDB  (Mongoose)", value: "mongodb" },
        { name: "PostgreSQL  (pg + knex)", value: "postgres" },
        { name: "MySQL  (mysql2 + knex)", value: "mysql" },
        { name: "SQLite  (better-sqlite3)", value: "sqlite" },
        { name: "Redis  (ioredis)", value: "redis" },
      ],
    },
    {
      type: "confirm",
      name: "useOrm",
      message: chalk.white("  Use Prisma ORM?"),
      default: false,
      when: (a) => ["postgres", "mysql", "sqlite"].includes(a.database),
    },
    {
      type: "confirm",
      name: "stripe",
      message: chalk.white("  Integrate Stripe payments?"),
      default: false,
    },
    {
      type: "checkbox",
      name: "authOptions",
      message: chalk.white("  Authentication (select all that apply):"),
      choices: [
        { name: "JWT (jsonwebtoken)", value: "jwt" },
        { name: "Passport.js", value: "passport" },
        { name: "Session-based (express-session)", value: "session" },
      ],
    },
    {
      type: "confirm",
      name: "swagger",
      message: chalk.white("  Include Swagger / OpenAPI docs?"),
      default: true,
    },
    {
      type: "list",
      name: "testing",
      message: chalk.white("  Testing framework:"),
      choices: [
        {
          name: "Vitest  (fast, ESM-native, supertest included)",
          value: "vitest",
        },
        { name: "Jest  (battle-tested, broad ecosystem)", value: "jest" },
        { name: "Mocha + Chai", value: "mocha" },
        { name: "None", value: "none" },
      ],
    },
    {
      type: "checkbox",
      name: "extras",
      message: chalk.white("  Extra features:"),
      choices: [
        { name: "Socket.IO (WebSockets)", value: "socketio" },
        { name: "Bull (job queues)", value: "bull" },
        { name: "Nodemailer (email)", value: "nodemailer" },
        { name: "Rate limiting (express-rate-limit)", value: "ratelimit" },
        { name: "File uploads (multer)", value: "multer" },
      ],
    },
    {
      type: "confirm",
      name: "docker",
      message: chalk.white("  Add Docker support?"),
      default: false,
    },
    {
      type: "confirm",
      name: "git",
      message: chalk.white("  Initialize git repo?"),
      default: true,
    },
    {
      type: "confirm",
      name: "installDeps",
      message: chalk.white("  Install dependencies now?"),
      default: true,
    },
  ]);

  const targetDir = path.resolve(process.cwd(), answers.projectName);

  if (fs.existsSync(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: chalk.yellow(
          `  Directory "${answers.projectName}" already exists. Overwrite?`,
        ),
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.red("\n  Aborted.\n"));
      process.exit(0);
    }
    fs.removeSync(targetDir);
  }

  console.log();
  const spinner = ora({
    text: chalk.dim("  Scaffolding project files…"),
    spinner: "dots2",
  }).start();

  try {
    await generateProjectFiles(answers, targetDir);
    spinner.succeed(chalk.green("  Project files created"));

    if (answers.installDeps) {
      spinner.start(chalk.dim("  Installing dependencies…"));
      execSync("npm install", { cwd: targetDir, stdio: "ignore" });
      spinner.succeed(chalk.green("  Dependencies installed"));
    }

    if (answers.git) {
      spinner.start(chalk.dim("  Initializing git…"));
      execSync(
        'git init && git add -A && git commit -m "chore: initial scaffold via nodezap"',
        {
          cwd: targetDir,
          stdio: "ignore",
          shell: true,
        },
      );
      spinner.succeed(chalk.green("  Git repository initialized"));
    }

    printSuccess(answers);
  } catch (err) {
    spinner.fail(chalk.red("  Something went wrong"));
    throw err;
  }
}

function printSuccess(answers) {
  const ext = answers.language === "ts" ? "ts" : "js";
  console.log();
  console.log(chalk.bold.hex("#FF6B35")("  ✦ Project ready!\n"));
  console.log(`  ${chalk.dim("cd")} ${chalk.bold(answers.projectName)}`);
  if (!answers.installDeps) console.log(`  ${chalk.dim("npm install")}`);
  console.log(`  ${chalk.dim("npm run dev")}\n`);

  console.log(chalk.dim("  ─── Key files ───────────────────────────────"));
  console.log(
    chalk.dim(
      `  src/config/env.${ext}                 env schema & validation`,
    ),
  );
  console.log(
    chalk.dim(
      `  src/utils/logger.${ext}               ${answers.logger} structured logger`,
    ),
  );
  console.log(
    chalk.dim(`  src/middleware/errorHandler.${ext}    global error handler`),
  );

  if (answers.swagger) {
    console.log(
      chalk.cyan("\n  📖 Swagger UI → http://localhost:3000/api-docs"),
    );
  }
  if (answers.testing !== "none") {
    console.log(
      chalk.dim(`\n  🧪 Tests: npm test  (${answers.testing} + supertest)`),
    );
  }
  if (answers.stripe)
    console.log(chalk.yellow("\n  ⚡ Stripe: add STRIPE_SECRET_KEY to .env"));
  if (answers.database !== "none") {
    const dbEnv = {
      mongodb: "MONGO_URI",
      postgres: "DATABASE_URL",
      mysql: "DATABASE_URL",
      sqlite: "DATABASE_PATH",
      redis: "REDIS_URL",
    };
    console.log(
      chalk.yellow(`\n  🗄  DB: add ${dbEnv[answers.database]} to .env`),
    );
  }
  if (answers.authOptions.includes("jwt"))
    console.log(chalk.yellow("  🔐 JWT: add JWT_SECRET to .env"));
  console.log();
  console.log(chalk.dim("  Generate modules:  nodezap generate module <name>"));
  console.log();
}

module.exports = { createApp };
