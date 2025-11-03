// ================================================
// Enhanced Chat Page JavaScript with Better UX
// ================================================

document.addEventListener('DOMContentLoaded', function() {
    // Get room info from session storage
    const roomCode = sessionStorage.getItem('roomCode');
    const username = sessionStorage.getItem('username');
    const isCreator = sessionStorage.getItem('isCreator') === 'true';

    // Redirect if no room info
    if (!roomCode || !username) {
        showAlert('No room information found. Redirecting...', 'warning');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    // ================== DOM ELEMENTS ==================
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const timeRemaining = document.getElementById('timeRemaining');
    const timeProgressBar = document.getElementById('timeProgressBar');
    const participantCount = document.getElementById('participantCount');
    const maxParticipants = document.getElementById('maxParticipants');
    const participantsCountBadge = document.getElementById('participantsCountBadge');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    const participantsContainer = document.getElementById('participantsContainer');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionMessage = document.getElementById('connectionMessage');

    // ================== STATE VARIABLES ==================
    let countdownInterval = null;
    let isConnected = false;
    let isSending = false;
    let messageQueue = [];
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // ================== SIGNALR CONNECTION ==================
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub", {
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
        })
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                if (retryContext.elapsedMilliseconds < 60000) {
                    return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 10000);
                } else {
                    return null;
                }
            }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // ================== INITIALIZATION ==================
    init();

    async function init() {
        try {
            roomCodeDisplay.textContent = roomCode;
            showConnectionStatus("Connecting to chat...", "info");
            
            await startConnection();
            await joinRoom();
        } catch (err) {
            console.error("❌ Initialization error:", err);
            showConnectionStatus("Failed to connect. Retrying...", "danger");
            setTimeout(init, 3000);
        }
    }

    async function startConnection() {
        try {
            await connection.start();
            console.log("✅ SignalR Connected");
            isConnected = true;
            reconnectAttempts = 0;
            hideConnectionStatus();
        } catch (err) {
            console.error("❌ SignalR Connection Error:", err);
            reconnectAttempts++;
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                showConnectionStatus(`Connection failed. Retrying (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, "warning");
                throw err;
            } else {
                showConnectionStatus("Connection failed. Please refresh the page.", "danger");
                throw err;
            }
        }
    }

    async function joinRoom() {
        try {
            await connection.invoke("JoinRoom", roomCode, username);
            console.log(`✅ Joined room: ${roomCode} as ${username}`);
        } catch (err) {
            console.error("❌ Error joining room:", err);
            showNotification("Failed to join room", "error");
            setTimeout(() => window.location.href = '/', 3000);
        }
    }

    // ================== SIGNALR EVENT HANDLERS ==================

    connection.on("JoinRoomResult", function(result) {
        if (!result.success) {
            showAlert(result.message, 'danger');
            setTimeout(() => window.location.href = '/', 2000);
        }
    });

    connection.on("RoomInfo", function(roomInfo) {
        console.log("📊 Room Info:", roomInfo);
        
        participantCount.textContent = roomInfo.participantCount;
        maxParticipants.textContent = roomInfo.maxParticipants;
        updateParticipants(roomInfo.participants);
        
        if (roomInfo.expiresAt) {
            const expiresAt = new Date(roomInfo.expiresAt);
            const createdAt = roomInfo.createdAt ? new Date(roomInfo.createdAt) : null;
            startCountdown(createdAt, expiresAt);
            
            const expiresLabel = document.getElementById('expiresAtLabel');
            if (expiresLabel) {
                expiresLabel.textContent = `expires ${expiresAt.toLocaleString()}`;
            }
        }
        
        // Enable message input
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;
        messageInput.focus();
        messageInput.placeholder = "Type your message...";
    });

    connection.on("ReceiveMessage", function(message) {
        console.log("📨 Message received:", message);
        addMessageToChat(message);
        
        // Show notification for other users' messages (if page not focused)
        if (message.type === 0 && message.username !== username && document.hidden) {
            showBrowserNotification(`${message.username}: ${message.content}`);
        }
    });

    connection.on("ChatHistory", function(messages) {
        console.log(`📚 Loading ${messages.length} messages from history`);
        
        // Clear welcome message
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            showWelcomeMessage();
        } else {
            messages.forEach(message => {
                addMessageToChat(message, false);
            });
        }
        
        scrollToBottom();
    });

    connection.on("ParticipantUpdate", function(info) {
        console.log("👥 Participant update:", info);
        participantCount.textContent = info.participantCount;
        updateParticipants(info.participants);
    });

    connection.on("RoomExpired", function(expiredRoomCode) {
        console.warn("⚠️ Room expired:", expiredRoomCode);
        showAlert("This room has expired and will close.", "warning");
        disableChat();
        setTimeout(() => window.location.href = '/', 3000);
    });

    connection.on("MessageError", function(errorMessage) {
        console.error("❌ Message error:", errorMessage);
        showNotification(errorMessage, "error");
        isSending = false;
        sendMessageBtn.disabled = false;
    });

    // ================== UI EVENT HANDLERS ==================

    sendMessageBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Show typing indicator (optional future enhancement)
    let typingTimeout;
    messageInput.addEventListener('input', function() {
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            // Future: Send typing stopped signal
        }, 1000);
    });

    leaveRoomBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to leave this chat room?')) {
            try {
                leaveRoomBtn.disabled = true;
                leaveRoomBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Leaving...';
                
                await connection.invoke("LeaveRoom");
                
                // Clear session storage
                sessionStorage.removeItem('roomCode');
                sessionStorage.removeItem('username');
                sessionStorage.removeItem('isCreator');
                
                showAlert('Leaving room...', 'info');
                setTimeout(() => window.location.href = '/', 500);
            } catch (err) {
                console.error("❌ Error leaving room:", err);
                // Force redirect anyway
                window.location.href = '/';
            }
        }
    });

    // ================== MESSAGE HANDLING ==================

    async function sendMessage() {
        const content = messageInput.value.trim();
        
        if (!content) {
            messageInput.focus();
            return;
        }

        if (!isConnected) {
            showNotification("Not connected to server. Reconnecting...", "warning");
            return;
        }

        if (isSending) {
            return;
        }

        if (content.length > 1000) {
            showNotification("Message is too long (max 1000 characters)", "warning");
            return;
        }

        try {
            isSending = true;
            sendMessageBtn.disabled = true;
            sendMessageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            // Optimistic UI update (show message immediately)
            const optimisticMessage = {
                id: `temp-${Date.now()}`,
                username: username,
                content: content,
                timestamp: new Date().toISOString(),
                type: 0
            };
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            
            // Send to server
            await connection.invoke("SendMessage", content);
            
            console.log("✅ Message sent successfully");
        } catch (err) {
            console.error("❌ Error sending message:", err);
            showNotification("Failed to send message. Please try again.", "error");
            messageInput.value = content; // Restore message
        } finally {
            isSending = false;
            sendMessageBtn.disabled = false;
            sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            messageInput.focus();
        }
    }

    function addMessageToChat(message, shouldScroll = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.dataset.messageId = message.id;
        
        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        switch (message.type) {
            case 0: // User message
                messageDiv.classList.add(message.username === username ? 'user-message' : 'other-message');
                messageDiv.innerHTML = `
                    <div class="message-header">
                        <strong>${escapeHtml(message.username)}</strong>
                        <span class="message-time">${timeString}</span>
                    </div>
                    <div class="message-content">${formatMessageContent(message.content)}</div>
                `;
                break;
            
            case 1: // System message
                messageDiv.classList.add('system-message');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-info-circle me-2"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 2: // User joined
                messageDiv.classList.add('system-message', 'join');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-user-plus me-2"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 3: // User left
                messageDiv.classList.add('system-message', 'leave');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-user-minus me-2"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 4: // Room expiring
                messageDiv.classList.add('system-message', 'warning');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 5: // Room expired
                messageDiv.classList.add('system-message', 'error');
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-times-circle me-2"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
        }
        
        chatMessages.appendChild(messageDiv);
        
        if (shouldScroll) {
            scrollToBottom(true);
        }
    }

    function showWelcomeMessage() {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h3>Welcome to Room ${roomCode}!</h3>
                <p>Start chatting and connect with others...</p>
                ${isCreator ? '<p class="text-muted mt-2"><small>💡 Share the room code with others to invite them</small></p>' : ''}
            </div>
        `;
    }

    function updateParticipants(participants) {
        participantsContainer.innerHTML = '';
        
        if (participantsCountBadge) {
            participantsCountBadge.textContent = participants.length;
        }
        
        // Sort participants: current user first, then alphabetically
        const sortedParticipants = [...participants].sort((a, b) => {
            if (a === username) return -1;
            if (b === username) return 1;
            return a.localeCompare(b);
        });
        
        sortedParticipants.forEach(participant => {
            const participantDiv = document.createElement('div');
            participantDiv.className = 'participant-item';
            const isCurrentUser = participant === username;
            participantDiv.innerHTML = `
                <i class="fas fa-user-circle"></i>
                <span>${escapeHtml(participant)}</span>
                ${isCurrentUser ? '<span class="badge bg-primary ms-auto">You</span>' : ''}
            `;
            participantsContainer.appendChild(participantDiv);
        });
    }

    // ================== COUNTDOWN TIMER ==================

    function startCountdown(createdAt, expiresAt) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        const startTime = createdAt ? createdAt.getTime() : Date.now();
        const endTime = expiresAt.getTime();
        const totalDuration = endTime - startTime;

        function updateTimer() {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                timeRemaining.textContent = "00:00:00";
                if (timeProgressBar) {
                    timeProgressBar.style.width = '0%';
                    timeProgressBar.className = 'progress-bar bg-danger';
                }
                clearInterval(countdownInterval);
                return;
            }

            // Format time
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            timeRemaining.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update progress bar
            if (timeProgressBar) {
                const percentage = (remaining / totalDuration) * 100;
                timeProgressBar.style.width = `${percentage}%`;
                
                // Change color based on time remaining
                timeProgressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
                if (percentage > 50) {
                    timeProgressBar.classList.add('bg-success');
                } else if (percentage > 20) {
                    timeProgressBar.classList.add('bg-warning');
                } else {
                    timeProgressBar.classList.add('bg-danger');
                }
            }

            // Warn when time is running out
            if (remaining <= 5 * 60 * 1000 && remaining > 4.9 * 60 * 1000) {
                showNotification("⚠️ Room will expire in 5 minutes!", "warning");
            }
        }

        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    }

    // ================== UTILITY FUNCTIONS ==================

    function scrollToBottom(smooth = false) {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }

    function showConnectionStatus(message, type) {
        connectionMessage.textContent = message;
        connectionStatus.className = `connection-banner alert alert-${type}`;
        connectionStatus.classList.remove('d-none');
    }

    function hideConnectionStatus() {
        connectionStatus.classList.add('d-none');
    }

    function showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastBody = document.getElementById('notificationBody');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }

    function showAlert(message, type) {
        showNotification(message, type);
    }

    function showBrowserNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Message', {
                body: message,
                icon: '/favicon.ico'
            });
        }
    }

    function disableChat() {
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
        messageInput.placeholder = "Chat room has closed";
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    function formatMessageContent(content) {
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        content = escapeHtml(content);
        content = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Convert newlines to <br>
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }

    // ================== CONNECTION STATE HANDLERS ==================

    connection.onreconnecting((error) => {
        console.warn("🔄 Reconnecting...", error);
        isConnected = false;
        showConnectionStatus("Connection lost. Reconnecting...", "warning");
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
    });

    connection.onreconnected(async (connectionId) => {
        console.log("✅ Reconnected with ID:", connectionId);
        isConnected = true;
        hideConnectionStatus();
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;
        showNotification("Reconnected successfully!", "success");
        
        // Rejoin the room
        try {
            await joinRoom();
        } catch (err) {
            console.error("❌ Error rejoining room:", err);
        }
    });

    connection.onclose((error) => {
        console.error("❌ Connection closed", error);
        isConnected = false;
        showConnectionStatus("Connection lost. Please refresh the page.", "danger");
        disableChat();
    });

    // ================== PAGE VISIBILITY HANDLER ==================

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Page became visible - check connection
            if (connection.state === signalR.HubConnectionState.Disconnected) {
                init();
            }
        }
    });

    // ================== CLEANUP ==================

    window.addEventListener('beforeunload', function(e) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        // Don't show confirmation if intentionally leaving
        if (!leaveRoomBtn.disabled) {
            // Optional: Add confirmation dialog
            // e.preventDefault();
            // e.returnValue = '';
        }
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
