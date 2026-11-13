package com.icapps.maintenpro

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FreeTierPolicyTest {
    @Test fun freeUserCanRegisterUntilFifteen() {
        assertTrue(FreeTierPolicy.canCreateEquipment(0, MaintenProTier.FREE))
        assertTrue(FreeTierPolicy.canCreateEquipment(14, MaintenProTier.FREE))
        assertFalse(FreeTierPolicy.canCreateEquipment(15, MaintenProTier.FREE))
        assertFalse(FreeTierPolicy.canCreateEquipment(20, MaintenProTier.FREE))
    }

    @Test fun trialHasUnlimitedEquipmentButStillShowsAds() {
        assertTrue(FreeTierPolicy.canCreateEquipment(15, MaintenProTier.TRIAL))
        assertTrue(FreeTierPolicy.canCreateEquipment(10000, MaintenProTier.TRIAL))
        assertTrue(FreeTierPolicy.shouldShowAds(MaintenProTier.TRIAL))
        assertFalse(FreeTierPolicy.canUseAdFreeExperience(MaintenProTier.TRIAL))
    }

    @Test fun paidProHasUnlimitedEquipmentAndNoAds() {
        assertTrue(FreeTierPolicy.canCreateEquipment(10000, MaintenProTier.PAID))
        assertFalse(FreeTierPolicy.shouldShowAds(MaintenProTier.PAID))
        assertTrue(FreeTierPolicy.canUseAdFreeExperience(MaintenProTier.PAID))
    }

    @Test fun freeTierShowsAdsAndDowngradeDoesNotDeleteData() {
        assertTrue(FreeTierPolicy.shouldShowAds(MaintenProTier.FREE))
        assertTrue(FreeTierPolicy.requiresUpgrade(16, MaintenProTier.FREE))
        assertFalse(FreeTierPolicy.requiresUpgrade(16, MaintenProTier.TRIAL))
        assertFalse(FreeTierPolicy.requiresUpgrade(16, MaintenProTier.PAID))
    }
}
