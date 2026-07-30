package com.foodstock.pro

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class ExpiryAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val product = intent.getStringExtra("product_name") ?: "Producto"
        val lot = intent.getStringExtra("lot").orEmpty()
        val expiry = intent.getStringExtra("expiry_date").orEmpty()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "foodstock_expiry"
        manager.createNotificationChannel(
            NotificationChannel(channelId, "Caducidades", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Avisos de lotes próximos a caducar"
            }
        )
        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pending = PendingIntent.getActivity(
            context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val lotText = if (lot.isBlank()) "" else " · Lote $lot"
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Producto próximo a caducar")
            .setContentText("$product$lotText · Fecha: $expiry")
            .setStyle(NotificationCompat.BigTextStyle().bigText("$product$lotText caduca el $expiry. Revisa su uso o retirada."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        manager.notify((product + lot + expiry).hashCode(), notification)
    }
}
