plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseConfig = groovy.json.JsonSlurper().parse(rootProject.file("../config/release.json")) as Map<*, *>
val admobAppId = (providers.gradleProperty("ADMOB_APP_ID").orNull ?: System.getenv("ADMOB_APP_ID").orEmpty()).ifBlank { "ca-app-pub-2591134184963379~6094043049" }
val admobBannerId = (providers.gradleProperty("ADMOB_BANNER_UNIT_ID").orNull ?: System.getenv("ADMOB_BANNER_UNIT_ID").orEmpty()).ifBlank { "ca-app-pub-2591134184963379/6612917799" }
val demoAppId = "ca-app-pub-3940256099942544~3347511713"
val demoBannerId = "ca-app-pub-3940256099942544/6300978111"

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
        versionCode = 14
        versionName = "1.2.9.2"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
        getByName("debug") {
            manifestPlaceholders["ADMOB_APP_ID"] = demoAppId
            buildConfigField("String", "ADMOB_BANNER_UNIT_ID", "\"$demoBannerId\"")
        }
        release {
            manifestPlaceholders["ADMOB_APP_ID"] = admobAppId.ifBlank { demoAppId }
            buildConfigField("String", "ADMOB_BANNER_UNIT_ID", "\"$admobBannerId\"")
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
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}

// Deshabilita compilaciones publicables sin identificadores AdMob reales.
tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
    doFirst {
        check(admobAppId.matches(Regex("ca-app-pub-[0-9]{16}~[0-9]{10}")) &&
              admobAppId != demoAppId &&
              admobBannerId.matches(Regex("ca-app-pub-[0-9]{16}/[0-9]{10}")) &&
              admobBannerId != demoBannerId) {
            "Faltan ADMOB_APP_ID y ADMOB_BANNER_UNIT_ID reales; release bloqueada."
        }
    }
}
