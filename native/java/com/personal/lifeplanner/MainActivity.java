package com.personal.lifeplanner;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageWatchPlugin.class);   // app-local plugins: must be registered before super.onCreate
        registerPlugin(LifeNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Back button: the app closes the menu or sheet, or returns to the Dashboard; only on the Dashboard does it leave.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) { leave(); return; }
                getBridge().getWebView().evaluateJavascript("(window.__lpBack && window.__lpBack()) || 'exit'", v -> {
                    if (v == null || v.contains("exit")) leave();
                });
            }
            private void leave() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
