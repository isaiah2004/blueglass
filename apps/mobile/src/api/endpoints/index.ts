/**
 * The API's typed surface: six methods, six models, six decoders.
 *
 * Purpose
 *   The public face of `src/api/endpoints`. Hooks and stores import {@link AtlasApi}
 *   and the models; nothing outside this folder should need a decoder, but they are
 *   exported so a contract test can run one against a recorded body.
 *
 * Usage
 *   ```ts
 *   import { createAtlasApi } from '@/api/endpoints';
 *   const api = createAtlasApi(createHttpClient({ headers: deviceIdentityHeaders }));
 *   ```
 */

export {
  createAtlasApi,
  type AtlasApi,
  type ChapterAddress,
  type RequestOptions,
  type SearchQuery,
} from './atlas-api';

export { decodeHealth, decodeIdentity } from './meta-decoders';

export type {
  ApiBook,
  ApiChapter,
  ApiHealth,
  ApiIdentity,
  ApiSearchHit,
  ApiSearchResults,
  ApiTranslation,
  ApiVerse,
} from './models';

export {
  decodeBooks,
  decodeChapter,
  decodeSearchResults,
  decodeTranslations,
} from './scripture-decoders';
