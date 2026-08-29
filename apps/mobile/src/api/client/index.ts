/**
 * The HTTP client: one way to call the API, one way to fail.
 *
 * Purpose
 *   The public surface of `src/api/client`. Endpoint modules import from here; nothing
 *   outside `src/api` should need to.
 *
 * The shape of the thing
 *   ```
 *   createHttpClient
 *       -> runWithRetry            (how many times, how long between)
 *           -> performRequestAttempt (deadline -> fetch -> classify -> decode)
 *               -> toHttpError | Decoder<T>
 *   ```
 *   Each layer is a separate module with its own test, because each fails in a way the
 *   others cannot simulate: the policy is arithmetic, the loop is a counter, the attempt
 *   is a network.
 *
 * The two guarantees
 *   1. **Nothing throws.** Every call resolves an {@link ApiResult}; the failure arm is
 *      one of five typed shapes, never a string and never an `Error` (rules 6.1.3,
 *      6.1.4).
 *   2. **Nothing waits forever.** Every attempt carries a deadline, and the retry loop
 *      is bounded (rules 6.4.1, 6.4.2).
 *
 * Usage
 *   ```ts
 *   import { createHttpClient } from '@/api/client';
 *   import { deviceIdentityHeaders } from '@/api/identity';
 *
 *   const client = createHttpClient({ headers: deviceIdentityHeaders });
 *   ```
 */

export {
  API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
  FALLBACK_API_BASE_URL,
  HEALTH_API_TIMEOUT_MS,
  normaliseBaseUrl,
  resolveApiBaseUrl,
  SEARCH_API_TIMEOUT_MS,
} from './api-config';

export {
  abortedError,
  httpError,
  isRetryableStatus,
  malformedResponseError,
  networkError,
  timeoutError,
  withAttempts,
  type ApiAbortedError,
  type ApiError,
  type ApiErrorKind,
  type ApiHttpError,
  type ApiMalformedResponseError,
  type ApiNetworkError,
  type ApiTimeoutError,
} from './api-error';

export {
  apiFailure,
  apiSuccess,
  describeApiError,
  emptyOnStatus,
  type ApiResult,
} from './api-result';

export { toHttpError, UNKNOWN_ERROR_CODE } from './error-envelope';

export { performRequestAttempt, type FetchLike, type RequestAttemptContext } from './http-attempt';

export {
  createHttpClient,
  type HeaderProvider,
  type HttpClient,
  type HttpClientOptions,
  type HttpMethod,
  type HttpRequest,
} from './http-client';

export {
  decodeArray,
  decodeBoolean,
  decodeNullable,
  decodeNumber,
  decodeObject,
  decodeRecord,
  decodeString,
  type Decoded,
  type DecodeFailure,
  type Decoder,
  type DecoderMap,
} from './json-shape';

export {
  buildRequestUrl,
  encodePath,
  encodeQuery,
  type QueryParameters,
  type QueryValue,
} from './request-url';

export { startRequestDeadline, type RequestDeadline } from './request-timeout';

export {
  defaultSleep,
  runWithRetry,
  type Attempt,
  type RetryRunnerOptions,
  type Sleep,
} from './retry';

export {
  backoffDelayMs,
  DEFAULT_RETRY_POLICY,
  NO_RETRY_POLICY,
  shouldRetry,
  type RandomSource,
  type RetryPolicy,
} from './retry-policy';
