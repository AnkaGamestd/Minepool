(function () {
    'use strict';

    class MobileMatchmakingUI {
        constructor(network, callbacks = {}) {
            this.network = network;
            this.callbacks = callbacks;
            this.searching = false;
            this.selectedTier = 'bronze';
            this.startedAt = 0;
            this.timer = null;
            this.create();
            this.bind();
        }

        create() {
            const overlay = document.createElement('section');
            overlay.className = 'matchmaking-overlay hidden';
            overlay.id = 'matchmaking-overlay';
            overlay.setAttribute('aria-label', 'Online multiplayer');
            overlay.innerHTML = `
              <div class="matchmaking-card" role="dialog" aria-modal="true" aria-labelledby="matchmaking-title">
                <header class="matchmaking-head">
                  <div><span class="matchmaking-kicker">ONLINE MULTIPLAYER</span><h2 id="matchmaking-title">FIND A RIVAL</h2></div>
                  <button class="matchmaking-close" id="matchmaking-close" type="button" aria-label="Close matchmaking">×</button>
                </header>
                <div class="matchmaking-status"><span class="online-dot"></span><span id="matchmaking-connection">Connecting to game server…</span></div>
                <div class="matchmaking-setup" id="matchmaking-setup">
                  <p class="matchmaking-copy">Choose a table and enter the live matchmaking queue.</p>
                  <div class="tier-grid" role="group" aria-label="Table stake">
                    <button class="tier-choice selected" type="button" data-tier="bronze"><strong>BRONZE</strong><span>50 COINS</span></button>
                    <button class="tier-choice" type="button" data-tier="silver"><strong>SILVER</strong><span>100 COINS</span></button>
                    <button class="tier-choice" type="button" data-tier="gold"><strong>GOLD</strong><span>250 COINS</span></button>
                  </div>
                  <button class="matchmaking-primary" id="quick-match" type="button"><span class="search-mark"></span> QUICK MATCH</button>
                  <div class="private-room-actions">
                    <button id="create-private-room" type="button">CREATE ROOM</button>
                    <button id="open-join-room" type="button">JOIN ROOM</button>
                  </div>
                  <div class="join-room-form hidden" id="join-room-form">
                    <label for="room-code-input">ROOM CODE</label>
                    <div><input id="room-code-input" maxlength="6" autocomplete="off" inputmode="text" placeholder="ABC123"><button id="join-private-room" type="button">JOIN</button></div>
                  </div>
                </div>
                <div class="matchmaking-searching hidden" id="matchmaking-searching" aria-live="polite">
                  <div class="radar"><span></span></div>
                  <h3>SEARCHING FOR OPPONENT</h3>
                  <p>Matching players near your rating…</p>
                  <strong id="search-elapsed">0:00</strong>
                  <button class="matchmaking-cancel" id="cancel-matchmaking" type="button">CANCEL</button>
                </div>
                <div class="matchmaking-room hidden" id="matchmaking-room" aria-live="polite">
                  <span class="room-label">PRIVATE ROOM</span>
                  <strong id="created-room-code">------</strong>
                  <p>Share this code with your friend. The match begins automatically when they join.</p>
                  <button class="matchmaking-cancel" id="cancel-room" type="button">CANCEL ROOM</button>
                </div>
              </div>`;
            document.body.appendChild(overlay);
            this.overlay = overlay;
        }

        bind() {
            this.overlay.querySelectorAll('[data-tier]').forEach((button) => button.addEventListener('click', () => {
                this.overlay.querySelectorAll('[data-tier]').forEach((item) => item.classList.toggle('selected', item === button));
                this.selectedTier = button.dataset.tier;
            }));
            document.getElementById('matchmaking-close').addEventListener('click', () => this.hide());
            document.getElementById('quick-match').addEventListener('click', () => this.startSearch());
            document.getElementById('cancel-matchmaking').addEventListener('click', () => this.cancelSearch());
            document.getElementById('create-private-room').addEventListener('click', () => this.network.createRoom(50));
            document.getElementById('open-join-room').addEventListener('click', () => document.getElementById('join-room-form').classList.toggle('hidden'));
            document.getElementById('join-private-room').addEventListener('click', () => this.joinRoom());
            document.getElementById('room-code-input').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') this.joinRoom();
            });
            document.getElementById('cancel-room').addEventListener('click', () => {
                this.network.leaveRoom();
                this.showSetup();
            });
            this.overlay.addEventListener('click', (event) => { if (event.target === this.overlay) this.hide(); });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.hide();
            });

            this.network.on('connected', () => this.setConnection('Connected — ready to play', true));
            this.network.on('authenticated', () => this.setConnection('Connected — ready to play', true));
            this.network.on('disconnected', () => this.setConnection('Connection lost — reconnecting…', false));
            this.network.on('connect_error', () => this.setConnection('Could not reach the game server', false));
            this.network.on('matchmaking_started', () => this.showSearching());
            this.network.on('match_found', () => {
                document.querySelector('#matchmaking-searching h3').textContent = 'MATCH FOUND';
                document.querySelector('#matchmaking-searching p').textContent = 'Preparing the table…';
            });
            this.network.on('matchmaking_cancelled', () => this.showSetup());
            this.network.on('matchmaking_timeout', () => {
                this.showSetup();
                this.callbacks.onMessage?.('No rival found. Please try again.');
            });
            this.network.on('room_created', (data) => this.showRoom(data.roomId));
            this.network.on('player_joined', (data) => {
                if (data.room?.status === 'ready') {
                    window.setTimeout(() => this.network.ready(), 250);
                }
            });
            this.network.on('room_error', (data) => this.callbacks.onMessage?.(data.error || 'Room operation failed.'));
            this.network.on('game_start', (data) => {
                this.stopTimer();
                this.searching = false;
                this.overlay.classList.add('hidden');
                this.callbacks.onGameStart?.(data);
            });
        }

        async show() {
            this.overlay.classList.remove('hidden');
            this.showSetup();
            if (!this.network.isConnected()) {
                this.setConnection('Connecting to game server…', false);
                try { await this.network.connect(); }
                catch (error) { this.setConnection('Could not reach the game server', false); }
            } else {
                this.setConnection('Connected — ready to play', true);
            }
        }

        hide() {
            if (this.searching) this.cancelSearch();
            this.overlay.classList.add('hidden');
        }

        startSearch() {
            if (!this.network.isConnected()) {
                this.callbacks.onMessage?.('Game server is not connected yet.');
                return;
            }
            this.searching = true;
            this.network.findMatch(this.selectedTier);
            this.showSearching();
        }

        cancelSearch() {
            this.network.cancelMatchmaking();
            this.searching = false;
            this.showSetup();
        }

        joinRoom() {
            const input = document.getElementById('room-code-input');
            const code = input.value.trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(code)) {
                this.callbacks.onMessage?.('Enter a valid 6-character room code.');
                return;
            }
            this.network.joinRoom(code);
        }

        showSetup() {
            this.stopTimer();
            document.getElementById('matchmaking-setup').classList.remove('hidden');
            document.getElementById('matchmaking-searching').classList.add('hidden');
            document.getElementById('matchmaking-room').classList.add('hidden');
        }

        showSearching() {
            document.getElementById('matchmaking-setup').classList.add('hidden');
            document.getElementById('matchmaking-searching').classList.remove('hidden');
            document.getElementById('matchmaking-room').classList.add('hidden');
            document.querySelector('#matchmaking-searching h3').textContent = 'SEARCHING FOR OPPONENT';
            document.querySelector('#matchmaking-searching p').textContent = 'Matching players near your rating…';
            this.startedAt = Date.now();
            this.stopTimer();
            this.timer = setInterval(() => {
                const total = Math.floor((Date.now() - this.startedAt) / 1000);
                document.getElementById('search-elapsed').textContent = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
            }, 250);
        }

        showRoom(code) {
            document.getElementById('matchmaking-setup').classList.add('hidden');
            document.getElementById('matchmaking-searching').classList.add('hidden');
            document.getElementById('matchmaking-room').classList.remove('hidden');
            document.getElementById('created-room-code').textContent = code;
        }

        setConnection(message, online) {
            document.getElementById('matchmaking-connection').textContent = message;
            this.overlay.querySelector('.online-dot').classList.toggle('offline', !online);
        }

        stopTimer() {
            if (this.timer) clearInterval(this.timer);
            this.timer = null;
        }
    }

    window.MobileMatchmakingUI = MobileMatchmakingUI;
})();
