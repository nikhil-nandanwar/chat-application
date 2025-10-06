namespace RealTimeChatApp.Models
{
    public class Message
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Username { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public MessageType Type { get; set; } = MessageType.User;
    }

    public enum MessageType
    {
        User,
        System,
        UserJoined,
        UserLeft,
        RoomExpiring,
        RoomExpired
    }
}