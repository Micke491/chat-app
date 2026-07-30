package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	geminiModel          = "gemini-3.5-flash"
	maxUserMessageRunes  = 4000
	maxTitleRunes        = 60
	geminiRequestTimeout = 60 * time.Second

	maxGeminiRetries = 3
	retryBaseDelay   = 500 * time.Millisecond
	retryMaxDelay    = 4 * time.Second

	maxInlineRequestBytes = 19 * 1024 * 1024
	maxImageBytes         = 8 * 1024 * 1024
	maxVideoBytes         = 15 * 1024 * 1024
	maxAudioBytes         = 12 * 1024 * 1024
	maxThumbnailB64Len = 60 * 1024

	maxMessagesPerChat   = 100
    maxHistoryChars      = 24000
    geminiMaxOutputTokens = 8192
)

var geminiHTTPClient = &http.Client{
	Timeout: geminiRequestTimeout,
}

var allowedImageMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/heic": true,
	"image/heif": true,
}

var allowedVideoMimeTypes = map[string]bool{
	"video/mp4":  true,
	"video/webm": true,
	"video/quicktime": true,
}

var allowedAudioMimeTypes = map[string]bool{
	"audio/webm":  true,
	"audio/ogg":   true,
	"audio/mpeg":  true,
	"audio/mp3":   true,
	"audio/mp4":   true,
	"audio/m4a":   true,
	"audio/x-m4a": true,
	"audio/wav":   true,
	"audio/wave":  true,
	"audio/aac":   true,
}

func isRetryableStatus(code int) bool {
	return code == http.StatusServiceUnavailable || // 503
		code == http.StatusTooManyRequests || // 429
		code == http.StatusInternalServerError || // 500
		code == http.StatusBadGateway || // 502
		code == http.StatusGatewayTimeout // 504
}

func callGeminiWithRetry(ctx context.Context, apiURL string, reqBodyBytes []byte, apiKey string) (*http.Response, error) {
	var lastErr error

	for attempt := 0; attempt <= maxGeminiRetries; attempt++ {
		if attempt > 0 {
			delay := backoffDelay(attempt)
			log.Printf("SendBotMessage: retrying Gemini call (attempt %d/%d) after %v", attempt, maxGeminiRetries, delay)
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(reqBodyBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to build request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("x-goog-api-key", apiKey)

		resp, err := geminiHTTPClient.Do(httpReq)
		if err != nil {
			lastErr = err
			log.Printf("SendBotMessage: Gemini request failed (attempt %d/%d): %v", attempt+1, maxGeminiRetries+1, err)
			continue
		}

		if resp.StatusCode == http.StatusOK || !isRetryableStatus(resp.StatusCode) {
			return resp, nil
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Printf("SendBotMessage: Gemini returned retryable status %d (attempt %d/%d): %s",
			resp.StatusCode, attempt+1, maxGeminiRetries+1, string(respBody))
		lastErr = fmt.Errorf("gemini returned status %d", resp.StatusCode)
	}

	return nil, lastErr
}

func backoffDelay(attempt int) time.Duration {
	delay := retryBaseDelay * time.Duration(1<<uint(attempt-1))
	if delay > retryMaxDelay {
		delay = retryMaxDelay
	}
	jitter := time.Duration(rand.Int63n(int64(delay) / 2))
	return delay/2 + jitter
}

func GetBotChats(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{
		{Key: "pinned", Value: -1},
		{Key: "updatedAt", Value: -1},
	})
	cursor, err := db.BotChatCollection.Find(ctx, bson.M{"userId": authUser.ID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bot chats"})
		return
	}
	defer cursor.Close(ctx)

	var chats []models.BotChat
	if err = cursor.All(ctx, &chats); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode bot chats"})
		return
	}

	if chats == nil {
		chats = []models.BotChat{}
	}

	c.JSON(http.StatusOK, chats)
}

func GetBotChat(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)
	chatIDStr := c.Param("id")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var chat models.BotChat
	err = db.BotChatCollection.FindOne(ctx, bson.M{"_id": chatID, "userId": authUser.ID}).Decode(&chat)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat"})
		return
	}

	c.JSON(http.StatusOK, chat)
}

