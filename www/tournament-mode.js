(function () {
    'use strict';

    const STORAGE_KEY = 'minepool.tournament.v1';
    const ROUNDS = ['QUARTER FINAL', 'SEMI FINAL', 'FINAL'];
    const TIERS = Object.freeze({
        downtown: { id: 'downtown', name: 'DOWNTOWN CUP', entry: 100, prize: 800, accent: 'bronze', difficulties: ['easy', 'medium', 'medium-hard'] },
        crown: { id: 'crown', name: 'CROWN MASTERS', entry: 500, prize: 4000, accent: 'gold', difficulties: ['medium', 'medium-hard', 'hard'] },
        world: { id: 'world', name: 'WORLD CLASS', entry: 2500, prize: 20000, accent: 'diamond', difficulties: ['medium-hard', 'hard', 'expert'] }
    });
    const RIVALS = ['MASON', 'NOAH', 'LENA', 'KAI', 'VICTOR', 'MAYA', 'LEO', 'ARIA', 'DIEGO', 'NOVA', 'ELIAS', 'ZARA'];

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

    class TournamentMode {
        constructor(options) {
            this.platform = options.platform;
            this.onExit = options.onExit;
            this.onStartMatch = options.onStartMatch;
            this.onPlayerChange = options.onPlayerChange;
            this.onMessage = options.onMessage;
            this.state = this.readState();
            this.root = document.getElementById('tournament-view');
            this.lobby = document.getElementById('tournament-lobby');
            this.bracket = document.getElementById('tournament-bracket');
            this.bind();
        }

        bind() {
            document.getElementById('tournament-back').addEventListener('click', () => this.onExit());
            document.querySelectorAll('[data-tournament-tier]').forEach((button) => button.addEventListener('click', () => this.start(button.dataset.tournamentTier)));
            document.getElementById('tournament-play-match').addEventListener('click', () => this.playCurrentMatch());
            document.getElementById('tournament-new').addEventListener('click', () => this.reset());
        }

        readState() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
            catch (error) { return null; }
        }

        saveState() {
            try {
                if (this.state) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
                else localStorage.removeItem(STORAGE_KEY);
            } catch (error) { console.warn('Tournament progress could not be saved.', error); }
        }

        show() {
            this.renderCoins();
            if (this.state) this.renderBracket();
            else this.renderLobby();
        }

        renderCoins() {
            document.getElementById('tournament-coins').textContent = new Intl.NumberFormat('en-US').format(this.platform.getPlayer().coins);
        }

        renderLobby() {
            this.lobby.classList.remove('hidden');
            this.bracket.classList.add('hidden');
            const coins = this.platform.getPlayer().coins;
            document.querySelectorAll('[data-tournament-tier]').forEach((button) => {
                const tier = TIERS[button.dataset.tournamentTier];
                button.disabled = coins < tier.entry;
                button.querySelector('.tournament-enter-copy').textContent = coins < tier.entry ? 'NOT ENOUGH COINS' : 'ENTER TOURNAMENT';
            });
        }

        async start(tierId) {
            const tier = TIERS[tierId];
            const player = this.platform.getPlayer();
            if (!tier || player.coins < tier.entry) {
                this.onMessage('TOURNAMENT', 'Not enough coins for this tournament.');
                return;
            }

            const shuffled = [...RIVALS].sort(() => Math.random() - 0.5).slice(0, 7);
            this.state = {
                tierId,
                round: 0,
                wonRounds: 0,
                eliminated: false,
                complete: false,
                entrants: [player.displayName, ...shuffled],
                opponents: [shuffled[0], shuffled[2], shuffled[6]],
                createdAt: Date.now()
            };
            this.saveState();
            await this.platform.updatePlayer({ coins: player.coins - tier.entry });
            this.onPlayerChange(this.platform.getPlayer());
            this.renderCoins();
            this.renderBracket();
        }

        reset() {
            this.state = null;
            this.saveState();
            this.renderCoins();
            this.renderLobby();
        }

        playCurrentMatch() {
            if (!this.state || this.state.eliminated || this.state.complete) return;
            const tier = TIERS[this.state.tierId];
            this.onStartMatch({
                opponent: this.state.opponents[this.state.round],
                difficulty: tier.difficulties[this.state.round],
                roundLabel: ROUNDS[this.state.round],
                tournamentName: tier.name
            });
        }

        async recordResult(won, pocketedBalls) {
            if (!this.state) return null;
            const tier = TIERS[this.state.tierId];
            const player = this.platform.getPlayer();
            const daily = player.dailyProgress || {};
            const finalWin = won && this.state.round === 2;
            const nextPlayer = await this.platform.updatePlayer({
                coins: player.coins + (finalWin ? tier.prize : 0),
                gamesPlayed: player.gamesPlayed + 1,
                gamesWon: player.gamesWon + (won ? 1 : 0),
                winStreak: won ? (player.winStreak || 0) + 1 : 0,
                dailyProgress: {
                    games: (daily.games || 0) + 1,
                    balls: (daily.balls || 0) + Math.max(0, pocketedBalls || 0),
                    wins: (daily.wins || 0) + (won ? 1 : 0)
                }
            });

            if (won) {
                this.state.wonRounds += 1;
                if (finalWin) this.state.complete = true;
                else this.state.round += 1;
            } else {
                this.state.eliminated = true;
            }
            this.saveState();
            this.onPlayerChange(nextPlayer);
            return {
                won,
                complete: this.state.complete,
                eliminated: this.state.eliminated,
                prize: finalWin ? tier.prize : 0,
                roundLabel: finalWin ? 'TOURNAMENT CHAMPION' : ROUNDS[Math.max(0, this.state.round - (won ? 1 : 0))]
            };
        }

        renderBracket() {
            if (!this.state) return this.renderLobby();
            const tier = TIERS[this.state.tierId];
            const names = this.state.entrants.map(escapeHtml);
            const human = names[0];
            const round = this.state.round;
            const won = this.state.wonRounds;
            const resultClass = (roundIndex) => won > roundIndex ? 'advanced' : (this.state.eliminated && round === roundIndex ? 'eliminated' : (round === roundIndex && !this.state.complete ? 'current' : ''));

            document.getElementById('tournament-name').textContent = tier.name;
            document.getElementById('tournament-prize').textContent = new Intl.NumberFormat('en-US').format(tier.prize);
            document.getElementById('tournament-rounds').innerHTML = `
                <section class="bracket-round"><h3>QUARTER FINALS</h3>
                    <div class="bracket-match ${resultClass(0)}"><span>${human}</span><span>${names[1]}</span></div>
                    <div class="bracket-match"><span>${names[2]}</span><span class="winner">${names[3]}</span></div>
                    <div class="bracket-match"><span class="winner">${names[4]}</span><span>${names[5]}</span></div>
                    <div class="bracket-match"><span>${names[6]}</span><span class="winner">${names[7]}</span></div>
                </section>
                <section class="bracket-round"><h3>SEMI FINALS</h3>
                    <div class="bracket-match ${resultClass(1)}"><span>${won >= 1 ? human : 'TBD'}</span><span>${names[3]}</span></div>
                    <div class="bracket-match"><span>${names[4]}</span><span class="winner">${names[7]}</span></div>
                </section>
                <section class="bracket-round final-round"><h3>FINAL</h3>
                    <div class="bracket-match ${resultClass(2)}"><span>${won >= 2 ? human : 'TBD'}</span><span>${names[7]}</span></div>
                    <div class="trophy-mark" aria-hidden="true">★</div>
                </section>`;

            const status = document.getElementById('tournament-status');
            const play = document.getElementById('tournament-play-match');
            const fresh = document.getElementById('tournament-new');
            if (this.state.complete) {
                status.innerHTML = `<strong>CHAMPION</strong><span>Prize collected: ${new Intl.NumberFormat('en-US').format(tier.prize)} coins</span>`;
                play.classList.add('hidden'); fresh.classList.remove('hidden');
            } else if (this.state.eliminated) {
                status.innerHTML = '<strong>ELIMINATED</strong><span>Your tournament run has ended.</span>';
                play.classList.add('hidden'); fresh.classList.remove('hidden');
            } else {
                status.innerHTML = `<strong>${ROUNDS[round]}</strong><span>Next opponent: ${escapeHtml(this.state.opponents[round])}</span>`;
                play.textContent = `PLAY ${ROUNDS[round]}`;
                play.classList.remove('hidden'); fresh.classList.add('hidden');
            }
            this.lobby.classList.add('hidden');
            this.bracket.classList.remove('hidden');
        }
    }

    window.TournamentMode = TournamentMode;
})();
