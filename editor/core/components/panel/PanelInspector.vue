<template>
  <AGUIPanel h="full" w="1/4" min-w="300px">
    <AGUIDetails title="Inspector" open>
      <InspectorView />
      <slot />
    </AGUIDetails>
  </AGUIPanel>
</template>
