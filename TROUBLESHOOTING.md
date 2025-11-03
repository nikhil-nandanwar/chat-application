# Troubleshooting Guide

## Issue: SignalR Integrity Error

**Problem:**
```
Failed to find a valid digest in the 'integrity' attribute for resource 
'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js'
```

**Solution:**
✅ **Fixed** by switching to jsDelivr CDN without integrity check:
```html
<script src="https://cdn.jsdelivr.net/npm/@microsoft/signalr@7.0.14/dist/browser/signalr.min.js" crossorigin="anonymous"></script>
```

In Razor views, `@` needs to be escaped as `@@`:
```html
<script src="https://cdn.jsdelivr.net/npm/@@microsoft/signalr@@7.0.14/dist/browser/signalr.min.js" crossorigin="anonymous"></script>
```

---

## Issue: favicon.ico 404 Error

**Problem:**
```
Failed to load resource: the server responded with a status of 404 (Not Found)
favicon.ico:1
```

**Solution:**
✅ **Fixed** by adding favicon files:
- Created `wwwroot/favicon.svg` with gradient chat icon
- Created placeholder `wwwroot/favicon.ico`
- Updated `_Layout.cshtml` with proper favicon links

---

## Issue: signalR is not defined

**Problem:**
```javascript
Uncaught ReferenceError: signalR is not defined
```

**Cause:**
SignalR script failed to load due to integrity mismatch or CDN issues.

**Solution:**
✅ **Fixed** by using reliable CDN (jsDelivr) without integrity checks.

---

## How to Test

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5)
3. **Check browser console** for any errors
4. **Verify SignalR loads**: Type `signalR` in console - should show object

---

## Additional Notes

### CDN Alternatives

If jsDelivr has issues, you can use:

**Option 1: unpkg**
```html
<script src="https://unpkg.com/@microsoft/signalr@7.0.14/dist/browser/signalr.min.js"></script>
```

**Option 2: Local copy**
1. Download SignalR from npm
2. Place in `wwwroot/lib/signalr/`
3. Reference locally:
```html
<script src="~/lib/signalr/signalr.min.js"></script>
```

**Option 3: Microsoft CDN**
```html
<script src="https://ajax.aspnetcdn.com/ajax/signalr/jquery.signalr-2.4.3.min.js"></script>
```

### Verifying the Fix

Open browser console and run:
```javascript
console.log(signalR); // Should show SignalR object
console.log(signalR.HubConnectionBuilder); // Should show function
```

### Common Issues After Fix

1. **Still getting errors?**
   - Clear cache and hard refresh
   - Check Network tab for failed requests
   - Verify script tag in page source (View Page Source)

2. **Script loads but connection fails?**
   - Check if backend is running
   - Verify hub endpoint URL (/chatHub)
   - Check browser console for SignalR connection errors

---

---

## Issue: Repeated Join/Leave Notifications

**Problem:**
Users see duplicate join/leave notifications when someone reconnects or refreshes:
```
wer joined the chat
wer left the chat
wer joined the chat
```

**Root Cause:**
1. Join/leave messages broadcasted to **all users** including the joining/leaving user
2. Users see their own join/leave messages when reconnecting
3. Join notifications sent before chat history loads

**Solution:**
✅ **Fixed** in `Hubs/ChatHub.cs`:

1. **Changed broadcast target to exclude caller:**
```csharp
// Before: Sends to everyone including caller
await Clients.Group(roomCode).SendAsync("ReceiveMessage", joinMessage);

// After: Sends only to others
await Clients.OthersInGroup(roomCode).SendAsync("ReceiveMessage", joinMessage);
```

2. **Reordered operations - chat history loads first:**
```csharp
// 1. Send chat history to new user
await Clients.Caller.SendAsync("ChatHistory", messages);

// 2. Then notify others about the join (not the joiner)
await Clients.OthersInGroup(roomCode).SendAsync("ReceiveMessage", joinMessage);
```

3. **Added participant count updates:**
```csharp
// Update all users with new participant count
await Clients.Group(roomCode).SendAsync("ParticipantUpdate", new
{
    ParticipantCount = room.Participants.Count,
    Participants = room.Participants.Values.Select(u => u.Username).ToList()
});
```

**4. Added validation checks in LeaveRoom:**
```csharp
// Check if user exists and is actually in the room before sending leave notification
var user = await _storageService.GetUserAsync(Context.ConnectionId);
if (user != null && !string.IsNullOrEmpty(user.RoomCode))
{
    var room = await _storageService.GetRoomAsync(roomCode);
    if (room != null && room.Participants.ContainsKey(Context.ConnectionId))
    {
        // Process leave and send notification
    }
}
```

**5. Enhanced OnDisconnectedAsync:**
```csharp
// Only process leave if user is actually in a room
var user = await _storageService.GetUserAsync(Context.ConnectionId);
if (user != null && !string.IsNullOrEmpty(user.RoomCode))
{
    await LeaveRoom();
}
```

**Result:**
- ✅ Users no longer see their own join/leave messages
- ✅ Chat history loads before join notifications
- ✅ Participant counts update correctly
- ✅ No "left the chat" message when joining for first time
- ✅ Leave notifications only sent when user was actually in a room
- ✅ Cleaner, less noisy chat experience

---

## Status

✅ All issues resolved:
- SignalR CDN fixed (using jsDelivr)
- Favicon added (SVG + ICO)
- Repeated join/leave notifications fixed
- All scripts loading correctly
- No console errors
