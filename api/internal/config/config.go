package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	MongoURI      string
	DBName        string
	JWTSecret     string
	Port          string
	SMTPHost      string
	SMTPPort      string
	SMTPUser      string
	SMTPPass      string
	EmailFrom     string
	RedisURL      string
	RedisToken    string
	CloudinaryURL string
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
	Environment   string
	StunURLs       string
	TurnURLs       string
	TurnUsername   string
	TurnCredential string
	TurnSecret     string
	MeteredDomain    string
	MeteredSecretKey string
	AppURL           string
	GeminiAPIKey     string
}

var AppConfig *Config

func LoadConfig() {
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found, using system environment variables")
    }

	AppConfig = &Config{
		MongoURI:      getEnv("MONGODB_URI", ""),
		DBName:        getEnv("DB_NAME", "chat-app"),
		JWTSecret:     getEnv("JWT_SECRET", ""),
		Port:          getEnv("PORT", "8080"),
		SMTPHost:      getEnv("SMTP_HOST", ""),
		SMTPPort:      getEnv("SMTP_PORT", "587"),
		SMTPUser:      getEnv("SMTP_USER", ""),
		SMTPPass:      getEnv("SMTP_PASS", ""),
		EmailFrom:     getEnv("EMAIL_FROM", ""),
		RedisURL:      getEnv("REDIS_URL", ""),
		RedisToken:    getEnv("REDIS_TOKEN", ""),
		CloudinaryURL: getEnv("CLOUDINARY_URL", ""),
		CloudinaryCloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
		CloudinaryAPIKey:    getEnv("CLOUDINARY_API_KEY", ""),
		CloudinaryAPISecret: getEnv("CLOUDINARY_API_SECRET", ""),
		Environment:   getEnv("APP_ENV", "development"),
		StunURLs:       getEnv("STUN_URLS", "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"),
		TurnURLs:       getEnv("TURN_URLS", ""),
		TurnUsername:   getEnv("TURN_USERNAME", ""),
		TurnCredential: getEnv("TURN_CREDENTIAL", ""),
		TurnSecret:     getEnv("TURN_SECRET", ""),
		MeteredDomain:    getEnv("METERED_DOMAIN", ""),
		MeteredSecretKey: getEnv("METERED_SECRET_KEY", ""),
		AppURL:           getEnv("APP_URL", "https://chat-app-gules-six-81.vercel.app"),
		GeminiAPIKey:     getEnv("GEMINI_API_KEY", ""),
	}

	requiredVars := map[string]string{
        "MONGODB_URI":   AppConfig.MongoURI,
        "JWT_SECRET":    AppConfig.JWTSecret,
		"APP_URL": AppConfig.AppURL,
	}

    for name, value := range requiredVars {
        if value == "" {
            if AppConfig.Environment == "production" {
                log.Fatalf("CRITICAL: Missing required environment variable: %s", name)
            } else {
                log.Printf("WARNING: Missing optional environment variable: %s", name)
            }
        }
    }
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}