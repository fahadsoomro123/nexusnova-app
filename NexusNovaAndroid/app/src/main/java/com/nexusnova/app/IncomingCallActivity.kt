package com.nexusnova.app

import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class IncomingCallActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        setContentView(R.layout.activity_incoming_call)

        val name = intent.getStringExtra(EXTRA_NAME) ?: getString(R.string.unknown_caller)
        val phone = intent.getStringExtra(EXTRA_PHONE) ?: ""
        val address = intent.getStringExtra(EXTRA_ADDRESS) ?: ""
        val known = intent.getBooleanExtra(EXTRA_KNOWN, false)

        findViewById<TextView>(R.id.callName).text = name
        findViewById<TextView>(R.id.callPhone).text = phone
        findViewById<TextView>(R.id.callAddress).text = address
        findViewById<TextView>(R.id.callBadge).text =
            if (known) "✓ Known contact" else "⚠ Unknown number"

        findViewById<Button>(R.id.btnClose).setOnClickListener { finish() }

        // Auto dismiss after 45s so it doesn't stick
        window.decorView.postDelayed({ if (!isFinishing) finish() }, 45_000)
    }

    companion object {
        const val EXTRA_PHONE = "phone"
        const val EXTRA_NAME = "name"
        const val EXTRA_ADDRESS = "address"
        const val EXTRA_KNOWN = "known"
    }
}
