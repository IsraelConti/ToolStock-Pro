package com.icapps.maintenpro

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FreeTierPolicyTest {
    @Test fun freeUserCanRegisterUntilFifteen() {
        assertTrue(FreeTierPolicy.canCreateEquipment(0, false))
        assertTrue(FreeTierPolicy.canCreateEquipment(14, false))
        assertFalse(FreeTierPolicy.canCreateEquipment(15, false))
        assertFalse(FreeTierPolicy.canCreateEquipment(20, false))
    }

    @Test fun activeProHasNoEquipmentLimit() {
        assertTrue(FreeTierPolicy.canCreateEquipment(15, true))
        assertTrue(FreeTierPolicy.canCreateEquipment(10000, true))
    }

    @Test fun onlyFreeUsersSeeAds() {
        assertTrue(FreeTierPolicy.shouldShowAds(false))
        assertFalse(FreeTierPolicy.shouldShowAds(true))
    }

    @Test fun downgradeDoesNotRequireDeletingRecords() {
        assertTrue(FreeTierPolicy.requiresUpgrade(16, false))
        assertFalse(FreeTierPolicy.requiresUpgrade(16, true))
    }
}
