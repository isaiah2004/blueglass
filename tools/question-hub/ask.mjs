/**
 * Agent-facing CLI for posting a question to the Question Hub.
 *
 * Subagents call this when they hit a decision only the human can make. The question is
 * queued and the agent carries on with work that does not depend on the answer — it never
 * blocks. Take the recommended option, record the assumption, keep building.
 *
 * Usage:
 *   node tools/question-hub/ask.mjs --section "9 · Maps" --q "Which tile provider?" \
 *        --why "Changes the whole rendering path" --kind choice \
 *        --opt "MapLibre" --opt "Custom GeoJSON" --rec "Custom GeoJSON" --by "map-agent"
 *
 *   --rank                    ask for an ordered subset instead of one pick
 *   --no-other                close the set (no free-text Other row)
 *   --in-use                  an agent has already built on the recommendation
 *   --image "<src>|<alt>"     attach a repo-relative image (alt is required)
 *   --swatch "<name>|#hex"    repeatable; collected into one swatch grid
 *   --attach '<json>'         repeatable; any attachment shape, verbatim
 *   --layout compare|swatch   presentation hint
 *   --stdin                   read the whole question as JSON on stdin
 */
const HUB = process.env.HUB_URL ?? 'http://localhost:7777';

function splitPair(value, what) {
  const at = value.indexOf('|');
  if (at < 0) throw new Error(what + ' must be "<first>|<second>", got: ' + value);
  return [value.slice(0, at).trim(), value.slice(at + 1).trim()];
}

function parseArgs(argv) {
  const out = { options: [], attachments: [], swatches: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[(i += 1)];
    switch (arg) {
      case '--stdin': out.stdin = true; break;
      case '--section': out.section = next(); break;
      case '--q': case '--question': out.question = next(); break;
      case '--why': out.why = next(); break;
      case '--kind': out.kind = next(); break;
      case '--opt': out.options.push(next()); break;
      case '--rec': out.recommended = next(); break;
      case '--default': out.defaultAnswer = next(); break;
      case '--by': out.askedBy = next(); break;
      case '--id': out.id = next(); break;
      case '--prefix': out.idPrefix = next(); break;
      case '--blocking': out.blocking = true; break;
      case '--rank': out.kind = 'rank'; break;
      case '--no-other': out.allowOther = false; break;
      case '--in-use': out.assumedInUse = true; break;
      case '--layout': out.layout = next(); break;
      case '--priority': out.priority = next(); break;
      case '--revive': out.revive = true; break;
      case '--image': {
        const [src, alt] = splitPair(next(), '--image');
        out.attachments.push({ type: 'image', src, alt });
        break;
      }
      case '--swatch': {
        const [name, hex] = splitPair(next(), '--swatch');
        out.swatches.push({ name, hex });
        break;
      }
      case '--attach': out.attachments.push(JSON.parse(next())); break;
      case '--note': out.attachments.push({ type: 'note', markdown: next() }); break;
      default:
        throw new Error('Unknown argument: ' + arg);
    }
  }
  return out;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** The queue is only useful if a human can face it: warn the fleet before it drowns them. */
async function warnIfQueueIsLong() {
  try {
    const res = await fetch(HUB + '/api/health');
    if (!res.ok) return;
    const { stats } = await res.json();
    if (stats.open > 100) {
      console.warn('[ask] ' + stats.open + ' questions are now open. That is more than one person can face in a sitting —');
      console.warn('[ask] prefer taking the recommended default and recording the assumption over asking another.');
    }
  } catch {
    // Health is advisory; never fail an ask because the stats call did not come back.
  }
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error('[ask] ' + err.message);
  process.exit(1);
}

const payload = args.stdin ? await readStdin() : args;
delete payload.stdin;
if (payload.options?.length === 0) delete payload.options;
if (payload.swatches?.length > 0) payload.attachments.push({ type: 'swatches', swatches: payload.swatches });
delete payload.swatches;
if (payload.attachments?.length === 0) delete payload.attachments;

if (payload.kind === 'scale') {
  console.warn('[ask] kind=scale is deprecated: a bare 1-5 row reads poorly on a phone.');
  console.warn('[ask] prefer kind=choice with labelled buckets, e.g. --opt "Not at all" --opt "Somewhat" --opt "A lot".');
}

const res = await fetch(HUB + '/api/ask', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

const body = await res.json();
if (!res.ok) {
  console.error('[ask] failed (' + res.status + '): ' + body.error);
  process.exit(1);
}
console.log('[ask] queued ' + body.id + ' — ' + body.question);
await warnIfQueueIsLong();
