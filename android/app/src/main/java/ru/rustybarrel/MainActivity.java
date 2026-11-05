package ru.rustybarrel;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.os.VibrationEffect;
import android.speech.tts.TextToSpeech;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

/**
 * Тонкая Android-обёртка. Вся игра — в assets/game.
 * Важно: здесь нет анонимных и нестатических внутренних классов —
 * d8 из build-tools 34 падает на них, собранных javac 24.
 */
public class MainActivity extends Activity {

    private WebView web;
    private TextToSpeech tts;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(true);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);

        web.setWebViewClient(new GameWebViewClient());
        web.setWebChromeClient(new GameChromeClient());
        web.addJavascriptInterface(new AndroidHost(this), "AndroidHost");

        setContentView(web);
        hideSystemUI();

        tts = new TextToSpeech(this, new TtsInit(this));
        String debug = getIntent().getStringExtra("debug");
        String url = "file:///android_asset/game/index.html";
        if (debug != null) debug = debug.replace(',', '&');
        if (debug != null && debug.length() > 0) url += "?" + debug;
        web.loadUrl(url);
    }

    private void hideSystemUI() {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                getWindow().setDecorFitsSystemWindows(false);
                WindowInsetsController c = getWindow().getDecorView().getWindowInsetsController();
                if (c != null) {
                    c.hide(WindowInsets.Type.systemBars());
                    c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    return;
                }
            }
        } catch (Exception ignored) {
            // ниже — резервный путь для прошивок, где контроллер ещё не готов
        }
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(window.androidBackPressed ? window.androidBackPressed() : 'exit')",
                new BackCallback(this));
    }

    void handleBackResult(String value) {
        if (value != null && value.contains("exit")) {
            finish();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideSystemUI();
    }

    void speakText(String text) {
        if (tts == null || text == null || text.trim().isEmpty()) return;
        runOnUiThread(new SpeakTask(this, text));
    }

    void stopSpeech() {
        runOnUiThread(new StopSpeechTask(this));
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        if (web != null) {
            web.removeJavascriptInterface("AndroidHost");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /* ---------- вспомогательные статические классы ---------- */

    private static class TtsInit implements TextToSpeech.OnInitListener {
        private final MainActivity activity;

        TtsInit(MainActivity activity) { this.activity = activity; }

        @Override
        public void onInit(int status) {
            Log.i("RBJS", "TTS init status=" + status);
            if (status == TextToSpeech.SUCCESS && activity.tts != null) {
                activity.tts.setLanguage(new Locale("ru", "RU"));
                activity.tts.setPitch(0.82f);
                activity.tts.setSpeechRate(0.92f);
            }
        }
    }

    private static class SpeakTask implements Runnable {
        private final MainActivity activity;
        private final String text;

        SpeakTask(MainActivity activity, String text) {
            this.activity = activity;
            this.text = text;
        }

        @Override
        public void run() {
            if (activity.tts == null) return;
            try {
                activity.tts.stop();
                activity.tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rustybarrel");
            } catch (Exception ignored) {}
        }
    }

    private static class StopSpeechTask implements Runnable {
        private final MainActivity activity;

        StopSpeechTask(MainActivity activity) { this.activity = activity; }

        @Override
        public void run() {
            if (activity.tts != null) {
                try { activity.tts.stop(); } catch (Exception ignored) {}
            }
        }
    }

    private static class GameWebViewClient extends WebViewClient {
    }

    private static class GameChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.e("RBJS", m.message() + " @" + m.lineNumber());
            return true;
        }
    }

    private static class BackCallback implements ValueCallback<String> {
        private final MainActivity activity;

        BackCallback(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        public void onReceiveValue(final String value) {
            activity.runOnUiThread(new FinishTask(activity, value));
        }
    }

    private static class FinishTask implements Runnable {
        private final MainActivity activity;
        private final String value;

        FinishTask(MainActivity activity, String value) {
            this.activity = activity;
            this.value = value;
        }

        @Override
        public void run() {
            activity.handleBackResult(value);
        }
    }

    /** Мост для вибрации и выхода из игры. */
    public static class AndroidHost {

        private final MainActivity activity;

        public AndroidHost(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                ms = Math.max(10, Math.min(ms, 600));
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(ms);
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void exitApp() {
            activity.runOnUiThread(new FinishTask(activity, "exit"));
        }

        @JavascriptInterface
        public void speak(String text) {
            activity.speakText(text);
        }

        @JavascriptInterface
        public void stopSpeaking() {
            activity.stopSpeech();
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }
}
