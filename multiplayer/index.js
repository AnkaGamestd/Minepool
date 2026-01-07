/**
 * Multiplayer Module Index
 * Exports all multiplayer components
 */

const { RoomManager, GameRoom } = require('./RoomManager');
const { MatchmakingQueue, EloCalculator } = require('./MatchmakingQueue');
const { MultiplayerServer } = require('./WebSocketHandler');
const { MatchHistory } = require('./MatchHistory');
const { AchievementManager } = require('./Achievements');
const { Tournament, TournamentManager } = require('./Tournament');

module.exports = {
    RoomManager,
    GameRoom,
    MatchmakingQueue,
    EloCalculator,
    MultiplayerServer,
    MatchHistory,
    AchievementManager,
    Tournament,
    TournamentManager
};
