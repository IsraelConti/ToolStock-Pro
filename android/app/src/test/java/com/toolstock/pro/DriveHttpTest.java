package com.toolstock.pro;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

public class DriveHttpTest {
    private static final String API = "https://www.googleapis.com/drive/v3/files";
    private static final String UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
    private static final String TYPE = "multipart/related; boundary=toolstock-test";
    private static final class FakeConnection extends HttpURLConnection {
        final ByteArrayOutputStream sent = new ByteArrayOutputStream();
        int code = 200;
        byte[] reply = "{\"files\":[]}".getBytes(StandardCharsets.UTF_8);
        boolean disconnected;
        FakeConnection(URL url) { super(url); }
        @Override public void setRequestMethod(String value) { method = value; }
        @Override public void connect() {}
        @Override public boolean usingProxy() { return false; }
        @Override public void disconnect() { disconnected = true; }
        @Override public int getResponseCode() { return code; }
        @Override public OutputStream getOutputStream() { return sent; }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(reply); }
        @Override public InputStream getErrorStream() { return new ByteArrayInputStream(reply); }
    }

    @Test public void readsDriveAndSendsAuthorizationWithoutRedirects() throws Exception {
        FakeConnection connection = new FakeConnection(new URL(API));
        DriveHttp.Result result = new DriveHttp(url -> connection).execute(API + "?spaces=appDataFolder", "GET", "test-token", "", "");
        assertEquals(200, result.status);
        assertEquals("{\"files\":[]}", result.body);
        assertEquals("Bearer test-token", connection.getRequestProperty("Authorization"));
        assertFalse(connection.getInstanceFollowRedirects());
        assertEquals(15000, connection.getConnectTimeout());
        assertEquals(30000, connection.getReadTimeout());
        assertTrue(connection.disconnected);
    }

    @Test public void createsAndUpdatesMultipartUsingUtf8() throws Exception {
        for (String method : new String[]{"POST", "PATCH"}) {
            String address = UPLOAD + (method.equals("PATCH") ? "/abc_123-xyz" : "") + "?uploadType=multipart";
            FakeConnection connection = new FakeConnection(new URL(address));
            String body = "--toolstock-test\r\n{\"name\":\"Piñón\"}\r\n--toolstock-test--\r\n";
            new DriveHttp(url -> connection).execute(address, method, "test-token", TYPE, body);
            assertEquals(method, connection.getRequestMethod());
            assertEquals(body, connection.sent.toString("UTF-8"));
            assertEquals(TYPE, connection.getRequestProperty("Content-Type"));
        }
    }

    @Test public void preservesHttpErrorsAndRejectsRedirects() throws Exception {
        FakeConnection connection = new FakeConnection(new URL(API));
        connection.code = 401;
        connection.reply = "{\"error\":{\"message\":\"Expired authorization\"}}".getBytes(StandardCharsets.UTF_8);
        DriveHttp transport = new DriveHttp(url -> connection);
        assertEquals(401, transport.execute(API, "GET", "test-token", "", "").status);
        connection.code = 302;
        assertThrows(SecurityException.class, () -> transport.execute(API, "GET", "test-token", "", ""));
        assertTrue(connection.disconnected);
    }

    @Test public void rejectsOtherHostsPathsMethodsAndHeaderInjectionBeforeOpeningConnection() {
        AtomicInteger opened = new AtomicInteger();
        DriveHttp transport = new DriveHttp(url -> { opened.incrementAndGet(); throw new IOException(); });
        for (String url : new String[]{
                "http://www.googleapis.com/drive/v3/files", "https://example.com/drive/v3/files",
                "https://www.googleapis.com.evil.test/drive/v3/files", "https://user@www.googleapis.com/drive/v3/files",
                "https://www.googleapis.com:444/drive/v3/files", API + "#fragment",
                "https://www.googleapis.com/drive/v3/files/../other", "https://www.googleapis.com/drive/v3/files/%2e%2e",
                "https://www.googleapis.com/oauth2/v1/userinfo"}) {
            assertThrows(url, SecurityException.class, () -> transport.execute(url, "GET", "test-token", "", ""));
        }
        assertThrows(SecurityException.class, () -> transport.execute(API, "DELETE", "test-token", "", ""));
        assertThrows(SecurityException.class, () -> transport.execute(API, "GET", "test-token\r\nInjected: bad", "", ""));
        assertThrows(SecurityException.class, () -> transport.execute(API, "GET", "", "", ""));
        assertThrows(SecurityException.class, () -> transport.execute(UPLOAD, "POST", "test-token", "text/html", "data"));
        assertThrows(SecurityException.class, () -> transport.execute(API, "GET", "test-token", "", "body"));
        assertEquals(0, opened.get());
    }

    @Test public void boundsUploadAndDownloadSizes() throws Exception {
        FakeConnection connection = new FakeConnection(new URL(API));
        DriveHttp transport = new DriveHttp(url -> connection);
        String large = new String(new char[DriveHttp.MAX_BYTES + 1]).replace('\0', 'x');
        assertThrows(IOException.class, () -> transport.execute(UPLOAD, "POST", "test-token", TYPE, large));
        connection.reply = large.getBytes(StandardCharsets.UTF_8);
        assertThrows(IOException.class, () -> transport.execute(API, "GET", "test-token", "", ""));
        assertTrue(connection.disconnected);
    }
}