func CreateBotChat(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)

	var body struct {
		Title string `json:"title"`
	}
	c.ShouldBindJSON(&body)

	title := sanitizeTitle(body.Title)
	if title == "" {
		title = "New AI Chat"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	newChat := models.BotChat{
		ID:        bson.NewObjectID(),
		UserID:    authUser.ID,
		Title:     title,
		Messages:  []models.BotMessage{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.BotChatCollection.InsertOne(ctx, newChat)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create chat"})
		return
	}

	c.JSON(http.StatusCreated, newChat)
}

func DeleteBotChat(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)
	chatIDStr := c.Param("id")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.BotChatCollection.DeleteOne(ctx, bson.M{"_id": chatID, "userId": authUser.ID})
	if err != nil || result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found or failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func RenameBotChat(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)
	chatIDStr := c.Param("id")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	var body struct {
		Title string `json:"title" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	title := sanitizeTitle(body.Title)
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title cannot be empty"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.BotChatCollection.UpdateOne(
		ctx,
		bson.M{"_id": chatID, "userId": authUser.ID},
		bson.M{"$set": bson.M{"title": title, "updatedAt": time.Now()}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename chat"})
		return
	}
	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "title": title})
}

func PinBotChat(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)
	chatIDStr := c.Param("id")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	var body struct {
		Pinned *bool `json:"pinned"`
	}
	c.ShouldBindJSON(&body)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var targetPinned bool
	if body.Pinned != nil {
		targetPinned = *body.Pinned
	} else {
		var existing models.BotChat
		err = db.BotChatCollection.FindOne(ctx, bson.M{"_id": chatID, "userId": authUser.ID}).Decode(&existing)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat"})
			return
		}
		targetPinned = !existing.Pinned
	}

	result, err := db.BotChatCollection.UpdateOne(
		ctx,
		bson.M{"_id": chatID, "userId": authUser.ID},
		bson.M{"$set": bson.M{"pinned": targetPinned}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pin state"})
		return
	}
	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "pinned": targetPinned})
}

type GeminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"` 
}
type GeminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *GeminiInlineData `json:"inline_data,omitempty"`
}
type GeminiContent struct {
	Role  string       `json:"role"`
	Parts []GeminiPart `json:"parts"`
}
type GeminiSysInst struct {
	Parts []GeminiPart `json:"parts"`
}
type GeminiGenConfig struct {
    MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
    Temperature     float64 `json:"temperature,omitempty"`
}
type GeminiRequest struct {
	SystemInstruction *GeminiSysInst  `json:"system_instruction,omitempty"`
	Contents          []GeminiContent `json:"contents"`
	GenerationConfig  *GeminiGenConfig `json:"generationConfig,omitempty"`
}

