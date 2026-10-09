package com.nexusnova.app;

import android.content.Context;
import android.content.Intent;
import android.os.Environment;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.Until;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Self-contained Android shell smoke coverage. This intentionally does not
 * require a Firebase account; authentication is not the target of this test.
 */
@RunWith(AndroidJUnit4.class)
public class NovaCutAndroidShellSmokeTest {
    private static final long APP_LAUNCH_TIMEOUT_MS = 45_000L;
    private static final long PICKER_LAUNCH_TIMEOUT_MS = 15_000L;

    @Test
    public void androidShellLaunchesAndNativeVideoPickerOpens() throws Exception {
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Context target = instrumentation.getTargetContext();
        UiDevice device = UiDevice.getInstance(instrumentation);

        Intent launchIntent = target.getPackageManager()
                .getLaunchIntentForPackage(target.getPackageName());
        assertNotNull("NexusNova has no launch intent for the debug QA package.", launchIntent);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        target.startActivity(launchIntent);

        boolean appVisible = device.wait(
                Until.hasObject(By.pkg(target.getPackageName())),
                APP_LAUNCH_TIMEOUT_MS
        );
        assertTrue("NexusNova app shell did not become visible after launch.", appVisible);
        device.waitForIdle(2_000L);
        saveScreenshot(device, target, "novacut-shell-launch.png");

        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("video/*");
        picker.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        target.startActivity(picker);

        boolean documentsUiVisible = device.wait(
                Until.hasObject(By.pkg("com.google.android.documentsui")),
                PICKER_LAUNCH_TIMEOUT_MS
        );
        boolean pickerLabelVisible = device.hasObject(By.text("Recent"))
                || device.hasObject(By.text("Browse"))
                || device.hasObject(By.text("Downloads"));
        assertTrue(
                "Android native video picker did not open. Expected DocumentsUI or a standard picker label.",
                documentsUiVisible || pickerLabelVisible
        );
        device.waitForIdle(1_000L);
        saveScreenshot(device, target, "novacut-native-video-picker.png");
        device.pressBack();
    }

    private static void saveScreenshot(UiDevice device, Context target, String filename) {
        File pictures = target.getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (pictures == null) {
            throw new AssertionError("External Pictures directory is unavailable for QA screenshots.");
        }
        if (!pictures.exists() && !pictures.mkdirs()) {
            throw new AssertionError("Could not create QA screenshot directory: " + pictures);
        }
        File output = new File(pictures, filename);
        if (!device.takeScreenshot(output)) {
            throw new AssertionError("Could not capture QA screenshot: " + output.getName());
        }
    }
}
