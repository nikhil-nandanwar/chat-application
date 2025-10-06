// Global site JavaScript functionality

// Common utilities and functions used across the application

window.ChatApp = {
    // Utility functions
    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },

    // Format time for display
    formatTime: function(date) {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    },

    // Generate random color for user avatars (future enhancement)
    generateUserColor: function(username) {
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 60%)`;
    },

    // Show toast notification (if bootstrap toast is available)
    showToast: function(message, type = 'info') {
        // This could be expanded to create dynamic toasts
        console.log(`${type.toUpperCase()}: ${message}`);
    },

    // Validate username format
    isValidUsername: function(username) {
        return username && 
               username.length >= 2 && 
               username.length <= 20 && 
               /^[a-zA-Z0-9_\s]+$/.test(username);
    },

    // Validate room code format
    isValidRoomCode: function(roomCode) {
        return roomCode && 
               roomCode.length === 4 && 
               /^\d{4}$/.test(roomCode);
    }
};

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    // Could send to logging service in production
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    // Could send to logging service in production
    event.preventDefault();
});

// Prevent accidental page refresh in chat room
window.addEventListener('beforeunload', function(event) {
    if (window.location.pathname === '/Home/Chat') {
        const roomCode = sessionStorage.getItem('roomCode');
        if (roomCode) {
            event.preventDefault();
            event.returnValue = 'Are you sure you want to leave the chat room?';
            return event.returnValue;
        }
    }
});

// Initialize common functionality when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Add loading state to all buttons with data-loading attribute
    const loadingButtons = document.querySelectorAll('[data-loading]');
    loadingButtons.forEach(button => {
        button.addEventListener('click', function() {
            const originalText = this.innerHTML;
            const loadingText = this.getAttribute('data-loading') || 'Loading...';
            
            this.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${loadingText}`;
            this.disabled = true;
            
            // Re-enable after 10 seconds as fallback
            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 10000);
        });
    });

    // Auto-focus first input on page
    const firstInput = document.querySelector('input[type="text"]:not([disabled])');
    if (firstInput) {
        firstInput.focus();
    }

    // Add ripple effect to buttons (optional enhancement)
    const rippleButtons = document.querySelectorAll('.btn');
    rippleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);