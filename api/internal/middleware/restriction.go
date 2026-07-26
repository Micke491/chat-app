package middleware

import (
	"net/http"
	"time"

	"chat-app/internal/models"

	"github.com/gin-gonic/gin"
)

// RequireActive blocks users the moderators have taken action against from
// producing anything new. Reading, profile edits and reporting stay open — a
// timeout is a posting restriction, not a lockout.
func RequireActive() gin.HandlerFunc {
	return func(c *gin.Context) {
		userObj, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
			c.Abort()
			return
		}

		user, ok := userObj.(models.User)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
			c.Abort()
			return
		}

		if user.IsBanned {
			c.JSON(http.StatusForbidden, gin.H{
				"message": "Your account has been banned",
				"banned":  true,
			})
			c.Abort()
			return
		}

		if user.TimeoutUntil != nil && user.TimeoutUntil.After(time.Now()) {
			c.JSON(http.StatusForbidden, gin.H{
				"message":      "You are restricted until " + user.TimeoutUntil.UTC().Format(time.RFC1123),
				"restricted":   true,
				"timeoutUntil": user.TimeoutUntil,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
