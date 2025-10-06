using RealTimeChatApp.Hubs;
using RealTimeChatApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSignalR();
builder.Services.AddControllersWithViews();

// Register custom services
builder.Services.AddSingleton<IMemoryStorageService, MemoryStorageService>();
builder.Services.AddSingleton<IChatRoomService, ChatRoomService>();
builder.Services.AddHostedService<RoomExpirationService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Map SignalR hub
app.MapHub<ChatHub>("/chatHub");

app.Run();
