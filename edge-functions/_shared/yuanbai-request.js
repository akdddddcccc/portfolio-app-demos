// Bound connection and response body reads. Do not automatically retry generation:
// a timed-out POST may still be consuming provider capacity.
export async function timedRequest(url, options = {}, stage = '请求处理', timeoutMs = 8000, read = r => r.text(), fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      ...options, signal: controller.signal,
      // EdgeOne otherwise applies a 15-second upstream timeout.
      eo: {...options.eo, timeoutSetting: {
        connectTimeout: Math.min(timeoutMs, 10000), readTimeout: timeoutMs, writeTimeout: timeoutMs,
      }},
    });
    return {response, body: await read(response)};
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      const timeout = new Error(`${stage}等待超时，请稍后再试。`);
      timeout.name = 'TimeoutError';
      timeout.stage = stage;
      throw timeout;
    }
    if (error && typeof error === 'object' && !error.stage) error.stage = stage;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
