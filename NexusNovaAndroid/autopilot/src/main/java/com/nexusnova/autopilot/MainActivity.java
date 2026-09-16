package com.nexusnova.autopilot;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import android.util.Base64;

public class MainActivity extends Activity {
    private static final String OWNER = "fahadsoomro123";
    private static final String REPO = "nexusnova-app";
    private static final String WORKFLOW = "nexusnova-autopilot.yml";
    private static final String API = "https://api.github.com";
    private static final String KEY_ALIAS = "nexusnova_autopilot_token";
    private static final String PREFS = "autopilot_secure";
    private static final String PREF_TOKEN = "encrypted_token";
    private static final String PREF_IV = "token_iv";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private EditText tokenInput;
    private EditText missionInput;
    private EditText branchInput;
    private TextView statusView;
    private Button runButton;
    private String activeRunUrl;
    private long dispatchStartedAt;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        if (hasSavedToken()) {
            tokenInput.setHint("GitHub token saved securely");
            tokenInput.setText("");
            setStatus("Ready. Token is stored on this phone.\nPaste a mission and press RUN AUTOPILOT.");
        } else {
            setStatus("First setup: paste a GitHub fine-grained token with Actions: Read/Write for this repository, then press SAVE TOKEN.");
        }
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(20), dp(18), dp(24));
        root.setBackgroundColor(0xFF101014);

        TextView title = text("NEXUSNOVA AUTOPILOT", 24, true);
        root.addView(title, lp(-1, -2));
        TextView subtitle = text("One prompt → execute → build → diagnose → repair → retry → verify", 14, false);
        subtitle.setTextColor(0xFFB8B8C6);
        root.addView(subtitle, lp(-1, -2));

        TextView tokenLabel = label("GitHub token (saved with Android Keystore)");
        root.addView(tokenLabel, lp(-1, -2));
        tokenInput = field("github_pat_...", true);
        root.addView(tokenInput, lp(-1, dp(58)));

        Button save = button("SAVE TOKEN");
        save.setOnClickListener(v -> saveToken());
        root.addView(save, lp(-1, dp(52)));

        TextView missionLabel = label("Mission / Prompt");
        root.addView(missionLabel, lp(-1, -2));
        missionInput = field("Example: Complete NexusNova Android + website end-to-end...", false);
        missionInput.setGravity(Gravity.TOP | Gravity.START);
        missionInput.setMinLines(8);
        missionInput.setPadding(dp(12), dp(12), dp(12), dp(12));
        root.addView(missionInput, lp(-1, dp(190)));

        TextView branchLabel = label("Target branch");
        root.addView(branchLabel, lp(-1, -2));
        branchInput = field("main", false);
        branchInput.setText("main");
        root.addView(branchInput, lp(-1, dp(56)));

        runButton = button("RUN AUTOPILOT");
        runButton.setOnClickListener(v -> dispatchMission());
        root.addView(runButton, lp(-1, dp(58)));

        Button stop = button("STOP POLLING");
        stop.setOnClickListener(v -> setStatus("Polling stopped. The GitHub workflow itself continues running."));
        root.addView(stop, lp(-1, dp(52)));

        statusView = text("", 14, false);
        statusView.setTextColor(0xFFE6E6F0);
        statusView.setPadding(0, dp(18), 0, dp(8));
        root.addView(statusView, lp(-1, -2));

        Button openRun = button("OPEN ACTIVE RUN");
        openRun.setOnClickListener(v -> {
            if (activeRunUrl != null) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(activeRunUrl)));
            else Toast.makeText(this, "No active run URL yet", Toast.LENGTH_SHORT).show();
        });
        root.addView(openRun, lp(-1, dp(50)));

        TextView note = text("Security: the app never stores the token in source code. The token is encrypted with Android Keystore. Use a dedicated fine-grained token and revoke it any time from GitHub.", 12, false);
        note.setTextColor(0xFF8F8F9A);
        root.addView(note, lp(-1, -2));

        scroll.addView(root);
        setContentView(scroll);
    }

    private void saveToken() {
        String token = tokenInput.getText().toString().trim();
        if (token.isEmpty()) { toast("Paste the token first"); return; }
        executor.execute(() -> {
            try {
                encryptAndStore(token);
                main.post(() -> {
                    tokenInput.setText("");
                    tokenInput.setHint("GitHub token saved securely");
                    setStatus("Token saved securely on this device.");
                });
            } catch (Exception e) { main.post(() -> setStatus("Token save failed: " + e.getMessage())); }
        });
    }

    private void dispatchMission() {
        final String mission = missionInput.getText().toString().trim();
        final String branch = branchInput.getText().toString().trim();
        if (mission.isEmpty()) { toast("Mission prompt is required"); return; }
        if (branch.isEmpty()) { toast("Branch is required"); return; }
        runButton.setEnabled(false);
        setStatus("Dispatching NexusNova Autopilot...\nThe phone can stay open or you can leave it; GitHub continues the workflow.");
        dispatchStartedAt = System.currentTimeMillis();
        executor.execute(() -> {
            try {
                String token = loadToken();
                if (token == null || token.isEmpty()) throw new IllegalStateException("No saved GitHub token. Save it first.");
                String body = new JSONObject().put("ref", branch).put("inputs", new JSONObject().put("mission", mission).put("branch", branch)).toString();
                HttpResult r = request("POST", "/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches", token, body);
                if (r.code != 204) throw new IllegalStateException("GitHub dispatch failed (HTTP " + r.code + "): " + r.body);
                main.post(() -> setStatus("Mission accepted by GitHub. Finding the workflow run..."));
                findRun(token, branch, 0);
            } catch (Exception e) {
                main.post(() -> { runButton.setEnabled(true); setStatus("Dispatch error: " + e.getMessage()); });
            }
        });
    }

    private void findRun(String token, String branch, int attempt) {
        executor.execute(() -> {
            try {
                String path = "/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/runs?branch=" + Uri.encode(branch) + "&per_page=10";
                HttpResult r = request("GET", path, token, null);
                if (r.code != 200) throw new IllegalStateException("Run lookup failed (HTTP " + r.code + "): " + r.body);
                JSONArray runs = new JSONObject(r.body).optJSONArray("workflow_runs");
                JSONObject found = null;
                if (runs != null) {
                    for (int i = 0; i < runs.length(); i++) {
                        JSONObject run = runs.getJSONObject(i);
                        long created = parseIso(run.optString("created_at"));
                        if (created >= dispatchStartedAt - 120000L && branch.equals(run.optString("head_branch"))) { found = run; break; }
                    }
                }
                if (found == null) {
                    if (attempt < 10) {
                        main.post(() -> setStatus("Waiting for GitHub to create the run... (" + (attempt + 1) + "/10)"));
                        main.postDelayed(() -> findRun(token, branch, attempt + 1), 2500L);
                    } else {
                        throw new IllegalStateException("Workflow was dispatched, but its run ID could not be located yet.");
                    }
                    return;
                }
                String url = found.optString("html_url", null);
                long id = found.optLong("id", 0L);
                activeRunUrl = url;
                pollRun(token, id, 0);
            } catch (Exception e) {
                main.post(() -> { runButton.setEnabled(true); setStatus("Run lookup error: " + e.getMessage()); });
            }
        });
    }

    private void pollRun(String token, long runId, int attempt) {
        executor.execute(() -> {
            try {
                HttpResult r = request("GET", "/repos/" + OWNER + "/" + REPO + "/actions/runs/" + runId, token, null);
                if (r.code != 200) throw new IllegalStateException("Status lookup failed (HTTP " + r.code + ")");
                JSONObject run = new JSONObject(r.body);
                String status = run.optString("status", "unknown");
                String conclusion = run.optString("conclusion", "");
                String branch = run.optString("head_branch", "");
                String sha = run.optString("head_sha", "");
                String message = "AUTOPILOT STATUS\n\nStatus: " + status + "\nConclusion: " + (conclusion.isEmpty() ? "running" : conclusion) + "\nBranch: " + branch + "\nCommit: " + (sha.length() > 12 ? sha.substring(0, 12) : sha);
                main.post(() -> setStatus(message));
                if (!"completed".equalsIgnoreCase(status) && attempt < 240) {
                    main.postDelayed(() -> pollRun(token, runId, attempt + 1), 5000L);
                } else {
                    main.post(() -> runButton.setEnabled(true));
                    if ("completed".equalsIgnoreCase(status)) main.post(() -> setStatus(message + "\n\nWorkflow finished. Open the run to inspect artifacts/logs if needed."));
                    else main.post(() -> setStatus(message + "\n\nPolling stopped after the mobile safety window. GitHub keeps running the job if it is still active."));
                }
            } catch (Exception e) {
                if (attempt < 20) {
                    main.postDelayed(() -> pollRun(token, runId, attempt + 1), 5000L);
                } else {
                    main.post(() -> { runButton.setEnabled(true); setStatus("Polling error: " + e.getMessage()); });
                }
            }
        });
    }

    private HttpResult request(String method, String path, String token, String body) throws Exception {
        URL url = new URL(API + path);
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        c.setRequestProperty("User-Agent", "NexusNova-Autopilot-Android");
        c.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = c.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        StringBuilder s = new StringBuilder();
        if (in != null) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line; while ((line = br.readLine()) != null) s.append(line);
            }
        }
        c.disconnect();
        return new HttpResult(code, s.toString());
    }

    private boolean hasSavedToken() { return getPrefs().contains(PREF_TOKEN) && getPrefs().contains(PREF_IV); }

    private void encryptAndStore(String token) throws Exception {
        SecretKey key = getOrCreateKey();
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        getPrefs().edit().putString(PREF_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP)).apply();
    }

    private String loadToken() throws Exception {
        String enc = getPrefs().getString(PREF_TOKEN, null);
        String iv64 = getPrefs().getString(PREF_IV, null);
        if (enc == null || iv64 == null) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, Base64.decode(iv64, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(enc, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return kg.generateKey();
    }

    private android.content.SharedPreferences getPrefs() { return getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private long parseIso(String value) { try { return java.time.Instant.parse(value).toEpochMilli(); } catch (Exception ignored) { return 0L; } }
    private void setStatus(String s) { statusView.setText(s); }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
    private int dp(int n) { return (int) (n * getResources().getDisplayMetrics().density + 0.5f); }
    private TextView text(String s, int size, boolean bold) { TextView t = new TextView(this); t.setText(s); t.setTextColor(0xFFF2F2F5); t.setTextSize(size); if (bold) t.setTypeface(null, android.graphics.Typeface.BOLD); return t; }
    private TextView label(String s) { TextView t = text(s, 13, true); t.setTextColor(0xFFC9C9D4); t.setPadding(0, dp(18), 0, dp(7)); return t; }
    private EditText field(String hint, boolean password) { EditText e = new EditText(this); e.setHint(hint); e.setHintTextColor(0xFF777784); e.setTextColor(0xFFF4F4F6); e.setTextSize(15); e.setBackgroundColor(0xFF1B1B22); e.setPadding(dp(12), 0, dp(12), 0); if (password) e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); return e; }
    private Button button(String s) { Button b = new Button(this); b.setText(s); b.setTextSize(13); b.setAllCaps(false); b.setTextColor(0xFFF7F7FA); b.setBackgroundColor(0xFF5E5CE6); return b; }
    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }

    private static final class HttpResult { final int code; final String body; HttpResult(int c, String b) { code = c; body = b; } }
}
