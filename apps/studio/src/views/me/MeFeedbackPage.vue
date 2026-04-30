<script setup lang="ts">
import {
  logoGithub,
  openOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import NavGroup from '../../components/ui/NavGroup.vue'
import NavItem from '../../components/ui/NavItem.vue'

const { t } = useI18n()
</script>

<template>
  <LayoutPage :title="t('feedback.title')" show-back-button default-href="/tabs/me">
    <div class="page-container">
      <NavGroup>
        <NavItem
          :icon="logoGithub"
          :label="t('feedback.github')"
          :desc="t('feedback.githubDesc')"
          :trailing-icon="openOutline"
          :chevron="false"
          href="https://github.com/YunYouJun/advjs/issues/new"
        />
      </NavGroup>
    </div>
  </LayoutPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}
</style>
