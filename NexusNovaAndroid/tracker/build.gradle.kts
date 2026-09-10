plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val novaVehicleApiBase = (project.findProperty("NOVA_VEHICLE_API_BASE") as String?)
    ?.trim()
    ?.trimEnd('/')
    ?.takeIf { it.isNotBlank() }
    ?: "https://nova-vehicle-premium.fahadsoomro123.workers.dev"

android {
    namespace = "com.nexusnova.tracker"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nexusnova.tracker"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "NOVA_VEHICLE_API_BASE", "\"$novaVehicleApiBase\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("com.google.android.gms:play-services-location:21.4.0")
}
