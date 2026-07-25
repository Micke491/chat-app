package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/services"
	"chat-app/internal/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func SendMessage(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var body struct {
		ChatID         string  `json:"chatId"`
		SenderID       string  `json:"senderId"`
		Text           string  `json:"text"`
		ReplyTo        *string `json:"replyTo"`
		MediaURL       string  `json:"mediaUrl"`
		MediaType      string  `json:"mediaType"`
		MediaPublicID  string  `json:"mediaPublicId"`
		IsForwarded    bool    `json:"isForwarded"`
		StoryID        *string `json:"storyId"`
		StoryMediaURL  string  `json:"storyMediaUrl"`
		StoryMediaType string  `json:"storyMediaType"`
		StoryCaption   string  `json:"storyCaption"`
		StoryExpiresAt *string `json:"storyExpiresAt"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if currentUser.ID.Hex() != body.SenderID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized sender"})
		return
	}

	chatID, err := bson.ObjectIDFromHex(body.ChatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}
	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": chatID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	isPart := false
	for _, p := range chat.Participants {
		if p == currentUser.ID {
			isPart = true
			break
		}
	}
	if !isPart {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member of this chat"})
		return
	}

	if !chat.IsGroupChat {
		var otherID bson.ObjectID
		for _, p := range chat.Participants {
			if p != currentUser.ID {
				otherID = p
				break
			}
		}
		if !otherID.IsZero() {
			var otherUser models.User
			err := db.UserCollection.FindOne(c, bson.M{"_id": otherID}).Decode(&otherUser)
			if err != nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot send messages. User not found."})
				return
			}
			for _, id := range currentUser.BlockedUsers {
				if id == otherID {
					c.JSON(http.StatusForbidden, gin.H{"error": "You cannot send messages to this user."})
					return
				}
			}
			for _, id := range otherUser.BlockedUsers {
				if id == currentUser.ID {
					c.JSON(http.StatusForbidden, gin.H{"error": "You cannot send messages to this user."})
					return
				}
			}
		}
	}

	var replyToID *bson.ObjectID
	if body.ReplyTo != nil {
		id, err := bson.ObjectIDFromHex(*body.ReplyTo)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid replyTo ID format"})
			return
		}
		replyToID = &id
	}

	var storyID *bson.ObjectID
	if body.StoryID != nil && *body.StoryID != "" {
		id, err := bson.ObjectIDFromHex(*body.StoryID)
		if err == nil {
			storyID = &id
		}
	}

	var storyExpiresAt *time.Time
	if body.StoryExpiresAt != nil && *body.StoryExpiresAt != "" {
		parsedTime, err := time.Parse(time.RFC3339, *body.StoryExpiresAt)
		if err == nil {
			storyExpiresAt = &parsedTime
		}
	}

	newMessage := models.Message{
		ID:             bson.NewObjectID(),
		ChatID:         chatID,
		Sender:         currentUser.ID,
		SenderUsername: currentUser.Username,
		Text:           body.Text,
		ReplyTo:        replyToID,
		MediaURL:       body.MediaURL,
		MediaType:      body.MediaType,
		MediaPublicID:  body.MediaPublicID,
		IsForwarded:    body.IsForwarded,
		StoryID:        storyID,
		StoryMediaURL:  body.StoryMediaURL,
		StoryMediaType: body.StoryMediaType,
		StoryCaption:   body.StoryCaption,
		StoryExpiresAt: storyExpiresAt,
		Status:         "sent",
		Read:           false,
		ReadBy:         []models.ReadByEntry{},
		DeliveredTo:    []bson.ObjectID{},
		Reactions:      []models.Reaction{},
		DeletedBy:      []bson.ObjectID{},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	session, err := db.MongoClient.StartSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start database session"})
		return
	}
	defer session.EndSession(c.Request.Context())

	err = mongo.WithSession(c.Request.Context(), session, func(sc context.Context) error {
		if err := session.StartTransaction(); err != nil {
			return err
		}

		_, err := db.MessageCollection.InsertOne(sc, newMessage)
		if err != nil {
			return err
		}

		_, err = db.ChatCollection.UpdateOne(sc, bson.M{"_id": chatID}, bson.M{
			"$set": bson.M{
				"lastMessage": newMessage.ID,
				"updatedAt":   time.Now(),
				"hiddenBy":    []bson.ObjectID{},
			},
		})
		if err != nil {
			return err
		}

		return session.CommitTransaction(sc)
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create message"})
		return
	}

	var populatedSender models.User
	db.UserCollection.FindOne(c, bson.M{"_id": newMessage.Sender}, options.FindOne().SetProjection(bson.M{"username": 1, "email": 1, "avatar": 1})).Decode(&populatedSender)

	populatedMsg := gin.H{
		"_id":            newMessage.ID,
		"chatId":         newMessage.ChatID,
		"sender":         populatedSender,
		"senderUsername": newMessage.SenderUsername,
		"text":           newMessage.Text,
		"mediaUrl":       newMessage.MediaURL,
		"mediaType":      newMessage.MediaType,
		"mediaPublicId":  newMessage.MediaPublicID,
		"status":         newMessage.Status,
		"createdAt":      newMessage.CreatedAt,
		"isForwarded":    newMessage.IsForwarded,
		"storyId":        newMessage.StoryID,
		"storyMediaUrl":  newMessage.StoryMediaURL,
		"storyMediaType": newMessage.StoryMediaType,
		"storyCaption":   newMessage.StoryCaption,
		"storyExpiresAt": newMessage.StoryExpiresAt,
		"storyExpired":   false,
	}

	if newMessage.ReplyTo != nil {
		var replyMsg models.Message
		db.MessageCollection.FindOne(c, bson.M{"_id": newMessage.ReplyTo}).Decode(&replyMsg)
		var replySender models.User
		db.UserCollection.FindOne(c, bson.M{"_id": replyMsg.Sender}, options.FindOne().SetProjection(bson.M{"username": 1})).Decode(&replySender)
		populatedMsg["replyTo"] = gin.H{
			"_id":    replyMsg.ID,
			"text":   replyMsg.Text,
			"sender": replySender,
		}
	}

	if chat.Status == "pending" {
		for _, pid := range chat.Participants {
			if pid != currentUser.ID {
				utils.Broadcast("user-"+pid.Hex(), "chat-request-received", gin.H{"chatId": body.ChatID})
			} else {
				utils.Broadcast("chat-"+body.ChatID, "receive-message", populatedMsg)
			}
		}
	} else {
		utils.Broadcast("chat-"+body.ChatID, "receive-message", populatedMsg)
		for _, pid := range chat.Participants {
			utils.Broadcast("user-"+pid.Hex(), "chat-update", gin.H{
				"chatId":      body.ChatID,
				"lastMessage": populatedMsg,
				"isGroupChat": chat.IsGroupChat,
			})
		}
	}

	var fcmRecipients []bson.ObjectID
	for _, pid := range chat.Participants {
		if pid != currentUser.ID {
			fcmRecipients = append(fcmRecipients, pid)
		}
	}
	if len(fcmRecipients) > 0 {
		title := currentUser.Username
		bodyText := newMessage.Text
		category := models.NotifyDirect
		if chat.Status == "pending" {
			title = "Chat Request"
			bodyText = currentUser.Username + " requested to chat with you"
			category = models.NotifyRequest
		} else if chat.IsGroupChat {
			category = models.NotifyGroup
			if chat.Name != nil && *chat.Name != "" {
				title = *chat.Name + " (" + currentUser.Username + ")"
			}
		}
		if bodyText == "" && newMessage.MediaType != "" {
			bodyText = "Sent a " + newMessage.MediaType
		}
		dataType := "message"
		if category == models.NotifyRequest {
			dataType = "request"
		}
		data := map[string]string{
			"type":       dataType,
			"chatId":     body.ChatID,
			"messageId":  newMessage.ID.Hex(),
			"senderId":   currentUser.ID.Hex(),
			"senderName": currentUser.Username,
		}
		services.SendPushNotification(context.Background(), fcmRecipients, chat.ID, category, title, bodyText, data)
	}

	c.JSON(http.StatusCreated, gin.H{"message": populatedMsg})
}

func GetMessages(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	chatIDStr := c.Query("chatId")
	limitStr := c.DefaultQuery("limit", "30")
	beforeStr := c.Query("before")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}
	limit, _ := strconv.Atoi(limitStr)

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": chatID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}
	isPart := false
	for _, p := range chat.Participants {
		if p == currentUser.ID {
			isPart = true
			break
		}
	}
	if !isPart {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	if beforeStr == "" {
		unreadQuery := bson.M{
			"chatId":        chatID,
			"deletedBy":     bson.M{"$ne": currentUser.ID},
			"sender":        bson.M{"$ne": currentUser.ID},
			"readBy.userId": bson.M{"$ne": currentUser.ID},
		}
		unreadCount, err := db.MessageCollection.CountDocuments(c, unreadQuery)
		if err == nil && int(unreadCount) > limit {
			limit = int(unreadCount) + 15
			if limit > 200 {
				limit = 200
			}
		}
	}

	query := bson.M{
		"chatId":    chatID,
		"deletedBy": bson.M{"$ne": currentUser.ID},
	}
	if beforeStr != "" {
		beforeTime, _ := time.Parse(time.RFC3339, beforeStr)
		query["createdAt"] = bson.M{"$lt": beforeTime}
	}

	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(int64(limit + 1))
	cursor, err := db.MessageCollection.Find(c, query, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}
	defer cursor.Close(c)

	var messages []models.Message
	cursor.All(c, &messages)

	hasMore := len(messages) > limit
	if hasMore {
		messages = messages[:limit]
	}

	var unreadIDs []bson.ObjectID
	for _, msg := range messages {
		if msg.Sender != currentUser.ID {
			isRead := false
			for _, rb := range msg.ReadBy {
				if rb.UserID == currentUser.ID {
					isRead = true
					break
				}
			}
			if !isRead {
				unreadIDs = append(unreadIDs, msg.ID)
			}
		}
	}

	if len(unreadIDs) > 0 {
		_, err := db.MessageCollection.UpdateMany(c, bson.M{"_id": bson.M{"$in": unreadIDs}}, bson.M{
			"$push":     bson.M{"readBy": models.ReadByEntry{UserID: currentUser.ID, ReadAt: time.Now()}},
			"$set":      bson.M{"status": "seen", "read": true},
			"$addToSet": bson.M{"deliveredTo": currentUser.ID},
		})
		if err == nil {
			utils.Broadcast("user-"+currentUser.ID.Hex(), "chat-update", gin.H{
				"chatId":      chatID.Hex(),
				"unreadCount": 0,
			})

			var unreadIDStrs []string
			for _, id := range unreadIDs {
				unreadIDStrs = append(unreadIDStrs, id.Hex())
			}

			utils.Broadcast("chat-"+chatID.Hex(), "messages-read", gin.H{
				"chatId":     chatID.Hex(),
				"messageIds": unreadIDStrs,
				"userId":     currentUser.ID.Hex(),
			})
		}
	}

	senderIDsMap := make(map[bson.ObjectID]bool)
	replyMsgIDsMap := make(map[bson.ObjectID]bool)

	for _, msg := range messages {
		senderIDsMap[msg.Sender] = true
		if msg.ReplyTo != nil {
			replyMsgIDsMap[*msg.ReplyTo] = true
		}
	}

	var senderIDs []bson.ObjectID
	for id := range senderIDsMap {
		senderIDs = append(senderIDs, id)
	}

	userCache := make(map[bson.ObjectID]models.User)
	if len(senderIDs) > 0 {
		cursor, err := db.UserCollection.Find(c, bson.M{"_id": bson.M{"$in": senderIDs}}, options.Find().SetProjection(bson.M{"username": 1, "avatar": 1, "name": 1}))
		if err == nil {
			var senders []models.User
			cursor.All(c, &senders)
			for _, u := range senders {
				userCache[u.ID] = u
			}
			cursor.Close(c)
		}
	}

	var replyMsgIDs []bson.ObjectID
	for id := range replyMsgIDsMap {
		replyMsgIDs = append(replyMsgIDs, id)
	}

	replyCache := make(map[bson.ObjectID]models.Message)
	var replySenderIDs []bson.ObjectID
	if len(replyMsgIDs) > 0 {
		cursor, err := db.MessageCollection.Find(c, bson.M{"_id": bson.M{"$in": replyMsgIDs}})
		if err == nil {
			var replyMsgs []models.Message
			cursor.All(c, &replyMsgs)
			for _, rm := range replyMsgs {
				replyCache[rm.ID] = rm
				if _, ok := userCache[rm.Sender]; !ok {
					replySenderIDs = append(replySenderIDs, rm.Sender)
				}
			}
			cursor.Close(c)
		}
	}

	if len(replySenderIDs) > 0 {
		cursor, err := db.UserCollection.Find(c, bson.M{"_id": bson.M{"$in": replySenderIDs}}, options.Find().SetProjection(bson.M{"username": 1, "avatar": 1}))
		if err == nil {
			var replySenders []models.User
			cursor.All(c, &replySenders)
			for _, ru := range replySenders {
				userCache[ru.ID] = ru
			}
			cursor.Close(c)
		}
	}

	populatedMessages := []gin.H{}
	for _, msg := range messages {
		sender, ok := userCache[msg.Sender]
		if !ok {
			sender.Username = "Deleted User"
		}

		storyExpired := false
		if msg.StoryExpiresAt != nil && time.Now().After(*msg.StoryExpiresAt) {
			storyExpired = true
		}

		msgMap := gin.H{
			"_id":                  msg.ID,
			"chatId":               msg.ChatID,
			"sender":               sender,
			"senderUsername":       msg.SenderUsername,
			"text":                 msg.Text,
			"read":                 msg.Read,
			"status":               msg.Status,
			"deliveredTo":          msg.DeliveredTo,
			"readBy":               msg.ReadBy,
			"isEdited":             msg.IsEdited,
			"editedAt":             msg.EditedAt,
			"originalText":         msg.OriginalText,
			"isDeletedForEveryone": msg.IsDeletedForEveryone,
			"deletedForEveryoneAt": msg.DeletedForEveryoneAt,
			"isPinned":             msg.IsPinned,
			"mediaUrl":             msg.MediaURL,
			"mediaType":            msg.MediaType,
			"mediaPublicId":        msg.MediaPublicID,
			"isForwarded":          msg.IsForwarded,
			"isSystemMessage":      msg.IsSystemMessage,
			"reactions":            msg.Reactions,
			"createdAt":            msg.CreatedAt,
			"updatedAt":            msg.UpdatedAt,
			"storyId":              msg.StoryID,
			"storyMediaUrl":        msg.StoryMediaURL,
			"storyMediaType":       msg.StoryMediaType,
			"storyCaption":         msg.StoryCaption,
			"storyExpiresAt":       msg.StoryExpiresAt,
			"storyExpired":         storyExpired,
		}

		if msg.ReplyTo != nil {
			if replyMsg, ok := replyCache[*msg.ReplyTo]; ok {
				replySender, ok := userCache[replyMsg.Sender]
				if !ok {
					replySender.Username = "Deleted User"
				}
				msgMap["replyTo"] = gin.H{
					"_id":    replyMsg.ID,
					"text":   replyMsg.Text,
					"sender": replySender,
				}
			}
		}

		populatedMessages = append(populatedMessages, msgMap)
	}

	for i, j := 0, len(populatedMessages)-1; i < j; i, j = i+1, j-1 {
		populatedMessages[i], populatedMessages[j] = populatedMessages[j], populatedMessages[i]
	}

	nextCursor := ""
	if hasMore && len(messages) > 0 {
		nextCursor = messages[0].CreatedAt.Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, gin.H{
		"messages":   populatedMessages,
		"hasMore":    hasMore,
		"nextCursor": nextCursor,
	})
}

func UpdateMessageStatus(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var body struct {
		ChatID     string   `json:"chatId"`
		MessageIDs []string `json:"messageIds"`
		Status     string   `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if body.Status != "delivered" && body.Status != "seen" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	var objIDs []bson.ObjectID
	for _, id := range body.MessageIDs {
		oid, err := bson.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
			return
		}
		objIDs = append(objIDs, oid)
	}

	update := bson.M{}
	if body.Status == "delivered" {
		update = bson.M{
			"$addToSet": bson.M{"deliveredTo": currentUser.ID},
			"$set":      bson.M{"status": "delivered"},
		}
	} else {
		update = bson.M{
			"$push":     bson.M{"readBy": models.ReadByEntry{UserID: currentUser.ID, ReadAt: time.Now()}},
			"$set":      bson.M{"status": "seen", "read": true},
			"$addToSet": bson.M{"deliveredTo": currentUser.ID},
		}
	}

	filter := bson.M{
		"_id":    bson.M{"$in": objIDs},
		"sender": bson.M{"$ne": currentUser.ID},
	}

	_, err := db.MessageCollection.UpdateMany(c, filter, update)

	if err == nil && body.ChatID != "" {
		switch body.Status {
		case "seen":
			utils.Broadcast("user-"+currentUser.ID.Hex(), "chat-update", gin.H{
				"chatId":      body.ChatID,
				"unreadCount": 0,
			})
			utils.Broadcast("chat-"+body.ChatID, "messages-read", gin.H{
				"chatId":     body.ChatID,
				"messageIds": body.MessageIDs,
				"userId":     currentUser.ID.Hex(),
			})
		case "delivered":
			utils.Broadcast("chat-"+body.ChatID, "messages-delivered", gin.H{
				"chatId":     body.ChatID,
				"messageIds": body.MessageIDs,
				"userId":     currentUser.ID.Hex(),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "updated": len(objIDs)})
}

func ManageReaction(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)
	messageIDStr := c.Param("messageId")
	messageID, err := bson.ObjectIDFromHex(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
		return
	}

	var msg models.Message
	err = db.MessageCollection.FindOne(c, bson.M{"_id": messageID}).Decode(&msg)
	if msg.IsDeletedForEveryone {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot react to a deleted message"})
		return
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": msg.ChatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	if c.Request.Method == "POST" {
		var body struct {
			Emoji  string `json:"emoji"`
			ChatID string `json:"chatId"`
		}
		c.ShouldBindJSON(&body)

		reaction := models.Reaction{
			UserID:    currentUser.ID,
			Emoji:     body.Emoji,
			CreatedAt: time.Now(),
		}

		_, err := db.MessageCollection.UpdateOne(c, bson.M{"_id": messageID}, bson.M{
			"$push": bson.M{"reactions": reaction},
		})
		if err == nil {
			utils.Broadcast("chat-"+body.ChatID, "message-reaction-added", gin.H{
				"chatId":    body.ChatID,
				"messageId": messageIDStr,
				"reaction": gin.H{
					"userId":    currentUser.ID,
					"emoji":     body.Emoji,
					"createdAt": reaction.CreatedAt,
					"user": gin.H{
						"username": currentUser.Username,
						"avatar":   currentUser.Avatar,
					},
				},
			})
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	} else {
		emoji := c.Query("emoji")
		chatID := c.Query("chatId")

		db.MessageCollection.UpdateOne(c, bson.M{"_id": messageID}, bson.M{
			"$pull": bson.M{"reactions": bson.M{"userId": currentUser.ID, "emoji": emoji}},
		})
		utils.Broadcast("chat-"+chatID, "message-reaction-removed", gin.H{
			"chatId":    chatID,
			"messageId": messageIDStr,
			"userId":    currentUser.ID,
			"emoji":     emoji,
		})
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func EditMessage(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)
	messageIDStr := c.Param("messageId")
	messageID, err := bson.ObjectIDFromHex(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
		return
	}

	var body struct {
		Text string `json:"text"`
	}
	c.ShouldBindJSON(&body)

	var msg models.Message
	err = db.MessageCollection.FindOne(c, bson.M{"_id": messageID}).Decode(&msg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": msg.ChatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	if msg.Sender != currentUser.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	if time.Since(msg.CreatedAt) > 15*time.Minute {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message too old to edit"})
		return
	}

	if msg.IsDeletedForEveryone {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot edit a deleted message"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"text":     body.Text,
			"isEdited": true,
			"editedAt": time.Now(),
		},
	}
	if !msg.IsEdited {
		update["$set"].(bson.M)["originalText"] = msg.Text
	}

	db.MessageCollection.UpdateOne(c, bson.M{"_id": messageID}, update)

	db.MessageCollection.FindOne(c, bson.M{"_id": messageID}).Decode(&msg)

	var sender models.User
	db.UserCollection.FindOne(c, bson.M{"_id": msg.Sender}, options.FindOne().SetProjection(bson.M{"username": 1, "avatar": 1})).Decode(&sender)

	populatedMsg := gin.H{
		"_id":            msg.ID,
		"chatId":         msg.ChatID,
		"sender":         sender,
		"senderUsername": msg.SenderUsername,
		"text":           msg.Text,
		"mediaUrl":       msg.MediaURL,
		"mediaType":      msg.MediaType,
		"mediaPublicId":  msg.MediaPublicID,
		"status":         msg.Status,
		"isEdited":       msg.IsEdited,
		"editedAt":       msg.EditedAt,
		"originalText":   msg.OriginalText,
		"isPinned":       msg.IsPinned,
		"createdAt":      msg.CreatedAt,
		"updatedAt":      msg.UpdatedAt,
		"reactions":      msg.Reactions,
	}

	utils.Broadcast("chat-"+msg.ChatID.Hex(), "message-updated", populatedMsg)

	c.JSON(http.StatusOK, gin.H{"message": populatedMsg})
}

