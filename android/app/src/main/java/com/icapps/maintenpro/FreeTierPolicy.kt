package com.icapps.maintenpro

/**
 * Commercial access rules for MaintenPro.
 * Never delete existing equipment or maintenance records when an entitlement changes.
 * The UI must consult canCreateEquipment before saving a NEW equipment record.
 * Existing equipment can always be viewed/edited and maintenance history remains usable.
 */
object FreeTierPolicy {
    const val MAX_FREE_EQUIPMENT = 15
    const val PREMIUM_MONTHLY_PRODUCT_ID = "maintenpro_premium_monthly"

    fun canCreateEquipment(existingEquipmentCount: Int, hasActivePro: Boolean): Boolean {
        require(existingEquipmentCount >= 0) { "Equipment count cannot be negative" }
        return hasActivePro || existingEquipmentCount < MAX_FREE_EQUIPMENT
    }

    fun canUseAdFreeExperience(hasActivePro: Boolean): Boolean = hasActivePro

    fun shouldShowAds(hasActivePro: Boolean): Boolean = !hasActivePro

    fun requiresUpgrade(existingEquipmentCount: Int, hasActivePro: Boolean): Boolean =
        !canCreateEquipment(existingEquipmentCount, hasActivePro)
}
