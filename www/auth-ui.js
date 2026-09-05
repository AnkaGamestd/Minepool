(function () {
    'use strict';

    class AccountUI {
        constructor(platform) {
            this.platform = platform;
            this.modal = document.getElementById('account-modal');
            this.status = document.getElementById('account-status');
            const googleMark = this.modal.querySelector('.account-google-mark');
            googleMark.textContent = '';
            googleMark.setAttribute('aria-hidden', 'true');
            this.bind();
            this.render();
        }

        bind() {
            document.getElementById('account-open').addEventListener('click', () => this.open());
            document.getElementById('account-close').addEventListener('click', () => this.close());
            document.getElementById('account-google').addEventListener('click', () => this.submit(() => this.platform.signInWithGoogle()));
            document.getElementById('account-logout').addEventListener('click', () => this.submit(() => this.platform.logout(), true));
            document.getElementById('account-delete-open').addEventListener('click', () => this.toggleDelete(true));
            document.getElementById('account-delete-cancel').addEventListener('click', () => this.toggleDelete(false));
            document.getElementById('account-delete-form').addEventListener('submit', (event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                this.submit(
                    () => this.platform.deleteAccount({ password: fields.get('password'), confirmation: fields.get('confirmation') }),
                    true,
                    'ACCOUNT DELETED'
                );
            });
            document.getElementById('account-login-form').addEventListener('submit', (event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                this.submit(() => this.platform.login({ email: fields.get('email'), password: fields.get('password') }), true);
            });
            document.getElementById('account-register-form').addEventListener('submit', (event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                this.submit(() => this.platform.register({ username: fields.get('username'), email: fields.get('email'), password: fields.get('password') }), true);
            });
            document.querySelectorAll('[data-account-tab]').forEach((button) => button.addEventListener('click', () => this.selectTab(button.dataset.accountTab)));
            this.modal.addEventListener('click', (event) => { if (event.target === this.modal) this.close(); });
            document.addEventListener('minepool:account-changed', () => this.render());
        }

        open() { this.render(); this.toggleDelete(false); this.modal.hidden = false; document.getElementById('account-close').focus(); }
        close() { this.modal.hidden = true; this.toggleDelete(false); }
        toggleDelete(visible) {
            document.getElementById('account-delete-confirm').hidden = !visible;
            document.getElementById('account-signed-actions').hidden = visible || !this.platform.isAuthenticated();
            this.status.textContent = '';
            if (visible) document.querySelector('#account-delete-form input[name="confirmation"]').focus();
        }
        selectTab(tab) {
            document.querySelectorAll('[data-account-tab]').forEach((button) => button.classList.toggle('active', button.dataset.accountTab === tab));
            document.querySelectorAll('[data-account-panel]').forEach((panel) => panel.hidden = panel.dataset.accountPanel !== tab);
            this.status.textContent = '';
        }
        async submit(action, closeOnSuccess = false, successMessage = 'ACCOUNT CONNECTED') {
            const buttons = [...this.modal.querySelectorAll('button')];
            buttons.forEach((button) => button.disabled = true);
            this.status.textContent = 'CONNECTING…';
            this.status.classList.remove('error');
            try {
                await action();
                this.status.textContent = successMessage;
                this.render();
                if (closeOnSuccess) window.setTimeout(() => this.close(), 450);
            } catch (error) {
                this.status.textContent = error.message || 'SIGN-IN FAILED';
                this.status.classList.add('error');
            } finally {
                buttons.forEach((button) => button.disabled = false);
            }
        }
        render() {
            const identity = this.platform.getIdentity();
            const authenticated = this.platform.isAuthenticated();
            document.getElementById('account-current-name').textContent = identity.displayName;
            document.querySelector('.account-current .avatar').textContent = identity.avatarText;
            document.getElementById('account-current-provider').textContent = authenticated ? (identity.provider.includes('google') ? 'GOOGLE ACCOUNT' : 'EMAIL ACCOUNT') : 'GUEST • SAVED ON THIS DEVICE';
            document.getElementById('account-forms').hidden = authenticated;
            document.getElementById('account-signed-actions').hidden = !authenticated;
            document.getElementById('account-delete-confirm').hidden = true;
            document.getElementById('account-delete-password').hidden = identity.provider.includes('google');
            document.getElementById('profile-account-state').textContent = authenticated ? `SIGNED IN • ${identity.email || identity.provider}` : 'GUEST PLAYER';
        }
    }

    window.AccountUI = AccountUI;
})();
