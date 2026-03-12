(function initApiBaseUrl() {
    const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const isFile = window.location.protocol === "file:";
    const isLocal = isLocalHost || isFile;
    window.API_BASE_URL = window.API_BASE_URL || (isLocal
        ? "http://localhost:5000"
        : "https://grocery-xsrl.onrender.com");
})();