func getSystemInstruction(persona string) string {
	base := ""
	switch persona {
	case "sarcastic":
		base = "You are a highly sarcastic, witty, and humorous AI. Be playfully mocking, but still give a full, genuinely useful answer — the joke is in the delivery, never an excuse to cut the answer short."
	case "coding":
		base = "You are an expert software engineer. Provide complete, runnable code examples, explain the reasoning and trade-offs behind them, and call out best practices and common pitfalls."
	case "coach":
		base = "You are a motivational professional coach. Be extremely encouraging, structured, goal-oriented, and uplifting, and give concrete actionable steps rather than generic encouragement."
	default:
		base = "You are a helpful, friendly, and knowledgeable AI assistant. Give complete, well-reasoned answers with enough depth and examples that the user does not have to ask a follow-up just to get the rest."
	}

	appContext := fmt.Sprintf(` You are seamlessly integrated into VokiToki, a modern real-time messaging platform. You are powered by the Google %s model.

Here is comprehensive context about the application you are part of:

**App Overview:**
VokiToki is a full-stack chat application built with Next.js 16, React 19, TypeScript, MongoDB, custom WebSockets (real-time events), peer-to-peer WebRTC (voice/video calls), and Cloudinary (media storage). It supports both web and mobile platforms.

**Core Features:**
1. **Real-Time Messaging** — Instant message delivery via Pusher WebSocket channels. Supports one-on-one direct messages and group conversations. Users can edit, delete (for self or everyone), and forward messages. Reply threads with quoted context, message pinning, and emoji reactions are all supported. Delivery and read receipt tracking with per-user granularity. Live typing indicators show when someone is composing a message.
2. **Media Sharing** — Image, video, and audio file uploads stored on Cloudinary with automatic optimization. Inline GIF and sticker pickers powered by Giphy. Voice message recording and playback. Automatic link preview generation with metadata extraction for shared URLs.
3. **Voice & Video Calls** — High-quality voice and video calling powered by the app's own peer-to-peer WebRTC stack with WebSocket signaling. Incoming call notifications with accept/decline handling. Available from any chat conversation.
4. **Stories** — Users can post stories visible to others. Privacy controls include public, followers-only, or private visibility. Stories are accessible from the chat sidebar.
5. **User Profiles** — Customizable avatar, display name, bio, location, gender, and custom links. Follower/following social system with follow requests for private accounts.
6. **Security** — JWT-based session management with bcrypt password hashing. Email-based password reset flow via Brevo SMTP. Two-Factor Authentication (2FA) with authenticator app support. User blocking and reporting system.
7. **Settings & Personalization** — Dark and light themes with system preference detection. Configurable read receipt visibility. Custom chat wallpapers with preset options. Auto-play controls for GIFs and voice messages. AI assistant persona selection (that's you!).
8. **AI Assistant** — That's you! Users can interact with you for help, coding assistance, writing, brainstorming, and app-related questions. You can also see and analyze images and short videos users upload directly in this chat, and you can listen to and understand voice messages/audio clips they send you — transcribe them, answer questions about them, summarize them, etc. Users can choose your persona in Settings > AI Assistant. Available personas: Default (helpful & friendly), Sarcastic (witty & humorous), Coding (expert engineer), Coach (motivational & structured).
9. **Push Notifications** — Firebase Cloud Messaging integration for real-time push notifications on mobile and desktop.

**App Navigation (help users find things):**
- Main chat list: /chat — the central messaging hub where all conversations appear
- Individual chat: /chat/[chatId] — open a specific conversation
- Settings: /settings — manage account, privacy, appearance, connections, AI persona, and danger zone options
- Profile: /profile/[username] — view any user's public profile
- AI Assistant: /bot — this current page where you are chatting
- Stories: accessible from the sidebar in the chat view

**Common Things Users May Ask You About:**
- How to start a voice or video call (open a chat, click the call icons in the header)
- How to create a group chat (click the new chat / compose button, select multiple users)
- How to change theme (Settings > Appearance > select Dark, Light, or System)
- How to enable Two-Factor Authentication (Settings > Privacy & Security > enable 2FA, scan QR with authenticator app)
- How to block or unblock users (go to their profile or Settings > Privacy & Security)
- How to mute a chat (long-press or right-click a chat in the list)
- How to pin messages (long-press or right-click a message inside a chat)
- How to change your AI persona (Settings > AI Assistant > select a persona)
- How to upload or change avatar (Settings > Account > click avatar to upload)
- How to set a chat wallpaper (Settings > Appearance > Wallpaper)
- How to share media (click the attachment/plus icon in the chat input area)
- How to record a voice message (hold the microphone icon in the chat input area, or in this AI chat click the mic icon to record a voice prompt)
- How to use GIFs and stickers (click the GIF/sticker icon in the chat input)
- How to forward a message (long-press or right-click a message > Forward)
- How to search for users (use the search bar in the chat sidebar)

Keep responses helpful, well-structured, and formatted with markdown. Use headings, bold text, bullet points, and code blocks where appropriate for readability.

**Answer length and completeness:**
Match the length of your answer to what was actually asked. A quick factual question deserves a short answer, but an explanation, a how-to, a comparison, or a coding question deserves a thorough one — walk through the reasoning, give examples, and cover the edge cases that matter.

Always finish what you start. Never stop mid-sentence, mid-list, mid-step, or mid-code-block. If a complete answer would be very long, prioritise fully covering the most important part and say what you left out, rather than opening sections you cannot finish. If you promise a list of N things, deliver all N.`, geminiModel)

	return base + appContext
}

func sanitizeTitle(s string) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) <= maxTitleRunes {
		return s
	}
	runes := []rune(s)
	return strings.TrimSpace(string(runes[:maxTitleRunes])) + "…"
}

