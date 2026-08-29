// Central axios instance. withCredentials is required because auth is a
// httpOnly session cookie set by the backend after Google OAuth — without
// this, the browser won't send that cookie on cross-origin requests to the
// API server (localhost:4000 vs localhost:3000 in dev).

import axios from "axios";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// Centralized 401 handling: if the session has expired/is invalid, bounce to
// the login page rather than leaving the UI stuck on a failed request.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
