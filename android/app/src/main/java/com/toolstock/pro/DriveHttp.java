package com.toolstock.pro;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Narrow HTTPS transport for the private Drive sync, independent of WebView origins. */
final class DriveHttp {
    static final int MAX_BYTES = 10 * 1024 * 1024;
    interface ConnectionFactory { HttpURLConnection open(URL url) throws IOException; }
    private final ConnectionFactory connections;
    DriveHttp() { this(url -> (HttpURLConnection) url.openConnection()); }
    DriveHttp(ConnectionFactory connections) { this.connections = connections; }

    static final class Result {
        final int status;
        final String body;
        Result(int status, String body) { this.status = status; this.body = body; }
    }

    Result execute(String address, String method, String token, String contentType, String body) throws IOException {
        URI uri;
        try { uri = URI.create(address); }
        catch (IllegalArgumentException invalid) { throw new SecurityException("Dirección de Drive no válida"); }
        String path = uri.getRawPath();
        boolean read = "GET".equals(method) && path != null && path.matches("/drive/v3/files(?:/[A-Za-z0-9_-]+)?");
        boolean create = "POST".equals(method) && "/upload/drive/v3/files".equals(path);
        boolean update = "PATCH".equals(method) && path != null && path.matches("/upload/drive/v3/files/[A-Za-z0-9_-]+");
        if (!"https".equals(uri.getScheme()) || !"www.googleapis.com".equals(uri.getHost()) ||
                (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawUserInfo() != null ||
                uri.getRawFragment() != null || address.length() > 32768 || !(read || create || update)) {
            throw new SecurityException("Solo se permite la sincronización privada con Google Drive");
        }
        if (token == null || !token.matches("[A-Za-z0-9._~+/-]{1,8192}={0,2}")) {
            throw new SecurityException("Falta una autorización válida de Google Drive");
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IOException("La copia supera el límite de 10 MB");
        if (read && bytes.length != 0) throw new SecurityException("Petición de lectura no válida");
        if (!read && !contentType.matches("application/json(?:; charset=UTF-8)?|multipart/related; boundary=[A-Za-z0-9-]{1,80}")) {
            throw new SecurityException("Formato de copia no válido");
        }
        HttpURLConnection connection = connections.open(uri.toURL());
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/json");
            if (!read) {
                connection.setRequestProperty("Content-Type", contentType);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new SecurityException("Google Drive devolvió una redirección no permitida");
            InputStream source = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (source == null) return new Result(status, "");
            try (InputStream input = source; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (output.size() + count > MAX_BYTES) throw new IOException("La copia de Drive supera el límite de 10 MB");
                    output.write(buffer, 0, count);
                }
                return new Result(status, output.toString(StandardCharsets.UTF_8.name()));
            }
        } finally { connection.disconnect(); }
    }
}
