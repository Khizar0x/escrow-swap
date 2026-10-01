export async function retryOnBlockhashError<T>(
  fn: () => Promise<T>,
  retries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isBlockhashIssue =
        /blockhash/i.test(message) || /block height exceeded/i.test(message);
      if (!isBlockhashIssue || attempt === retries) {
        throw err;
      }
    }
  }
  throw lastError;
}
