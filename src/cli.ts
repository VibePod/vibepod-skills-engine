#!/usr/bin/env node
import { Command, Option } from "commander";

import { addCommand } from "./commands/add.js";
import { deleteCommand } from "./commands/delete.js";
import { listCommand } from "./commands/list.js";
import { resolveCommand } from "./commands/resolve.js";
import { syncCommand } from "./commands/sync.js";
import { updateCommand } from "./commands/update.js";
import { validateCommand } from "./commands/validate.js";
import { configureOutput, logError } from "./utils/output.js";
import type { Scope } from "./utils/paths.js";

const program = new Command();

program
  .name("skills-engine")
  .description(
    "VibePod Skills Engine — manage skills inside a controlled container",
  )
  .version("0.1.0")
  .option("--json", "Emit machine-readable JSON on stdout");

function scopeOption(): Option {
  return new Option("--scope <scope>", "Target scope")
    .choices(["local", "user"])
    .makeOptionMandatory(true);
}

function optionalScopeOption(): Option {
  return new Option("--scope <scope>", "Filter by scope").choices([
    "local",
    "user",
  ]);
}

interface GlobalOpts {
  json?: boolean;
}

function setupOutput(cmd: Command): void {
  const root = cmd.parent ?? cmd;
  const opts = root.opts<GlobalOpts>();
  configureOutput({ json: !!opts.json });
}

program
  .command("add <locator>")
  .description("Install a skill from a locator")
  .addOption(scopeOption())
  .option("--id <id>", "Override the derived skill ID")
  .option("--link", "Symlink instead of copy (local sources only)")
  .action(
    async (
      locator: string,
      opts: { scope: Scope; id?: string; link?: boolean },
      cmd: Command,
    ) => {
      setupOutput(cmd);
      const rc = await addCommand({
        locator,
        scope: opts.scope,
        id: opts.id,
        link: opts.link,
      });
      process.exit(rc);
    },
  );

program
  .command("delete <id>")
  .description("Remove an installed skill")
  .addOption(scopeOption())
  .action(async (id: string, opts: { scope: Scope }, cmd: Command) => {
    setupOutput(cmd);
    const rc = await deleteCommand({ id, scope: opts.scope });
    process.exit(rc);
  });

program
  .command("list")
  .description("List installed skills")
  .addOption(optionalScopeOption())
  .action(async (opts: { scope?: Scope }, cmd: Command) => {
    setupOutput(cmd);
    const rc = await listCommand({ scope: opts.scope });
    process.exit(rc);
  });

program
  .command("sync")
  .description("Reconcile installed/ with the lockfile")
  .addOption(scopeOption())
  .action(async (opts: { scope: Scope }, cmd: Command) => {
    setupOutput(cmd);
    const rc = await syncCommand({ scope: opts.scope });
    process.exit(rc);
  });

program
  .command("update [id]")
  .description("Re-resolve locators and rewrite the lockfile")
  .addOption(scopeOption())
  .action(
    async (id: string | undefined, opts: { scope: Scope }, cmd: Command) => {
      setupOutput(cmd);
      const rc = await updateCommand({ scope: opts.scope, id });
      process.exit(rc);
    },
  );

program
  .command("validate <path>")
  .description("Validate a SKILL.md without installing")
  .action(async (path: string, _opts: unknown, cmd: Command) => {
    setupOutput(cmd);
    const rc = await validateCommand(path);
    process.exit(rc);
  });

program
  .command("resolve")
  .description("Produce the merged skill index across scopes")
  .addOption(optionalScopeOption())
  .action(async (opts: { scope?: Scope }, cmd: Command) => {
    setupOutput(cmd);
    const rc = await resolveCommand({ scope: opts.scope });
    process.exit(rc);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  logError((err as Error).message);
  process.exit(1);
});
