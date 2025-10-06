using Microsoft.AspNetCore.Mvc;
using RealTimeChatApp.Models;
using RealTimeChatApp.Services;

namespace RealTimeChatApp.Controllers
{
    public class HomeController : Controller
    {
        private readonly IChatRoomService _chatRoomService;
        private readonly ILogger<HomeController> _logger;

        public HomeController(IChatRoomService chatRoomService, ILogger<HomeController> logger)
        {
            _chatRoomService = chatRoomService;
            _logger = logger;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Chat()
        {
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> ValidateRoomCode([FromBody] string roomCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomCode))
                {
                    return Json(new { success = false, message = "Room code is required" });
                }

                var isValid = await _chatRoomService.IsValidRoomCodeAsync(roomCode);
                var canJoin = await _chatRoomService.CanJoinRoomAsync(roomCode);

                if (!isValid)
                {
                    return Json(new { success = false, message = "Invalid or expired room code" });
                }

                if (!canJoin)
                {
                    return Json(new { success = false, message = "Room is full or no longer available" });
                }

                return Json(new { success = true, message = "Room code is valid" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error validating room code: {roomCode}");
                return Json(new { success = false, message = "An error occurred while validating the room code" });
            }
        }

        public IActionResult Error()
        {
            return View();
        }
    }
}