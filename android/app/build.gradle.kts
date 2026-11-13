plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val admobAppId = providers.gradleProperty("ADMOB_APP_ID").orNull ?: System.getenv("ADMOB_APP_ID").orEmpty()
val admobBannerUnitId = providers.gradleProperty("ADMOB_BANNER_UNIT_ID").orNull ?: System.getenv("ADMOB_BANNER_UNIT_ID").orEmpty()
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testBannerId = "ca-app-pub-3940256099942544/6300978111"

android {
    namespace = "com.icapps.maintenpro"
    compileSdk = 36
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        applicationId = "com.icapps.maintenpro"
        minSdk = 24
        targetSdk = 36
        versionCode = 9
        versionName = "1.2.6"
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
            manifestPlaceholders["ADMOB_APP_ID"] = testAppId
            buildConfigField("String", "ADMOB_BANNER_UNIT_ID", "\"$testBannerId\"")
        }
        release {
            // Se exige un ID real para publicar. Nunca enviar anuncios de prueba a producción.
            manifestPlaceholders["ADMOB_APP_ID"] = admobAppId.ifBlank { testAppId }
            buildConfigField("String", "ADMOB_BANNER_UNIT_ID", "\"$admobBannerUnitId\"")
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
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    testImplementation("junit:junit:4.13.2")
}

// Bloquear versiones release hasta configurar la app y unidad publicitaria reales.
tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
    doFirst {
        check(admobAppId.matches(Regex("ca-app-pub-[0-9]{16}~[0-9]{10}")) &&
              admobAppId != testAppId &&
              admobBannerUnitId.matches(Regex("ca-app-pub-[0-9]{16}/[0-9]{10}")) &&
              admobBannerUnitId != testBannerId) {
            "Faltan ADMOB_APP_ID y ADMOB_BANNER_UNIT_ID reales. Configure AdMob antes de compilar release."
        }
    }
}
