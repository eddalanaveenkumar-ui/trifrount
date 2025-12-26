package com.example.Triangle;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private int originalOrientation;
    private WebChromeClient webChromeClient;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        final WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        String newUserAgent = settings.getUserAgentString().replace("; wv", "");
        settings.setUserAgentString(newUserAgent);

        webChromeClient = new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    onHideCustomView();
                    return;
                }
                customView = view;
                originalOrientation = getRequestedOrientation();
                customViewCallback = callback;

                FrameLayout decor = (FrameLayout) getWindow().getDecorView();
                decor.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                        View.SYSTEM_UI_FLAG_FULLSCREEN |
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) {
                    return;
                }
                FrameLayout decor = (FrameLayout) getWindow().getDecorView();
                decor.removeView(customView);
                customView = null;
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);

                setRequestedOrientation(originalOrientation);

                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                }
                customViewCallback = null;
            }
        };

        webView.setWebChromeClient(webChromeClient);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            webChromeClient.onHideCustomView();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int action = event.getAction();
        int keyCode = event.getKeyCode();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            if (action == KeyEvent.ACTION_DOWN) {
                getBridge().getWebView().evaluateJavascript("document.dispatchEvent(new CustomEvent('volumeButton', { detail: { direction: 'up', state: 'down' } }));", null);
            } else if (action == KeyEvent.ACTION_UP) {
                getBridge().getWebView().evaluateJavascript("document.dispatchEvent(new CustomEvent('volumeButton', { detail: { direction: 'up', state: 'up' } }));", null);
            }
            // Do NOT return true here. Let the system handle the volume change.
            // We only want to intercept for our long-press logic, but still allow volume control.
            return super.dispatchKeyEvent(event);
        }

        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (action == KeyEvent.ACTION_DOWN) {
                getBridge().getWebView().evaluateJavascript("document.dispatchEvent(new CustomEvent('volumeButton', { detail: { direction: 'down', state: 'down' } }));", null);
            } else if (action == KeyEvent.ACTION_UP) {
                getBridge().getWebView().evaluateJavascript("document.dispatchEvent(new CustomEvent('volumeButton', { detail: { direction: 'down', state: 'up' } }));", null);
            }
            // Do NOT return true here. Let the system handle the volume change.
            return super.dispatchKeyEvent(event);
        }

        return super.dispatchKeyEvent(event);
    }
}
