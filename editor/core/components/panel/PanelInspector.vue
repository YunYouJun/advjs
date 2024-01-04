<template>
  <AGUIPanel h="full" w="full">
    <AGUIDetails w="full" title="Inspector" open>
      <InspectorView />
      <slot />
    </AGUIDetails>
  </AGUIPanel>
</template>
