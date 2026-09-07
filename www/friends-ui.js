(() => {
    'use strict';
    class FriendsUI {
        constructor(network, platform, callbacks = {}) {
            this.network = network;
            this.platform = platform;
            this.callbacks = callbacks;
            this.busy = false;
            this.activeInviteId = null;
            this.create();
            this.bind();
        }

        create() {
            this.overlay = document.createElement('section');
            this.overlay.className = 'friends-overlay hidden';
            this.overlay.id = 'friends-overlay';
            this.overlay.innerHTML = `<div class="friends-card" role="dialog" aria-modal="true" aria-labelledby="friends-title">
              <header class="friends-head"><div><span>YOUR CLUB</span><h2 id="friends-title">PLAY WITH FRIEND</h2></div><button id="friends-close" type="button" aria-label="Close friends">×</button></header>
              <div class="friends-connection"><i></i><span id="friends-connection-text">Connecting…</span><button id="friends-refresh" type="button">REFRESH</button></div>
              <div class="friends-content">
                <section class="friend-search"><form id="friend-search-form"><label for="friend-search-input">FIND PLAYER BY NICK</label><div><input id="friend-search-input" minlength="3" maxlength="20" autocomplete="off" placeholder="ENTER PLAYER NICK" required><button type="submit">SEARCH</button></div></form><div id="friend-search-results" class="friend-list compact"></div></section>
                <section class="friends-roster"><div id="friend-requests-section" hidden><h3>FRIEND REQUESTS <span id="friend-request-count">0</span></h3><div id="friend-requests" class="friend-list"></div></div><h3>FRIENDS <span id="friend-count">0</span></h3><div id="friend-list" class="friend-list"><p class="friend-empty">Your friends will appear here.</p></div><div id="friend-outgoing" class="friend-outgoing"></div></section>
              </div>
              <div class="friend-wait hidden" id="friend-wait"><div class="friend-wait-pulse"></div><h3>INVITATION SENT</h3><p>Waiting for <strong id="friend-wait-name">your friend</strong> to accept…</p><button id="friend-wait-cancel" type="button">CANCEL INVITATION</button></div>
              <p class="friends-status" id="friends-status" role="status" aria-live="polite"></p>
            </div>`;
            this.inviteOverlay = document.createElement('section');
            this.inviteOverlay.className = 'friend-invite-overlay hidden';
            this.inviteOverlay.innerHTML = `<div class="friend-invite-card" role="alertdialog" aria-modal="true" aria-labelledby="friend-invite-title"><span class="friend-invite-kicker">FRIEND MATCH</span><div class="friend-invite-player"><div class="avatar" id="friend-invite-avatar">P</div><div><h2 id="friend-invite-title">MATCH INVITATION</h2><strong id="friend-invite-name">Player</strong><small id="friend-invite-rating">RATING 1200</small></div></div><p>wants to play a friendly 8-ball match.</p><div class="friend-invite-timer"><span id="friend-invite-time">30</span>s</div><div class="friend-invite-actions"><button id="friend-invite-decline" type="button">DECLINE</button><button id="friend-invite-accept" type="button">ACCEPT & PLAY</button></div></div>`;
            document.body.append(this.overlay, this.inviteOverlay);
            this.el = id => this.overlay.querySelector('#' + id);
            this.inviteEl = id => this.inviteOverlay.querySelector('#' + id);
        }

        bind() {
            this.el('friends-close').onclick = () => this.hide();
            this.el('friends-refresh').onclick = () => this.load();
            this.el('friend-search-form').onsubmit = event => { event.preventDefault(); this.search(); };
            this.el('friend-wait-cancel').onclick = () => { if (this.activeInviteId) this.network.cancelFriendMatch(this.activeInviteId); };
            this.overlay.onclick = event => { if (event.target === this.overlay) this.hide(); };
            this.inviteEl('friend-invite-accept').onclick = () => this.respondToMatch(true);
            this.inviteEl('friend-invite-decline').onclick = () => this.respondToMatch(false);
            document.addEventListener('keydown', event => { if (event.key === 'Escape' && !this.inviteOverlay.classList.contains('hidden')) this.respondToMatch(false); else if (event.key === 'Escape') this.hide(); });
            document.addEventListener('minepool:account-changed', () => { if (!this.overlay.classList.contains('hidden')) this.load(); });
            this.network?.on('authenticated', () => { this.setConnection(true); if (!this.overlay.classList.contains('hidden')) this.load(); });
            this.network?.on('connected', () => this.setConnection(true));
            this.network?.on('disconnected', () => this.setConnection(false));
            this.network?.on('friends_changed', () => { if (!this.overlay.classList.contains('hidden')) this.load(); });
            this.network?.on('friend_match_invite', data => this.showMatchInvite(data));
            this.network?.on('friend_match_sent', data => this.showWaiting(data));
            this.network?.on('friend_match_accepted', data => { this.activeInviteId = data.inviteId; this.message('Invitation accepted. Preparing the table…'); });
            this.network?.on('friend_match_closed', data => this.matchClosed(data));
            this.network?.on('friend_match_error', data => { this.showRoster(); this.message(data.error || 'Invitation failed.', true); });
            this.network?.on('game_start', data => { if (!data.friendMatch) return; this.hide(true); this.hideMatchInvite(); this.callbacks.onGameStart?.(data); });
        }

        async show() {
            if (!this.platform.isAuthenticated()) return this.callbacks.onAccount?.();
            this.overlay.classList.remove('hidden');
            this.showRoster();
            if (!this.network?.isConnected()) {
                this.setConnection(false, 'Connecting to game server…');
                try { await this.network.connect(); } catch (error) { this.setConnection(false, 'Could not reach game server'); }
            }
            await this.load();
        }
        hide(force = false) { if (force || !this.activeInviteId) this.overlay.classList.add('hidden'); }
        setConnection(online, text) {
            this.el('friends-connection-text').textContent = text || (online ? 'Online — invitations available' : 'Offline — reconnecting');
            this.overlay.querySelector('.friends-connection i').classList.toggle('offline', !online);
        }
        message(text, error = false) { this.el('friends-status').textContent = text; this.el('friends-status').classList.toggle('error', error); }
        setBusy(value) {
            this.busy = value;
            this.overlay.querySelector('.friends-card').classList.toggle('is-busy', value);
            [this.el('friends-refresh'), this.el('friend-search-input'), this.el('friend-search-form').querySelector('button')]
                .forEach(element => { element.disabled = value; });
        }

        async load() {
            if (!this.platform.isAuthenticated() || this.busy) return;
            this.setBusy(true);
            try {
                const data = await this.platform.getFriends();
                this.renderPlayers(this.el('friend-list'), data.friends, 'friend');
                this.renderPlayers(this.el('friend-requests'), data.incoming, 'incoming');
                this.el('friend-requests-section').hidden = !data.incoming.length;
                this.el('friend-request-count').textContent = data.incoming.length;
                this.el('friend-count').textContent = data.friends.length;
                this.renderOutgoing(data.outgoing);
                this.message('');
            } catch (error) { this.message(error.message, true); }
            finally { this.setBusy(false); }
        }

        async search() {
            const input = this.el('friend-search-input');
            if (!input.reportValidity() || this.busy) return;
            this.setBusy(true);
            try {
                const data = await this.platform.searchFriends(input.value.trim());
                this.renderPlayers(this.el('friend-search-results'), data.players, 'search');
                this.message(data.players.length ? '' : 'No players found with that nick.');
            } catch (error) { this.message(error.message, true); }
            finally { this.setBusy(false); }
        }

        renderPlayers(container, players, mode) {
            container.replaceChildren();
            if (!players.length) {
                const empty = document.createElement('p'); empty.className = 'friend-empty';
                empty.textContent = mode === 'friend' ? 'Add a player to start your friends list.' : mode === 'incoming' ? 'No pending requests.' : 'No matching players.';
                container.append(empty); return;
            }
            players.forEach(player => container.append(this.playerRow(player, mode)));
        }

        playerRow(player, mode) {
            const row = document.createElement('article'); row.className = 'friend-row';
            const avatar = document.createElement('div'); avatar.className = 'avatar';
            window.MinePoolAvatar.render(avatar, { displayName: player.username, avatarText: player.username.charAt(0).toUpperCase(), avatarUrl: player.profilePicture });
            const copy = document.createElement('div'); copy.className = 'friend-copy';
            const name = document.createElement('strong'); name.textContent = player.username;
            const meta = document.createElement('small'); meta.textContent = `${player.online ? 'ONLINE' : 'OFFLINE'} · RATING ${player.elo}`; meta.className = player.online ? 'online' : '';
            copy.append(name, meta);
            const actions = document.createElement('div'); actions.className = 'friend-actions';
            const button = (label, className, action) => { const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.className = className; element.onclick = action; return element; };
            if (mode === 'friend') {
                const play = button('PLAY', 'friend-play', () => this.invite(player)); play.disabled = !player.online || !this.network?.isConnected(); actions.append(play);
                const remove = button('×', 'friend-remove', () => this.remove(player)); remove.setAttribute('aria-label', `Remove ${player.username}`); actions.append(remove);
            } else if (mode === 'incoming') {
                actions.append(button('DECLINE', 'friend-decline', () => this.respondRequest(player, 'decline')), button('ACCEPT', 'friend-accept', () => this.respondRequest(player, 'accept')));
            } else {
                const labels = { friend: 'FRIEND', incoming: 'RESPOND ABOVE', outgoing: 'PENDING' };
                if (player.relation === 'none') actions.append(button('ADD', 'friend-accept', () => this.add(player)));
                else { const state = document.createElement('span'); state.className = 'friend-relation'; state.textContent = labels[player.relation]; actions.append(state); }
            }
            row.append(avatar, copy, actions); return row;
        }

        renderOutgoing(players) {
            const root = this.el('friend-outgoing'); root.replaceChildren();
            if (!players.length) return;
            const label = document.createElement('span'); label.textContent = 'REQUESTS SENT'; root.append(label);
            players.forEach(player => { const chip = document.createElement('span'); chip.textContent = player.username; root.append(chip); });
        }

        async add(player) { await this.mutate(() => this.platform.sendFriendRequest(player.id), 'Friend request sent.'); }
        async respondRequest(player, action) { await this.mutate(() => this.platform.respondFriendRequest(player.id, action), action === 'accept' ? `${player.username} is now your friend.` : 'Friend request declined.'); }
        async remove(player) { await this.mutate(() => this.platform.removeFriend(player.id), `${player.username} removed from friends.`); }
        async mutate(action, success) {
            if (this.busy) return; this.setBusy(true);
            try { await action(); this.message(success); await this.loadAfterMutation(); }
            catch (error) { this.message(error.message, true); }
            finally { this.setBusy(false); }
        }
        async loadAfterMutation() {
            const data = await this.platform.getFriends();
            this.el('friend-search-results').replaceChildren();
            this.renderPlayers(this.el('friend-list'), data.friends, 'friend');
            this.renderPlayers(this.el('friend-requests'), data.incoming, 'incoming');
            this.el('friend-requests-section').hidden = !data.incoming.length;
            this.el('friend-request-count').textContent = data.incoming.length;
            this.el('friend-count').textContent = data.friends.length;
            this.renderOutgoing(data.outgoing);
        }

        invite(player) {
            if (this.busy) return;
            if (!player.online || !this.network?.isConnected()) return this.message(`${player.username} is offline.`, true);
            this.message('Sending match invitation…');
            this.network.inviteFriend(player.id);
        }
        showWaiting(data) {
            this.activeInviteId = data.inviteId;
            this.el('friend-wait-name').textContent = data.target.username;
            this.overlay.querySelector('.friends-content').classList.add('hidden');
            this.el('friend-wait').classList.remove('hidden');
            this.message('');
        }
        showRoster() {
            this.activeInviteId = null;
            this.overlay.querySelector('.friends-content').classList.remove('hidden');
            this.el('friend-wait').classList.add('hidden');
        }
        matchClosed(data) {
            if (this.incomingInvite?.inviteId === data.inviteId) this.hideMatchInvite();
            if (this.activeInviteId !== data.inviteId) return;
            const messages = { declined: `${data.declinedBy || 'Your friend'} declined the invitation.`, expired: 'The invitation expired.', cancelled: 'Invitation cancelled.', unavailable: 'Your friend is no longer available.' };
            this.showRoster(); this.message(messages[data.reason] || 'Invitation closed.', data.reason !== 'cancelled'); this.load();
        }
        showMatchInvite(data) {
            this.incomingInvite = data;
            this.inviteEl('friend-invite-name').textContent = data.from.username;
            this.inviteEl('friend-invite-rating').textContent = `RATING ${data.from.elo}`;
            window.MinePoolAvatar.render(this.inviteEl('friend-invite-avatar'), { displayName: data.from.username, avatarText: data.from.username.charAt(0).toUpperCase(), avatarUrl: data.from.profilePicture });
            this.inviteOverlay.classList.remove('hidden');
            clearInterval(this.inviteTimer);
            const tick = () => {
                const seconds = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
                this.inviteEl('friend-invite-time').textContent = seconds;
                if (!seconds) this.hideMatchInvite();
            };
            tick(); this.inviteTimer = setInterval(tick, 250);
        }
        respondToMatch(accept) {
            if (!this.incomingInvite) return;
            const inviteId = this.incomingInvite.inviteId;
            this.hideMatchInvite();
            this.network.respondFriendMatch(inviteId, accept);
        }
        hideMatchInvite() { clearInterval(this.inviteTimer); this.inviteTimer = null; this.incomingInvite = null; this.inviteOverlay.classList.add('hidden'); }
    }
    window.FriendsUI = FriendsUI;
})();
