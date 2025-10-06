using Microsoft.AspNetCore.SignalR;
using RealTimeChatApp.Models;
using RealTimeChatApp.Services;

namespace RealTimeChatApp.Hubs
{
    public class ChatHub : Hub
    {
        private readonly IChatRoomService _chatRoomService;
        private readonly IMemoryStorageService _storageService;
        private readonly ILogger<ChatHub> _logger;

        public ChatHub(
            IChatRoomService chatRoomService,
            IMemoryStorageService storageService,
            ILogger<ChatHub> logger)
        {
            _chatRoomService = chatRoomService;
            _storageService = storageService;
            _logger = logger;
        }

        public async Task JoinRoom(string roomCode, string username)
        {
            try
            {
                var result = await _chatRoomService.JoinRoomAsync(roomCode, username, Context.ConnectionId);
                
                if (result.Success)
                {
                    // Add connection to SignalR group
                    await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);
                    
                    // Send success response to the user
                    await Clients.Caller.SendAsync("JoinRoomResult", result);
                    
                    // Notify other users in the room
                    var joinMessage = new Message
                    {
                        Content = $"{username} joined the chat",
                        Type = MessageType.UserJoined,
                        Username = "System"
                    };
                    
                    await _storageService.AddMessageToRoomAsync(roomCode, joinMessage);
                    await Clients.Group(roomCode).SendAsync("ReceiveMessage", joinMessage);
                    
                    // Send room information and chat history to the new user
                    var room = await _storageService.GetRoomAsync(roomCode);
                    if (room != null)
                    {
                        await Clients.Caller.SendAsync("RoomInfo", new
                        {
                            RoomCode = roomCode,
                            ParticipantCount = room.Participants.Count,
                            MaxParticipants = room.MaxParticipants,
                            TimeRemaining = room.TimeRemaining,
                            Participants = room.Participants.Values.Select(u => u.Username).ToList()
                        });

                        // Send chat history
                        var messages = await _storageService.GetRoomMessagesAsync(roomCode);
                        await Clients.Caller.SendAsync("ChatHistory", messages);
                    }
                    
                    _logger.LogInformation($"User {username} joined room {roomCode}");
                }
                else
                {
                    await Clients.Caller.SendAsync("JoinRoomResult", result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error joining room {roomCode} for user {username}");
                await Clients.Caller.SendAsync("JoinRoomResult", new RoomResponse
                {
                    Success = false,
                    Message = "An error occurred while joining the room"
                });
            }
        }

        public async Task CreateRoom(string username)
        {
            try
            {
                var result = await _chatRoomService.CreateRoomAsync(username, Context.ConnectionId);
                
                if (result.Success)
                {
                    // Add connection to SignalR group
                    await Groups.AddToGroupAsync(Context.ConnectionId, result.RoomCode!);
                    
                    // Send success response with room code
                    await Clients.Caller.SendAsync("CreateRoomResult", result);
                    
                    // Send room information
                    var room = result.Room;
                    if (room != null)
                    {
                        await Clients.Caller.SendAsync("RoomInfo", new
                        {
                            RoomCode = result.RoomCode,
                            ParticipantCount = room.Participants.Count,
                            MaxParticipants = room.MaxParticipants,
                            TimeRemaining = room.TimeRemaining,
                            Participants = room.Participants.Values.Select(u => u.Username).ToList()
                        });
                    }
                    
                    _logger.LogInformation($"User {username} created room {result.RoomCode}");
                }
                else
                {
                    await Clients.Caller.SendAsync("CreateRoomResult", result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating room for user {username}");
                await Clients.Caller.SendAsync("CreateRoomResult", new RoomResponse
                {
                    Success = false,
                    Message = "An error occurred while creating the room"
                });
            }
        }

        public async Task SendMessage(string content)
        {
            try
            {
                var result = await _chatRoomService.SendMessageAsync(Context.ConnectionId, content);
                
                if (result.Success)
                {
                    var user = await _storageService.GetUserAsync(Context.ConnectionId);
                    if (user != null)
                    {
                        var room = await _storageService.GetRoomAsync(user.RoomCode);
                        if (room != null)
                        {
                            // Get the latest message (should be the one we just added)
                            var messages = await _storageService.GetRoomMessagesAsync(user.RoomCode);
                            var latestMessage = messages.LastOrDefault();
                            
                            if (latestMessage != null)
                            {
                                // Send message to all users in the room
                                await Clients.Group(user.RoomCode).SendAsync("ReceiveMessage", latestMessage);
                            }
                        }
                    }
                }
                else
                {
                    await Clients.Caller.SendAsync("MessageError", result.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error sending message from connection {Context.ConnectionId}");
                await Clients.Caller.SendAsync("MessageError", "An error occurred while sending the message");
            }
        }

        public async Task LeaveRoom()
        {
            try
            {
                var user = await _storageService.GetUserAsync(Context.ConnectionId);
                if (user != null)
                {
                    var roomCode = user.RoomCode;
                    var username = user.Username;
                    
                    // Remove from SignalR group
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomCode);
                    
                    // Remove user from room
                    await _chatRoomService.LeaveRoomAsync(Context.ConnectionId);
                    
                    // Notify other users
                    var leaveMessage = new Message
                    {
                        Content = $"{username} left the chat",
                        Type = MessageType.UserLeft,
                        Username = "System"
                    };
                    
                    await _storageService.AddMessageToRoomAsync(roomCode, leaveMessage);
                    await Clients.Group(roomCode).SendAsync("ReceiveMessage", leaveMessage);
                    
                    // Update participant count for remaining users
                    var room = await _storageService.GetRoomAsync(roomCode);
                    if (room != null)
                    {
                        await Clients.Group(roomCode).SendAsync("ParticipantUpdate", new
                        {
                            ParticipantCount = room.Participants.Count,
                            Participants = room.Participants.Values.Select(u => u.Username).ToList()
                        });
                    }
                    
                    _logger.LogInformation($"User {username} left room {roomCode}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error when user left room for connection {Context.ConnectionId}");
            }
        }

        public async Task GetRoomInfo()
        {
            try
            {
                var user = await _storageService.GetUserAsync(Context.ConnectionId);
                if (user != null)
                {
                    var room = await _storageService.GetRoomAsync(user.RoomCode);
                    if (room != null)
                    {
                        await Clients.Caller.SendAsync("RoomInfo", new
                        {
                            RoomCode = user.RoomCode,
                            ParticipantCount = room.Participants.Count,
                            MaxParticipants = room.MaxParticipants,
                            TimeRemaining = room.TimeRemaining,
                            Participants = room.Participants.Values.Select(u => u.Username).ToList()
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting room info for connection {Context.ConnectionId}");
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                await LeaveRoom();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error handling disconnection for {Context.ConnectionId}");
            }
            
            await base.OnDisconnectedAsync(exception);
        }
    }
}