package db

import (
	"context"
	"log"
	"time"

	"chat-app/internal/config"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var MongoClient *mongo.Client
var UserCollection *mongo.Collection
var ChatCollection *mongo.Collection
var StoryCollection *mongo.Collection
var ReportCollection *mongo.Collection
var MessageCollection *mongo.Collection
var SessionCollection *mongo.Collection 
var DraftCollection *mongo.Collection
var BotChatCollection *mongo.Collection
var AnnouncementCollection *mongo.Collection

func ConnectMongo() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(config.AppConfig.MongoURI)
	client, err := mongo.Connect(clientOptions)
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("Failed to ping MongoDB:", err)
	}

	MongoClient = client
	db := client.Database(config.AppConfig.DBName)
	UserCollection = db.Collection("users")
	ChatCollection = db.Collection("chats")
	StoryCollection = db.Collection("stories")
	ReportCollection = db.Collection("reports")
	MessageCollection = db.Collection("messages")
	SessionCollection = db.Collection("sessions") 
	DraftCollection = db.Collection("drafts")
	BotChatCollection = db.Collection("bot_chats")
	AnnouncementCollection = db.Collection("announcements")

	log.Println("Successfully connected to MongoDB")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = CreateIndexes(ctx)
	}()
}