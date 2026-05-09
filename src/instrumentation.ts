/**
 * Next.js instrumentation hook — runs once in the Node.js process.
 *
 * Purpose: absorb ETIMEDOUT socket errors that escape try/catch via the
 * undici HTTP client (used by @supabase/ssr internally).  When Supabase's
 * free-tier instance is cold-starting, `supabase.auth.getUser()` can time out
 * at the socket level *after* the promise already settled.  Node.js then fires
 * an 'error' event on the undici socket which becomes an `uncaughtException`
 * and can destabilise the dev-server process.
 *
 * We install a narrow handler that only suppresses ETIMEDOUT / ECONNRESET
 * write errors; all other uncaught exceptions are re-thrown so they still
 * crash loudly.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Absorb transient network errors from the undici socket pool that escape
    // promise chains (cold-start timeouts, connection resets, etc.)
    process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
      const isTransientNetworkError =
        (err.code === "ETIMEDOUT" || err.code === "ECONNRESET") &&
        err.syscall === "write";

      if (isTransientNetworkError) {
        // Log but do NOT rethrow — this is a Supabase cold-start artifact, not
        // an application bug.
        console.warn(
          "[instrumentation] swallowed transient socket error:",
          err.code,
          err.syscall
        );
        return;
      }

      // Anything else: let Node.js handle it normally (default: crash + dump).
      throw err;
    });

    process.on("unhandledRejection", (reason: unknown) => {
      const err = reason as NodeJS.ErrnoException | null;
      if (
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNRESET"
      ) {
        console.warn(
          "[instrumentation] swallowed unhandled rejection:",
          err.code
        );
        return;
      }
      // Re-throw so Next.js / Node.js can handle non-network rejections.
      throw reason;
    });
  }
}
