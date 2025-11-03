using RealTimeChatApp.Models;
using System.Collections.Concurrent;

namespace RealTimeChatApp.Services
{
    public interface IMemoryStorageService
    {
        Task<ChatRoom?> GetRoomAsync(string roomCode);
        Task<bool> AddRoomAsync(ChatRoom room);
        Task<bool> RemoveRoomAsync(string roomCode);
        Task<List<ChatRoom>> GetAllRoomsAsync();
        Task<List<ChatRoom>> GetExpiredRoomsAsync();
        Task<bool> AddUserToRoomAsync(string roomCode, User user);
        Task<bool> RemoveUserFromRoomAsync(string roomCode, string connectionId);
        Task<User?> GetUserAsync(string connectionId);
        Task<bool> AddMessageToRoomAsync(string roomCode, Message message);
        Task<List<Message>> GetRoomMessagesAsync(string roomCode);
    }

    public class MemoryStorageService : IMemoryStorageService
    {
        private readonly ConcurrentDictionary<string, ChatRoom> _rooms = new();
        private readonly ConcurrentDictionary<string, User> _connectedUsers = new();

        public Task<ChatRoom?> GetRoomAsync(string roomCode)
        {
            _rooms.TryGetValue(roomCode, out var room);
            return Task.FromResult(room);
        }

        public Task<bool> AddRoomAsync(ChatRoom room)
        {
            return Task.FromResult(_rooms.TryAdd(room.RoomCode, room));
        }

        public Task<bool> RemoveRoomAsync(string roomCode)
        {
            var removed = _rooms.TryRemove(roomCode, out var room);
            
            // Also remove all users from this room
            if (removed && room != null)
            {
                foreach (var participant in room.Participants.Values)
                {
                    _connectedUsers.TryRemove(participant.ConnectionId, out _);
                }
            }

            return Task.FromResult(removed);
        }

        public Task<List<ChatRoom>> GetAllRoomsAsync()
        {
            return Task.FromResult(_rooms.Values.ToList());
        }

        public Task<List<ChatRoom>> GetExpiredRoomsAsync()
        {
            var expiredRooms = _rooms.Values
                .Where(room => room.IsExpired)
                .ToList();
            
            return Task.FromResult(expiredRooms);
        }

        public async Task<bool> AddUserToRoomAsync(string roomCode, User user)
        {
            var room = await GetRoomAsync(roomCode);
            if (room == null || room.IsExpired || room.IsFull)
            {
                return false;
            }

            var added = room.Participants.TryAdd(user.ConnectionId, user);
            if (added)
            {
                _connectedUsers.TryAdd(user.ConnectionId, user);
            }

            return added;
        }

        public async Task<bool> RemoveUserFromRoomAsync(string roomCode, string connectionId)
        {
            var room = await GetRoomAsync(roomCode);
            if (room == null)
            {
                return false;
            }

            var removed = room.Participants.TryRemove(connectionId, out _);
            _connectedUsers.TryRemove(connectionId, out _);

            return removed;
        }

        public Task<User?> GetUserAsync(string connectionId)
        {
            _connectedUsers.TryGetValue(connectionId, out var user);
            return Task.FromResult(user);
        }

        public async Task<bool> AddMessageToRoomAsync(string roomCode, Message message)
        {
            var room = await GetRoomAsync(roomCode);
            if (room == null || room.IsExpired)
            {
                return false;
            }

            room.AddMessage(message);
            return true;
        }

        public async Task<List<Message>> GetRoomMessagesAsync(string roomCode)
        {
            var room = await GetRoomAsync(roomCode);
            if (room == null)
            {
                return new List<Message>();
            }

            return room.GetMessages()
                .OrderBy(m => m.Timestamp)
                .ToList();
        }
    }
}