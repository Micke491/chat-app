package services

import (
	"context"
	"log"

	"chat-app/internal/db"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// unreadStat is what one recipient needs to personalise their push: how many
// unread messages sit in the chat that just fired, and how many they have in
// total (the app icon badge).
type unreadStat struct {
	InChat int
	Total  int
}

// unreadFilter is the single definition of "unread", kept identical to the
// aggregation GetChats uses (handlers/chat.go) so the tray subtitle and the
// in-app chat list can never disagree. There is a dedicated index for this
// shape in db/indexes.go.
func unreadFilter(userID bson.ObjectID, chatIDs []bson.ObjectID) bson.M {
	ids := chatIDs
	if ids == nil {
		ids = []bson.ObjectID{}
	}
	return bson.M{
		"chatId":        bson.M{"$in": ids},
		"sender":        bson.M{"$ne": userID},
		"readBy.userId": bson.M{"$ne": userID},
		"deletedBy":     bson.M{"$ne": userID},
	}
}

// unreadStats counts unread messages for every recipient of a push.
//
// Cost is 1 + 2N queries for N recipients: one to learn everybody's chats, then
// two indexed counts each. That is nothing for a direct message (N=1) and
// acceptable for this app's group sizes. If groups ever get large, this is the
// first thing to cache.
//
// Every failure path returns zeroes rather than an error: a missing badge is a
// cosmetic loss, and it must never stop the notification being delivered.
func unreadStats(ctx context.Context, recipients []bson.ObjectID, chatID bson.ObjectID) map[bson.ObjectID]unreadStat {
	stats := make(map[bson.ObjectID]unreadStat, len(recipients))
	if len(recipients) == 0 {
		return stats
	}

	cursor, err := db.ChatCollection.Find(ctx,
		bson.M{"participants": bson.M{"$in": recipients}},
		options.Find().SetProjection(bson.M{"_id": 1, "participants": 1}),
	)
	if err != nil {
		log.Printf("push: could not load chats for unread counts: %v", err)
		return stats
	}
	defer cursor.Close(ctx)

	var chats []struct {
		ID           bson.ObjectID   `bson:"_id"`
		Participants []bson.ObjectID `bson:"participants"`
	}
	if err := cursor.All(ctx, &chats); err != nil {
		log.Printf("push: could not decode chats for unread counts: %v", err)
		return stats
	}

	recipientSet := make(map[bson.ObjectID]bool, len(recipients))
	for _, r := range recipients {
		recipientSet[r] = true
	}
	chatsByUser := make(map[bson.ObjectID][]bson.ObjectID, len(recipients))
	for _, chat := range chats {
		for _, p := range chat.Participants {
			if recipientSet[p] {
				chatsByUser[p] = append(chatsByUser[p], chat.ID)
			}
		}
	}

	for _, r := range recipients {
		var stat unreadStat

		total, err := db.MessageCollection.CountDocuments(ctx, unreadFilter(r, chatsByUser[r]))
		if err != nil {
			log.Printf("push: unread total failed for %s: %v", r.Hex(), err)
		} else {
			stat.Total = int(total)
		}

		if !chatID.IsZero() {
			inChat, err := db.MessageCollection.CountDocuments(ctx, unreadFilter(r, []bson.ObjectID{chatID}))
			if err != nil {
				log.Printf("push: unread in-chat failed for %s: %v", r.Hex(), err)
			} else {
				stat.InChat = int(inChat)
			}
		}

		stats[r] = stat
	}

	return stats
}
