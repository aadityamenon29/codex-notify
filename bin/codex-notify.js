#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const REPO_SPEC = "github:aadityamenon29/codex-notify";

function usage() {
  console.log(`codex-notify

Usage:
  codex-notify install [--threshold seconds] [--force]
  codex-notify uninstall [--purge]
  codex-notify status
  codex-notify test

Options:
  --threshold, -t  Minimum turn duration before notifying. Default: 5.
  --force          Replace an existing custom Codex notify command.
  --purge          During uninstall, also remove codex-notify files.
`);
}

function paths() {
  const home = os.homedir();
  const codexDir = path.join(home, ".codex");
  return {
    home,
    codexDir,
    binDir: path.join(codexDir, "bin"),
    configPath: path.join(codexDir, "config.toml"),
    hookPath: path.join(codexDir, "bin", "codex-notify-done.sh"),
    settingsPath: path.join(codexDir, "codex-notify.env"),
  };
}

function parseArgs(args) {
  const opts = {
    threshold: 5,
    thresholdProvided: false,
    force: false,
    purge: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--threshold" || arg === "-t") {
      if (i + 1 >= args.length) fail("Missing value for --threshold.");
      opts.threshold = parseThreshold(args[i + 1]);
      opts.thresholdProvided = true;
      i += 1;
    } else if (arg.startsWith("--threshold=")) {
      opts.threshold = parseThreshold(arg.slice("--threshold=".length));
      opts.thresholdProvided = true;
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--purge") {
      opts.purge = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  return opts;
}

function parseThreshold(value) {
  if (!/^\d+$/.test(String(value))) {
    fail("--threshold must be a whole number of seconds.");
  }
  return Number(value);
}

function fail(message, code = 1) {
  console.error(`codex-notify: ${message}`);
  process.exit(code);
}

function escapeTomlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    "-",
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join("");
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = `${filePath}.codex-notify.bak.${timestamp()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function notifyLine(hookPath) {
  return `notify = ["${escapeTomlString(hookPath)}"]`;
}

function findNotifyLine(config) {
  const match = config.match(/^notify\s*=\s*\[[^\n]*\]\s*$/m);
  return match ? match[0] : null;
}

function install(rawArgs) {
  const opts = parseArgs(rawArgs);
  const p = paths();
  const config = readIfExists(p.configPath);
  const existingNotify = findNotifyLine(config);
  const nextNotify = notifyLine(p.hookPath);

  if (
    existingNotify &&
    !existingNotify.includes("codex-notify-done.sh") &&
    !opts.force
  ) {
    console.error("codex-notify: Codex already has a custom notify command:");
    console.error(`  ${existingNotify}`);
    console.error("");
    console.error("No config changes were made. Re-run with --force to replace it.");
    process.exit(2);
  }

  fs.mkdirSync(p.binDir, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "assets", "codex-notify-done.sh"),
    p.hookPath
  );
  fs.chmodSync(p.hookPath, 0o755);

  const settings = [
    "# codex-notify settings",
    `MIN_SECONDS=${opts.threshold}`,
    "POPUP=1",
    "SOUND=1",
    "SOUND_NAME=Ping",
    "",
  ].join("\n");
  fs.writeFileSync(p.settingsPath, settings, "utf8");

  let nextConfig;
  if (existingNotify) {
    nextConfig = config.replace(/^notify\s*=\s*\[[^\n]*\]\s*$/m, nextNotify);
  } else {
    const prefix = config && !config.endsWith("\n") ? "\n" : "";
    nextConfig = `${config}${prefix}${config ? "\n" : ""}${nextNotify}\n`;
  }

  let backupPath = null;
  if (nextConfig !== config) {
    fs.mkdirSync(p.codexDir, { recursive: true });
    backupPath = backupFile(p.configPath);
    fs.writeFileSync(p.configPath, nextConfig, "utf8");
  }

  console.log("Installed codex-notify.");
  console.log(`Hook: ${p.hookPath}`);
  console.log(`Config: ${p.configPath}`);
  console.log(`Threshold: ${opts.threshold} seconds`);
  if (backupPath) console.log(`Backup: ${backupPath}`);
  console.log("");
  console.log("Restart existing Codex sessions before expecting notifications.");
  console.log(`Test hook: npx --yes ${REPO_SPEC} test`);
  console.log('Test Codex: codex exec "Say exactly: notification test done"');
}

function uninstall(rawArgs) {
  const opts = parseArgs(rawArgs);
  const p = paths();
  const config = readIfExists(p.configPath);
  const existingNotify = findNotifyLine(config);

  if (existingNotify && existingNotify.includes("codex-notify-done.sh")) {
    const backupPath = backupFile(p.configPath);
    const nextConfig = config
      .replace(/^notify\s*=\s*\[[^\n]*\]\s*\n?/m, "")
      .replace(/\n{3,}/g, "\n\n");
    fs.writeFileSync(p.configPath, nextConfig, "utf8");
    console.log("Removed codex-notify from Codex config.");
    if (backupPath) console.log(`Backup: ${backupPath}`);
  } else {
    console.log("No codex-notify notify line found in Codex config.");
  }

  if (opts.purge) {
    for (const filePath of [p.hookPath, p.settingsPath]) {
      try {
        fs.rmSync(filePath);
        console.log(`Removed ${filePath}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
}

function status() {
  const p = paths();
  const config = readIfExists(p.configPath);
  const existingNotify = findNotifyLine(config);
  const settings = readIfExists(p.settingsPath).trim();

  console.log(`Config: ${p.configPath}`);
  console.log(`Hook: ${p.hookPath}`);
  console.log(`Hook installed: ${fs.existsSync(p.hookPath) ? "yes" : "no"}`);
  console.log(`Notify line: ${existingNotify || "(none)"}`);
  console.log("");
  console.log(settings || "No codex-notify settings file found.");
}

function test() {
  const p = paths();
  if (!fs.existsSync(p.hookPath)) {
    fail(`Hook is not installed at ${p.hookPath}. Run codex-notify install first.`);
  }

  console.log("Sending a test notification.");
  const result = childProcess.spawnSync(
    p.hookPath,
    ['{"type":"agent-turn-complete"}'],
    { stdio: "inherit" }
  );

  if (result.error) throw result.error;
  process.exit(result.status || 0);
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "install") install(args);
  else if (command === "uninstall") uninstall(args);
  else if (command === "status") status();
  else if (command === "test") test();
  else fail(`Unknown command: ${command}`);
}

main();
