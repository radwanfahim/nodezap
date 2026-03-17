#!/usr/bin/env node
"use strict";

const chalk = require("chalk");
const { createApp } = require("../lib/create-app");
const { generateModule } = require("../lib/generate-module");

const args = process.argv.slice(2);
const command = args[0];

const banner = `
${chalk.bold.hex("#F4D03F")("███╗   ██╗ ██████╗ ██████╗ ███████╗")}${chalk.bold.hex("#E74C3C")("███████╗ █████╗ ██████╗ ")}
${chalk.bold.hex("#F4D03F")("████╗  ██║██╔═══██╗██╔══██╗██╔════╝")}${chalk.bold.hex("#E74C3C")("╚══███╔╝██╔══██╗██╔══██╗")}
${chalk.bold.hex("#F9E87F")("██╔██╗ ██║██║   ██║██║  ██║█████╗  ")}${chalk.bold.hex("#E87B50")("  ███╔╝ ███████║██████╔╝")}
${chalk.bold.hex("#F9E87F")("██║╚██╗██║██║   ██║██║  ██║██╔══╝  ")}${chalk.bold.hex("#E87B50")(" ███╔╝  ██╔══██║██╔═══╝ ")}
${chalk.bold.hex("#FEF9E7")("██║ ╚████║╚██████╔╝██████╔╝███████╗")}${chalk.bold.hex("#F5CBA7")("███████╗██║  ██║██║     ")}
${chalk.bold.hex("#FEF9E7")("╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝")}${chalk.bold.hex("#F5CBA7")("╚══════╝╚═╝  ╚═╝╚═╝     ")}

  ${chalk.bold.hex("#C0392B")("☕")} ${chalk.bold.white("nodezap")} ${chalk.dim("— Production-ready Express apps, zap in seconds.")}
`;

async function main() {
  console.log(banner);

  if (!command || command === "new") {
    const projectName = args[1];
    await createApp(projectName);
  } else if (command === "generate" || command === "g") {
    const type = args[1];
    const name = args[2];
    if (!type || !name) {
      console.log(
        chalk.yellow(
          "\n  Usage: nodezap generate <controller|route|module> <name>\n",
        ),
      );
      console.log(chalk.dim("  Examples:"));
      console.log(chalk.dim("    nodezap generate controller user"));
      console.log(chalk.dim("    nodezap generate module product"));
      console.log(chalk.dim("    nodezap g module order"));
      console.log();
      process.exit(1);
    }
    await generateModule(type, name);
  } else if (command === "--help" || command === "-h") {
    showHelp();
  } else {
    console.log(chalk.red(`\n  Unknown command: ${command}\n`));
    showHelp();
  }
}

function showHelp() {
  console.log(chalk.bold("  Commands:\n"));
  console.log(
    `  ${chalk.hex("#C0392B")("nodezap new <app-name>")}        ${chalk.dim("Scaffold a new Express app")}`,
  );
  console.log(
    `  ${chalk.hex("#C0392B")("nodezap g controller <name>")}   ${chalk.dim("Generate a controller")}`,
  );
  console.log(
    `  ${chalk.hex("#C0392B")("nodezap g route <name>")}        ${chalk.dim("Generate a route file")}`,
  );
  console.log(
    `  ${chalk.hex("#C0392B")("nodezap g module <name>")}       ${chalk.dim("Generate a full CRUD module")}`,
  );
  console.log();
}

main().catch((err) => {
  console.error(chalk.red("\n  ✖ Error: ") + err.message);
  process.exit(1);
});
