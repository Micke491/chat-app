package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/models"
	"chat-app/internal/services"
	"chat-app/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
)

var (
	localCache sync.Map
)

func setCache(ctx context.Context, key string, value string, duration time.Duration) {
	if db.RedisClient != nil {
		err := db.RedisClient.Set(ctx, key, value, duration).Err()
		if err == nil {
			return
		}
	}
	localCache.Store(key, value)
	go func() {
		time.Sleep(duration)
		localCache.Delete(key)
	}()
}

func getCache(ctx context.Context, key string) (string, error) {
	if db.RedisClient != nil {
		val, err := db.RedisClient.Get(ctx, key).Result()
		if err == nil {
			return val, nil
		}
	}
	if val, ok := localCache.Load(key); ok {
		return val.(string), nil
	}
	return "", fmt.Errorf("not found")
}

func delCache(ctx context.Context, key string) {
	if db.RedisClient != nil {
		db.RedisClient.Del(ctx, key)
	}
	localCache.Delete(key)
}

type CallState struct {
	CallID       string `json:"call_id"`
	CallerID     string `json:"caller_id"`
	CalleeID     string `json:"callee_id"`
	CallType     string `json:"call_type"`
	Status       string `json:"status"`
	CallerName   string `json:"caller_name"`
	CallerAvatar string `json:"caller_avatar"`
	ChatID       string `json:"chat_id"`
}

type InitiateCallReq struct {
	CallID       string `json:"call_id"`
	CallerID     string `json:"caller_id"`
	CalleeID     string `json:"callee_id"`
	CallType     string `json:"call_type"`
	CallerName   string `json:"caller_name"`
	CallerAvatar string `json:"caller_avatar"`
	ChatID       string `json:"chat_id"`
}

type CallActionReq struct {
	CallID string `json:"call_id"`
	UserID string `json:"user_id"`
}

