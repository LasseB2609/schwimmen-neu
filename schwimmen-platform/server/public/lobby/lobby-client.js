import { getState } from './state.js';
import { registerLobbyActions } from './actions.js';
import { registerLobbySocketHandlers } from './socket.js';
import { initLobby } from './init.js';

const state = getState();

registerLobbyActions(state);
registerLobbySocketHandlers(state);
initLobby(state);
