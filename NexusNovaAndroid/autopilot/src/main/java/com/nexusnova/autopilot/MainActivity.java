package com.nexusnova.autopilot;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.speech.RecognizerIntent;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
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
import java.util.ArrayList;
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
    private static final String PREF_HISTORY = "mission_history";

    // GitHub Primer-inspired palette: same semantic colors in light/dark modes.
    private static final int GH_DARK_BG = 0xFF0D1117;
    private static final int GH_DARK_PANEL = 0xFF161B22;
    private static final int GH_DARK_BORDER = 0xFF30363D;
    private static final int GH_DARK_TEXT = 0xFFC9D1D9;
    private static final int GH_DARK_MUTED = 0xFF8B949E;
    private static final int GH_DARK_GREEN = 0xFF3FB950;
    private static final int GH_GREEN = 0xFF1F883D;
    private static final int GH_LIGHT_BG = 0xFFFFFFFF;
    private static final int GH_LIGHT_PANEL = 0xFFF6F8FA;
    private static final int GH_LIGHT_BORDER = 0xFFD0D7DE;
    private static final int GH_LIGHT_TEXT = 0xFF1F2328;
    private static final int GH_LIGHT_MUTED = 0xFF59636E;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText tokenInput;
    private EditText missionInput;
    private EditText branchInput;
    private TextView connectionView;
    private TextView statusView;
    private TextView historyView;
    private TextView runMetaView;
    private Button runButton;
    private LinearLayout root;
    private String activeRunUrl;
    private long activeRunId;
    private long dispatchStartedAt;

    private static final int REQUEST_VOICE = 4107;

    private boolean darkMode() {
        return getPrefs().getBoolean(PREF_THEME, true);
    }

    private int textColor() { return darkMode() ? GH_DARK_TEXT : GH_LIGHT_TEXT; }
    private int mutedColor() { return darkMode() ? GH_DARK_MUTED : GH_LIGHT_MUTED; }
    private int panelColor() { return darkMode() ? GH_DARK_PANEL : GH_LIGHT_PANEL; }
    private int borderColor() { return darkMode() ? GH_DARK_BORDER : GH_LIGHT_BORDER; }
    private int accentColor() { return darkMode() ? GH_DARK_GREEN : GH_GREEN; }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
        refreshTheme();
        restoreState();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(darkMode() ? GH_DARK_BG : GH_LIGHT_BG);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(28));
        scroll.addView(root);

        root.addView(buildHeader(), lp(-1, -2));
        root.addView(buildConnectionCard(), lp(-1, -2));
        root.addView(buildMissionCard(), lp(-1, -2));
        root.addView(buildEngineCard(), lp(-1, -2));
        root.addView(buildStatusCard(), lp(-1, -2));
        root.addView(buildHistoryCard(), lp(-1, -2));
        root.addView(buildToolsCard(), lp(-1, -2));
        root.addView(buildSecurityNote(), lp(-1, -2));

        setContentView(scroll);
    }

    private View buildHeader() {
        LinearLayout header = row();
        LinearLayout brand = row();
        TextView logo = text("N", 23, true);
        logo.setGravity(Gravity.CENTER);
        logo.setTextColor(0xFFFFFFFF);
        logo.setBackgroundColor(accentColor());
        brand.addView(logo, lp(dp(44), dp(44)));

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setPadding(dp(10), 0, 0, 0);
        titles.addView(text("NexusNova", 18, true), lp(-1, -2));
        TextView sub = text("Autopilot", 11, false);
        sub.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        titles.addView(sub, lp(-1, -2));
        brand.addView(titles, lp(0, -2, 1f));
        header.addView(brand, lp(0, -2, 1f));

        Button theme = compactButton(darkMode() ? "☀" : "☾");
        theme.setOnClickListener(v -> {
            getPrefs().edit().putBoolean(PREF_THEME, !darkMode()).apply();
            rebuild();
        });
        header.addView(theme, lp(dp(44), dp(44)));

        return header;
    }

    private View buildConnectionCard() {
        LinearLayout card = card();
        LinearLayout top = row();
        top.addView(text("GitHub Connection", 14, true), lp(0, -2, 1f));
        connectionView = text("Checking…", 10, false);
        top.addView(connectionView, lp(-2, -2));
        card.addView(top, lp(-1, -2));

        TextView repo = text("● " + OWNER + " / " + REPO, 12, false);
        repo.setPadding(0, dp(7), 0, dp(6));
        card.addView(repo, lp(-1, -2));

        tokenInput = field("github_pat_…", true);
        card.addView(tokenInput, lp(-1, dp(52)));

        LinearLayout actions = row();
        Button connect = primaryButton("CONNECT / VERIFY");
        connect.setOnClickListener(v -> connectGithub());
        actions.addView(connect, lp(0, dp(48), 1f));
        Button clear = outlineButton("CLEAR");
        clear.setOnClickListener(v -> {
            getPrefs().edit().remove(PREF_TOKEN).remove(PREF_IV).apply();
            tokenInput.setText("");
            setConnection("Not connected");
            setStatus("GitHub token removed from this device.");
        });
        LinearLayout.LayoutParams cp = lp(0, dp(48), 0.45f);
        cp.leftMargin = dp(8);
        actions.addView(clear, cp);
        card.addView(actions, lp(-1, -2));
        return card;
    }

    private View buildMissionCard() {
        LinearLayout card = card();
        TextView title = text("YOUR MISSION / PROMPT", 12, true);
        title.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        card.addView(title, lp(-1, -2));

        TextView hint = text("Write the whole job once. Autopilot plans, executes, repairs and verifies.", 10, false);
        hint.setTextColor(mutedColor());
        hint.setPadding(0, dp(4), 0, dp(7));
        card.addView(hint, lp(-1, -2));

        missionInput = field("Example: Complete NexusNova Android + website end-to-end…", false);
        missionInput.setGravity(Gravity.TOP | Gravity.START);
        missionInput.setPadding(dp(12), dp(12), dp(12), dp(12));
        missionInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        card.addView(missionInput, lp(-1, dp(184)));

        LinearLayout voiceRow = row();
        Button voice = outlineButton("🎙  VOICE");
        voice.setOnClickListener(v -> startVoiceInput());
        voiceRow.addView(voice, lp(0, dp(44), 0.42f));
        Button templates = outlineButton("⚡  TEMPLATES");
        templates.setOnClickListener(v -> showTemplates());
        LinearLayout.LayoutParams tp = lp(0, dp(44), 0.58f);
        tp.leftMargin = dp(8);
        voiceRow.addView(templates, tp);
        LinearLayout.LayoutParams vr = lp(-1, -2);
        vr.topMargin = dp(9);
        card.addView(voiceRow, vr);

        TextView branchTitle = text("TARGET BRANCH", 10, true);
        branchTitle.setTextColor(mutedColor());
        branchTitle.setPadding(0, dp(13), 0, dp(5));
        card.addView(branchTitle, lp(-1, -2));
        branchInput = field("main", false);
        branchInput.setText("main");
        card.addView(branchInput, lp(-1, dp(50)));

        LinearLayout execution = row();
        TextView mode = text("FULL AUTOPILOT", 11, true);
        mode.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        execution.addView(mode, lp(0, -2, 1f));
        TextView modeHint = text("Build • Fix • Test • Verify", 10, false);
        modeHint.setTextColor(mutedColor());
        execution.addView(modeHint, lp(-2, -2));
        LinearLayout.LayoutParams ep = lp(-1, -2);
        ep.topMargin = dp(12);
        card.addView(execution, ep);

        runButton = primaryButton("🚀  RUN AUTOPILOT");
        runButton.setOnClickListener(v -> dispatchMission());
        LinearLayout.LayoutParams rb = lp(-1, dp(56));
        rb.topMargin = dp(10);
        card.addView(runButton, rb);
        return card;
    }

    private View buildEngineCard() {
        LinearLayout card = card();
        LinearLayout top = row();
        top.addView(text("Autonomous Engine", 14, true), lp(0, -2, 1f));
        TextView active = text("● ACTIVE", 10, false);
        active.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        top.addView(active, lp(-2, -2));
        card.addView(top, lp(-1, -2));

        addStep(card, "✓", "Understand mission", "Repository-aware planning");
        addStep(card, "✓", "Repair failures", "Root-cause analysis + alternative fixes");
        addStep(card, "✓", "Verify delivery", "Tests + build + artifact verification");
        addStep(card, "✓", "Remember context", "Mission history and previous outcomes");
        return card;
    }

    private View buildStatusCard() {
        LinearLayout card = card();
        LinearLayout top = row();
        top.addView(text("LIVE STATUS", 12, true), lp(0, -2, 1f));
        runMetaView = text("IDLE", 9, false);
        runMetaView.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        top.addView(runMetaView, lp(-2, -2));
        card.addView(top, lp(-1, -2));
        statusView = text("", 11, false);
        statusView.setTextIsSelectable(true);
        statusView.setPadding(0, dp(8), 0, 0);
        card.addView(statusView, lp(-1, -2));

        LinearLayout actions = row();
        Button open = outlineButton("OPEN RUN");
        open.setOnClickListener(v -> openActiveRun());
        actions.addView(open, lp(0, dp(45), 1f));
        Button artifacts = outlineButton("ARTIFACTS");
        artifacts.setOnClickListener(v -> loadArtifacts());
        LinearLayout.LayoutParams ap = lp(0, dp(45), 1f);
        ap.leftMargin = dp(8);
        actions.addView(artifacts, ap);
        LinearLayout.LayoutParams actp = lp(-1, -2);
        actp.topMargin = dp(9);
        card.addView(actions, actp);
        return card;
    }

    private View buildHistoryCard() {
        LinearLayout card = card();
        LinearLayout top = row();
        top.addView(text("Mission Memory", 14, true), lp(0, -2, 1f));
        Button clear = compactButton("CLEAR");
        clear.setOnClickListener(v -> {
            getPrefs().edit().remove(PREF_HISTORY).apply();
            refreshHistory();
        });
        top.addView(clear, lp(dp(78), dp(38)));
        card.addView(top, lp(-1, -2));
        historyView = text("No missions yet.", 10, false);
        historyView.setTextColor(mutedColor());
        historyView.setPadding(0, dp(8), 0, 0);
        card.addView(historyView, lp(-1, -2));
        return card;
    }

    private View buildToolsCard() {
        LinearLayout card = card();
        card.addView(text("TOOLS", 12, true), lp(-1, -2));
        addTool(card, "🔄", "Refresh current run", "Re-check GitHub now", this::refreshActiveRun);
        addTool(card, "🌐", "Open repository", "Open nexusnova-app on GitHub", () -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/" + OWNER + "/" + REPO))));
        addTool(card, "🔐", "GitHub security", "Token is encrypted locally", () -> setStatus("Token protection: Android Keystore + AES-GCM.\nNever put tokens into mission prompts or source code."));
        return card;
    }

    private View buildSecurityNote() {
        TextView note = text("Security: use a dedicated fine-grained GitHub token with only the permissions this workflow needs. Never paste passwords, signing keys, recovery codes or other secrets into a mission.", 10, false);
        note.setTextColor(mutedColor());
        note.setPadding(0, dp(15), 0, 0);
        return note;
    }

    private void addStep(LinearLayout parent, String icon, String title, String subtitle) {
        LinearLayout r = row();
        TextView dot = text(icon, 12, true);
        dot.setTextColor(darkMode() ? GH_DARK_GREEN : GH_GREEN);
        r.addView(dot, lp(dp(24), -2));
        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.addView(text(title, 11, true), lp(-1, -2));
        TextView s = text(subtitle, 9, false);
        s.setTextColor(mutedColor());
        texts.addView(s, lp(-1, -2));
        r.addView(texts, lp(0, -2, 1f));
        LinearLayout.LayoutParams p = lp(-1, -2);
        p.topMargin = dp(8);
        parent.addView(r, p);
    }

    private void addTool(LinearLayout parent, String icon, String title, String subtitle, Runnable action) {
        LinearLayout r = row();
        TextView i = text(icon, 16, false);
        r.addView(i, lp(dp(30), -2));
        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.addView(text(title, 11, true), lp(-1, -2));
        TextView s = text(subtitle, 9, false);
        s.setTextColor(mutedColor());
        texts.addView(s, lp(-1, -2));
        r.addView(texts, lp(0, -2, 1f));
        Button go = compactButton("›");
        go.setOnClickListener(v -> action.run());
        r.addView(go, lp(dp(38), dp(38)));
        LinearLayout.LayoutParams p = lp(-1, -2);
        p.topMargin = dp(7);
        parent.addView(r, p);
    }

    private void restoreState() {
        if (hasSavedToken()) {
            tokenInput.setHint("GitHub token saved securely on this device");
            setConnection("Connected locally");
            setStatus("Ready. Your GitHub connection is saved. Paste a mission and press RUN AUTOPILOT.");
        } else {
            setConnection("Not connected");
            setStatus("First setup: paste your GitHub fine-grained token and press CONNECT / VERIFY.");
        }
        refreshHistory();
    }

    private void rebuild() {
        buildUi();
        refreshTheme();
        restoreState();
    }

    private void refreshTheme() {
        root.setBackgroundColor(darkMode() ? GH_DARK_BG : GH_LIGHT_BG);
        applyColors(root);
    }

    private void applyColors(View view) {
        int fg = textColor();
        int muted = mutedColor();
        int panel = panelColor();
        if (view instanceof EditText) {
            EditText e = (EditText) view;
            e.setTextColor(fg);
            e.setHintTextColor(muted);
            e.setBackground(background(panel, borderColor(), 8, 1));
        } else if (view instanceof Button) {
            Button b = (Button) view;
            if (isPrimaryButton(b)) {
                b.setTextColor(Color.WHITE);
                b.setBackground(background(accentColor(), accentColor(), 8, 0));
            } else {
                b.setTextColor(fg);
                b.setBackground(background(panel, borderColor(), 8, 1));
            }
        } else if (view instanceof TextView) {
            TextView t = (TextView) view;
            int current = t.getCurrentTextColor();
            if (current == 0 || current == 0xFF000000 || current == 0xFFFFFFFF) t.setTextColor(fg);
        }
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup g = (android.view.ViewGroup) view;
            for (int i = 0; i < g.getChildCount(); i++) applyColors(g.getChildAt(i));
        }
    }

    private boolean isPrimaryButton(Button b) {
        String s = b.getText() == null ? "" : b.getText().toString();
        return s.contains("RUN") || s.contains("CONNECT");
    }

    private GradientDrawable background(int fill, int stroke, int radiusDp, int strokeDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0) d.setStroke(dp(strokeDp), stroke);
        return d;
    }

    private void connectGithub() {
        final String typed = tokenInput.getText().toString().trim();
        setStatus("Verifying GitHub connection…");
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
                    setStatus("GitHub connected successfully. Your phone can now launch Autopilot missions.");
                });
            } catch (Exception e) {
                main.post(() -> { setConnection("Connection failed"); setStatus("GitHub connection error: " + safeMessage(e)); });
            }
        });
    }

    private void dispatchMission() {
        final String mission = missionInput.getText().toString().trim();
        final String branch = branchInput.getText().toString().trim();
        if (mission.isEmpty()) { toast("Mission prompt is required"); return; }
        if (branch.isEmpty()) { toast("Target branch is required"); return; }
        runButton.setEnabled(false);
        runMetaView.setText("STARTING");
        setStatus("Dispatching NexusNova Autopilot…\nGitHub will continue the workflow even if you leave the app.");
        dispatchStartedAt = System.currentTimeMillis();
        addHistory("STARTED", mission, branch);
        executor.execute(() -> {
            try {
                String token = loadToken();
                if (token == null || token.isEmpty()) throw new IllegalStateException("Connect GitHub first.");
                String body = new JSONObject().put("ref", branch).put("inputs", new JSONObject().put("mission", mission).put("branch", branch)).toString();
                HttpResult r = request("POST", "/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches", token, body);
                if (r.code != 204) throw new IllegalStateException("Workflow dispatch failed (HTTP " + r.code + "): " + r.body);
                main.post(() -> setStatus("Mission accepted by GitHub. Locating the live run…"));
                findRun(token, branch, 0);
            } catch (Exception e) {
                main.post(() -> { runButton.setEnabled(true); runMetaView.setText("ERROR"); setStatus("Dispatch error: " + safeMessage(e)); addHistory("ERROR", mission, branch); });
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
                        if (created >= dispatchStartedAt - 120000L && branch.equals(candidate.optString("head_branch"))) { found = candidate; break; }
                    }
                }
                if (found == null) {
                    if (attempt < 12) {
                        main.post(() -> setStatus("Waiting for GitHub to create the live run… (" + (attempt + 1) + "/12)"));
                        main.postDelayed(() -> findRun(token, branch, attempt + 1), 2500L);
                    } else throw new IllegalStateException("Workflow dispatched, but the run is not visible yet.");
                    return;
                }
                activeRunUrl = found.optString("html_url", null);
                activeRunId = found.optLong("id", 0L);
                pollRun(token, activeRunId, 0);
            } catch (Exception e) {
                main.post(() -> { runButton.setEnabled(true); runMetaView.setText("ERROR"); setStatus("Run lookup error: " + safeMessage(e)); });
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
                        + "\nBranch: " + branch + "\nCommit: " + (sha.length() > 12 ? sha.substring(0, 12) : sha)
                        + "\nRun ID: " + runId;
                main.post(() -> { setStatus(message); runMetaView.setText(status.toUpperCase()); });
                if (!"completed".equalsIgnoreCase(status) && attempt < 240) {
                    main.postDelayed(() -> pollRun(token, runId, attempt + 1), 5000L);
                } else {
                    main.post(() -> runButton.setEnabled(true));
                    if ("completed".equalsIgnoreCase(status)) {
                        String finalMessage = message + "\n\nWorkflow finished. Open RUN or ARTIFACTS for the final result.";
                        main.post(() -> { setStatus(finalMessage); addHistory(conclusion.toUpperCase(), "Run #" + runId, branch); });
                    } else {
                        main.post(() -> setStatus(message + "\n\nMobile polling window ended; GitHub may still be running the workflow."));
                    }
                }
            } catch (Exception e) {
                if (attempt < 20) main.postDelayed(() -> pollRun(token, runId, attempt + 1), 5000L);
                else main.post(() -> { runButton.setEnabled(true); setStatus("Polling error: " + safeMessage(e)); });
            }
        });
    }

    private void refreshActiveRun() {
        if (activeRunId <= 0) { setStatus("No active run yet."); return; }
        executor.execute(() -> {
            try {
                String token = loadToken();
                HttpResult r = request("GET", "/repos/" + OWNER + "/" + REPO + "/actions/runs/" + activeRunId, token, null);
                if (r.code != 200) throw new IllegalStateException("Refresh failed (HTTP " + r.code + ")");
                JSONObject run = new JSONObject(r.body);
                String status = run.optString("status", "unknown");
                String conclusion = run.optString("conclusion", "");
                main.post(() -> { runMetaView.setText(status.toUpperCase()); setStatus("Status: " + status + "\nConclusion: " + (conclusion.isEmpty() ? "running" : conclusion) + "\nRun ID: " + activeRunId); });
            } catch (Exception e) { main.post(() -> setStatus("Refresh error: " + safeMessage(e))); }
        });
    }

    private void loadArtifacts() {
        if (activeRunId <= 0) { setStatus("No completed/current run selected yet."); return; }
        executor.execute(() -> {
            try {
                String token = loadToken();
                HttpResult r = request("GET", "/repos/" + OWNER + "/" + REPO + "/actions/runs/" + activeRunId + "/artifacts?per_page=50", token, null);
                if (r.code != 200) throw new IllegalStateException("Artifact lookup failed (HTTP " + r.code + ")");
                JSONArray a = new JSONObject(r.body).optJSONArray("artifacts");
                StringBuilder out = new StringBuilder("ARTIFACT CENTER\n\n");
                if (a == null || a.length() == 0) out.append("No artifacts reported for this run yet.");
                else for (int i = 0; i < a.length(); i++) {
                    JSONObject x = a.getJSONObject(i);
                    out.append("• ").append(x.optString("name", "artifact"))
                       .append("\n  Size: ").append(x.optLong("size_in_bytes", 0L)).append(" bytes")
                       .append("\n  Status: ").append(x.optBoolean("expired", false) ? "expired" : "available").append("\n\n");
                }
                main.post(() -> setStatus(out.toString()));
            } catch (Exception e) { main.post(() -> setStatus("Artifact error: " + safeMessage(e))); }
        });
    }

    private void openActiveRun() {
        if (activeRunUrl == null) { toast("No active run URL yet"); return; }
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(activeRunUrl)));
    }

    private void startVoiceInput() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Tell NexusNova what to do…");
        try { startActivityForResult(intent, REQUEST_VOICE); }
        catch (Exception e) { toast("Voice input is not available on this device."); }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_VOICE && resultCode == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                String old = missionInput.getText().toString().trim();
                missionInput.setText(old.isEmpty() ? results.get(0) : old + "\n\n" + results.get(0));
            }
        }
    }

    private void showTemplates() {
        final String[] names = {"🐛 Fix Build", "📱 Android Release", "🌐 Website", "🔍 Full Audit", "✨ Complete Feature", "🛠 Debug Everything"};
        final String[] prompts = {
                "Inspect the repository, diagnose the failing Android build, fix the root cause, rebuild, run verification and deliver the verified APK.",
                "Prepare a production-ready Android release. Fix all build/test issues, verify signing/package/version, and produce the final APK/AAB artifacts.",
                "Audit the NexusNova website, implement missing pieces, fix build/deployment errors, run tests and verify the final web artifact.",
                "Perform a full repository audit. Identify unfinished or broken functionality, implement necessary fixes, run all relevant tests and verify the result.",
                "Implement the requested feature end-to-end, integrate it cleanly with the existing architecture, test it and repair any failures automatically.",
                "Find and fix the current project's important errors and regressions. Use root-cause analysis, alternative fixes when needed, and verify everything before finishing."
        };
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        for (int i = 0; i < names.length; i++) {
            final int ix = i;
            Button b = outlineButton(names[i]);
            b.setOnClickListener(v -> { missionInput.setText(prompts[ix]); missionInput.setSelection(missionInput.length()); });
            list.addView(b, lp(-1, dp(44)));
            if (i < names.length - 1) ((LinearLayout.LayoutParams)b.getLayoutParams()).bottomMargin = dp(6);
        }
        showPanel("MISSION TEMPLATES", list);
    }

    private void showPanel(String title, View content) {
        android.app.AlertDialog dialog = new android.app.AlertDialog.Builder(this)
                .setTitle(title)
                .setView(content)
                .setNegativeButton("Close", null)
                .create();
        dialog.show();
    }

    private void addHistory(String outcome, String mission, String branch) {
        try {
            String raw = getPrefs().getString(PREF_HISTORY, "[]");
            JSONArray arr = new JSONArray(raw);
            JSONObject item = new JSONObject();
            item.put("outcome", outcome);
            item.put("mission", mission.length() > 130 ? mission.substring(0, 130) + "…" : mission);
            item.put("branch", branch);
            item.put("time", System.currentTimeMillis());
            JSONArray next = new JSONArray();
            next.put(item);
            for (int i = 0; i < Math.min(arr.length(), 9); i++) next.put(arr.getJSONObject(i));
            getPrefs().edit().putString(PREF_HISTORY, next.toString()).apply();
            main.post(this::refreshHistory);
        } catch (Exception ignored) { }
    }

    private void refreshHistory() {
        if (historyView == null) return;
        try {
            JSONArray arr = new JSONArray(getPrefs().getString(PREF_HISTORY, "[]"));
            if (arr.length() == 0) { historyView.setText("No missions yet."); return; }
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject x = arr.getJSONObject(i);
                s.append("• ").append(x.optString("outcome", "UNKNOWN"))
                 .append(" — ").append(x.optString("mission", "Mission"))
                 .append("\n  ").append(x.optString("branch", "main"));
                if (i < arr.length() - 1) s.append("\n\n");
            }
            historyView.setText(s.toString());
        } catch (Exception e) { historyView.setText("Mission history unavailable."); }
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
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return kg.generateKey();
    }

    private SharedPreferences getPrefs() { return getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private long parseIso(String value) { try { return Instant.parse(value).toEpochMilli(); } catch (Exception ignored) { return 0L; } }
    private void setConnection(String s) { if (connectionView != null) connectionView.setText(s); }
    private void setStatus(String s) { if (statusView != null) statusView.setText(s); }
    private String safeMessage(Exception e) { String s = e.getMessage(); return s == null || s.isEmpty() ? e.getClass().getSimpleName() : s; }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
    private int dp(int n) { return (int) (n * getResources().getDisplayMetrics().density + 0.5f); }

    private TextView text(String s, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        t.setTextColor(textColor());
        return t;
    }

    private EditText field(String hint, boolean password) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setTextSize(14);
        e.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        e.setSingleLine(password);
        e.setInputType(password ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        e.setPadding(dp(12), 0, dp(12), 0);
        e.setTextColor(textColor());
        e.setHintTextColor(mutedColor());
        e.setBackground(background(panelColor(), borderColor(), 8, 1));
        return e;
    }

    private Button primaryButton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(13);
        b.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        b.setTextColor(Color.WHITE);
        b.setMinHeight(dp(44));
        b.setPadding(dp(14), 0, dp(14), 0);
        b.setBackground(background(accentColor(), accentColor(), 8, 0));
        return b;
    }

    private Button outlineButton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(11);
        b.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        b.setMinHeight(dp(42));
        b.setPadding(dp(12), 0, dp(12), 0);
        b.setTextColor(textColor());
        b.setBackground(background(panelColor(), borderColor(), 8, 1));
        return b;
    }

    private Button compactButton(String s) {
        Button b = outlineButton(s);
        b.setTextSize(11);
        return b;
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        c.setBackground(background(panelColor(), borderColor(), 8, 1));
        LinearLayout.LayoutParams p = lp(-1, -2);
        p.bottomMargin = dp(10);
        c.setLayoutParams(p);
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
