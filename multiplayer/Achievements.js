/**
 * Achievement System for 8-Ball Pool
 * Tracks and awards player achievements
 */

class AchievementManager {
    constructor() {
        // Define all achievements
        this.achievements = {
            // Beginner achievements
            first_win: {
                id: 'first_win',
                name: 'First Victory',
                description: 'Win your first game',
                icon: '🏆',
                rarity: 'common',
                coins: 100
            },
            ten_wins: {
                id: 'ten_wins',
                name: 'Rising Star',
                description: 'Win 10 games',
                icon: '⭐',
                rarity: 'common',
                coins: 250
            },
            fifty_wins: {
                id: 'fifty_wins',
                name: 'Pool Shark',
                description: 'Win 50 games',
                icon: '🦈',
                rarity: 'rare',
                coins: 1000
            },
            hundred_wins: {
                id: 'hundred_wins',
                name: 'Pool Legend',
                description: 'Win 100 games',
                icon: '👑',
                rarity: 'epic',
                coins: 2500
            },

            // Streak achievements
            streak_3: {
                id: 'streak_3',
                name: 'On Fire',
                description: 'Win 3 games in a row',
                icon: '🔥',
                rarity: 'common',
                coins: 150
            },
            streak_5: {
                id: 'streak_5',
                name: 'Unstoppable',
                description: 'Win 5 games in a row',
                icon: '💫',
                rarity: 'rare',
                coins: 500
            },
            streak_10: {
                id: 'streak_10',
                name: 'Perfect Ten',
                description: 'Win 10 games in a row',
                icon: '🌟',
                rarity: 'epic',
                coins: 2000
            },

            // Skill achievements
            break_and_run: {
                id: 'break_and_run',
                name: 'Break and Run',
                description: 'Pocket all your balls without opponent taking a shot',
                icon: '⚡',
                rarity: 'epic',
                coins: 1500
            },
            eight_ball_combo: {
                id: 'eight_ball_combo',
                name: '8-Ball Combo',
                description: 'Win by pocketing the 8-ball on a combo shot',
                icon: '🎱',
                rarity: 'rare',
                coins: 500
            },
            comeback_king: {
                id: 'comeback_king',
                name: 'Comeback King',
                description: 'Win a game after being 4 balls behind',
                icon: '💪',
                rarity: 'rare',
                coins: 750
            },

            // ELO achievements
            silver_rank: {
                id: 'silver_rank',
                name: 'Silver Tier',
                description: 'Reach 800 ELO rating',
                icon: '🥈',
                rarity: 'common',
                coins: 200
            },
            gold_rank: {
                id: 'gold_rank',
                name: 'Gold Tier',
                description: 'Reach 1100 ELO rating',
                icon: '🥇',
                rarity: 'common',
                coins: 500
            },
            platinum_rank: {
                id: 'platinum_rank',
                name: 'Platinum Tier',
                description: 'Reach 1400 ELO rating',
                icon: '💎',
                rarity: 'rare',
                coins: 1000
            },
            diamond_rank: {
                id: 'diamond_rank',
                name: 'Diamond Tier',
                description: 'Reach 1700 ELO rating',
                icon: '💠',
                rarity: 'epic',
                coins: 2000
            },
            master_rank: {
                id: 'master_rank',
                name: 'Master Tier',
                description: 'Reach 2000 ELO rating',
                icon: '🏅',
                rarity: 'legendary',
                coins: 5000
            },

            // Coins achievements
            rich_player: {
                id: 'rich_player',
                name: 'Getting Rich',
                description: 'Accumulate 5,000 coins',
                icon: '💰',
                rarity: 'common',
                coins: 0
            },
            millionaire: {
                id: 'millionaire',
                name: 'Pool Millionaire',
                description: 'Accumulate 100,000 coins',
                icon: '💵',
                rarity: 'legendary',
                coins: 0
            },
            high_roller: {
                id: 'high_roller',
                name: 'High Roller',
                description: 'Win a 1000 coin wager game',
                icon: '🎰',
                rarity: 'rare',
                coins: 500
            },

            // Social achievements
            first_chat: {
                id: 'first_chat',
                name: 'Friendly Player',
                description: 'Send your first chat message',
                icon: '💬',
                rarity: 'common',
                coins: 50
            },
            spectator: {
                id: 'spectator',
                name: 'Spectator',
                description: 'Watch 10 games',
                icon: '👀',
                rarity: 'common',
                coins: 100
            },

            // Special achievements
            perfect_break: {
                id: 'perfect_break',
                name: 'Perfect Break',
                description: 'Pocket 3 or more balls on the break',
                icon: '💥',
                rarity: 'rare',
                coins: 300
            },
            no_fouls: {
                id: 'no_fouls',
                name: 'Clean Game',
                description: 'Win a game without committing any fouls',
                icon: '✨',
                rarity: 'rare',
                coins: 400
            }
        };

        // Player achievements storage (in production, use database)
        this.playerAchievements = new Map(); // playerId -> Set(achievementIds)
        this.playerProgress = new Map(); // playerId -> { achievement: progress }
    }

