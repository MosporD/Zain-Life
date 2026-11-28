package com.personal.lifeplanner;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/**
 * Microsoft sign-in helper: window.Capacitor.Plugins.MsAuth.
 * open() shows Microsoft's sign-in page in the phone's browser; when it finishes, Microsoft sends the
 * browser to <app id>://auth?code=..., Android hands that link back to this app and the
 * "redirect" event carries it to JavaScript. request() makes the token and Graph calls from Java,
 * because Microsoft refuses token requests that come from a web page (the WebView sends an Origin).
 */
@CapacitorPlugin(name = "MsAuth")
public class MsAuthPlugin extends Plugin {
    // The link scheme is the app id (com.zainlife.app, or the personal app's own), see AndroidManifest.xml.
    private String scheme() { return getContext().getPackageName(); }

    @Override
    public void load() {
        // The app may have been closed while the browser was open: the link then arrives as the launch intent.
        Intent i = getActivity() == null ? null : getActivity().getIntent();
        if (deliver(i)) getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        deliver(intent);
    }

    private boolean deliver(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u == null || !scheme().equals(u.getScheme()) || !"auth".equals(u.getHost())) return false;
        JSObject d = new JSObject();
        d.put("url", u.toString());
        notifyListeners("redirect", d, true);   // kept until JavaScript is listening
        return true;
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://login.microsoftonline.com/")) { call.reject("Not a Microsoft sign-in address"); return; }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No browser on this phone");
        }
    }

    /** {method, url, headers:{}, body} -> {status, body}. Only Microsoft's sign-in and Graph addresses. */
    @PluginMethod
    public void request(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith("https://login.microsoftonline.com/") && !url.startsWith("https://graph.microsoft.com/")) {
            call.reject("Address not allowed"); return;
        }
        final String method = call.getString("method", "GET");
        final String body = call.getString("body", null);
        final JSObject headers = call.getObject("headers", new JSObject());
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestMethod(method);
                c.setConnectTimeout(15000);
                c.setReadTimeout(20000);
                for (Iterator<String> it = headers.keys(); it.hasNext(); ) { String k = it.next(); c.setRequestProperty(k, headers.getString(k)); }
                if (body != null) {
                    c.setDoOutput(true);
                    try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
                }
                int status = c.getResponseCode();
                InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] b = new byte[8192];
                    for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
                    in.close();
                }
                JSObject res = new JSObject();
                res.put("status", status);
                res.put("body", buf.toString("UTF-8"));
                call.resolve(res);
            } catch (Exception e) {
                call.reject("No connection to Microsoft");
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }
}
