import axios from "axios";

const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:5001/api`;

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? fallbackApiUrl : "/api"),
  withCredentials: true,
});
