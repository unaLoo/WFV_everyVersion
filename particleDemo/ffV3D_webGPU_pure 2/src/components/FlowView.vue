<template>
    <div id="stats"></div>
    <div id="playground"></div>
    <canvas id="WebGPUFrame"></canvas>
    <!-- <canvas id = "playground"></canvas> -->

</template>
    
<script setup lang='ts'>
import Stats from 'three/examples/jsm/libs/stats.module';
    import { onMounted } from 'vue';
    import { FlowFieldManager } from "./flowRenderElements/flowfield";
    import "mapbox-gl/dist/mapbox-gl.css";



    async function flowFieldVisualizing() {

        // Set FPS monitor
        let stats = new (Stats as any)();

        // Initialize the flow field manager
        const ffManager = await FlowFieldManager.Create("/json/flow_field_description.json", stats);
        if (ffManager.debug = true) {
            const container = document.getElementById('stats'); 
            container?.appendChild( stats.dom );
        }
    }

    onMounted(async()=> {
        await flowFieldVisualizing();
    });

</script>
    
<style>
#playground {
    position: absolute;
    height: 100%;
    width: 100%;
    margin: 0;
}

#WebGPUFrame {
    position: absolute;
    height: 100%;
    width: 100%;
    /* background-color: aquamarine; */
    pointer-events: none;
}

</style>