func InitiateCall(c *gin.Context) {
	var req InitiateCallReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	callID := req.CallID
	if callID == "" {
		callID = uuid.New().String()
	}

	val, err := getCache(c.Request.Context(), "call:"+callID)
	if err == nil && strings.Contains(val, "cancelled") {
		c.JSON(http.StatusOK, gin.H{"message": "Call was cancelled before it started"})
		return
	}

	isGroupCall := req.CalleeID == ""
	state := CallState{
		CallID:       callID,
		CallerID:     req.CallerID,
		CalleeID:     req.CalleeID,
		CallType:     req.CallType,
		Status:       "ringing",
		CallerName:   req.CallerName,
		CallerAvatar: req.CallerAvatar,
		ChatID:       req.ChatID,
	}

	stateJSON, _ := json.Marshal(state)

	setCache(c.Request.Context(), "call:"+callID, string(stateJSON), 60*time.Second)
	setCache(c.Request.Context(), "user_status:"+req.CallerID, "busy", 60*time.Second)
	if !isGroupCall {
		setCache(c.Request.Context(), "user_status:"+req.CalleeID, "busy", 60*time.Second)
	}

	var chat models.Chat
	if req.ChatID != "" {
		chatID, _ := bson.ObjectIDFromHex(req.ChatID)
		db.ChatCollection.FindOne(c, bson.M{"_id": chatID}).Decode(&chat)
	}

	var callRecipients []bson.ObjectID
	var chatOID bson.ObjectID
	var caller models.User
	db.UserCollection.FindOne(c, bson.M{"_id": currentUser.ID}).Decode(&caller)

	if isGroupCall {
		chatOID = chat.ID

		var participants []models.User
		cursor, _ := db.UserCollection.Find(c, bson.M{"_id": bson.M{"$in": chat.Participants}})
		cursor.All(c, &participants)

		for _, p := range participants {
			if p.ID.Hex() == req.CallerID {
				continue
			}

			callerBlockedThem := false
			for _, b := range caller.BlockedUsers {
				if b == p.ID {
					callerBlockedThem = true
					break
				}
			}

			theyBlockedCaller := false
			for _, b := range p.BlockedUsers {
				if b == caller.ID {
					theyBlockedCaller = true
					break
				}
			}

			if callerBlockedThem || theyBlockedCaller {
				continue
			}

			callRecipients = append(callRecipients, p.ID)
			utils.Broadcast("user-"+p.ID.Hex(), "incoming_call", map[string]interface{}{
				"call_id":       callID,
				"caller_id":     req.CallerID,
				"call_type":     req.CallType,
				"caller_name":   req.CallerName,
				"caller_avatar": req.CallerAvatar,
				"chat_id":       req.ChatID,
			})
		}
	} else {
		calleeOID, err := bson.ObjectIDFromHex(req.CalleeID)
		if err == nil {
			callRecipients = append(callRecipients, calleeOID)
		}
		if req.ChatID != "" {
			chatOID = chat.ID
		}
		if chat.Status == "pending" {
			utils.Broadcast("user-"+req.CalleeID, "chat-request-received", map[string]interface{}{
				"chatId": req.ChatID,
			})
		} else {
			utils.Broadcast("user-"+req.CalleeID, "incoming_call", map[string]interface{}{
				"call_id":       callID,
				"caller_id":     req.CallerID,
				"call_type":     req.CallType,
				"caller_name":   req.CallerName,
				"caller_avatar": req.CallerAvatar,
				"chat_id":       req.ChatID,
			})
		}
	}

	if len(callRecipients) > 0 {
		var pushCopy services.PushCopy
		category := models.NotifyCall
		dataType := services.PushTypeCall

		if chat.Status == "pending" {
			pushCopy = services.RequestPushCopy(req.CallerName)
			category = models.NotifyRequest
			dataType = services.PushTypeRequest
		} else {
			pushCopy = services.CallPushCopy(req.CallerName, req.CallType)
		}

		data := map[string]string{
			"type":       dataType,
			"callerId":   req.CallerID,
			"callerName": req.CallerName,
			"chatId":     req.ChatID,
		}
		if dataType == services.PushTypeCall {
			data["callId"] = callID
			data["callType"] = req.CallType
		}
		services.SendPushNotification(context.Background(), callRecipients, chatOID, category, pushCopy.Title, pushCopy.Body, data)
	}

	if req.ChatID != "" {
		chatID, err := bson.ObjectIDFromHex(req.ChatID)
		if err == nil {
			callMsg := models.Message{
				ID:              bson.NewObjectID(),
				ChatID:          chatID,
				Sender:          currentUser.ID,
				SenderUsername:  currentUser.Username,
				Text:            fmt.Sprintf("%s started a %s call", currentUser.Username, req.CallType),
				MediaType:       "call",
				MediaPublicID:   callID,
				IsSystemMessage: false,
				Status:          "sent",
				Read:            false,
				ReadBy:          []models.ReadByEntry{},
				DeliveredTo:     []bson.ObjectID{},
				Reactions:       []models.Reaction{},
				DeletedBy:       []bson.ObjectID{},
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}

			_, insertErr := db.MessageCollection.InsertOne(c, callMsg)
			if insertErr == nil {
				db.ChatCollection.UpdateOne(c, bson.M{"_id": chatID}, bson.M{
					"$set": bson.M{
						"lastMessage": callMsg.ID,
						"updatedAt":   time.Now(),
					},
				})

				populatedMsg := gin.H{
					"_id":            callMsg.ID,
					"chatId":         callMsg.ChatID,
					"sender":         gin.H{"_id": currentUser.ID, "username": currentUser.Username, "avatar": currentUser.Avatar},
					"senderUsername": callMsg.SenderUsername,
					"text":           callMsg.Text,
					"mediaType":      callMsg.MediaType,
					"mediaPublicId":  callMsg.MediaPublicID,
					"status":         callMsg.Status,
					"createdAt":      callMsg.CreatedAt.Format(time.RFC3339),
				}
				if chat.Status == "pending" {
					utils.Broadcast("user-"+req.CalleeID, "chat-request-received", gin.H{"chatId": req.ChatID})
					utils.Broadcast("chat-"+req.ChatID, "receive-message", populatedMsg)
				} else {
					utils.Broadcast("chat-"+req.ChatID, "receive-message", populatedMsg)
					utils.Broadcast("user-"+req.CalleeID, "chat-update", gin.H{
						"chatId":      req.ChatID,
						"lastMessage": populatedMsg,
						"unreadCount": 1,
					})
				}
			} else {
				log.Printf("Failed to insert call message: %v\n", insertErr)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Call initiated", "call_id": callID})
}

func AcceptCall(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var req CallActionReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.UserID != currentUser.ID.Hex() {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot perform call actions for another user"})
		return
	}

	val, err := getCache(c.Request.Context(), "call:"+req.CallID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found or expired"})
		return
	}

	var state CallState
	json.Unmarshal([]byte(val), &state)

	state.Status = "active"
	stateJSON, _ := json.Marshal(state)
	setCache(c.Request.Context(), "call:"+req.CallID, string(stateJSON), 2*time.Hour)
	setCache(c.Request.Context(), "user_status:"+state.CallerID, "busy", 2*time.Hour)
	if state.CalleeID != "" {
		setCache(c.Request.Context(), "user_status:"+state.CalleeID, "busy", 2*time.Hour)
	}

	isCaller := req.UserID == state.CallerID

	if !isCaller {
		utils.Broadcast("user-"+state.CallerID, "call_accepted", map[string]interface{}{
			"call_id": req.CallID,
			"user_id": currentUser.ID.Hex(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Call accepted",
	})
}

func RejectCall(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var req CallActionReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.UserID != currentUser.ID.Hex() {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot perform call actions for another user"})
		return
	}

	val, err := getCache(c.Request.Context(), "call:"+req.CallID)
	if err == nil {
		var state CallState
		json.Unmarshal([]byte(val), &state)

		delCache(c.Request.Context(), "user_status:"+state.CallerID)
		delCache(c.Request.Context(), "user_status:"+state.CalleeID)
		delCache(c.Request.Context(), "call:"+req.CallID)

		utils.Broadcast("user-"+state.CallerID, "call_rejected", map[string]interface{}{
			"call_id": req.CallID,
		})

		var msg models.Message
		err = db.MessageCollection.FindOne(c, bson.M{"mediaPublicId": req.CallID, "mediaType": "call"}).Decode(&msg)
		if err == nil {
			db.MessageCollection.UpdateOne(c, bson.M{"_id": msg.ID}, bson.M{
				"$set": bson.M{
					"text":      "Call Ended",
					"updatedAt": time.Now(),
				},
			})
			msg.Text = "Call Ended"
			var sender models.User
			db.UserCollection.FindOne(c, bson.M{"_id": msg.Sender}).Decode(&sender)

			populatedMsg := gin.H{
				"_id":            msg.ID,
				"chatId":         msg.ChatID,
				"sender":         gin.H{"_id": sender.ID, "username": sender.Username, "avatar": sender.Avatar},
				"senderUsername": msg.SenderUsername,
				"text":           msg.Text,
				"mediaType":      msg.MediaType,
				"mediaPublicId":  msg.MediaPublicID,
				"createdAt":      msg.CreatedAt,
				"updatedAt":      time.Now(),
			}
			utils.Broadcast("chat-"+msg.ChatID.Hex(), "message-updated", populatedMsg)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Call rejected"})
}

func EndCall(c *gin.Context) {
	userObj, _ := c.Get("user")
	currentUser := userObj.(models.User)

	var req CallActionReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.UserID != currentUser.ID.Hex() {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot perform call actions for another user"})
		return
	}

	val, err := getCache(c.Request.Context(), "call:"+req.CallID)
	if err == nil {
		var state CallState
		json.Unmarshal([]byte(val), &state)

		delCache(c.Request.Context(), "user_status:"+state.CallerID)
		delCache(c.Request.Context(), "user_status:"+state.CalleeID)
		delCache(c.Request.Context(), "call:"+req.CallID)

		otherUserID := state.CallerID
		if req.UserID == state.CallerID {
			otherUserID = state.CalleeID
		}

		utils.Broadcast("user-"+otherUserID, "call_ended", map[string]interface{}{
			"call_id": req.CallID,
		})

		if state.Status != "active" && req.UserID == state.CallerID && state.CalleeID != "" {
			if calleeOID, err := bson.ObjectIDFromHex(state.CalleeID); err == nil {
				missedCopy := services.MissedCallPushCopy(state.CallerName, state.CallType)
				missedChatOID := bson.NilObjectID
				if state.ChatID != "" {
					if id, err := bson.ObjectIDFromHex(state.ChatID); err == nil {
						missedChatOID = id
					}
				}
				services.SendPushNotification(
					context.Background(),
					[]bson.ObjectID{calleeOID},
					missedChatOID,
					models.NotifyCall,
					missedCopy.Title, missedCopy.Body,
					map[string]string{
						"type":       services.PushTypeMissedCall,
						"callId":     req.CallID,
						"callType":   state.CallType,
						"callerId":   state.CallerID,
						"callerName": state.CallerName,
						"chatId":     state.ChatID,
					},
				)
			}
		}

		var msg models.Message
		err = db.MessageCollection.FindOne(c, bson.M{"mediaPublicId": req.CallID, "mediaType": "call"}).Decode(&msg)
		if err == nil {
			db.MessageCollection.UpdateOne(c, bson.M{"_id": msg.ID}, bson.M{
				"$set": bson.M{
					"text":      "Call Ended",
					"updatedAt": time.Now(),
				},
			})
			msg.Text = "Call Ended"
			var sender models.User
			db.UserCollection.FindOne(c, bson.M{"_id": msg.Sender}).Decode(&sender)

			populatedMsg := gin.H{
				"_id":            msg.ID,
				"chatId":         msg.ChatID,
				"sender":         gin.H{"_id": sender.ID, "username": sender.Username, "avatar": sender.Avatar},
				"senderUsername": msg.SenderUsername,
				"text":           msg.Text,
				"mediaType":      msg.MediaType,
				"mediaPublicId":  msg.MediaPublicID,
				"createdAt":      msg.CreatedAt,
				"updatedAt":      time.Now(),
			}
			utils.Broadcast("chat-"+msg.ChatID.Hex(), "message-updated", populatedMsg)
		}
	} else {
		setCache(c.Request.Context(), "call:"+req.CallID, `{"status": "cancelled"}`, 60*time.Second)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Call ended"})
}

type iceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func fetchMeteredIceServers() ([]iceServer, error) {
	domain := strings.TrimSpace(config.AppConfig.MeteredDomain)
	key := strings.TrimSpace(config.AppConfig.MeteredSecretKey)
	if domain == "" || key == "" {
		return nil, nil
	}

	url := fmt.Sprintf("https://%s/api/v1/turn/credentials?apiKey=%s", domain, key)
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("metered API returned status %d", resp.StatusCode)
	}

	var servers []iceServer
	if err := json.NewDecoder(resp.Body).Decode(&servers); err != nil {
		return nil, err
	}
	return servers, nil
}

func GetIceServers(c *gin.Context) {
	servers := []iceServer{}

	if stun := strings.TrimSpace(config.AppConfig.StunURLs); stun != "" {
		servers = append(servers, iceServer{URLs: splitAndTrim(stun)})
	}

	if metered, err := fetchMeteredIceServers(); err != nil {
		log.Printf("Failed to fetch Metered ICE servers: %v\n", err)
	} else if len(metered) > 0 {
		servers = append(servers, metered...)
	}

	if turn := strings.TrimSpace(config.AppConfig.TurnURLs); turn != "" {
		turnServer := iceServer{URLs: splitAndTrim(turn)}
		if secret := config.AppConfig.TurnSecret; secret != "" {
			userObj, _ := c.Get("user")
			currentUser := userObj.(models.User)
			expiry := time.Now().Add(6 * time.Hour).Unix()
			turnServer.Username = fmt.Sprintf("%d:%s", expiry, currentUser.ID.Hex())
			mac := hmac.New(sha1.New, []byte(secret))
			mac.Write([]byte(turnServer.Username))
			turnServer.Credential = base64.StdEncoding.EncodeToString(mac.Sum(nil))
		} else {
			turnServer.Username = config.AppConfig.TurnUsername
			turnServer.Credential = config.AppConfig.TurnCredential
		}
		servers = append(servers, turnServer)
	}

	c.JSON(http.StatusOK, gin.H{"iceServers": servers})
}
