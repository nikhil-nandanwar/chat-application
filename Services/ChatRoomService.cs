using RealTimeChatApp.Models;

namespace RealTimeChatApp.Services
{
    public interface IChatRoomService
    {
        Task<RoomResponse> CreateRoomAsync(string username, string connectionId, int expirationMinutes = 60);
        Task<RoomResponse> JoinRoomAsync(string roomCode, string username, string connectionId);
        Task<bool> LeaveRoomAsync(string connectionId);
        Task<MessageResponse> SendMessageAsync(string connectionId, string content);
        Task<ChatRoom?> GetUserRoomAsync(string connectionId);
        Task<bool> IsValidRoomCodeAsync(string roomCode);
        string GenerateRoomCode();
        Task<bool> CanJoinRoomAsync(string roomCode);
    }

    public class ChatRoomService : IChatRoomService
    {
        private readonly IMemoryStorageService _storageService;
        private readonly Random _random = new();
        private readonly ILogger<ChatRoomService> _logger;

        public ChatRoomService(IMemoryStorageService storageService, ILogger<ChatRoomService> logger)
        {
            _storageService = storageService;
            _logger = logger;
        }

        public async Task<RoomResponse> CreateRoomAsync(string username, string connectionId, int expirationMinutes = 60)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(username))
                {
                    return new RoomResponse 
                    { 
                        Success = false, 
                        Message = "Username is required" 
                    };
                }

                if (expirationMinutes < 1 || expirationMinutes > 1440) // Max 24 hours
                {
                    return new RoomResponse 
                    { 
                        Success = false, 
                        Message = "Expiration time must be between 1 and 1440 minutes" 
                    };
                }

                // Check if user is already in a room
                var existingUser = await _storageService.GetUserAsync(connectionId);
                if (existingUser != null)
                {
                    return new RoomResponse 
                    { 
                        Success = false, 
                        Message = "You are already in a chat room" 
                    };
                }

                string roomCode;
                bool roomCreated = false;
                int attempts = 0;
                const int maxAttempts = 10;

                // Try to generate a unique room code
                do
                {
                    roomCode = GenerateRoomCode();
                    var existingRoom = await _storageService.GetRoomAsync(roomCode);
                    
                    if (existingRoom == null)
                    {
                        // Create new room
                        var room = new ChatRoom
                        {
                            RoomCode = roomCode,
                            CreatorConnectionId = connectionId,
                            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes)
                        };

                        // Create user
                        var user = new User
                        {
                            ConnectionId = connectionId,
                            Username = username,
                            RoomCode = roomCode
                        };

                        roomCreated = await _storageService.AddRoomAsync(room);
                        if (roomCreated)
                        {
                            await _storageService.AddUserToRoomAsync(roomCode, user);
                        }
                    }

