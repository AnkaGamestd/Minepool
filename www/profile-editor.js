(() => {
    'use strict';
    const originalContent = new WeakMap();

    function renderAvatar(element, { avatarUrl, avatarText, displayName } = {}) {
        if (!element) return;
        if (avatarUrl) {
            try { avatarUrl = new URL(String(avatarUrl), String(window.MINEPOOL_SERVER_URL || location.origin)).href; }
            catch (error) { avatarUrl = null; }
        }
        if (!originalContent.has(element)) originalContent.set(element, element.innerHTML);
        element.classList.toggle('has-photo', Boolean(avatarUrl));
        element.setAttribute('aria-label', displayName || 'Player');
        if (avatarUrl) {
            const image = document.createElement('img');
            image.className = 'profile-photo';
            image.src = avatarUrl;
            image.alt = '';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => {
                element.classList.remove('has-photo');
                if (element.classList.contains('menu-avatar')) element.innerHTML = originalContent.get(element);
                else element.textContent = avatarText || 'P';
            }, { once: true });
            element.replaceChildren(image);
        } else if (element.classList.contains('menu-avatar')) {
            element.innerHTML = originalContent.get(element);
        } else {
            element.textContent = avatarText || 'P';
        }
    }

    async function resizePhoto(file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
        if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#0a1715'; context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
        if (!blob) throw new Error('This image could not be prepared.');
        return new File([blob], 'profile.jpg', { type: 'image/jpeg' });
    }

    class ProfileEditor {
        constructor(platform, { onAccount }) {
            this.platform = platform;
            this.onAccount = onAccount;
            this.busy = false;
            this.modal = document.createElement('div');
            this.modal.className = 'modal';
            this.modal.id = 'profile-editor-modal';
            this.modal.hidden = true;
            this.modal.innerHTML = `<section class="profile-editor-card" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
              <header class="modal-head"><div><div class="eyeline">PLAYER IDENTITY</div><h2 id="profile-editor-title">EDIT PROFILE</h2></div><button class="icon-button" id="profile-editor-close" type="button" aria-label="Close profile editor">×</button></header>
              <div class="profile-editor-layout">
                <section class="profile-photo-editor" aria-label="Profile photo">
                  <div class="profile-photo-preview avatar" id="profile-photo-preview">P</div>
                  <div><strong>PROFILE PHOTO</strong><p>Shown on your player card and during matches.</p></div>
                  <input id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
                  <div class="profile-photo-actions"><button id="profile-photo-select" class="account-primary" type="button">CHOOSE PHOTO</button><button id="profile-photo-remove" class="profile-editor-secondary" type="button">REMOVE PHOTO</button></div>
                  <small>Images are resized for fast loading. Removing your upload restores the connected account photo when available.</small>
                </section>
                <form class="profile-nick-form" id="profile-nick-form">
                  <label for="profile-nick">PLAYER NICK</label>
                  <input id="profile-nick" name="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_-]+" autocomplete="nickname" required>
                  <div class="profile-nick-meta"><span>3–20 letters, numbers, _ or -</span><span id="profile-nick-count">0 / 20</span></div>
                  <button class="account-primary" type="submit">SAVE NICK</button>
                </form>
              </div>
              <p class="account-status" id="profile-editor-status" role="status" aria-live="polite"></p>
            </section>`;
            document.body.append(this.modal);
            this.el = id => this.modal.querySelector('#' + id);
            this.el('profile-editor-close').onclick = () => this.close();
            this.el('profile-photo-select').onclick = () => this.el('profile-photo-input').click();
            this.el('profile-photo-remove').onclick = () => this.removePhoto();
            this.el('profile-photo-input').onchange = event => this.uploadPhoto(event.target.files?.[0]);
            this.el('profile-nick').oninput = () => this.updateCount();
            this.el('profile-nick-form').onsubmit = event => { event.preventDefault(); this.saveNick(); };
            this.modal.onclick = event => { if (event.target === this.modal) this.close(); };
            document.addEventListener('keydown', event => { if (event.key === 'Escape' && !this.modal.hidden) this.close(); });
            document.addEventListener('minepool:player-updated', () => { if (!this.modal.hidden) this.render(); });
        }
        open() {
            if (!this.platform.isAuthenticated()) return this.onAccount();
            this.message(''); this.render(); this.modal.hidden = false; this.el('profile-nick').focus();
        }
        close() { if (!this.busy) this.modal.hidden = true; }
        message(text, error = false) { const status = this.el('profile-editor-status'); status.textContent = text; status.classList.toggle('error', error); }
        updateCount() { this.el('profile-nick-count').textContent = `${this.el('profile-nick').value.length} / 20`; }
        render() {
            const player = this.platform.getPlayer();
            const identity = this.platform.getIdentity();
            if (document.activeElement !== this.el('profile-nick')) this.el('profile-nick').value = identity.displayName;
            this.updateCount();
            renderAvatar(this.el('profile-photo-preview'), { ...identity, avatarUrl: player.avatarUrl });
            this.el('profile-photo-remove').disabled = this.busy || !player.avatarUrl;
            this.modal.querySelectorAll('button,input').forEach(element => { if (element.id !== 'profile-photo-remove') element.disabled = this.busy; });
        }
        async run(action, success) {
            if (this.busy) return;
            this.busy = true; this.message('SAVING…'); this.render();
            try { await action(); this.message(success); }
            catch (error) { this.message(error.message || 'Profile could not be updated.', true); }
            finally { this.busy = false; this.render(); }
        }
        saveNick() {
            const username = this.el('profile-nick').value.trim();
            if (!this.el('profile-nick-form').reportValidity()) return;
            this.run(() => this.platform.updateProfile({ username }), 'NICK UPDATED');
        }
        async uploadPhoto(file) {
            if (!file) return;
            await this.run(async () => this.platform.uploadAvatar(await resizePhoto(file)), 'PROFILE PHOTO UPDATED');
            this.el('profile-photo-input').value = '';
        }
        removePhoto() { this.run(() => this.platform.removeAvatar(), 'PROFILE PHOTO REMOVED'); }
    }

    window.MinePoolAvatar = Object.freeze({ render: renderAvatar });
    window.ProfileEditor = ProfileEditor;
})();
