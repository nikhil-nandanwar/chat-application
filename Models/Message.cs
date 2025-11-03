using System.ComponentModel.DataAnnotations;

namespace RealTimeChatApp.Models
{
    public class Message
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [StringLength(1000)]
        public string Content { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public MessageType Type { get; set; } = MessageType.User;
    }

    public enum MessageType
    {
        User = 0,
        System = 1,
        UserJoined = 2,
        UserLeft = 3,
        RoomExpiring = 4,
        RoomExpired = 5
    }
}