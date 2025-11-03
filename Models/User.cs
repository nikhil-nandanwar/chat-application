using System.ComponentModel.DataAnnotations;

namespace RealTimeChatApp.Models
{
    public class User
    {
        [Required]
        public string ConnectionId { get; set; } = string.Empty;

        [Required]
        [StringLength(50, MinimumLength = 2)]
        [RegularExpression(@"^[a-zA-Z0-9_\s]+$", ErrorMessage = "Username can only contain letters, numbers, underscores, and spaces")]
        public string Username { get; set; } = string.Empty;

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [StringLength(4, MinimumLength = 4)]
        public string RoomCode { get; set; } = string.Empty;

        public bool IsOnline { get; set; } = true;
        public DateTime? LastSeenAt { get; set; }
    }
}