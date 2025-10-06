using System.Collections.Concurrent;

namespace RealTimeChatApp.Models
{
    public class ChatRoom
    {
        public string RoomCode { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public string CreatorConnectionId { get; set; } = string.Empty;
        public int MaxParticipants { get; set; } = 20;
        public ConcurrentDictionary<string, User> Participants { get; set; } = new();
        public ConcurrentBag<Message> Messages { get; set; } = new();
        public bool IsExpired => DateTime.UtcNow > ExpiresAt;
        public bool IsFull => Participants.Count >= MaxParticipants;

        public ChatRoom()
        {
            CreatedAt = DateTime.UtcNow;
            ExpiresAt = CreatedAt.AddHours(1); // 1 hour expiration
        }

        public TimeSpan TimeRemaining => ExpiresAt > DateTime.UtcNow ? ExpiresAt - DateTime.UtcNow : TimeSpan.Zero;
    }
}