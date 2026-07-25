package services

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"chat-app/internal/db"
	"chat-app/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

var expoHTTPClient = &http.Client{Timeout: 10 * time.Second}

type expoMessage struct {
	To         string            `json:"to"`
	Title      string            `json:"title"`
	Body       string            `json:"body"`
	Subtitle   string            `json:"subtitle,omitempty"`
	Data       map[string]string `json:"data,omitempty"`
	Sound      string            `json:"sound,omitempty"`
	Badge      *int              `json:"badge,omitempty"`
	ChannelID  string            `json:"channelId,omitempty"`
	CategoryID string            `json:"categoryId,omitempty"`
	Priority   string            `json:"priority,omitempty"`
}

// stackTag builds the value expo-notifications uses as the Android notification
// tag: FirebaseMessagingDelegate reads data["tag"] and falls back to a unique
// message id. Notifications sharing a tag replace each other in the tray, so
// keying it per conversation collapses a burst of messages into one entry per
// chat instead of one row per message, and keeps categories apart. Returns ""
// when there is no stable id, which keeps the default per-message behaviour
// rather than collapsing unrelated notifications onto each other.
func stackTag(category string, data map[string]string) string {
	switch category {
	case models.NotifyCall:
		if id := data["callId"]; id != "" {
			return "call:" + id
		}
	case models.NotifyRequest:
		if id := data["chatId"]; id != "" {
			return "request:" + id
		}
	default:
		if id := data["chatId"]; id != "" {
			return "chat:" + id
		}
	}
	return ""
}

type expoTicketResponse struct {
	Data []struct {
		Status  string `json:"status"`
		ID      string `json:"id"`
		Message string `json:"message"`
		Details struct {
			Error string `json:"error"`
		} `json:"details"`
	} `json:"data"`
}

// SendPushNotification fans a notification out to every device of every
// recipient. It returns immediately: all of its work - preference filtering,
// unread counting, token lookup, HTTP - happens on a background goroutine, so a
// slow push never delays the request that triggered it. Both call sites already
// pass context.Background(), so nothing observes the result.
func SendPushNotification(ctx context.Context, userIDs []bson.ObjectID, chatID bson.ObjectID, category, title, body string, data map[string]string) {
	if len(userIDs) == 0 {
		return
	}

	recipients := append([]bson.ObjectID(nil), userIDs...)
	payload := make(map[string]string, len(data)+2)
	for k, v := range data {
		payload[k] = v
	}

	go deliverPush(recipients, chatID, category, title, body, payload)
}

