package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Moderation state is written straight to Mongo by the admin panel, which has no
// way to invalidate this cache — so it has to expire on its own quickly enough
// that a ban or an unban lands within about a minute.
const authStatusCacheTTL = time.Minute

func clearExpiredTimeout(userID bson.ObjectID) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.UserCollection.UpdateOne(ctx,
		bson.M{"_id": userID, "timeoutUntil": bson.M{"$lte": time.Now()}},
		bson.M{"$unset": bson.M{"timeoutUntil": ""}},
	)
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenString := ""

		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		} else if cookie, err := c.Cookie("token"); err == nil {
			tokenString = cookie
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
			c.Abort()
			return
		}

		claims, err := services.VerifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid token"})
			c.Abort()
			return
		}

		var sess models.Session
		tokenCacheKey := "session_token:" + tokenString

		if db.RedisClient != nil {
			cachedSess, err := db.RedisClient.Get(c, tokenCacheKey).Result()
			if err == nil && cachedSess != "" {
				json.Unmarshal([]byte(cachedSess), &sess)
			}
		}

		if sess.ID.IsZero() {
			err = db.SessionCollection.FindOne(c, bson.M{"token": tokenString}).Decode(&sess)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					c.JSON(http.StatusUnauthorized, gin.H{"message": "Session has been revoked or expired"})
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error checking session"})
				}
				c.Abort()
				return
			}
			if db.RedisClient != nil {
				sessJSON, _ := json.Marshal(sess)
				db.RedisClient.Set(c, tokenCacheKey, sessJSON, 0)
			}
		}

		c.Set("sessionId", sess.ID)

		cacheKey := "user_auth:" + claims.UserID
		if db.RedisClient != nil {
			cachedStatus, _ := db.RedisClient.Get(c, cacheKey).Result()
			if cachedStatus == "banned" {
				c.JSON(http.StatusForbidden, gin.H{"message": "Account is banned", "banned": true})
				c.Abort()
				return
			}
		}

		var user models.User
		objectID, _ := bson.ObjectIDFromHex(claims.UserID)

		opts := options.FindOne().SetProjection(bson.M{
			"_id":          1,
			"username":     1,
			"avatar":       1,
			"role":         1,
			"isBanned":     1,
			"timeoutUntil": 1,
			"createdAt":    1,
			"blockedUsers": 1,
		})

		err = db.UserCollection.FindOne(c, bson.M{"_id": objectID}, opts).Decode(&user)

		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "User not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error"})
			}
			c.Abort()
			return
		}

		if db.RedisClient != nil {
			status := "active"
			if user.IsBanned {
				status = "banned"
			}
			db.RedisClient.Set(context.Background(), cacheKey, status, authStatusCacheTTL)
		}

		if user.IsBanned {
			c.JSON(http.StatusForbidden, gin.H{"message": "Account is banned", "banned": true})
			c.Abort()
			return
		}

		if user.TimeoutUntil != nil && !user.TimeoutUntil.After(time.Now()) {
			user.TimeoutUntil = nil
			go clearExpiredTimeout(user.ID)
		}

		c.Set("user", user)
		c.Next()
	}
}