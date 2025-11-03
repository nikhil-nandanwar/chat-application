using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;

namespace RealTimeChatApp.Models
{
    public class ChatRoom
    {
        [Required]
        [StringLength(4, MinimumLength = 4)]
        public string RoomCode { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        [Required]
        public string CreatorConnectionId { get; set; } = string.Empty;

        [Range(1, 100)]
        public int MaxParticipants { get; set; } = 20;

        public ConcurrentDictionary<string, User> Participants { get; set; } = new();
        
        // Use List with lock instead of ConcurrentBag for better ordering
        private readonly object _messagesLock = new();
        private readonly List<Message> _messages = new();

        public List<Message> GetMessages()
        {
            lock (_messagesLock)
            {
                return new List<Message>(_messages);
            }
        }

        public void AddMessage(Message message)
        {
            lock (_messagesLock)
            {
                _messages.Add(message);
                
                // Keep only last 500 messages to prevent memory issues
                if (_messages.Count > 500)
                {
                    _messages.RemoveAt(0);
                }
            }
        }

        public int MessageCount
        {
            get
            {
                lock (_messagesLock)
                {
                    return _messages.Count;
                }
            }
        }

        public bool IsExpired => DateTime.UtcNow > ExpiresAt;
        public bool IsFull => Participants.Count >= MaxParticipants;
        public bool IsActive => !IsExpired && Participants.Count > 0;

        public ChatRoom()
        {
            CreatedAt = DateTime.UtcNow;
            ExpiresAt = CreatedAt.AddHours(1); // 1 hour expiration
        }

        public TimeSpan TimeRemaining => ExpiresAt > DateTime.UtcNow ? ExpiresAt - DateTime.UtcNow : TimeSpan.Zero;
    }
}