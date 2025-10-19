// Home page JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const createUsernameInput = document.getElementById('createUsername');
    const joinUsernameInput = document.getElementById('joinUsername');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    const loadingText = document.getElementById('loadingText');

    // SignalR connection
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Start SignalR connection
    startConnection();

    async function startConnection() {
        try {
            await connection.start();
            console.log("SignalR Connected");
        } catch (err) {
            console.error("SignalR Connection Error:", err);
            setTimeout(startConnection, 5000);
        }
    }

    // Create Room Button Click
    createRoomBtn.addEventListener('click', async function() {
        const username = createUsernameInput.value.trim();
        const expirationMinutes = parseInt(document.getElementById('expirationMinutes').value);
        
        if (!validateUsername(username)) {
            return;
        }

        try {
            loadingText.textContent = "Creating room...";
            loadingModal.show();
            createRoomBtn.disabled = true;

            await connection.invoke("CreateRoom", username, expirationMinutes);
        } catch (err) {
            console.error("Error creating room:", err);
            showAlert("Error creating room. Please try again.", "danger");
            loadingModal.hide();
            createRoomBtn.disabled = false;
        }
    });

    // Join Room Button Click
    joinRoomBtn.addEventListener('click', async function() {
        const username = joinUsernameInput.value.trim();
        const roomCode = roomCodeInput.value.trim();
        
        if (!validateUsername(username) || !validateRoomCode(roomCode)) {
            return;
        }

        try {
            loadingText.textContent = "Validating room code...";
            loadingModal.show();
            joinRoomBtn.disabled = true;

            // First validate the room code
            const response = await fetch('/Home/ValidateRoomCode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roomCode)
            });

            const result = await response.json();
            
            if (!result.success) {
                showAlert(result.message, "danger");
                loadingModal.hide();
                joinRoomBtn.disabled = false;
                return;
            }

            loadingText.textContent = "Joining room...";
            await connection.invoke("JoinRoom", roomCode, username);
        } catch (err) {
            console.error("Error joining room:", err);
            showAlert("Error joining room. Please try again.", "danger");
            loadingModal.hide();
            joinRoomBtn.disabled = false;
        }
    });

    // Input validation and formatting
    roomCodeInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').substring(0, 4);
    });

    createUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createRoomBtn.click();
        }
    });

    joinUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            roomCodeInput.focus();
        }
    });

    roomCodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinRoomBtn.click();
        }
    });

    // SignalR event handlers
    connection.on("CreateRoomResult", function(result) {
        loadingModal.hide();
        createRoomBtn.disabled = false;

        if (result.success) {
            // Store room info and redirect to chat
            sessionStorage.setItem('roomCode', result.roomCode);
            sessionStorage.setItem('username', createUsernameInput.value.trim());
            window.location.href = '/Home/Chat';
        } else {
            showAlert(result.message, "danger");
        }
    });

    connection.on("JoinRoomResult", function(result) {
        loadingModal.hide();
        joinRoomBtn.disabled = false;

        if (result.success) {
            // Store room info and redirect to chat
            sessionStorage.setItem('roomCode', result.roomCode);
            sessionStorage.setItem('username', joinUsernameInput.value.trim());
            window.location.href = '/Home/Chat';
        } else {
            showAlert(result.message, "danger");
        }
    });

    // Helper functions
    function validateUsername(username) {
        if (!username) {
            showAlert("Please enter a username", "warning");
            return false;
        }
        if (username.length < 2) {
            showAlert("Username must be at least 2 characters long", "warning");
            return false;
        }
        if (username.length > 20) {
            showAlert("Username must be 20 characters or less", "warning");
            return false;
        }
        if (!/^[a-zA-Z0-9_\s]+$/.test(username)) {
            showAlert("Username can only contain letters, numbers, underscores, and spaces", "warning");
            return false;
        }
        return true;
    }

    function validateRoomCode(roomCode) {
        if (!roomCode) {
            showAlert("Please enter a room code", "warning");
            return false;
        }
        if (roomCode.length !== 4) {
            showAlert("Room code must be exactly 4 digits", "warning");
            return false;
        }
        if (!/^\d{4}$/.test(roomCode)) {
            showAlert("Room code must contain only numbers", "warning");
            return false;
        }
        return true;
    }

    function showAlert(message, type) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert-temporary');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-temporary`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at the top of the container
        const container = document.querySelector('.hero-section .container');
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Connection state handling
    connection.onreconnecting(() => {
        showAlert("Connection lost. Reconnecting...", "warning");
    });

    connection.onreconnected(() => {
        showAlert("Reconnected successfully!", "success");
    });

    connection.onclose(() => {
        showAlert("Connection lost. Please refresh the page.", "danger");
    });
});