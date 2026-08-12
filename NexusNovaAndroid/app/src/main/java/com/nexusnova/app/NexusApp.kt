package com.nexusnova.app

import android.app.Application

class NexusApp : Application() {
    override fun onCreate() {
        super.onCreate()
        PhonebookStore.init(this)
    }
}
