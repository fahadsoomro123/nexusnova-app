package com.nexusnova.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Tiny permission bridge used only when Nova Drive smart tracking is armed.
 * Android 10+ requires runtime Activity Recognition permission for reliable
 * walking / bicycle / in-vehicle classification.
 */
class NexusDrivePermissionActivity : AppCompatActivity() {

    private val recognitionPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        runCatching {
            startService(
                Intent(this, NexusDriveForegroundService::class.java)
                    .setAction(NexusDriveForegroundService.ACTION_STATUS)
            )
        }
        finish()
        overridePendingTransition(0, 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(0, 0)

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        ) {
            finish()
            overridePendingTransition(0, 0)
            return
        }

        recognitionPermission.launch(Manifest.permission.ACTIVITY_RECOGNITION)
    }
}
