package com.nexusnova.app

import android.app.role.RoleManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class CallerSetupActivity : AppCompatActivity() {

    private val roleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        val ok = hasRole()
        Toast.makeText(
            this,
            if (ok) "Caller ID enabled ✓" else "Caller ID not enabled yet",
            Toast.LENGTH_LONG
        ).show()
        if (ok) finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_caller_setup)

        findViewById<TextView>(R.id.setupBody).text = getString(R.string.caller_setup_body)
        findViewById<Button>(R.id.btnEnable).setOnClickListener { requestRole() }
        findViewById<Button>(R.id.btnSkip).setOnClickListener { finish() }
    }

    private fun hasRole(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        val rm = getSystemService(RoleManager::class.java) ?: return false
        return rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
    }

    private fun requestRole() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Toast.makeText(this, "Need Android 10+", Toast.LENGTH_LONG).show()
            return
        }
        val rm = getSystemService(RoleManager::class.java) ?: return
        if (!rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
            Toast.makeText(this, "Caller ID role not available on this device", Toast.LENGTH_LONG).show()
            return
        }
        if (rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
            Toast.makeText(this, "Already enabled ✓", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        roleLauncher.launch(rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
    }
}
