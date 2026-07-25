package services

import "chat-app/internal/models"

// Push types travel in data["type"]. They are finer-grained than the preference
// category on purpose: a missed call must stay under the user's "calls"
// preference while getting its own quiet channel and no answer buttons.
const (
	PushTypeMessage    = "message"
	PushTypeRequest    = "request"
	PushTypeCall       = "call"
	PushTypeMissedCall = "missed_call"
)

// Android channel ids. These must match the channels created in the app's
// registerPush.ts - a push naming a channel that does not exist is dropped to
// the default channel and loses its importance.
const (
	channelDirect      = "messages_direct"
	channelGroup       = "messages_group"
	channelRequests    = "chat_requests"
	channelCalls       = "calls"
	channelCallsMissed = "calls_missed"
)

// Notification category ids. These must match the categories registered in the
// app's categories.ts; an unregistered id simply yields no action buttons,
// which is the intended outcome for requests and missed calls.
const (
	categoryMessageDirect = "message_direct"
	categoryMessageGroup  = "message_group"
	categoryCallIncoming  = "call_incoming"
)

// channelForPush maps a push onto its Android channel and delivery priority.
// One channel per kind is what lets the system sort them, and lets a user
// silence group chats without losing call alerts.
func channelForPush(category string, data map[string]string) (channelID, priority string) {
	switch category {
	case models.NotifyCall:
		if data["type"] == PushTypeMissedCall {
			// A missed call is a record, not an interruption.
			return channelCallsMissed, "normal"
		}
		return channelCalls, "high"
	case models.NotifyRequest:
		return channelRequests, "high"
	case models.NotifyGroup:
		return channelGroup, "high"
	default:
		return channelDirect, "high"
	}
}

// categoryIDForPush picks the action-button set. It deliberately does not reuse
// the preference category: those are two different axes.
func categoryIDForPush(category string, data map[string]string) string {
	switch category {
	case models.NotifyCall:
		if data["type"] == PushTypeMissedCall {
			return ""
		}
		return categoryCallIncoming
	case models.NotifyGroup:
		return categoryMessageGroup
	case models.NotifyRequest:
		return ""
	default:
		return categoryMessageDirect
	}
}
