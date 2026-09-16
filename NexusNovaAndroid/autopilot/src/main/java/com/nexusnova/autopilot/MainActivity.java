package com.nexusnova.autopilot;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
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
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
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
    private static final String PREF_THEME = "theme";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText tokenInput;
    private EditText missionInput;
    private EditText branchInput;
    private TextView connectionView;
    private TextView statusView;
    private Button runButton;
    private Button connectButton;
    private LinearLayout root;
    private String activeRunUrl;
    private long dispatchStartedAt;

    private boolean darkMode() {
        return getPrefs().getBoolean(PREF_THEME, true);
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        refreshTheme();
        if (hasSavedToken()) {
            tokenInput.setHint("GitHub token saved securely on this device");
            setConnection("GitHub token saved • tap CONNECT / VERIFY to test it");
            setStatus("Ready. Paste your mission and start Autopilot.");
        } else {
            setConnection("Not connected");
            setStatus("First time: connect GitHub, then enter your mission.");
        }
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(26));

        LinearLayout header = row();
        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.HORIZONTAL);
        TextView logo = text("N", 23, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackgroundColor(0xFF1F883D);
        brand.addView(logo, lp(dp(44), dp(44)));
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setPadding(dp(10), 0, 0, 0);
        titles.addView(text("NexusNova", 18, true), lp(-1, -2));
        TextView sub = text("Autopilot", 11, false);
        sub.setTextColor(0xFF1A7F37);
        titles.addView(sub, lp(-1, -2));
        brand.addView(titles, lp(0, -2, 1f));
        Button theme = compactButton("☼");
        theme.setOnClickListener(v -> {
            getPrefs().edit().putBoolean(PREF_THEME, !darkMode()).apply();
            refreshTheme();
        });
        header.addView(brand, lp(0, -2, 1f));
        header.addView(theme, lp(dp(44), dp(44)));
        root.addView(header, lp(-1, -2));

        TextView tagline = text("One prompt. Full execution. Verified results.", 13, false);
        tagline.setPadding(0, dp(8), 0, dp(10));
        tagline.setTextColor(0xFF57606E);
        root.addView(tagline, lp(-1, -2));

        LinearLayout githubCard = card();
        LinearLayout ghTop = row();
        ghTop.addView(text("GitHub Connection", 15, true), lp(0, -2, 1f));
        connectionView = text("Not connected", 11, false);
        ghTop.addView(connectionView, lp(-2, -2));
        githubCard.addView(ghTop, lp(-1, -2));
        TextView ghHint = text("Connect this phone to your NexusNova repository. The token is encrypted with Android Keystore.", 11, false);
        ghHint.setTextColor(0xFF57606E);
        ghHint.setPadding(0, dp(6), 0, dp(10));
        githubCard.addView(ghHint, lp(-1, -2));
        tokenInput = field("github_pat_...", true);
        githubCard.addView(tokenInput, lp(-1, dp(52)));
        connectButton = primaryButton("CONNECT / VERIFY GITHUB");
        connectButton.setOnClickListener(v -> connectGithub());
        githubCard.addView(connectButton, lp(-1, dp(48)));
        root.addView(githubCard, lp(-1, -2));

        LinearLayout repoCard = card();
        repoCard.addView(text("Target repository", 13, true), lp(-1, -2));
        TextView repo = text("● " + OWNER + " / " + REPO, 12, false);
        repo.setPadding(0, dp(7), 0, dp(0));
        repoCard.addView(repo, lp(-1, -2));
        repoCard.addView(text("This secure mobile client is pinned to your configured NexusNova repository.", 10, false), lp(-1, -2));
        root.addView(repoCard, lp(-1, -2));

        TextView missionTitle = text("YOUR MISSION / PROMPT", 12, true);
        missionTitle.setPadding(0, dp(18), 0, dp(7));
        root.addView(missionTitle, lp(-1, -2));
        missionInput = field("Example: Complete NexusNova Android + website end-to-end. Fix every error, test everything, and deliver verified artifacts...", false);
        missionInput.setGravity(Gravity.TOP | Gravity.START);
        missionInput.setPadding(dp(12), dp(12), dp(12), dp(12));
        missionInput.setMinLines(9);
        root.addView(missionInput, lp(-1, dp(205)));
        TextView promptHint = text("Write the whole job once. Autopilot handles plan → code → build → diagnose → repair → retry → verify.", 10, false);
        promptHint.setTextColor(0xFF57606E);
        promptHint.setPadding(0, dp(6), 0, 0);
        root.addView(promptHint, lp(-1, -2));

        TextView branchTitle = text("TARGET BRANCH", 12, true);
        branchTitle.setPadding(0, dp(16), 0, dp(7));
        root.addView(branchTitle, lp(-1, -2));
        branchInput = field("main", false);
        branchInput.setText("main");
        root.addView(branchInput, lp(-1, dp(52)));

        LinearLayout runCard = card();
        TextView mode = text("FULL AUTOPILOT MODE", 11, true);
        mode.setTextColor(0xFF1A7F37);
        runCard.addView(mode, lp(-1, -2));
        runCard.addView(text("Build + fix + test + verify + artifacts", 12, false), lp(-1, -2));
        runButton = primaryButton("🚀  RUN AUTOPILOT");
        runButton.setOnClickListener(v -> dispatchMission());
        LinearLayout.LayoutParams rb = lp(-1, dp(56));
        rb.topMargin = dp(11);
        runCard.addView(runButton, rb);
        root.addView(runCard, lp(-1, -2));

        LinearLayout statusCard = card();
        statusView = text("", 12, false);
        statusView.setTextIsSelectable(true);
        statusCard.addView(text("LIVE STATUS", 11, true), lp(-1, -2));
        statusCard.addView(statusView, lp(-1, -2));
        root.addView(statusCard, lp(-1, -2));

        Button openRun = outlineButton("OPEN ACTIVE RUN");
        openRun.setOnClickListener(v -> {
            if (activeRunUrl != null) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(activeRunUrl)));
            else toast("No active run yet");
        });
        root.addView(openRun, lp(-1, dp(48)));

        TextView security = text("Security: use a dedicated fine-grained GitHub token. It is encrypted locally and never placed in source code. Revoke it from GitHub any time.", 10, false);
        security.setTextColor(0xFF57606E);
        security.setPadding(0, dp(14), 0, 0);
        root.addView(security, lp(-1, -2));

        scroll.addView(root);
        setContentView(scroll);
    }

    private void refreshTheme() {
        int bg = darkMode() ? 0xFF0D1117 : 0xFFFFFFFF;
        int fg = darkMode() ? 0xFFC9D1D9 : 0xFF1F2328;
        int muted = darkMode() ? 0xFF8B949E : 0xFF59636E;
        int panel = darkMode() ? 0xFF161B22 : 0xFFF6F8FA;
        int border = darkMode() ? 0xFF30363D : 0xFFD0D7DE;
        root.setBackgroundColor(bg);
        applyColors(root, fg, muted, panel, border);
        if (connectionView != null) connectionView.setTextColor(darkMode() ? 0xFF3FB950 : 0xFF1A7F37);
    }

    private void applyColors(android.view.View view, int fg, int muted, int panel, int border) {
        if (view instanceof TextView) {
            TextView t = (TextView) view;
            String s = String.valueOf(t.getText());
            if (!s.contains("Not connected") && !s.contains("Ready. Token") && !s.contains("GitHub token saved")) {
                if (t.getCurrentTextColor() != 0xFF1A7F37 && t.getCurrentTextColor() != 0xFF1F883D) t.setTextColor(fg);
            }
        }
        if (view instanceof EditText) {
            EditText e = (EditText) view;
            e.setTextColor(fg);
            e.setHintTextColor(muted);
            e.setBackgroundColor(panel);
        }
        if (view instanceof Button) {
            Button b = (Button) view;
            b.setTextColor(fg);
        }
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup g = (android.view.ViewGroup) view;
            for (int i = 0; i < g.getChildCount(); i++) applyColors(g.getChildAt(i), fg, muted, panel, border);
        }
    }

    private void connectGithub() {
        final String typed = tokenInput.getText().toString().trim();
        setStatus("Verifying GitHub connection...");
        executor.execute(() -> {
            try {
                String token = typed.isEmpty() ? loadToken() : typed;
                if (token == null || token.isEmpty()) throw new IllegalStateException("Paste a GitHub token first.");
                HttpResult user = request("GET", "/user", token, null);
                if (user.code != 200) throw new IllegalStateException("GitHub rejected the token (HTTP " + user.code + ").");
                JSONObject u = new JSONObject(user.body);
                String login = u.optString("login", "GitHub user");
                HttpResult repo = request("GET", "/repos/" + OWNER + "/" + REPO, token, null);
                if (repo.code != 200) throw new IllegalStateException("Repository access failed (HTTP " + repo.code + ").");
                if (!typed.isEmpty()) encryptAndStore(typed);
                main.post(() -> {
                    tokenInput.setText("");
                    tokenInput.setHint("Connected securely • token saved");
                    setConnection("Connected • @" + login + " • repository OK");
                    setStatus("GitHub connected successfully. Your phone can now dispatch Autopilot missions.");
                });
            } catch (Exception e) {
                main.post(() -> { setConnection("Connection failed"); setStatus("GitHub connection error: " + e.getMessage()); });
            }
        });
    }

    private void dispatchMission() {
        final String mission = missionInput.getText().toString().trim();
        final String branch = branchInput.getText().toString().trim();
        if (mission.isEmpty()) { toast("Mission prompt is required"); return; }
        if (branch.isEmpty()) { toast("Target branch is required"); return; }
        runButton.setEnabled(false);
        setStatus("Dispatching NexusNova Autopilot...\nGitHub will continue the workflow even if you leave this screen.");
        dispatchStartedAt = System.currentTimeMillis();
        executor.execute(() -> {
            try {
                String token = loadToken();
                if (token == null || token.isEmpty()) throw new IllegalStateException("Connect GitHub first.");
                String body = new JSONObject()
                        .put("ref", branch)
                        .put("inputs", new JSONObject().put("mission", mission).put("branch", branch))
                        .toString();
                HttpResult r = request("POST", "/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches", token, body);
                if (r.code != 204) throw new IllegalStateException("Workflow dispatch failed (HTTP " + r.code + "): " + r.body);
                main.post(() -> setStatus("Mission accepted by GitHub. Locating the workflow run..."));
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
                if (r.code != 200) throw new IllegalStateException("Run lookup failed (HTTP " + r.code + ")");
                JSONArray runs = new JSONObject(r.body).optJSONArray("workflow_runs");
                JSONObject found = null;
                if (runs != null) {
                    for (int i = 0; i < runs.length(); i++) {
                        JSONObject candidate = runs.getJSONObject(i);
                        long created = parseIso(candidate.optString("created_at"));
                        if (created >= dispatchStartedAt - 120000L && branch.equals(candidate.optString("head_branch"))) {
                            found = candidate;
                            break;
                        }
                    }
                }
                if (found == null) {
                    if (attempt < 12) {
                        main.post(() -> setStatus("Waiting for GitHub to create the run... (" + (attempt + 1) + "/12)"));
                        main.postDelayed(() -> findRun(token, branch, attempt + 1), 2500L);
                    } else {
                        throw new IllegalStateException("Workflow dispatched, but the run is not visible yet.");
                    }
                    return;
                }
                activeRunUrl = found.optString("html_url", null);
                long id = found.optLong("id", 0L);
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
                String message = "Status: " + status + "\nConclusion: " + (conclusion.isEmpty() ? "running" : conclusion)
                        + "\nBranch: " + branch + "\nCommit: " + (sha.length() > 12 ? sha.substring(0, 12) : sha);
                main.post(() -> setStatus(message));
                if (!"completed".equalsIgnoreCase(status) && attempt < 240) {
                    main.postDelayed(() -> pollRun(token, runId, attempt + 1), 5000L);
                } else {
                    main.post(() -> runButton.setEnabled(true));
                    if ("completed".equalsIgnoreCase(status)) {
                        main.post(() -> setStatus(message + "\n\nWorkflow finished. Open Active Run for logs/artifacts."));
                    } else {
                        main.post(() -> setStatus(message + "\n\nMobile polling window ended; GitHub may still be running the workflow."));
                    }
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
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
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
                String line;
                while ((line = br.readLine()) != null) s.append(line);
            }
        }
        c.disconnect();
        return new HttpResult(code, s.toString());
    }

    private boolean hasSavedToken() {
        return getPrefs().contains(PREF_TOKEN) && getPrefs().contains(PREF_IV);
    }

    private void encryptAndStore(String token) throws Exception {
        SecretKey key = getOrCreateKey();
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        getPrefs().edit()
                .putString(PREF_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .apply();
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
        if (ks.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return kg.generateKey();
    }

    private SharedPreferences getPrefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private long parseIso(String value) {
        try { return Instant.parse(value).toEpochMilli(); }
        catch (Exception ignored) { return 0L; }
    }

    private void setConnection(String s) { connectionView.setText(s); }
    private void setStatus(String s) { statusView.setText(s); }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
    private int dp(int n) { return (int) (n * getResources().getDisplayMetrics().density + 0.5f); }

    private TextView text(String s, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTypeface(null, bold ? Typeface.BOLD : Typeface.NORMAL);
        return t;
    }

    private EditText field(String hint, boolean password) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setTextSize(14);
        e.setSingleLine(password);
        e.setInputType(password ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        e.setPadding(dp(12), 0, dp(12), 0);
        return e;
    }

    private Button primaryButton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(13);
        b.setTypeface(null, Typeface.BOLD);
        b.setTextColor(0xFFFFFFFF);
        b.setBackgroundColor(0xFF1F883D);
        return b;
    }

    private Button outlineButton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(12);
        return b;
    }

    private Button compactButton(String s) {
        Button b = outlineButton(s);
        b.setTextSize(18);
        return b;
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        c.setBackgroundColor(darkMode() ? 0xFF161B22 : 0xFFF6F8FA);
        LinearLayout.LayoutParams p = lp(-1, -2);
        p.bottomMargin = dp(10);
        return c;
    }

    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        return r;
    }

    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    private LinearLayout.LayoutParams lp(int w, int h, float weight) { return new LinearLayout.LayoutParams(w, h, weight); }

    private static final class HttpResult {
        final int code;
        final String body;
        HttpResult(int code, String body) { this.code = code; this.body = body; }
    }

    @Override protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
