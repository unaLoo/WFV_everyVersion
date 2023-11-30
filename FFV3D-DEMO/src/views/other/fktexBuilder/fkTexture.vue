<script setup lang="ts">
import { onMounted } from 'vue';
import FakeTexBuilder from './utils/FakeTexBuilder';


onMounted(async()=>{
  // const canvas = document.querySelector('#textureBuild');
  let adapter = (await navigator.gpu.requestAdapter()!)!;
  let device = await adapter?.requestDevice()!;
  let txBuilder =  new FakeTexBuilder(1024,558,device);

  await txBuilder.generateTextureData();
//   txBuilder.generateTexture();
  txBuilder.generatePNG();

})
</script>

<template>
<canvas id="textureBuild"></canvas>
</template>

<style scoped>
#textureBuild{
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
}
</style>