func deliverPush(userIDs []bson.ObjectID, chatID bson.ObjectID, category, title, body string, data map[string]string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	activeRecipientIDs := filterRecipients(ctx, userIDs, chatID, category)
	if len(activeRecipientIDs) == 0 {
		return
	}

	cursor, err := db.SessionCollection.Find(ctx, bson.M{
		"userId":        bson.M{"$in": activeRecipientIDs},
		"expoPushToken": bson.M{"$exists": true, "$ne": ""},
	})
	if err != nil {
		log.Printf("Failed to query Expo push tokens: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var sessions []models.Session
	if err := cursor.All(ctx, &sessions); err != nil {
		log.Printf("Failed to decode sessions for push: %v", err)
		return
	}
	if len(sessions) == 0 {
		return
	}

	data["category"] = category
	if data["chatId"] == "" && !chatID.IsZero() {
		data["chatId"] = chatID.Hex()
	}
	if data["tag"] == "" {
		if tag := stackTag(category, data); tag != "" {
			data["tag"] = tag
		}
	}

	stats := unreadStats(ctx, activeRecipientIDs, chatID)

	messages, tokens := buildExpoMessages(sessions, stats, category, title, body, data)
	if len(messages) == 0 {
		return
	}

	sendExpoBatches(messages, tokens)
}

// stacksMessages reports whether this kind of push accumulates in the tray. Only
// chat messages do; a call or a request is a single event, and labelling one
// "3 new messages" would be a lie.
func stacksMessages(category string) bool {
	return category == models.NotifyDirect || category == models.NotifyGroup
}

// buildExpoMessages renders one Expo message per device. Title, body and data
// are shared, but the unread subtitle and the icon badge are per recipient -
// which is the whole reason this loop cannot hoist a single payload.
func buildExpoMessages(
	sessions []models.Session,
	stats map[bson.ObjectID]unreadStat,
	category, title, body string,
	data map[string]string,
) ([]expoMessage, []string) {
	channelID, priority := channelForPush(category, data)
	categoryID := categoryIDForPush(category, data)

	messages := make([]expoMessage, 0, len(sessions))
	tokens := make([]string, 0, len(sessions))

	for _, s := range sessions {
		if s.ExpoPushToken == "" {
			continue
		}

		stat := stats[s.UserID]

		subtitle := ""
		if stacksMessages(category) {
			subtitle = unreadSubtitle(stat.InChat)
		}

		var badge *int
		if stat.Total > 0 {
			total := stat.Total
			badge = &total
		}

		messages = append(messages, expoMessage{
			To:         s.ExpoPushToken,
			Title:      title,
			Body:       body,
			Subtitle:   subtitle,
			Data:       data,
			Sound:      "default",
			Badge:      badge,
			ChannelID:  channelID,
			CategoryID: categoryID,
			Priority:   priority,
		})
		tokens = append(tokens, s.ExpoPushToken)
	}

	return messages, tokens
}

func filterRecipients(ctx context.Context, userIDs []bson.ObjectID, chatID bson.ObjectID, category string) []bson.ObjectID {
	userCursor, err := db.UserCollection.Find(ctx, bson.M{"_id": bson.M{"$in": userIDs}})
	if err != nil {
		return userIDs
	}
	var users []models.User
	if err := userCursor.All(ctx, &users); err != nil {
		return userIDs
	}

	var out []bson.ObjectID
	for _, u := range users {
		if !u.NotificationPrefs.Allows(category) {
			continue
		}
		if !chatID.IsZero() {
			muted := false
			for _, mc := range u.MutedChats {
				if mc.ChatID == chatID && mc.MutedUntil.After(time.Now()) {
					muted = true
					break
				}
			}
			if muted {
				continue
			}
		}
		out = append(out, u.ID)
	}
	return out
}

func sendExpoBatches(messages []expoMessage, tokens []string) {
	const batchSize = 100
	for start := 0; start < len(messages); start += batchSize {
		end := start + batchSize
		if end > len(messages) {
			end = len(messages)
		}
		postExpoBatch(messages[start:end], tokens[start:end])
	}
}

func postExpoBatch(batch []expoMessage, tokens []string) {
	payload, err := json.Marshal(batch)
	if err != nil {
		log.Printf("Expo push marshal error: %v", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushEndpoint, bytes.NewReader(payload))
	if err != nil {
		log.Printf("Expo push request error: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := expoHTTPClient.Do(req)
	if err != nil {
		log.Printf("Expo push send error: %v", err)
		return
	}
	defer resp.Body.Close()

	var ticket expoTicketResponse
	if err := json.NewDecoder(resp.Body).Decode(&ticket); err != nil {
		log.Printf("Expo push response decode error: %v", err)
		return
	}

	ok := 0
	for i, t := range ticket.Data {
		if t.Status == "ok" {
			ok++
			continue
		}
		if t.Details.Error == "DeviceNotRegistered" && i < len(tokens) {
			pruneExpoToken(tokens[i])
		}
	}
	log.Printf("Expo push: sent %d/%d", ok, len(batch))
}

func pruneExpoToken(token string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.SessionCollection.UpdateMany(ctx,
		bson.M{"expoPushToken": token},
		bson.M{"$set": bson.M{"expoPushToken": ""}},
	)
	if err != nil {
		log.Printf("Failed to prune Expo token: %v", err)
	}
}
