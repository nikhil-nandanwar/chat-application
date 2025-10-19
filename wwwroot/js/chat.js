// Chat page JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Get room info from session storage
    const roomCode = sessionStorage.getItem('roomCode');
    const username = sessionStorage.getItem('username');

    if (!roomCode || !username) {
        alert('No room information found. Redirecting to home page.');
        window.location.href = '/';
        return;
    }

    // DOM elements
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const timeRemaining = document.getElementById('timeRemaining');
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
    const notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
    const notificationBody = document.getElementById('notificationBody');

    // State variables
    let countdownInterval;
    let isConnected = false;

    // SignalR connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Initialize
    init();

    async function init() {
        try {
            roomCodeDisplay.textContent = roomCode;
            showConnectionStatus("Connecting...", "warning");
            
            await startConnection();
            await joinRoom();
        } catch (err) {
            console.error("Initialization error:", err);
            showConnectionStatus("Failed to connect", "danger");
        }
    }

    async function startConnection() {
        try {
            await connection.start();
            console.log("SignalR Connected");
            isConnected = true;
            hideConnectionStatus();
        } catch (err) {
            console.error("SignalR Connection Error:", err);
            showConnectionStatus("Connection failed", "danger");
            setTimeout(startConnection, 5000);
        }
    }

    async function joinRoom() {
        try {
            await connection.invoke("JoinRoom", roomCode, username);
        } catch (err) {
            console.error("Error joining room:", err);
            showNotification("Failed to join room", "error");
        }
    }

    // SignalR event handlers
    connection.on("JoinRoomResult", function(result) {
        if (!result.success) {
            alert(result.message);
            window.location.href = '/';
        }
    });

    connection.on("RoomInfo", function(roomInfo) {
        participantCount.textContent = roomInfo.participantCount;
        maxParticipants.textContent = roomInfo.maxParticipants;
        updateParticipants(roomInfo.participants);
        
        if (roomInfo.expiresAt) {
            // Parse server UTC ISO timestamp
            const expires = new Date(roomInfo.expiresAt);
            const created = roomInfo.createdAt ? new Date(roomInfo.createdAt) : null;
            startCountdownFromDates(created, expires);
            // Set expires label
            document.getElementById('expiresAtLabel').textContent = `expires ${expires.toLocaleString()}`;
        }
        
        // Enable message input
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;
        messageInput.focus();
    });

    connection.on("ReceiveMessage", function(message) {
        addMessageToChat(message);
    });

    connection.on("ChatHistory", function(messages) {
        // Clear initial welcome message
        chatMessages.innerHTML = '';
        
        messages.forEach(message => {
            addMessageToChat(message, false); // Don't scroll for history
        });
        
        // Scroll to bottom after loading history
        scrollToBottom();
    });

    connection.on("ParticipantUpdate", function(info) {
        participantCount.textContent = info.participantCount;
        updateParticipants(info.participants);
    });

    connection.on("RoomExpired", function(roomCode) {
        showNotification("Room has expired", "error");
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    });

    connection.on("MessageError", function(errorMessage) {
        showNotification(errorMessage, "error");
    });

    // UI event handlers
    sendMessageBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    leaveRoomBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to leave the room?')) {
            try {
                await connection.invoke("LeaveRoom");
                sessionStorage.removeItem('roomCode');
                sessionStorage.removeItem('username');
                window.location.href = '/';
            } catch (err) {
                console.error("Error leaving room:", err);
                window.location.href = '/';
            }
        }
    });

    // Message handling
    async function sendMessage() {
        const content = messageInput.value.trim();
        
        if (!content) {
            return;
        }

        if (!isConnected) {
            showNotification("Not connected to server", "error");
            return;
        }

        try {
            sendMessageBtn.disabled = true;
            await connection.invoke("SendMessage", content);
            messageInput.value = '';
            messageInput.focus();
        } catch (err) {
            console.error("Error sending message:", err);
            showNotification("Failed to send message", "error");
        } finally {
            sendMessageBtn.disabled = false;
        }
    }

    function addMessageToChat(message, shouldScroll = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const now = new Date(message.timestamp);
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        switch (message.type) {
            case 0: // User message
                messageDiv.className += message.username === username ? ' user-message' : ' other-message';
                messageDiv.innerHTML = `
                    <div class="message-header">
                        <strong>${escapeHtml(message.username)}</strong>
                        <span class="message-time">${timeString}</span>
                    </div>
                    <div class="message-content">${escapeHtml(message.content)}</div>
                `;
                break;
            
            case 1: // System message
                messageDiv.className += ' system-message';
                messageDiv.innerHTML = `
                    <div class="message-content">${escapeHtml(message.content)}</div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 2: // User joined
                messageDiv.className += ' system-message join';
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-user-plus me-1"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 3: // User left
                messageDiv.className += ' system-message leave';
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-user-minus me-1"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 4: // Room expiring
                messageDiv.className += ' system-message warning';
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
                
            case 5: // Room expired
                messageDiv.className += ' system-message error';
                messageDiv.innerHTML = `
                    <div class="message-content">
                        <i class="fas fa-times-circle me-1"></i>
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${timeString}</div>
                `;
                break;
        }
        
        chatMessages.appendChild(messageDiv);
        
        if (shouldScroll) {
            scrollToBottom();
        }
    }

    function updateParticipants(participants) {
        participantsContainer.innerHTML = '';
        
        if (participantsCountBadge) {
            participantsCountBadge.textContent = participants.length;
        }
        
        participants.forEach(participant => {
            const participantDiv = document.createElement('div');
            participantDiv.className = 'participant-item';
            participantDiv.innerHTML = `
                <i class="fas fa-user"></i>
                <span>${escapeHtml(participant)}</span>
                ${participant === username ? '<small class="text-muted ms-1">(You)</small>' : ''}
            `;
            participantsContainer.appendChild(participantDiv);
        });
    }

    function startCountdownFromDates(createdAt, expiresAt) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        const start = createdAt ? createdAt.getTime() : (new Date()).getTime();
        const end = expiresAt.getTime();
        const total = Math.max(end - start, 1000);

        function update() {
            const now = new Date().getTime();
            const distance = end - now;

            if (distance <= 0) {
                timeRemaining.textContent = "00:00:00";
                document.getElementById('timeProgressBar').style.width = '0%';
                document.getElementById('timeProgressBar').classList.remove('bg-light');
                document.getElementById('timeProgressBar').classList.add('bg-danger');
                clearInterval(countdownInterval);
                return;
            }

            const hours = Math.floor(distance / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timeRemaining.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            const elapsed = now - start;
            const pct = Math.max(0, Math.min(100, (distance <= 0 ? 0 : (distance / total) * 100)));
            const progressPct = Math.round(pct);
            const bar = document.getElementById('timeProgressBar');
            if (bar) {
                bar.style.width = `${progressPct}%`;
                // Color transitions: green (>50%), yellow (20-50), red (<20)
                bar.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-light');
                if (progressPct > 50) bar.classList.add('bg-success');
                else if (progressPct > 20) bar.classList.add('bg-warning');
                else bar.classList.add('bg-danger');
            }
        }

        update();
        countdownInterval = setInterval(update, 1000);
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showConnectionStatus(message, type) {
        connectionMessage.textContent = message;
        connectionStatus.className = `connection-status alert alert-${type} mb-0`;
        connectionStatus.classList.remove('d-none');
    }

    function hideConnectionStatus() {
        connectionStatus.classList.add('d-none');
    }

    function showNotification(message, type) {
        notificationBody.textContent = message;
        notificationToast.show();
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Connection state handling
    connection.onreconnecting(() => {
        isConnected = false;
        showConnectionStatus("Reconnecting...", "warning");
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
    });

    connection.onreconnected(async () => {
        isConnected = true;
        hideConnectionStatus();
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;
        showNotification("Reconnected successfully!", "success");
        
        // Rejoin the room
        try {
            await joinRoom();
        } catch (err) {
            console.error("Error rejoining room:", err);
        }
    });

    connection.onclose(() => {
        isConnected = false;
        showConnectionStatus("Connection lost. Please refresh the page.", "danger");
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
    });
});