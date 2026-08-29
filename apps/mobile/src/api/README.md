# `src/api` — the client's networking layer

Everything that talks to the Atlas Bible server, and everything that remembers what it
said. One import point: `@/api`.

```
query/      TanStack Query hooks, cache config, cache persistence   <- components use this
  |
endpoints/  six typed methods + the decoders that police the wire   <- tests double this
  |
client/     base URL, timeouts, retries, typed errors               <- survives a train
  |
identity/   the anonymous device-id header (decision A-01)
storage/    localStorage on web, MMKV on native  (decision T-01)
stream/     Server-Sent Events, for grounded chat only
```

Each layer depends only on the one below it. Every platform dependency arrives by
injection, which is why the whole thing is testable under plain Node with no React Native
transform.

---

## The five guarantees

| # | Guarantee | Where it lives |
|---|---|---|
| 1 | **Nothing throws.** Every call resolves an `ApiResult`; the failure arm is one of five typed shapes, never a string and never an `Error`. | `client/api-error.ts`, `client/api-result.ts` |
| 2 | **Nothing waits forever.** Every attempt carries a deadline (rule 6.4.1). | `client/request-timeout.ts` |
| 3 | **Retries back off with jitter, and never double-fire.** One attempt in flight at a time; the attempt count is exactly the policy's (rule 6.4.2). | `client/retry-policy.ts`, `client/retry.ts` |
| 4 | **Every request says who it is.** A device id, minted once and persisted (`A-01`). The prototype sent no auth at all and the server hardcoded `dev-user` — port map risk #9. | `identity/` |
| 5 | **A chapter read once opens instantly, offline.** Query cache persisted across launches (`O-01`). | `query/query-persistence.ts` |

## The two seams that exist to be replaced

**Identity.** `client/http-client.ts` takes a `HeaderProvider`. Real accounts are a second
implementation of that one function type, swapped in
`atlas-client.ts`. No endpoint, hook, store or component mentions identity.

**Storage.** `storage/device-storage.ts` (web, and the Node test runner) and
`storage/device-storage.native.ts` (Android) are the two halves of one import. Adding
`AsyncStorage`, or any other engine, is a third implementation of `KeyValueStore`.

## The `react-native-mmkv` rule

`react-native-mmkv` has no browser build, and decision `T-01` makes the browser a
first-class target. **Exactly one file may import it**:
`storage/mmkv-key-value-store.native.ts`. Three defences, in the order they fire:

1. `no-restricted-imports` in `eslint.config.mjs` — a lint error while you type, in every
   file that is not `*.native.ts`.
2. `storage/web-key-value-store.test.ts` — asserts at runtime that the module the web
   bundle resolves never reports the native engine.
3. Metro's platform resolution — `.native.ts` is never bundled for `platform=web`. This is
   the guarantee; the two above are what turn a broken web build into a message that names
   the mistake.

## Endpoints

| method | route | server module |
|---|---|---|
| `getHealth` | `GET /health` | `health` |
| `getTranslations` | `GET /translations` | `scripture` |
| `getBooks` | `GET /books` | `scripture` |
| `getChapter` | `GET /chapters/{translation}/{book}/{chapter}` | `scripture` |
| `search` | `GET /search` | `scripture` |
| `getIdentity` | `GET /me` | `identity` |

All six are `GET`, so all six are idempotent and safe to retry. **The first write endpoint
added here must pass `NO_RETRY_POLICY` or carry an idempotency key** (rule 6.4.5).

Wire fields are snake_case and are translated to camelCase in `endpoints/`. The wire names
survive in the decoders, where the contract they enforce is the point. `verseKey` stays a
plain number: validating a whole chapter against the KJV versification table would blank
the screen for one verse a translation numbers differently. Call `verseKeyFromNumber` from
`@/domain` where a resolved book is actually needed.

## Wiring it up

Once, in the app shell:

```tsx
const queryClient = useMemo(createAtlasQueryClient, []);

useEffect(() => {
  const persister = createQueryCachePersister({ queryClient });
  void persister.restore();
  return persister.start();
}, [queryClient]);

return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
```

Then anywhere:

```ts
const chapter = useChapterQuery({ translation: 'BSB', book: 'John', chapter: 3 });
```

## Retry lives in one layer, on purpose

The query client sets `retry: false`. That is not a missing retry — it is the *only* way to
avoid two of them. `client/retry.ts` already retries with exponential backoff and jitter,
and leaving TanStack's own retry on as well would make one failed read nine requests
arriving in an unjittered rhythm.

## Known duplication — for whoever converges it

`apps/mobile/src/features/reader/api/` holds a second, narrower scripture client written in
parallel by the reader agent: `reader-api.ts`, `scripture-contract.ts`,
`scripture-endpoints.ts`, `scripture-queries.ts`. It covers chapters and translations only,
and it predates this layer's identity header, jittered backoff, typed error union, and
persisted cache.

Nothing here depends on it and nothing there depends on this, so both compile and both
pass. Converging means pointing the reader's hooks at `useChapterQuery` /
`useTranslationsQuery` and deleting the four files — a change that belongs to whoever owns
`src/features/reader`, not to this directory. Recorded here so the next agent does not
"discover" it a third time.
