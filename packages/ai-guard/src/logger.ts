/**
 * Minimal structured logger for `@atlas/ai-guard`.
 *
 * Purpose
 *   Rule 7.1.1 requires structured logs and rule 7.1.2 forbids `console.log`. This package
 *   is a leaf library used by a Node backend and by CLI tooling, so it writes newline
 *   delimited JSON to stderr and leaves collection to whatever runs it (rule 7.1.5).
 *
 * Key responsibilities
 *   - Emit one JSON object per line with `timestamp`, `level`, `service_name`, `message`.
 *   - Let callers attach domain context (task, model id, request id, cost) per entry.
 *   - Stay silent below the configured level.
 *
 * What must never reach this logger
 *   Prompts, completions, and API keys. Rule 7.1.4 is absolute, and prompt text may carry a
 *   user's private journal entries. The guard logs token counts, cost, model id, and the
 *   cache key hash — never the content that produced them.
 *
 * Usage
 *   ```ts
 *   const logger = createLogger('ai-guard');
 *   logger.warn('Provider attempt failed', { attempt: 2, model_id: 'mistralai/mistral-nemo' });
 *   ```
 */

/** Severity levels, ordered least to most severe. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured fields attached to a single entry. Values must be JSON-serialisable scalars. */
export type LogFields = Readonly<Record<string, string | number | boolean | null>>;

/** The logging surface the rest of the package depends on. */
export interface StructuredLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Parse `ATLAS_LOG_LEVEL`, defaulting to `info` per rule 7.2.1. */
function resolveLevel(raw: string | undefined): LogLevel {
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

/**
 * Create a logger bound to a service name.
 *
 * @param serviceName Value for the `service_name` field on every entry.
 * @param level       Minimum level to emit. Defaults to `ATLAS_LOG_LEVEL`, then `info`.
 * @param sink        Where to write. Defaults to stderr. Tests pass a collector.
 * @returns A logger that never throws; a failing sink must not take down an AI call.
 */
export function createLogger(
  serviceName: string,
  level: LogLevel = resolveLevel(process.env['ATLAS_LOG_LEVEL']),
  sink: (line: string) => void = (line) => void process.stderr.write(line),
): StructuredLogger {
  const threshold = LEVEL_SEVERITY[level];

  const emit = (entryLevel: LogLevel, message: string, fields?: LogFields): void => {
    if (LEVEL_SEVERITY[entryLevel] < threshold) {
      return;
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level: entryLevel,
      service_name: serviceName,
      message,
      ...(fields ?? {}),
    };
    try {
      sink(`${JSON.stringify(entry)}\n`);
    } catch (writeError) {
      // A broken log sink is not a reason to abandon a paid API call that already
      // succeeded. Swallowing is deliberate and bounded to this one line; the error is
      // re-surfaced on stderr so it is never silent (rule 6.1.1).
      const reason = writeError instanceof Error ? writeError.message : 'unknown';
      process.stderr.write(`{"level":"error","message":"log sink failed: ${reason}"}\n`);
    }
  };

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
  };
}

/** A logger that discards everything. Used by tests and by callers that opt out. */
export const NULL_LOGGER: StructuredLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