    checkAchievements(player, match, isWinner) {
        const playerId = player.email || player.id;
        const newAchievements = [];

        // Initialize player data if needed
        if (!this.playerAchievements.has(playerId)) {
            this.playerAchievements.set(playerId, new Set());
            this.playerProgress.set(playerId, {});
        }

        const earned = this.playerAchievements.get(playerId);
        const progress = this.playerProgress.get(playerId);

        if (isWinner) {
            // Win-based achievements
            progress.wins = (progress.wins || 0) + 1;
            progress.currentStreak = (progress.currentStreak || 0) + 1;
            progress.maxStreak = Math.max(progress.maxStreak || 0, progress.currentStreak);

            if (progress.wins === 1 && !earned.has('first_win')) {
                newAchievements.push(this.awardAchievement(playerId, 'first_win'));
            }
            if (progress.wins === 10 && !earned.has('ten_wins')) {
                newAchievements.push(this.awardAchievement(playerId, 'ten_wins'));
            }
            if (progress.wins === 50 && !earned.has('fifty_wins')) {
                newAchievements.push(this.awardAchievement(playerId, 'fifty_wins'));
            }
            if (progress.wins === 100 && !earned.has('hundred_wins')) {
                newAchievements.push(this.awardAchievement(playerId, 'hundred_wins'));
            }

            // Streak achievements
            if (progress.currentStreak >= 3 && !earned.has('streak_3')) {
                newAchievements.push(this.awardAchievement(playerId, 'streak_3'));
            }
            if (progress.currentStreak >= 5 && !earned.has('streak_5')) {
                newAchievements.push(this.awardAchievement(playerId, 'streak_5'));
            }
            if (progress.currentStreak >= 10 && !earned.has('streak_10')) {
                newAchievements.push(this.awardAchievement(playerId, 'streak_10'));
            }

            // High roller
            if (match.wager >= 1000 && !earned.has('high_roller')) {
                newAchievements.push(this.awardAchievement(playerId, 'high_roller'));
            }

            // Clean game (no fouls)
            const playerFouls = match.gameState?.fouls?.filter(f => {
                const isHost = match.players?.host?.id === playerId;
                return f.player === (isHost ? 1 : 2);
            }) || [];
            if (playerFouls.length === 0 && !earned.has('no_fouls')) {
                newAchievements.push(this.awardAchievement(playerId, 'no_fouls'));
            }
        } else {
            // Reset streak on loss
            progress.currentStreak = 0;
        }

        // ELO-based achievements
        const elo = player.elo || 1200;
        if (elo >= 800 && !earned.has('silver_rank')) {
            newAchievements.push(this.awardAchievement(playerId, 'silver_rank'));
        }
        if (elo >= 1100 && !earned.has('gold_rank')) {
            newAchievements.push(this.awardAchievement(playerId, 'gold_rank'));
        }
        if (elo >= 1400 && !earned.has('platinum_rank')) {
            newAchievements.push(this.awardAchievement(playerId, 'platinum_rank'));
        }
        if (elo >= 1700 && !earned.has('diamond_rank')) {
            newAchievements.push(this.awardAchievement(playerId, 'diamond_rank'));
        }
        if (elo >= 2000 && !earned.has('master_rank')) {
            newAchievements.push(this.awardAchievement(playerId, 'master_rank'));
        }

        // Coins-based achievements
        const coins = player.coins || 0;
        if (coins >= 5000 && !earned.has('rich_player')) {
            newAchievements.push(this.awardAchievement(playerId, 'rich_player'));
        }
        if (coins >= 100000 && !earned.has('millionaire')) {
            newAchievements.push(this.awardAchievement(playerId, 'millionaire'));
        }

        return newAchievements.filter(a => a !== null);
    }

    awardAchievement(playerId, achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement) return null;

        const earned = this.playerAchievements.get(playerId);
        if (earned.has(achievementId)) return null;

        earned.add(achievementId);

        return {
            ...achievement,
            earnedAt: Date.now()
        };
    }

    getPlayerAchievements(playerId) {
        const earned = this.playerAchievements.get(playerId) || new Set();
        const progress = this.playerProgress.get(playerId) || {};

        const result = {
            earned: [],
            locked: [],
            progress
        };

        for (const [id, achievement] of Object.entries(this.achievements)) {
            if (earned.has(id)) {
                result.earned.push({
                    ...achievement,
                    unlocked: true
                });
            } else {
                result.locked.push({
                    ...achievement,
                    unlocked: false
                });
            }
        }

        // Sort by rarity
        const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
        result.earned.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
        result.locked.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

        return result;
    }

    checkChatAchievement(playerId) {
        if (!this.playerAchievements.has(playerId)) {
            this.playerAchievements.set(playerId, new Set());
        }

        const earned = this.playerAchievements.get(playerId);
        if (!earned.has('first_chat')) {
            return this.awardAchievement(playerId, 'first_chat');
        }
        return null;
    }

    trackSpectating(playerId) {
        if (!this.playerProgress.has(playerId)) {
            this.playerProgress.set(playerId, {});
        }

        const progress = this.playerProgress.get(playerId);
        progress.gamesWatched = (progress.gamesWatched || 0) + 1;

        const earned = this.playerAchievements.get(playerId) || new Set();
        if (progress.gamesWatched >= 10 && !earned.has('spectator')) {
            return this.awardAchievement(playerId, 'spectator');
        }
        return null;
    }
}

module.exports = { AchievementManager };
