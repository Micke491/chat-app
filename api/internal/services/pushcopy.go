package services

import (
	"fmt"
	"strings"
)

// PushCopy is the user-visible text of one push notification. Subtitle maps to
// Android's setSubText - the small line above the title - and is empty for
// anything that is not a stacked conversation.
type PushCopy struct {
	Title    string
	Body     string
	Subtitle string
}

// mediaLabel mirrors getMessageContent in the app's MessageBubble.tsx so the
// tray, the chat list and the bubble never disagree about what an attachment is
// called.
func mediaLabel(mediaType string) string {
	switch mediaType {
	case "":
		return ""
	case "image":
		return "Photo"
	case "video":
		return "Video"
	case "audio":
		return "Voice message"
	case "gif":
		return "GIF"
	case "sticker":
		return "Sticker"
	case "call":
		return "Call"
	default:
		return "Attachment"
	}
}

// unreadSubtitle is empty for a single message: repeating "1 new message" next
// to the message itself is noise. It only earns its line once messages stack.
func unreadSubtitle(n int) string {
	if n <= 1 {
		return ""
	}
	return fmt.Sprintf("%d new messages", n)
}

func messagePreview(text, mediaType string) string {
	if t := strings.TrimSpace(text); t != "" {
		return t
	}
	if label := mediaLabel(mediaType); label != "" {
		return label
	}
	return "New message"
}

// MessagePushCopy renders a chat message the way WhatsApp does: in a group the
// title is the group and the sender moves into the body, so a glance at the
// tray answers "which conversation" before "who".
func MessagePushCopy(senderName, groupName, text, mediaType string, isGroup bool, unreadInChat int) PushCopy {
	preview := messagePreview(text, mediaType)
	subtitle := unreadSubtitle(unreadInChat)

	if isGroup && strings.TrimSpace(groupName) != "" {
		return PushCopy{
			Title:    groupName,
			Body:     senderName + ": " + preview,
			Subtitle: subtitle,
		}
	}

	// An unnamed group, and every direct chat, is titled by the sender.
	return PushCopy{
		Title:    senderName,
		Body:     preview,
		Subtitle: subtitle,
	}
}

func RequestPushCopy(senderName string) PushCopy {
	return PushCopy{
		Title: "Chat request",
		Body:  senderName + " wants to chat",
	}
}

func callTypeLabel(callType string) string {
	if callType == "video" {
		return "video"
	}
	return "voice"
}

func CallPushCopy(callerName, callType string) PushCopy {
	return PushCopy{
		Title: callerName,
		Body:  fmt.Sprintf("Incoming %s call", callTypeLabel(callType)),
	}
}

func MissedCallPushCopy(callerName, callType string) PushCopy {
	return PushCopy{
		Title: "Missed call",
		Body:  fmt.Sprintf("%s · %s call", callerName, callTypeLabel(callType)),
	}
}
