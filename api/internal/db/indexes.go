package db

import (
	"context"
	"log"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func CreateIndexes(ctx context.Context) error {
	userTextIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"username": "text",
			"name":     "text",
		},
		Options: options.Index().SetWeights(bson.M{
			"username": 10,
			"name":     5,
		}).SetDefaultLanguage("english"),
	}

	blockedUsersIndexModel := mongo.IndexModel{
		Keys: bson.M{"blockedUsers": 1},
		Options: options.Index().SetSparse(true),
	}

	statusIndexModel := mongo.IndexModel{
		Keys: bson.M{"status": 1},
		Options: options.Index().SetSparse(true),
	}

	userIndexes := []mongo.IndexModel{
		userTextIndexModel,
		blockedUsersIndexModel,
		statusIndexModel,
	}

	if _, err := UserCollection.Indexes().CreateMany(ctx, userIndexes); err != nil {
		log.Printf("Warning: Failed to create user indexes: %v\n", err)
	}

	participantsIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"participants": 1,
			"updatedAt":    -1,
		},
	}

	hiddenByIndexModel := mongo.IndexModel{
		Keys: bson.M{"hiddenBy": 1},
		Options: options.Index().SetSparse(true),
	}

	groupChatIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"isGroupChat": 1,
			"updatedAt":   -1,
		},
	}

	lastMessageIndexModel := mongo.IndexModel{
		Keys: bson.M{"lastMessage": 1},
		Options: options.Index().SetSparse(true),
	}

	chatIndexes := []mongo.IndexModel{
		participantsIndexModel,
		hiddenByIndexModel,
		groupChatIndexModel,
		lastMessageIndexModel,
	}

	if _, err := ChatCollection.Indexes().CreateMany(ctx, chatIndexes); err != nil {
		log.Printf("Warning: Failed to create chat indexes: %v\n", err)
	}

	chatTimestampIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"chatId":    1,
			"createdAt": -1,
		},
	}

	senderIndexModel := mongo.IndexModel{
		Keys: bson.M{"sender": 1},
	}

	unreadIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"chatId":        1,
			"readBy.userId": 1,
		},
	}

	deletedByIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"chatId":    1,
			"deletedBy": 1,
		},
		Options: options.Index().SetSparse(true),
	}

	callMediaIndexModel := mongo.IndexModel{
		Keys: bson.M{
			"mediaPublicId": 1,
			"mediaType":     1,
		},
		Options: options.Index().SetSparse(true),
	}

	messageIndexes := []mongo.IndexModel{
		chatTimestampIndexModel,
		senderIndexModel,
		unreadIndexModel,
		deletedByIndexModel,
		callMediaIndexModel,
	}

	if _, err := MessageCollection.Indexes().CreateMany(ctx, messageIndexes); err != nil {
		log.Printf("Warning: Failed to create message indexes: %v\n", err)
	}

	sessionTokenIndexModel := mongo.IndexModel{
		Keys: bson.M{"token": 1},
		Options: options.Index().SetUnique(true),
	}
	if _, err := SessionCollection.Indexes().CreateOne(ctx, sessionTokenIndexModel); err != nil {
		log.Printf("Warning: Failed to create session indexes: %v\n", err)
	}

	draftUserChatIndexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "userId", Value: 1},
			{Key: "chatId", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}

	draftTTLIndexModel := mongo.IndexModel{
		Keys:    bson.M{"updatedAt": 1},
		Options: options.Index().SetExpireAfterSeconds(7 * 24 * 60 * 60), // 7 days
	}

	draftIndexes := []mongo.IndexModel{
		draftUserChatIndexModel,
		draftTTLIndexModel,
	}

	if _, err := DraftCollection.Indexes().CreateMany(ctx, draftIndexes); err != nil {
		log.Printf("Warning: Failed to create draft indexes: %v\n", err)
	}

	announcementDeliveryIndexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "status", Value: 1},
			{Key: "audience", Value: 1},
			{Key: "sentAt", Value: -1},
		},
	}

	announcementReadByIndexModel := mongo.IndexModel{
		Keys:    bson.M{"readBy": 1},
		Options: options.Index().SetSparse(true),
	}

	announcementIndexes := []mongo.IndexModel{
		announcementDeliveryIndexModel,
		announcementReadByIndexModel,
	}

	if _, err := AnnouncementCollection.Indexes().CreateMany(ctx, announcementIndexes); err != nil {
		log.Printf("Warning: Failed to create announcement indexes: %v\n", err)
	}

	log.Println("Database index migration completed successfully.")
	return nil
}
