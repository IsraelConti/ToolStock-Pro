plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseConfig = groovy.json.JsonSlurper().parse(rootProject.file("../config/release.json")) as Map<*, *>

android {
    namespace = "com.icapps.maintenpro"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        applicationId = "com.icapps.maintenpro"
        minSdk = 24
        targetSdk = 36
        versionCode = 12
        versionName = "1.2.9"
        val webClientId = ((project.findProperty("GOOGLE_WEB_CLIENT_ID") as String?) ?: releaseConfig["googleWebClientId"]?.toString() ?: "").replace("\\", "").replace("\"", "")
        val syncApiBase = ((project.findProperty("SYNC_API_BASE") as String?) ?: releaseConfig["entitlementBase"]?.toString() ?: "").replace("\\", "").replace("\"", "")
        val pcDownloadUrl = ((project.findProperty("PC_DOWNLOAD_URL") as String?) ?: releaseConfig["pcDownloadUrl"]?.toString() ?: "").replace("\\", "").replace("\"", "")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$webClientId\"")
        buildConfigField("String", "SYNC_API_BASE", "\"$syncApiBase\"")
        buildConfigField("String", "PC_DOWNLOAD_URL", "\"$pcDownloadUrl\"")
        buildConfigField("String", "PUBLIC_SITE_URL", "\"https://israelconti.github.io\"")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.documentfile:documentfile:1.0.1")
    implementation("com.android.billingclient:billing-ktx:9.1.0")
    implementation("com.google.android.gms:play-services-auth:21.4.0")
}
