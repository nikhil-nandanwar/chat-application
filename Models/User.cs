namespace RealTimeChatApp.Models
{
    public class User
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public string RoomCode { get; set; } = string.Empty;
    }
}