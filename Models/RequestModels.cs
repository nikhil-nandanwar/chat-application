namespace RealTimeChatApp.Models
{
    public class CreateRoomRequest
    {
        public string Username { get; set; } = string.Empty;
    }

    public class JoinRoomRequest
    {
        public string RoomCode { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
    }

    public class SendMessageRequest
    {
        public string RoomCode { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class RoomResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? RoomCode { get; set; }
        public ChatRoom? Room { get; set; }
    }

    public class MessageResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}