                    attempts++;
                } while (!roomCreated && attempts < maxAttempts);

                if (!roomCreated)
                {
                    return new RoomResponse 
                    { 
                        Success = false, 
                        Message = "Failed to create room. Please try again." 
                    };
                }

                var createdRoom = await _storageService.GetRoomAsync(roomCode);
                return new RoomResponse 
                { 
                    Success = true, 
                    Message = "Room created successfully", 
                    RoomCode = roomCode,
                    Room = createdRoom
                };
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Exception in CreateRoomAsync");
                return new RoomResponse
                {
                    Success = false,
                    Message = "An internal error occurred while creating the room"
                };
            }
        }

        public async Task<RoomResponse> JoinRoomAsync(string roomCode, string username, string connectionId)
        {
            if (string.IsNullOrWhiteSpace(roomCode) || string.IsNullOrWhiteSpace(username))
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Room code and username are required" 
                };
            }

            // Check if user is already in a room
            var existingUser = await _storageService.GetUserAsync(connectionId);
            if (existingUser != null)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "You are already in a chat room" 
                };
            }

            var room = await _storageService.GetRoomAsync(roomCode);
            if (room == null)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Room not found" 
                };
            }

            if (room.IsExpired)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Room has expired" 
                };
            }

            if (room.IsFull)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Room is full" 
                };
            }

            // Check if username is already taken in this room
            var isUsernameTaken = room.Participants.Values
                .Any(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));

            if (isUsernameTaken)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Username is already taken in this room" 
                };
            }

            var user = new User
            {
                ConnectionId = connectionId,
                Username = username,
                RoomCode = roomCode
            };

            var joined = await _storageService.AddUserToRoomAsync(roomCode, user);
            if (!joined)
            {
                return new RoomResponse 
                { 
                    Success = false, 
                    Message = "Failed to join room" 
                };
            }

            return new RoomResponse 
            { 
                Success = true, 
                Message = "Joined room successfully", 
                RoomCode = roomCode,
                Room = room
            };
        }

        public async Task<bool> LeaveRoomAsync(string connectionId)
        {
            var user = await _storageService.GetUserAsync(connectionId);
            if (user == null)
            {
                return false;
            }

            return await _storageService.RemoveUserFromRoomAsync(user.RoomCode, connectionId);
        }

        public async Task<MessageResponse> SendMessageAsync(string connectionId, string content)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                return new MessageResponse 
                { 
                    Success = false, 
                    Message = "Message content cannot be empty" 
                };
            }

            if (content.Length > 1000)
            {
                return new MessageResponse 
                { 
                    Success = false, 
                    Message = "Message is too long (maximum 1000 characters)" 
                };
            }

            var user = await _storageService.GetUserAsync(connectionId);
            if (user == null)
            {
                return new MessageResponse 
                { 
                    Success = false, 
                    Message = "You are not in a chat room" 
                };
            }

            var room = await _storageService.GetRoomAsync(user.RoomCode);
            if (room == null || room.IsExpired)
            {
                return new MessageResponse 
                { 
                    Success = false, 
                    Message = "Room no longer exists or has expired" 
                };
            }

            // Basic content filtering
            var filteredContent = FilterMessage(content);

            var message = new Message
            {
                Username = user.Username,
                Content = filteredContent,
                Type = MessageType.User
            };

            var added = await _storageService.AddMessageToRoomAsync(user.RoomCode, message);
            if (!added)
            {
                return new MessageResponse 
                { 
                    Success = false, 
                    Message = "Failed to send message" 
                };
            }

            return new MessageResponse 
            { 
                Success = true, 
                Message = "Message sent successfully" 
            };
        }

        public async Task<ChatRoom?> GetUserRoomAsync(string connectionId)
        {
            var user = await _storageService.GetUserAsync(connectionId);
            if (user == null)
            {
                return null;
            }

            return await _storageService.GetRoomAsync(user.RoomCode);
        }

        public async Task<bool> IsValidRoomCodeAsync(string roomCode)
        {
            if (string.IsNullOrWhiteSpace(roomCode) || roomCode.Length != 4)
            {
                return false;
            }

            var room = await _storageService.GetRoomAsync(roomCode);
            return room != null && !room.IsExpired;
        }

        public async Task<bool> CanJoinRoomAsync(string roomCode)
        {
            var room = await _storageService.GetRoomAsync(roomCode);
            return room != null && !room.IsExpired && !room.IsFull;
        }

        public string GenerateRoomCode()
        {
            return _random.Next(1000, 9999).ToString();
        }

        private string FilterMessage(string content)
        {
            // Basic content filtering - remove excessive whitespace
            content = content.Trim();
            
            // Replace multiple consecutive spaces with single space
            content = System.Text.RegularExpressions.Regex.Replace(content, @"\s+", " ");
            
            // Remove or replace potentially problematic characters
            content = content.Replace("<script", "&lt;script");
            content = content.Replace("</script", "&lt;/script");
            
            return content;
        }
    }
}