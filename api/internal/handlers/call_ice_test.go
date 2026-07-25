package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"chat-app/internal/config"

	"github.com/gin-gonic/gin"
)

type iceBody struct {
	IceServers []iceServer `json:"iceServers"`
	HasRelay   bool        `json:"hasRelay"`
}

func iceResponse(t *testing.T) iceBody {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/call/ice-servers", nil)

	GetIceServers(c)

	var body iceBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("bad json: %v (%s)", err, w.Body.String())
	}
	return body
}

// Regression: a STUN-only config cannot traverse carrier-grade NAT, so callers
// must be told there is no relay rather than being left on "connecting".
func TestStunOnlyIsReportedAsRelayless(t *testing.T) {
	config.AppConfig = &config.Config{StunURLs: "stun:stun.l.google.com:19302"}
	body := iceResponse(t)

	if body.HasRelay {
		t.Fatalf("STUN-only config must not claim a relay: %+v", body)
	}
}

func TestFallbackRelayUsedWhenPrimaryMissing(t *testing.T) {
	config.AppConfig = &config.Config{
		StunURLs:               "stun:stun.l.google.com:19302",
		FallbackTurnURLs:       "turn:relay.example:3478,turns:relay.example:5349",
		FallbackTurnUsername:   "u",
		FallbackTurnCredential: "p",
	}
	body := iceResponse(t)

	if !body.HasRelay {
		t.Fatalf("fallback relay not applied: %+v", body)
	}
	for _, s := range body.IceServers {
		for _, u := range s.URLs {
			if strings.HasPrefix(u, "turn") && s.Username == "" {
				t.Fatalf("relay %q has no credentials", u)
			}
		}
	}
}

func TestConfiguredTurnSuppressesFallback(t *testing.T) {
	config.AppConfig = &config.Config{
		TurnURLs:               "turn:my.turn.example:3478",
		TurnUsername:           "u",
		TurnCredential:         "p",
		FallbackTurnURLs:       "turn:relay.example:3478",
		FallbackTurnUsername:   "fb",
		FallbackTurnCredential: "fb",
	}
	body := iceResponse(t)

	for _, s := range body.IceServers {
		for _, u := range s.URLs {
			if strings.Contains(u, "relay.example") {
				t.Fatalf("fallback used despite configured TURN: %+v", body)
			}
		}
	}
	if !body.HasRelay {
		t.Fatal("configured relay missing")
	}
}
