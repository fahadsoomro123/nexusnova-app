plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
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
        debug {
            buildConfigField("boolean", "NEXUS_ADS_TEST_MODE", "true")
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
        }
        release {
            isMinifyEnabled = true
            buildConfigField("boolean", "NEXUS_ADS_TEST_MODE", "false")
            manifestPlaceholders["admobAppId"] = "ca-app-pub-5070673529890078~1824799663"
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

kotlin {
    jvmToolchain(17)
}

// Canonical web source lives once at repository-root/fresh-rebuild/.
// Every local or CI Android build regenerates assets/www from that source.
val freshWebSource = rootProject.projectDir.parentFile.resolve("fresh-rebuild")
val syncFreshWebAssets = tasks.register<Sync>("syncFreshWebAssets") {
    from(freshWebSource)
    into(layout.projectDirectory.dir("src/main/assets/www"))
    doFirst {
        if (!freshWebSource.resolve("index.html").isFile) {
            throw GradleException("Canonical fresh-rebuild/index.html is missing")
        }
    }
}

tasks.configureEach {
    if (name == "preBuild") dependsOn(syncFreshWebAssets)
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.3")
    implementation("com.wireguard.android:tunnel:1.0.20260102")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.14.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Native Firebase App Check for the Android WebView shell.
    implementation(platform("com.google.firebase:firebase-bom:34.17.0"))
    implementation("com.google.firebase:firebase-appcheck-recaptcha")

    // GMA Next-Gen SDK. Debug builds use Google's test inventory; release builds
    // use NexusNova production IDs only after the production consent gate passes.
    implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.3.0")

    // Google User Messaging Platform for production privacy/consent handling.
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
}