func DeleteMessage(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)
	messageIDStr := c.Param("messageId")
	messageID, err := bson.ObjectIDFromHex(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
		return
	}

	forEveryone := c.Query("forEveryone") == "true"

	var msg models.Message
	err = db.MessageCollection.FindOne(c, bson.M{"_id": messageID}).Decode(&msg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": msg.ChatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	if forEveryone {
		if msg.Sender != currentUser.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only sender can delete for everyone"})
			return
		}

		db.MessageCollection.UpdateOne(c, bson.M{"_id": messageID}, bson.M{
			"$set": bson.M{
				"isDeletedForEveryone": true,
				"deletedForEveryoneAt": time.Now(),
				"text":                 "This message was deleted",
				"mediaUrl":             "",
				"mediaType":            "",
				"mediaPublicId":        "",
				"isPinned":             false,
			},
		})

		utils.Broadcast("chat-"+msg.ChatID.Hex(), "message-deleted", gin.H{"messageId": messageIDStr, "chatId": msg.ChatID.Hex()})

		for _, pid := range chat.Participants {
			utils.Broadcast("user-"+pid.Hex(), "chat-update", gin.H{
				"chatId": msg.ChatID.Hex(),
				"lastMessage": gin.H{
					"_id":                  messageIDStr,
					"text":                 "This message was deleted",
					"isDeletedForEveryone": true,
				},
			})
		}
	} else {
		db.MessageCollection.UpdateOne(c, bson.M{"_id": messageID}, bson.M{
			"$addToSet": bson.M{"deletedBy": currentUser.ID},
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetPinnedMessages(c *gin.Context) {
	chatIDStr := c.Param("chatId")
	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": chatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	var messages []models.Message
	cursor, _ := db.MessageCollection.Find(c, bson.M{"chatId": chatID, "isPinned": true}, options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(1))
	cursor.All(c, &messages)

	populatedMessages := []gin.H{}
	for _, msg := range messages {
		var sender models.User
		db.UserCollection.FindOne(c, bson.M{"_id": msg.Sender}, options.FindOne().SetProjection(bson.M{"username": 1, "avatar": 1})).Decode(&sender)

		populatedMessages = append(populatedMessages, gin.H{
			"_id":            msg.ID,
			"chatId":         msg.ChatID,
			"sender":         sender,
			"senderUsername": msg.SenderUsername,
			"text":           msg.Text,
			"mediaUrl":       msg.MediaURL,
			"mediaType":      msg.MediaType,
			"mediaPublicId":  msg.MediaPublicID,
			"status":         msg.Status,
			"isPinned":       msg.IsPinned,
			"createdAt":      msg.CreatedAt,
			"updatedAt":      msg.UpdatedAt,
			"reactions":      msg.Reactions,
		})
	}

	c.JSON(http.StatusOK, populatedMessages)
}

func PinMessage(c *gin.Context) {
	chatIDStr := c.Param("chatId")
	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": chatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	var body struct {
		MessageID string `json:"messageId"`
	}
	c.ShouldBindJSON(&body)
	msgID, err := bson.ObjectIDFromHex(body.MessageID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
		return
	}

	var msg models.Message
	err = db.MessageCollection.FindOne(c, bson.M{"_id": msgID}).Decode(&msg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}
	if msg.ChatID != chatID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message does not belong to this chat"})
		return
	}

	db.MessageCollection.UpdateMany(c, bson.M{"chatId": chatID, "isPinned": true}, bson.M{"$set": bson.M{"isPinned": false}})

	db.MessageCollection.UpdateOne(c, bson.M{"_id": msgID}, bson.M{"$set": bson.M{"isPinned": true}})

	db.MessageCollection.FindOne(c, bson.M{"_id": msgID}).Decode(&msg)

	var sender models.User
	db.UserCollection.FindOne(c, bson.M{"_id": msg.Sender}, options.FindOne().SetProjection(bson.M{"username": 1, "avatar": 1})).Decode(&sender)

	populatedMsg := gin.H{
		"_id":            msg.ID,
		"chatId":         msg.ChatID,
		"sender":         sender,
		"senderUsername": msg.SenderUsername,
		"text":           msg.Text,
		"mediaUrl":       msg.MediaURL,
		"mediaType":      msg.MediaType,
		"mediaPublicId":  msg.MediaPublicID,
		"status":         msg.Status,
		"isPinned":       msg.IsPinned,
		"createdAt":      msg.CreatedAt,
		"updatedAt":      msg.UpdatedAt,
		"reactions":      msg.Reactions,
	}

	utils.Broadcast("chat-"+chatIDStr, "message-pinned", populatedMsg)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": populatedMsg})
}

func UnpinMessage(c *gin.Context) {
	chatIDStr := c.Param("chatId")
	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var chat models.Chat
	err = db.ChatCollection.FindOne(c, bson.M{"_id": chatID, "participants": currentUser.ID}).Decode(&chat)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not in this conversation"})
		return
	}

	msgIDStr := c.Query("messageId")
	msgID, err := bson.ObjectIDFromHex(msgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID format"})
		return
	}

	var msg models.Message
	err = db.MessageCollection.FindOne(c, bson.M{"_id": msgID}).Decode(&msg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}
	if msg.ChatID != chatID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message does not belong to this chat"})
		return
	}

	db.MessageCollection.UpdateOne(c, bson.M{"_id": msgID}, bson.M{"$set": bson.M{"isPinned": false}})
	utils.Broadcast("chat-"+chatIDStr, "message-unpinned", gin.H{"messageId": msgIDStr, "chatId": chatIDStr})

	c.JSON(http.StatusOK, gin.H{"success": true})
}
