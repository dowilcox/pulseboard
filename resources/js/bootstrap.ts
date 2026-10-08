import { router } from "@inertiajs/react";
import axios from "axios";
window.axios = axios;

window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

// On CSRF token mismatch (419), hard reload to get a fresh token
window.axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 419) {
            window.location.reload();
            return new Promise(() => {});
        }
        return Promise.reject(error);
    },
);

// Inertia visits use their own HTTP client rather than axios, so the
// interceptor above doesn't see them — handle their 419s here too.
router.on("httpException", (event) => {
    if (event.detail.response.status === 419) {
        event.preventDefault();
        window.location.reload();
    }
});