func trimHistory(msgs []models.BotMessage, maxChars int) []models.BotMessage {
    if len(msgs) == 0 {
        return msgs
    }

    total := 0
    start := len(msgs)
    for i := len(msgs) - 1; i >= 0; i-- {
        total += len(msgs[i].Text)
        if total > maxChars {
            break
        }
        start = i
    }

    trimmed := msgs[start:]

    for len(trimmed) > 0 && trimmed[0].Role != "user" {
        trimmed = trimmed[1:]
    }

    return trimmed
}

type incomingAttachment struct {
	MimeType string `json:"mimeType" binding:"required"`
	Data     string `json:"data" binding:"required"` 
	FileName string `json:"fileName"`
}

func validateAttachment(a incomingAttachment) (attachType string, decoded []byte, err error) {
	mime := strings.ToLower(strings.TrimSpace(a.MimeType))
	// Strip codec parameters e.g. "audio/webm;codecs=opus" -> "audio/webm"
	if idx := strings.Index(mime, ";"); idx != -1 {
		mime = strings.TrimSpace(mime[:idx])
	}

	switch {
	case allowedImageMimeTypes[mime]:
		attachType = "image"
	case allowedVideoMimeTypes[mime]:
		attachType = "video"
	case allowedAudioMimeTypes[mime]:
		attachType = "audio"
	default:
		return "", nil, fmt.Errorf("unsupported file type: %s", a.MimeType)
	}

	decoded, err = base64.StdEncoding.DecodeString(a.Data)
	if err != nil {
		return "", nil, fmt.Errorf("invalid file data encoding")
	}

	if len(decoded) == 0 {
		return "", nil, fmt.Errorf("empty file")
	}

	if attachType == "image" && len(decoded) > maxImageBytes {
		return "", nil, fmt.Errorf("image is too large (max %dMB)", maxImageBytes/(1024*1024))
	}
	if attachType == "video" && len(decoded) > maxVideoBytes {
		return "", nil, fmt.Errorf("video is too large (max %dMB, keep clips short)", maxVideoBytes/(1024*1024))
	}
	if attachType == "audio" && len(decoded) > maxAudioBytes {
		return "", nil, fmt.Errorf("voice message is too large (max %dMB, keep recordings short)", maxAudioBytes/(1024*1024))
	}

	return attachType, decoded, nil
}

func buildThumbnail(attachType string, decoded []byte, mimeType string) string {
	switch attachType {
	case "image":
		resized, err := resizeImageForThumbnail(decoded, mimeType)
		if err != nil {
			log.Printf("SendBotMessage: could not resize image thumbnail (%s), falling back: %v", mimeType, err)
			b64 := base64.StdEncoding.EncodeToString(decoded)
			if len(b64) > maxThumbnailB64Len {
				return ""
			}
			return "data:" + mimeType + ";base64," + b64
		}
		return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(resized)

	case "video":
		return extractVideoFrameThumbnail(decoded, mimeType)

	case "audio":
		// No visual thumbnail for audio; the client renders a waveform/player icon instead.
		return ""

	default:
		return ""
	}
}

