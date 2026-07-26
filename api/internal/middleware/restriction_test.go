package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"chat-app/internal/models"

	"github.com/gin-gonic/gin"
)

func runRequireActive(t *testing.T, user models.User) (int, map[string]any) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/chat/message", nil)
	c.Set("user", user)

	reached := false
	RequireActive()(c)
	if !c.IsAborted() {
		reached = true
		w.WriteHeader(200)
	}

	body := map[string]any{}
	if w.Body.Len() > 0 {
		json.Unmarshal(w.Body.Bytes(), &body)
	}
	body["reached"] = reached
	return w.Code, body
}

func TestActiveUserPassesThrough(t *testing.T) {
	code, body := runRequireActive(t, models.User{Username: "ok"})
	if code != 200 || body["reached"] != true {
		t.Fatalf("active user was blocked: %d %v", code, body)
	}
}

func TestBannedUserIsBlocked(t *testing.T) {
	code, body := runRequireActive(t, models.User{Username: "bad", IsBanned: true})
	if code != 403 || body["banned"] != true {
		t.Fatalf("expected a 403 ban, got %d %v", code, body)
	}
}

func TestTimedOutUserIsBlocked(t *testing.T) {
	until := time.Now().Add(time.Hour)
	code, body := runRequireActive(t, models.User{Username: "quiet", TimeoutUntil: &until})
	if code != 403 || body["restricted"] != true {
		t.Fatalf("expected a 403 restriction, got %d %v", code, body)
	}
	if body["timeoutUntil"] == nil {
		t.Fatal("clients need timeoutUntil to show how long the restriction lasts")
	}
}

// A timeout that has run out must stop blocking on its own, even if nothing has
// cleared the field in the database yet.
func TestExpiredTimeoutPassesThrough(t *testing.T) {
	until := time.Now().Add(-time.Minute)
	code, body := runRequireActive(t, models.User{Username: "served", TimeoutUntil: &until})
	if code != 200 || body["reached"] != true {
		t.Fatalf("expired timeout still blocking: %d %v", code, body)
	}
}
