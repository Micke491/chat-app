package handlers

import (
	"context"
	"net/http"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Announcements older than this are never surfaced, even if the user never
// opened the app to dismiss them.
const announcementMaxAge = 30 * 24 * time.Hour

func GetAnnouncements(c *gin.Context) {
	user, ok := c.MustGet("user").(models.User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	audiences := []string{models.AudienceAll, models.AudienceActive}
	if user.Role == "admin" {
		audiences = append(audiences, models.AudienceAdmins)
	}

	cutoff := time.Now().Add(-announcementMaxAge)
	if user.CreatedAt.After(cutoff) {
		cutoff = user.CreatedAt
	}

	filter := bson.M{
		"status":   models.AnnouncementSent,
		"audience": bson.M{"$in": audiences},
		"sentAt":   bson.M{"$gte": cutoff},
		"readBy":   bson.M{"$ne": user.ID},
	}

	opts := options.Find().SetSort(bson.D{{Key: "sentAt", Value: -1}}).SetLimit(20)
	cursor, err := db.AnnouncementCollection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch announcements"})
		return
	}
	defer cursor.Close(ctx)

	announcements := []models.Announcement{}
	if err := cursor.All(ctx, &announcements); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode announcements"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"announcements": announcements})
}

func DismissAnnouncement(c *gin.Context) {
	user, ok := c.MustGet("user").(models.User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	announcementID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid announcement id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.AnnouncementCollection.UpdateOne(ctx,
		bson.M{"_id": announcementID},
		bson.M{"$addToSet": bson.M{"readBy": user.ID}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to dismiss announcement"})
		return
	}
	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Announcement not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Announcement dismissed"})
}
