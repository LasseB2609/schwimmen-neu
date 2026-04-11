import { getState } from './state.js';
import { registerGameActions } from './actions.js';
import { registerGameSocketHandlers } from './socket.js';
import { initGame } from './init.js';

const state = getState();

registerGameActions(state);
registerGameSocketHandlers(state);
initGame(state);
