package com.icapps.maintenpro

/**
 * FREE: 15 equipos con anuncios.
 * TRIAL: 7 días con todas las funciones, equipos ilimitados y anuncios.
 * PAID: 4,99 EUR/mes, equipos ilimitados y sin anuncios.
 * Nunca se eliminan equipos, órdenes ni historiales por perder una suscripción.
 */
enum class MaintenProTier { FREE, TRIAL, PAID }

object FreeTierPolicy {
    const val MAX_FREE_EQUIPMENT = 15
    const val PREMIUM_MONTHLY_PRODUCT_ID = "maintenpro_premium_monthly"

    fun canCreateEquipment(existingEquipmentCount: Int, tier: MaintenProTier): Boolean {
        require(existingEquipmentCount >= 0) { "Equipment count cannot be negative" }
        return tier != MaintenProTier.FREE || existingEquipmentCount < MAX_FREE_EQUIPMENT
    }

    fun shouldShowAds(tier: MaintenProTier): Boolean = tier != MaintenProTier.PAID

    fun canUseAdFreeExperience(tier: MaintenProTier): Boolean = tier == MaintenProTier.PAID

    fun requiresUpgrade(existingEquipmentCount: Int, tier: MaintenProTier): Boolean =
        !canCreateEquipment(existingEquipmentCount, tier)
}
