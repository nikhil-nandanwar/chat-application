using Microsoft.AspNetCore.SignalR;
using RealTimeChatApp.Hubs;
using RealTimeChatApp.Models;

namespace RealTimeChatApp.Services
{
    public class RoomExpirationService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<RoomExpirationService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1); // Check every minute

        public RoomExpirationService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<RoomExpirationService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndCleanupExpiredRoomsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while checking for expired rooms");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task CheckAndCleanupExpiredRoomsAsync()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var storageService = scope.ServiceProvider.GetRequiredService<IMemoryStorageService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();

            var expiredRooms = await storageService.GetExpiredRoomsAsync();
            
            foreach (var room in expiredRooms)
            {
                _logger.LogInformation($"Cleaning up expired room: {room.RoomCode}");

                // Notify all participants that the room has expired
                var expiredMessage = new Message
                {
                    Content = "This chat room has expired and will be closed.",
                    Type = MessageType.RoomExpired,
                    Username = "System"
                };

                // Send message to all participants in the room
                await hubContext.Clients.Group(room.RoomCode).SendAsync("ReceiveMessage", expiredMessage);
                
                // Wait a moment for the message to be delivered
                await Task.Delay(1000);

                // Disconnect all participants
                foreach (var participant in room.Participants.Values)
                {
                    await hubContext.Clients.Client(participant.ConnectionId).SendAsync("RoomExpired", room.RoomCode);
                }

                // Remove the room from storage
                await storageService.RemoveRoomAsync(room.RoomCode);
                
                _logger.LogInformation($"Expired room {room.RoomCode} has been cleaned up");
            }
        }

        public async Task NotifyRoomExpiringAsync(string roomCode, TimeSpan timeRemaining)
        {
            if (timeRemaining.TotalMinutes <= 5) // Notify when 5 minutes or less remaining
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();

                var warningMessage = new Message
                {
                    Content = $"⚠️ This chat room will expire in {timeRemaining.Minutes} minutes and {timeRemaining.Seconds} seconds.",
                    Type = MessageType.RoomExpiring,
                    Username = "System"
                };

                await hubContext.Clients.Group(roomCode).SendAsync("ReceiveMessage", warningMessage);
            }
        }
    }
}