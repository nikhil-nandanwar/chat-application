// ================================================
// Enhanced Home Page JavaScript with Better UX
// ================================================

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const createUsernameInput = document.getElementById('createUsername');
    const joinUsernameInput = document.getElementById('joinUsername');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const expirationMinutes = document.getElementById('expirationMinutes');
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    const loadingText = document.getElementById('loadingText');

    // State
    let isCreatingRoom = false;
    let isJoiningRoom = false;
    let connectionAttempts = 0;
    const MAX_CONNECTION_ATTEMPTS = 3;

    // SignalR connection with enhanced configuration
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub", {
            skipNegotiation: false,
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
        })
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                if (retryContext.elapsedMilliseconds < 60000) {
                    return Math.random() * 10000;
                } else {
                    return null;
                }
            }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // Start SignalR connection
    startConnection();

    async function startConnection() {
        try {
            showConnectionStatus('Connecting...', 'info');
            await connection.start();
            console.log("✅ SignalR Connected");
            hideConnectionStatus();
            connectionAttempts = 0;
            enableInputs();
        } catch (err) {
            console.error("❌ SignalR Connection Error:", err);
            connectionAttempts++;
            
            if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
                showConnectionStatus(`Connection failed. Retrying... (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`, 'warning');
                setTimeout(startConnection, 5000);
            } else {
                showConnectionStatus('Unable to connect to server. Please refresh the page.', 'danger');
                disableInputs();
            }
        }
    }

    // ================== EVENT HANDLERS ==================

    // Create Room Button Click with debouncing
    createRoomBtn.addEventListener('click', debounce(async function() {
        if (isCreatingRoom) return;

        const username = createUsernameInput.value.trim();
        const expiration = parseInt(expirationMinutes.value);
        
        const validation = validateUsername(username);
        if (!validation.valid) {
            showAlert(validation.message, "warning");
            createUsernameInput.focus();
            return;
        }

        try {
            isCreatingRoom = true;
            loadingText.textContent = "Creating your chat room...";
            loadingModal.show();
            createRoomBtn.disabled = true;
            createRoomBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

            await connection.invoke("CreateRoom", username, expiration);
        } catch (err) {
            console.error("Error creating room:", err);
            showAlert("Failed to create room. Please try again.", "danger");
            resetCreateButton();
            loadingModal.hide();
        }
    }, 300));

    // Join Room Button Click with debouncing
    joinRoomBtn.addEventListener('click', debounce(async function() {
        if (isJoiningRoom) return;

        const username = joinUsernameInput.value.trim();
        const roomCode = roomCodeInput.value.trim();
        
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            showAlert(usernameValidation.message, "warning");
            joinUsernameInput.focus();
            return;
        }

        const roomCodeValidation = validateRoomCode(roomCode);
        if (!roomCodeValidation.valid) {
            showAlert(roomCodeValidation.message, "warning");
            roomCodeInput.focus();
            return;
        }

        try {
            isJoiningRoom = true;
            loadingText.textContent = "Validating room code...";
            loadingModal.show();
            joinRoomBtn.disabled = true;
            joinRoomBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Joining...';

            // First validate the room code via HTTP
            const response = await fetch('/Home/ValidateRoomCode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roomCode)
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            
            if (!result.success) {
                showAlert(result.message, "danger");
                resetJoinButton();
                loadingModal.hide();
                return;
            }

            loadingText.textContent = "Joining room...";
            await connection.invoke("JoinRoom", roomCode, username);
        } catch (err) {
            console.error("Error joining room:", err);
            showAlert("Failed to join room. Please try again.", "danger");
            resetJoinButton();
            loadingModal.hide();
        }
    }, 300));

    // ================== INPUT HANDLERS ==================

    // Room code input - format as typed
    roomCodeInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value.substring(0, 4);
        
        // Auto-validate when 4 digits entered
        if (value.length === 4) {
            roomCodeInput.classList.add('is-valid');
            roomCodeInput.classList.remove('is-invalid');
        } else if (value.length > 0) {
            roomCodeInput.classList.add('is-invalid');
            roomCodeInput.classList.remove('is-valid');
        } else {
            roomCodeInput.classList.remove('is-valid', 'is-invalid');
        }
    });

    // Username inputs - live validation
    [createUsernameInput, joinUsernameInput].forEach(input => {
        input.addEventListener('input', function(e) {
            const validation = validateUsername(e.target.value.trim());
            if (e.target.value.length > 0) {
                if (validation.valid) {
                    e.target.classList.add('is-valid');
                    e.target.classList.remove('is-invalid');
                } else {
                    e.target.classList.add('is-invalid');
                    e.target.classList.remove('is-valid');
                }
            } else {
                e.target.classList.remove('is-valid', 'is-invalid');
            }
        });
    });

    // Enter key handlers
    createUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            createRoomBtn.click();
        }
    });

    joinUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            roomCodeInput.focus();
        }
    });

    roomCodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            joinRoomBtn.click();
        }
    });

    // ================== SIGNALR EVENT HANDLERS ==================

    connection.on("CreateRoomResult", function(result) {
        loadingModal.hide();
        resetCreateButton();

        if (result.success) {
            // Store room info
            sessionStorage.setItem('roomCode', result.roomCode);
            sessionStorage.setItem('username', createUsernameInput.value.trim());
            sessionStorage.setItem('isCreator', 'true');
            
            // Show success message with fade effect
            showAlert(`✨ Room created! Code: ${result.roomCode}`, "success");
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = '/Home/Chat';
            }, 800);
        } else {
            showAlert(result.message || "Failed to create room", "danger");
        }
    });

    connection.on("JoinRoomResult", function(result) {
        loadingModal.hide();
        resetJoinButton();

        if (result.success) {
            // Store room info
            sessionStorage.setItem('roomCode', result.roomCode);
            sessionStorage.setItem('username', joinUsernameInput.value.trim());
            sessionStorage.setItem('isCreator', 'false');
            
            // Show success message
            showAlert('✨ Joining room...', "success");
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = '/Home/Chat';
            }, 800);
        } else {
            showAlert(result.message || "Failed to join room", "danger");
        }
    });

    // ================== VALIDATION FUNCTIONS ==================

    function validateUsername(username) {
        if (!username) {
            return { valid: false, message: "Please enter a username" };
        }
        if (username.length < 2) {
            return { valid: false, message: "Username must be at least 2 characters" };
        }
        if (username.length > 50) {
            return { valid: false, message: "Username must be 50 characters or less" };
        }
        if (!/^[a-zA-Z0-9_\s]+$/.test(username)) {
            return { valid: false, message: "Username can only contain letters, numbers, underscores, and spaces" };
        }
        return { valid: true };
    }

    function validateRoomCode(roomCode) {
        if (!roomCode) {
            return { valid: false, message: "Please enter a room code" };
        }
        if (roomCode.length !== 4) {
            return { valid: false, message: "Room code must be exactly 4 digits" };
        }
        if (!/^\d{4}$/.test(roomCode)) {
            return { valid: false, message: "Room code must contain only numbers" };
        }
        return { valid: true };
    }

    // ================== UTILITY FUNCTIONS ==================

    function showAlert(message, type) {
        // Remove existing alerts
        document.querySelectorAll('.alert-temporary').forEach(alert => {
            alert.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => alert.remove(), 300);
        });

        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-temporary`;
        alertDiv.style.animation = 'slideIn 0.3s ease-out';
        alertDiv.innerHTML = `
            <i class="fas fa-${getIconForType(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.hero-section .container');
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => alertDiv.remove(), 300);
            }
        }, 5000);
    }

    function getIconForType(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    function showConnectionStatus(message, type) {
        let statusDiv = document.querySelector('.connection-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.className = 'connection-status';
            document.body.appendChild(statusDiv);
        }
        statusDiv.className = `connection-status alert alert-${type} show`;
        statusDiv.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>${message}`;
    }

    function hideConnectionStatus() {
        const statusDiv = document.querySelector('.connection-status');
        if (statusDiv) {
            statusDiv.classList.remove('show');
            setTimeout(() => statusDiv.remove(), 300);
        }
    }

    function enableInputs() {
        createRoomBtn.disabled = false;
        joinRoomBtn.disabled = false;
        createUsernameInput.disabled = false;
        joinUsernameInput.disabled = false;
        roomCodeInput.disabled = false;
        expirationMinutes.disabled = false;
    }

    function disableInputs() {
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        createUsernameInput.disabled = true;
        joinUsernameInput.disabled = true;
        roomCodeInput.disabled = true;
        expirationMinutes.disabled = true;
    }

    function resetCreateButton() {
        isCreatingRoom = false;
        createRoomBtn.disabled = false;
        createRoomBtn.innerHTML = '<i class="fas fa-plus me-2"></i>Create Room';
    }

    function resetJoinButton() {
        isJoiningRoom = false;
        joinRoomBtn.disabled = false;
        joinRoomBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Join Room';
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ================== CONNECTION STATE HANDLERS ==================

    connection.onreconnecting((error) => {
        console.warn("🔄 Reconnecting...", error);
        showConnectionStatus("Connection lost. Reconnecting...", "warning");
        disableInputs();
    });

    connection.onreconnected((connectionId) => {
        console.log("✅ Reconnected with ID:", connectionId);
        showAlert("Reconnected successfully!", "success");
        hideConnectionStatus();
        enableInputs();
        connectionAttempts = 0;
    });

    connection.onclose((error) => {
        console.error("❌ Connection closed", error);
        showConnectionStatus("Connection lost. Please refresh the page.", "danger");
        disableInputs();
    });

    // ================== PAGE VISIBILITY HANDLER ==================

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log("Page hidden");
        } else {
            console.log("Page visible");
            if (connection.state === signalR.HubConnectionState.Disconnected) {
                startConnection();
            }
        }
    });
});

// CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }

    .connection-status {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        min-width: 300px;
        text-align: center;
        animation: slideIn 0.3s ease-out;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }

    .form-control.is-valid,
    .form-control.is-invalid {
        transition: all 0.2s ease;
    }

    .alert-temporary {
        margin-bottom: 1rem;
    }
`;
document.head.appendChild(style);
