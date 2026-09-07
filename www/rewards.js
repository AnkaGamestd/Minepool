(() => {
    'use strict';
    class RewardsUI {
        constructor(platform, { onHome, onAccount }) {
            this.platform = platform;
            this.onAccount = onAccount;
            this.busy = false;
            this.root = document.createElement('main');
            this.root.id = 'rewards-view';
            this.root.className = 'rewards-shell app-view hidden';
            this.root.innerHTML = `
              <div class="rewards-inner">
                <header class="rewards-top"><button id="rewards-home" class="back-button" type="button">← HOME</button><span>PLAYER REWARDS</span><div class="rewards-balance"><small>YOUR COINS</small><strong id="rewards-coins">0</strong></div></header>
                <div class="rewards-heading"><div><span class="eyeline">A LITTLE MORE, EVERY DAY</span><h1>Good games. Great rewards.</h1></div><button id="rewards-refresh" class="rewards-secondary" type="button">REFRESH</button></div>
                <p id="rewards-account-note" class="rewards-note">Sign in to save your rewards across devices.</p>
                <section class="rewards-grid" aria-label="Coin rewards">
                  <article class="reward-card reward-daily"><div class="reward-topline"><span>DAILY CHECK-IN</span><span id="daily-badge" class="reward-badge">EVERY DAY</span></div><div class="reward-value"><span class="reward-coin" aria-hidden="true">★</span><div><strong>100</strong><span>FREE COINS</span></div></div><h2>Make it a daily habit.</h2><p>Visit every day and collect your coins. One claim per account, per day.</p><div class="reward-detail"><span id="rewards-streak">Your next reward is waiting.</span><span id="daily-reset">Resets daily at 00:00 UTC</span></div><button id="claim-daily" class="rewards-primary" type="button">SIGN IN TO CLAIM</button></article>
                  <article class="reward-card reward-invite"><div class="reward-topline"><span>BETTER WITH FRIENDS</span><span class="reward-badge">PER FRIEND</span></div><div class="reward-value"><span class="reward-coin" aria-hidden="true">★</span><div><strong>500</strong><span>INVITE BONUS</span></div></div><h2>Bring a friend to the table.</h2><p>Your friend creates an account and enters your code within 7 days. You receive 500 coins once per friend.</p><div class="reward-code"><label for="invite-code">YOUR INVITE CODE</label><div><input id="invite-code" readonly value="SIGN IN FIRST" aria-label="Your invite code"><button id="copy-invite" type="button">COPY</button></div></div><div class="reward-detail"><span id="referral-count">0 friends invited</span></div><button id="share-invite" class="rewards-primary" type="button">INVITE A FRIEND</button></article>
                </section>
                <details class="redeem-panel"><summary>Invited by a friend? Enter their code <span>＋</span></summary><form id="redeem-invite"><label for="friend-code">FRIEND’S INVITE CODE</label><div><input id="friend-code" name="code" minlength="6" maxlength="16" autocomplete="off" autocapitalize="characters" pattern="[A-Za-z0-9]{6,16}" placeholder="ENTER CODE" required><button class="rewards-secondary" type="submit" id="redeem-button">USE CODE</button></div><p id="redeem-note">One code per new account. Your friend receives the bonus.</p></form></details>
                <p id="rewards-status" role="status" aria-live="polite"></p>
              </div>`;
            document.body.append(this.root);
            this.el = id => this.root.querySelector('#' + id);
            this.el('rewards-home').onclick = onHome;
            this.el('rewards-refresh').onclick = () => this.load();
            this.el('claim-daily').onclick = () => this.claim();
            this.el('copy-invite').onclick = () => this.share(false);
            this.el('share-invite').onclick = () => this.share(true);
            this.el('redeem-invite').onsubmit = e => { e.preventDefault(); this.redeem(); };
            const ref = new URLSearchParams(location.search).get('ref');
            if (ref && /^[A-Za-z0-9]{6,16}$/.test(ref)) {
                this.el('friend-code').value = ref.toUpperCase();
                this.root.querySelector('details').open = true;
            }
            document.addEventListener('minepool:account-changed', () => { this.data = null; if (!this.root.classList.contains('hidden')) this.load(); });
            document.addEventListener('visibilitychange', () => { if (!document.hidden && !this.root.classList.contains('hidden')) this.load(); });
            this.render();
        }
        message(text, error = false) { this.el('rewards-status').textContent = text; this.el('rewards-status').classList.toggle('error', error); }
        render() {
            const signed = this.platform.isAuthenticated();
            const data = this.data;
            this.el('rewards-coins').textContent = this.platform.getPlayer().coins.toLocaleString();
            this.el('rewards-account-note').textContent = signed ? 'Rewards are saved to your account. An internet connection is required.' : 'Sign in or create an account to claim rewards and invite friends.';
            const claim = this.el('claim-daily');
            claim.textContent = !signed ? 'SIGN IN TO CLAIM' : this.busy ? 'PLEASE WAIT…' : data?.daily.claimed ? '✓ COLLECTED TODAY' : 'CLAIM 100 COINS';
            claim.disabled = this.busy || (signed && (!data || data.daily.claimed));
            this.el('daily-badge').textContent = data?.daily.claimed ? 'COLLECTED' : 'EVERY DAY';
            this.el('rewards-streak').textContent = data ? `${data.daily.streak} day${data.daily.streak === 1 ? '' : 's'} check-in streak` : 'Your next reward is waiting.';
            this.el('daily-reset').textContent = data ? `Next reset: ${new Date(data.daily.nextReset).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} local time` : 'Resets daily at 00:00 UTC';
            this.el('invite-code').value = data?.referral.code || (signed ? 'LOADING…' : 'SIGN IN FIRST');
            this.el('referral-count').textContent = `${data?.referral.count || 0} friends invited · ${(data?.referral.count || 0) * 500} coins earned`;
            this.el('copy-invite').disabled = this.busy || !data;
            this.el('share-invite').disabled = this.busy || (signed && !data);
            this.el('redeem-button').disabled = this.busy || (signed && (!data || !data.referral.canRedeem));
            this.el('friend-code').disabled = signed && data && !data.referral.canRedeem;
            this.el('redeem-note').textContent = data?.referral.redeemed ? 'An invite code has already been used on this account.' : signed && data && !data.referral.canRedeem ? 'Invite codes are available during your first 7 days.' : 'One code per new account. Your friend receives the bonus.';
        }
        async load() {
            if (this.busy) return;
            if (!this.platform.isAuthenticated()) { this.data = null; this.render(); return; }
            this.busy = true; this.render();
            try {
                this.data = await this.platform.rewards(); this.message('');
                clearTimeout(this.resetTimer);
                this.resetTimer = setTimeout(() => { if (!this.root.classList.contains('hidden')) this.load(); }, Math.max(1000, this.data.daily.nextReset - this.data.serverTime + 500));
            } catch (error) { this.data = null; this.message(error.message, true); }
            finally { this.busy = false; this.render(); }
        }
        async claim() {
            if (!this.platform.isAuthenticated()) return this.onAccount();
            if (this.busy || !this.data || this.data.daily.claimed) return;
            this.busy = true; this.render();
            try { this.data = await this.platform.rewards('/daily'); this.message(this.data.awarded ? '+100 coins added to your account!' : 'Already collected today. Come back tomorrow.'); }
            catch (error) { this.message(error.message, true); }
            finally { this.busy = false; this.render(); }
        }
        async share(useShareSheet) {
            if (!this.platform.isAuthenticated()) return this.onAccount();
            if (!this.data) return;
            const code = this.data.referral.code;
            const url = `${window.MINEPOOL_SERVER_URL}/?ref=${encodeURIComponent(code)}`;
            try {
                if (useShareSheet && navigator.share) await navigator.share({title:'Join me in Mine Pool', text:`Let’s play pool! Create an account and enter my invite code: ${code}`, url});
                else { await navigator.clipboard.writeText(useShareSheet ? `Join me in Mine Pool: ${url}\nInvite code: ${code}` : code); this.message(useShareSheet ? 'Invite copied. Send it to your friend.' : 'Invite code copied.'); }
            } catch (error) { if (error.name !== 'AbortError') { this.el('invite-code').select(); this.message('Select and copy your invite code above.'); } }
        }
        async redeem() {
            if (!this.platform.isAuthenticated()) return this.onAccount();
            if (this.busy || !this.data?.referral.canRedeem) return;
            this.busy = true; this.render();
            try { this.data = await this.platform.rewards('/referral', {code:this.el('friend-code').value}); this.message('Invite accepted! Your friend received 500 coins.'); }
            catch (error) { this.message(error.message, true); }
            finally { this.busy = false; this.render(); }
        }
    }
    window.RewardsUI = RewardsUI;
})();