func SendBotMessage(c *gin.Context) {
	authUser := c.MustGet("user").(models.User)
	chatIDStr := c.Param("id")

	chatID, err := bson.ObjectIDFromHex(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Chat ID format"})
		return
	}

	var body struct {
		Text        string               `json:"text"`
		Attachments []incomingAttachment `json:"attachments"`
		FromIndex   *int                 `json:"fromIndex"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	userInput := strings.TrimSpace(body.Text)
	hasAttachments := len(body.Attachments) > 0

	if userInput == "" && !hasAttachments {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message text or an attachment is required"})
		return
	}
	if utf8.RuneCountInString(userInput) > maxUserMessageRunes {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Message is too long (max %d characters)", maxUserMessageRunes),
		})
		return
	}
	if len(body.Attachments) > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only one image, video, or voice message can be attached per message"})
		return
	}

	apiKey := config.AppConfig.GeminiAPIKey
	if apiKey == "" {
		log.Println("SendBotMessage: GEMINI_API_KEY is not configured")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service is not configured on the server."})
		return
	}

	reqCtx := c.Request.Context()

	var chat models.BotChat
	err = db.BotChatCollection.FindOne(reqCtx, bson.M{"_id": chatID, "userId": authUser.ID}).Decode(&chat)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat"})
		return
	}

	truncated := false
	if body.FromIndex != nil && *body.FromIndex >= 0 && *body.FromIndex <= len(chat.Messages) {
		chat.Messages = chat.Messages[:*body.FromIndex]
		truncated = true
	}

	isFirstMessage := len(chat.Messages) == 0

	if len(chat.Messages) >= maxMessagesPerChat {
    c.JSON(http.StatusBadRequest, gin.H{
        "error": fmt.Sprintf(
            "This chat has reached the maximum of %d messages. Please start a new chat to continue.",
            maxMessagesPerChat,
        ),
    })
    return
}

	var attachType string
	var attachBytes []byte
	var attachMime string
	var attachFileName string
	var storedAttachments []models.BotAttachment

	if hasAttachments {
		a := body.Attachments[0]
		attachType, attachBytes, err = validateAttachment(a)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		attachMime = strings.ToLower(strings.TrimSpace(a.MimeType))
		if idx := strings.Index(attachMime, ";"); idx != -1 {
			attachMime = strings.TrimSpace(attachMime[:idx])
		}
		attachFileName = a.FileName
		if attachFileName == "" {
			attachFileName = "upload"
		}

		approxB64Len := (len(attachBytes) * 4) / 3
		if approxB64Len+len(userInput) > maxInlineRequestBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File is too large to send to the AI. Please use a smaller file."})
			return
		}

		storedAttachments = []models.BotAttachment{
			{
				Type:         attachType,
				MimeType:     attachMime,
				FileName:     attachFileName,
				ThumbnailB64: buildThumbnail(attachType, attachBytes, attachMime),
			},
		}
	}

	displayText := userInput
	if displayText == "" && hasAttachments {
		switch attachType {
		case "image":
			displayText = "📷 Sent an image"
		case "video":
			displayText = "🎥 Sent a video"
		case "audio":
			displayText = "🎤 Sent a voice message"
		}
	}

	userMsg := models.BotMessage{
		ID:          bson.NewObjectID(),
		Role:        "user",
		Text:        displayText,
		Attachments: storedAttachments,
		CreatedAt:   time.Now(),
	}

	geminiReq := GeminiRequest{
		SystemInstruction: &GeminiSysInst{
			Parts: []GeminiPart{{Text: getSystemInstruction(authUser.BotPersona)}},
		},
		Contents: make([]GeminiContent, 0, len(chat.Messages)+1),
	}

	trimmedMessages := trimHistory(chat.Messages, maxHistoryChars)
	for _, m := range trimmedMessages {
		role := m.Role
		if role == "bot" {
			role = "model"
		}
		geminiReq.Contents = append(geminiReq.Contents, GeminiContent{
			Role:  role,
			Parts: []GeminiPart{{Text: m.Text}},
		})
	}

	geminiReq.GenerationConfig = &GeminiGenConfig{
    MaxOutputTokens: geminiMaxOutputTokens,
    Temperature:     0.7,
}

	currentParts := make([]GeminiPart, 0, 2)
	textForGemini := userInput
	if textForGemini == "" && hasAttachments {
		switch attachType {
		case "audio":
			textForGemini = "Please listen to this voice message and respond to it."
		default:
			textForGemini = "Please analyze this file and describe what you see."
		}
	}
	if textForGemini != "" {
		currentParts = append(currentParts, GeminiPart{Text: textForGemini})
	}
	if hasAttachments {
		currentParts = append(currentParts, GeminiPart{
			InlineData: &GeminiInlineData{
				MimeType: attachMime,
				Data:     base64.StdEncoding.EncodeToString(attachBytes),
			},
		})
	}

	geminiReq.Contents = append(geminiReq.Contents, GeminiContent{
		Role:  "user",
		Parts: currentParts,
	})

	reqBytes, err := json.Marshal(geminiReq)
	if err != nil {
		log.Printf("SendBotMessage: failed to marshal gemini request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build AI request"})
		return
	}

	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse",
		geminiModel,
	)

	resp, err := callGeminiWithRetry(reqCtx, apiURL, reqBytes, apiKey)
	if err != nil {
		log.Printf("SendBotMessage: Gemini call failed after retries: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "The AI provider is temporarily unavailable. Please try again in a moment."})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("SendBotMessage: Gemini returned non-retryable %d: %s", resp.StatusCode, string(respBody))

		if resp.StatusCode == http.StatusBadRequest && hasAttachments {
			c.JSON(http.StatusBadGateway, gin.H{"error": "The AI couldn't process that file. Try a different image/video/audio or format."})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "The AI provider returned an error. Please try again."})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	initData, _ := json.Marshal(map[string]interface{}{
		"type":        "init",
		"userMessage": userMsg,
	})
	fmt.Fprintf(c.Writer, "data: %s\n\n", initData)
	c.Writer.Flush()

	reader := bufio.NewReader(resp.Body)
	var fullBotText strings.Builder
	var finishReason string

	for {
		if reqCtx.Err() != nil {
			break
		}

		line, err := reader.ReadBytes('\n')
		if err != nil {
			break
		}

		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		if !bytes.HasPrefix(line, []byte("data: ")) {
			continue
		}
		dataStr := bytes.TrimPrefix(line, []byte("data: "))

		if string(dataStr) == "[DONE]" {
			continue
		}

		var chunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text    string `json:"text"`
						Thought bool   `json:"thought"`
					} `json:"parts"`
				} `json:"content"`
				FinishReason string `json:"finishReason"`
			} `json:"candidates"`
		}

		if err := json.Unmarshal(dataStr, &chunk); err != nil {
			log.Printf("SendBotMessage: skipping unparsable SSE chunk: %v", err)
			continue
		}
		if len(chunk.Candidates) == 0 {
			continue
		}

		candidate := chunk.Candidates[0]
		if candidate.FinishReason != "" {
			finishReason = candidate.FinishReason
		}

		var textPiece strings.Builder
		for _, part := range candidate.Content.Parts {
			if part.Thought || part.Text == "" {
				continue
			}
			textPiece.WriteString(part.Text)
		}
		if textPiece.Len() == 0 {
			continue
		}

		fullBotText.WriteString(textPiece.String())

		chunkData, _ := json.Marshal(map[string]string{
			"type": "chunk",
			"text": textPiece.String(),
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", chunkData)
		c.Writer.Flush()
	}

	if finishReason == "MAX_TOKENS" {
		log.Printf("SendBotMessage: response hit MAX_TOKENS for chat %s", chatID.Hex())
		notice := "\n\n_(Response reached its length limit — ask me to continue.)_"
		fullBotText.WriteString(notice)
		noticeData, _ := json.Marshal(map[string]string{
			"type": "chunk",
			"text": notice,
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", noticeData)
		c.Writer.Flush()
	}

	botText := fullBotText.String()
	botMsg := models.BotMessage{
		ID:        bson.NewObjectID(),
		Role:      "model",
		Text:      botText,
		CreatedAt: time.Now(),
	}

	dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer dbCancel()

	newMessages := []models.BotMessage{userMsg}
	if botText != "" {
		newMessages = append(newMessages, botMsg)
	}

	var update bson.M
	if truncated {
		update = bson.M{
			"$set": bson.M{
				"updatedAt": time.Now(),
				"messages":  append(append([]models.BotMessage{}, chat.Messages...), newMessages...),
			},
		}
	} else {
		update = bson.M{
			"$set":  bson.M{"updatedAt": time.Now()},
			"$push": bson.M{"messages": bson.M{"$each": newMessages}},
		}
	}

	_, pushErr := db.BotChatCollection.UpdateOne(dbCtx, bson.M{"_id": chatID}, update)
	if pushErr != nil {
		log.Printf("SendBotMessage: failed to persist messages for chat %s: %v", chatID.Hex(), pushErr)

	}

	finalTitle := chat.Title
	if isFirstMessage {
		titleSource := userInput
		if titleSource == "" {
			titleSource = displayText
		}
		finalTitle = sanitizeTitle(titleSource)
		if finalTitle == "" {
			finalTitle = "New AI Chat"
		}

		_, titleErr := db.BotChatCollection.UpdateOne(dbCtx,
			bson.M{"_id": chatID, "title": chat.Title},
			bson.M{"$set": bson.M{"title": finalTitle}},
		)
		if titleErr != nil {
			log.Printf("SendBotMessage: failed to set title for chat %s: %v", chatID.Hex(), titleErr)
		}
	}

	if reqCtx.Err() == nil {
		finalData, _ := json.Marshal(map[string]interface{}{
			"type":       "done",
			"botMessage": botMsg,
			"chatTitle":  finalTitle,
			"model":      geminiModel,
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", finalData)
		c.Writer.Flush()
	}
}
