import chalk from "chalk";

export interface OutputOptions {
  json: boolean;
}

interface OutputState {
  json: boolean;
  buffered: unknown[];
}

const state: OutputState = { json: false, buffered: [] };

export function configureOutput(opts: OutputOptions): void {
  state.json = opts.json;
  state.buffered = [];
}

export function emit(record: Record<string, unknown>, humanFn?: () => string): void {
  if (state.json) {
    state.buffered.push(record);
    return;
  }
  if (humanFn) {
    process.stdout.write(humanFn() + "\n");
  }
}

export function flush(): void {
  if (state.json) {
    process.stdout.write(JSON.stringify(state.buffered, null, 2) + "\n");
    state.buffered = [];
  }
}

export function logInfo(message: string): void {
  if (!state.json) {
    process.stderr.write(chalk.cyan(message) + "\n");
  }
}

export function logWarn(message: string): void {
  if (!state.json) {
    process.stderr.write(chalk.yellow(message) + "\n");
  }
}

export function logError(message: string): void {
  // Always surface on stderr so the host CLI can show it regardless of mode.
  process.stderr.write(chalk.red(message) + "\n");
  // In JSON mode also record it in the buffered output, so machine consumers
  // can see the error structurally. Never write directly to stdout — that
  // would produce two top-level JSON values once `flush` emits the array.
  if (state.json) {
    state.buffered.push({ error: message });
  }
}

export function logSuccess(message: string): void {
  if (!state.json) {
    process.stderr.write(chalk.green(message) + "\n");
  }
}
