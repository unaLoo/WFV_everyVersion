<template>
    <div id="main">
        <div id="mapContainer"></div>
        <canvas id="flow"></canvas>
        <div id="STATS"></div> 
    </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import VisualManager from "./VisualManager.ts";
onMounted(()=>{

    const manager = new VisualManager("mapContainer","flow","STATS");
    manager.Initialize();
})

</script>

<style scoped>
    #main{
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
    }
    #mapContainer{
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        position: absolute;
    }
    #flow{
        width: 100%;
        height: 100%;
        position: absolute;
        pointer-events: none;
    }
</style>