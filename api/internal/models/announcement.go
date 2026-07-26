package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	AudienceAll     = "all"
	AudienceActive  = "active"
	AudienceAdmins  = "admins"
	AnnouncementSent = "sent"
)

type Announcement struct {
	ID                bson.ObjectID   `bson:"_id,omitempty" json:"_id"`
	Title             string          `bson:"title" json:"title"`
	Body              string          `bson:"body" json:"body"`
	Audience          string          `bson:"audience" json:"audience"`
	Status            string          `bson:"status" json:"status"`
	CreatedBy         bson.ObjectID   `bson:"createdBy,omitempty" json:"-"`
	CreatedByUsername string          `bson:"createdByUsername" json:"createdByUsername"`
	SentAt            *time.Time      `bson:"sentAt,omitempty" json:"sentAt,omitempty"`
	DeliveredCount    int             `bson:"deliveredCount" json:"deliveredCount"`
	ReadBy            []bson.ObjectID `bson:"readBy,omitempty" json:"-"`
	CreatedAt         time.Time       `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time       `bson:"updatedAt" json:"updatedAt"`
}
