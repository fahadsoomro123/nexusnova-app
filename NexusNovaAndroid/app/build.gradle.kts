plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.nexusnova.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nexusnova.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        viewBinding = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // GMA Next-Gen SDK. Google recommends migrating from the legacy
    // play-services-ads path for improved stability and lower RPC overhead.
    implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.3.0")

    // Google User Messaging Platform. Production ad requests will be gated by
    // fresh consent state before NexusNova switches away from test inventory.
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
}
