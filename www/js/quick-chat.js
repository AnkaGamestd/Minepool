/**
 * Quick Chat System - Mine Pool
 * Handles speech button dropdowns and text messaging
 */

document.addEventListener('DOMContentLoaded', () => {
    const p1SpeechBtn = document.getElementById('p1-speech-btn');
    const p2SpeechBtn = document.getElementById('p2-speech-btn');
    const dropdown = document.getElementById('quick-chat-dropdown');
    const chatInputContainer = document.getElementById('chat-input-container');
    const chatInput = document.getElementById('quick-chat-input');
    const chatSendBtn = document.getElementById('quick-chat-send');
    const quickOptions = document.querySelectorAll('.quick-chat-option');

    let isOpen = false;

    function openChat() {
        if (dropdown) dropdown.classList.remove('hidden');
        if (chatInputContainer) chatInputContainer.classList.remove('hidden');
        isOpen = true;

        // Focus the input after a short delay
        setTimeout(() => {
            if (chatInput) chatInput.focus();
        }, 150);
    }

    function closeChat() {
        if (dropdown) dropdown.classList.add('hidden');
        if (chatInputContainer) chatInputContainer.classList.add('hidden');
        isOpen = false;

        // Clear input when closing
        if (chatInput) chatInput.value = '';
    }

    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function sendMessage(msg) {
        if (!msg || msg.trim() === '') return;

        const trimmedMsg = msg.trim();

        // Send via network if available (for online multiplayer)
        if (window.networkManager) {
            window.networkManager.sendMessage(trimmedMsg);
        }

        // Show in local speech bubble
        if (window.addChatMessage) {
            window.addChatMessage(window.currentUser?.username || 'You', trimmedMsg, true);
        }

        console.log('💬 Message sent:', trimmedMsg);
    }

    // Player 1 speech button click
    if (p1SpeechBtn) {
        p1SpeechBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChat();
        });
    }

    // Player 2 speech button click
    if (p2SpeechBtn) {
        p2SpeechBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChat();
        });
    }

    // Close when clicking outside chat elements
    document.addEventListener('click', (e) => {
        if (!isOpen) return;

        const clickedDropdown = dropdown && dropdown.contains(e.target);
        const clickedInput = chatInputContainer && chatInputContainer.contains(e.target);
        const clickedP1Btn = p1SpeechBtn && p1SpeechBtn.contains(e.target);
        const clickedP2Btn = p2SpeechBtn && p2SpeechBtn.contains(e.target);

        if (!clickedDropdown && !clickedInput && !clickedP1Btn && !clickedP2Btn) {
            closeChat();
        }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeChat();
        }
    });

    // Quick chat preset buttons
    quickOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msg = btn.dataset.msg;
            sendMessage(msg);
            closeChat();
        });
    });

    // Send button click
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chatInput && chatInput.value.trim()) {
                sendMessage(chatInput.value);
                chatInput.value = '';
                closeChat();
            }
        });
    }

    // Enter key to send
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                if (chatInput.value.trim()) {
                    sendMessage(chatInput.value);
                    chatInput.value = '';
                    closeChat();
                }
            }
        });

        // Prevent closing when interacting with input
        chatInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Expose functions globally
    window.openQuickChat = openChat;
    window.closeQuickChat = closeChat;
    window.toggleQuickChat = toggleChat;
});
