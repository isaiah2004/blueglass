/**
 * The fleet status board: what the agents are doing, on the same phone the
 * human answers from. Replaced wholesale by the orchestrator, never patched.
 */
import { esc } from './util.js';
import { state } from './store.js';

const STATES = ['done', 'running', 'blocked', 'queued'];

const row = (entry) => {
  const stateName = STATES.includes(entry.state) ? entry.state : 'queued';
  return '<div class="srow"><span class="sdot ' + stateName + '" aria-hidden="true"></span><div>' +
    '<p class="stitle">' + esc(entry.title) +
      '<span class="sstate ' + stateName + '">' + esc(stateName) + '</span></p>' +
    (entry.detail ? '<p class="sdetail">' + esc(entry.detail) + '</p>' : '') +
    '</div></div>';
};

/** The whole board, or an honest empty state. */
export function renderStatusBoard() {
  const board = state.statusBoard;
  if (!board || !Array.isArray(board.entries) || board.entries.length === 0) {
    return '<div class="empty"><p class="big">No status posted yet.</p>' +
      '<p>The orchestrator publishes here as the fleet works.</p></div>';
  }
  const stamp = board.updatedAt ? new Date(board.updatedAt).toLocaleString() : 'unknown time';
  return (board.headline ? '<p class="status-headline">' + esc(board.headline) + '</p>' : '') +
    '<p class="status-stamp">Updated ' + esc(stamp) + '</p>' +
    board.entries.map(row).join('');
}
