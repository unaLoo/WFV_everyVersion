<script setup lang="ts">
import { onMounted } from 'vue';
import HeightTexBuilder from './utils/HeightTexBuilder';

onMounted(async()=>{
    // let layeredHeight = [1,1.5,5,12,1,1,1,1,1,1,1,1]
    let layeredHeight = [1,1,1,1,1,1,1,1,1];
    let texBuilder = new HeightTexBuilder(layeredHeight);
    texBuilder.generateTexture();
    

})
</script>

<template>
<!-- <canvas id=""></canvas> -->
</template>

<style scoped>


</style>
