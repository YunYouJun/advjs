<template>
  <svg
    id="yun-logo"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    version="1.1"
    width="400"
    height="400"
    viewBox="40 40 320 320"
    stroke-width="16"
  >
    <defs>
      <line
        id="eye"
        x1="0"
        y1="-35"
        x2="0"
        y2="35"
        stroke-linecap="round"
      >
        <animateTransform
          attributeName="transform"
          additive="sum"
          attributeType="XML"
          type="scale"
          from="1 1"
          to="1 0"
          dur="0.15s"
          repeatCount="2"
        />
      </line>
    </defs>
    <polygon
      stroke-linejoin="round"
      fill="none"
      points="50,250 50,150 100,150 100,100 300,100 300,150 350,150 350,250 300,250 300,300 100,300 100,250 50,250"
    />
    <use xlink:href="#eye" transform="translate(150,200)" />
    <use xlink:href="#eye" transform="translate(250,200)" />
  </svg>
</template>

<style lang="scss">
#yun-logo {
  stroke: black;
}

@media (prefers-color-scheme: dark) {
  #yun-logo {
    stroke: white;
  }
}

.dark {
  #yun-logo {
    stroke: white;
  }
}
</style>
