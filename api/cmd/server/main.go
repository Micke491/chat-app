package main

import (
	"log"
	"time"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/handlers"
	"chat-app/internal/middleware"
	"chat-app/internal/utils"
	"chat-app/internal/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	config.LoadConfig()
	db.ConnectMongo()
	db.ConnectRedis()

	ws.GlobalHub = ws.NewHub()
	go ws.GlobalHub.Run()

	utils.InitRedisPubSub() 

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000", "https://vokitoki.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type", "Accept", "Cache-Control", "X-Trusted-Device-Token", "X-Device-Name"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "time": time.Now()})
	})

	r.GET("/ws", ws.HandleWebSocket(ws.GlobalHub))

	auth := r.Group("/api/auth")
	{
		auth.POST("/register", middleware.RateLimiter(5, 5*time.Minute, "auth:register"), handlers.Register)
		auth.GET("/verify-email", handlers.VerifyEmail)
		auth.POST("/login", middleware.RateLimiter(10, 5*time.Minute, "auth:login"), handlers.Login)
		auth.POST("/password-reset-request", middleware.RateLimiter(1, time.Second, "auth:reset-request"), handlers.RequestPasswordReset)
		auth.POST("/reset-password", middleware.RateLimiter(5, 10*time.Minute, "auth:reset-execute"), handlers.ExecutePasswordReset)
		auth.POST("/2fa/verify-login", middleware.RateLimiter(10, 5*time.Minute, "auth:verify-login-2fa"), handlers.VerifyLogin2FA)
	}

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		api.POST("/users/device-token", handlers.UpdateDeviceToken)
		api.GET("/users/current_user", handlers.GetCurrentUser)
		api.PATCH("/users/current_user", handlers.UpdateCurrentUser)
		api.DELETE("/users/current_user", handlers.DeleteCurrentUser)

		api.GET("/me", handlers.GetCurrentUser)

		api.PATCH("/users/preferences", handlers.UpdatePreferences)

		api.GET("/chats/muted", handlers.GetMutedChats)
		api.POST("/chats/mute", handlers.MuteChat)
		api.POST("/chats/unmute", handlers.UnmuteChat)
		api.GET("/chats/pinned", handlers.GetPinnedChats)
		api.POST("/chats/pin", handlers.PinChat)
		api.POST("/chats/unpin", handlers.UnpinChat)

		api.GET("/users/sessions", handlers.GetActiveSessions)
		api.DELETE("/users/sessions/:id", handlers.RevokeSession)

		api.POST("/auth/2fa/request-enable", middleware.RateLimiter(1, time.Second, "2fa:request-enable"), handlers.RequestEnable2FA)
		api.POST("/auth/2fa/confirm-enable", handlers.ConfirmEnable2FA)
		api.POST("/auth/2fa/disable", handlers.Disable2FA)

		api.POST("/users/profile/upload", middleware.RateLimiter(5, 5*time.Minute, "profile:upload"), handlers.UploadProfilePicture)

		api.GET("/users/search", handlers.SearchUsers)
		api.GET("/users/suggested-contacts", handlers.GetSuggestedContacts)
		api.GET("/users/recommended", handlers.GetRecommendedUsers)



		api.GET("/users/block/check", handlers.CheckBlockStatus)

		api.POST("/users/block", handlers.BlockUser)
		api.DELETE("/users/block", handlers.UnblockUser)

		api.GET("/users/blocked", handlers.GetBlockedUsers)

		api.GET("/profile", handlers.GetMyProfile)
		api.PATCH("/profile", middleware.RateLimiter(10, 5*time.Minute, "profile:update"), handlers.UpdateMyProfile)
		api.DELETE("/profile", middleware.RateLimiter(10, 5*time.Minute, "profile:delete-story"), handlers.DeleteMyStory)
		api.GET("/profile/:userId", handlers.GetUserProfile)

		api.GET("/geolocation/search", handlers.SearchLocation)
		api.GET("/geolocation/reverse", handlers.ReverseGeocode)

		api.GET("/stories", handlers.GetAllStories)
		api.GET("/stories/:userId", handlers.GetUserStories)
		api.POST("/stories/:userId", handlers.MarkStoryViewed)

		api.POST("/reports", middleware.RateLimiter(5, 5*time.Minute, "reports:create"), handlers.CreateReport)

		api.GET("/announcements", handlers.GetAnnouncements)
		api.POST("/announcements/:id/read", handlers.DismissAnnouncement)

		api.GET("/url-metadata", middleware.RateLimiter(30, time.Minute, "url-metadata"), handlers.GetURLMetadata)

		api.GET("/chats/requests", handlers.GetChatRequests)
		api.POST("/chats/:id/accept", handlers.AcceptChatRequest)
		api.POST("/chats/:id/reject", handlers.RejectChatRequest)

		api.GET("/chats", handlers.GetChats)
		api.DELETE("/chats/:id", handlers.HideChat)

		api.GET("/chat/message", handlers.GetMessages)
		api.PATCH("/chat/message/messages/:messageId/status", handlers.UpdateMessageStatus)
		api.POST("/chat/message/messages/:messageId/status", handlers.UpdateMessageStatus) // Bulk
		api.DELETE("/chat/message/messages/:messageId/delete", handlers.DeleteMessage)

		api.GET("/chat/:chatId", handlers.GetChatById)
		api.DELETE("/chat/:chatId", handlers.LeaveChat)
		api.POST("/chat/:chatId/leave", handlers.LeaveChat)
		api.GET("/chat/:chatId/pinned", handlers.GetPinnedMessages)

		api.GET("/chat/media/list", handlers.ListMedia)

		api.GET("/sync", handlers.SyncData)

		api.PUT("/chat/draft", handlers.UpsertDraft)
		api.GET("/chat/draft", handlers.GetDraft)
		api.DELETE("/chat/draft", handlers.DeleteDraft)

		api.POST("/call/reject", handlers.RejectCall)
		api.POST("/call/end", handlers.EndCall)
		api.GET("/call/ice-servers", handlers.GetIceServers)

		bot := api.Group("/bot")
		{
			bot.GET("/chats", handlers.GetBotChats)
			bot.POST("/chats", middleware.RateLimiter(10, time.Minute, "bot:create"), handlers.CreateBotChat)
			bot.GET("/chats/:id", handlers.GetBotChat)
			bot.DELETE("/chats/:id", handlers.DeleteBotChat)
			bot.PATCH("/chats/:id", handlers.RenameBotChat)
			bot.PATCH("/chats/:id/pin", handlers.PinBotChat)
		}
	}

	// Everything that creates or broadcasts content. Banned and timed-out users
	// are turned away here so a moderator action takes effect on the live
	// session instead of waiting for the next login.
	restricted := api.Group("")
	restricted.Use(middleware.RequireActive())
	{
		restricted.POST("/stories", middleware.RateLimiter(10, 5*time.Minute, "stories:create"), handlers.CreateStory)

		restricted.POST("/chats", middleware.RateLimiter(5, 5*time.Minute, "chat:create"), handlers.CreateChat)
		restricted.POST("/chats/GroupChat", handlers.CreateGroupChat)
		restricted.POST("/chat/typing", middleware.RateLimiter(60, time.Minute, "chat:typing"), handlers.TypingIndicator)

		restricted.POST("/chat/message", middleware.RateLimiter(60, time.Minute, "message:send"), handlers.SendMessage)
		restricted.POST("/chat/message/messages/:messageId/reaction", handlers.ManageReaction)
		restricted.DELETE("/chat/message/messages/:messageId/reaction", handlers.ManageReaction)
		restricted.PATCH("/chat/message/messages/:messageId/edit", handlers.EditMessage)

		restricted.PATCH("/chat/:chatId/update", handlers.UpdateGroupChat)
		restricted.POST("/chat/:chatId/remove", handlers.RemoveParticipant)
		restricted.POST("/chat/:chatId/add", handlers.AddParticipant)
		restricted.POST("/chat/:chatId/pinned", handlers.PinMessage)
		restricted.DELETE("/chat/:chatId/pinned", handlers.UnpinMessage)

		restricted.POST("/chat/media/upload", middleware.RateLimiter(10, time.Minute, "chat:media:upload"), handlers.UploadMedia)

		restricted.POST("/call/initiate", handlers.InitiateCall)
		restricted.POST("/call/accept", handlers.AcceptCall)

		restricted.POST("/bot/chats/:id/message", middleware.GeminiRateLimiter(), handlers.SendBotMessage)
	}

	go handlers.StartStoryCleanup()

	log.Printf("Server starting on port %s", config.AppConfig.Port)
	if err := r.Run(":" + config.AppConfig.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
