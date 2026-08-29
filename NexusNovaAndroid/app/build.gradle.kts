plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Build refresh: secure-session sync watchdog validation (2026-08-15).
// Build refresh: Android blank-screen self-recovery validation (v74).
// ADMOB SAFETY LOCK: until explicitly unlocked, every Android variant uses
// Google's test App ID and test inventory. Signed/release builds are TEST-only.
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
        debug {
            buildConfigField("boolean", "NEXUS_ADS_TEST_MODE", "true")
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
        }
        release {
            isMinifyEnabled = false
            buildConfigField("boolean", "NEXUS_ADS_TEST_MODE", "true")
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
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
        buildConfig = true
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

    // GMA Next-Gen SDK. All current builds intentionally use Google TEST inventory.
    implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.3.0")

    // Google User Messaging Platform for privacy/consent handling.
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
}
