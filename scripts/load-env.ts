// Imported first by CLI scripts so DATABASE_URL from .env.local is set
// before anything reads it. The Next.js app loads .env.local on its own.
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
