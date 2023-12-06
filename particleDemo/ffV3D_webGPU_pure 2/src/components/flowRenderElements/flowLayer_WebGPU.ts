import mapboxgl, { Map } from 'mapbox-gl';
import type { FlowFieldManager } from './flowfield';
import { CustomLayer } from './customLayer';
import { Destory, Prepare, Tick } from '../webGPU/flowElement';

class FlowLayer_WebGPU extends CustomLayer {

    public map: mapboxgl.Map | null = null;
    public ready = false;

    constructor(
        id: string, renderingMode: '2d' | '3d',
        public ffManager: FlowFieldManager
    ) {
        super(id, renderingMode);
    }

    async onAdd(map: Map, gl: WebGL2RenderingContext) {
        console.log("Custom flow field layer is being added...");
        this.map = map;
        this.ffManager.platform = map;
        this.ready = await Prepare();
    }

    async render(gl: WebGL2RenderingContext, u_matrix: number[]) {

        if(!this.ready) {
            console.log("manager not ready !");
            this.map?.triggerRepaint();
            return;
        }

        // Get mercator coordinates of the screen center
        const center = this.map!.getCenter();
        const mercatorCenter = mapboxgl.MercatorCoordinate.fromLngLat({lng:center.lng, lat:center.lat});

        // !!! Start Dash !!!
        await Tick(this.ffManager.controller!, u_matrix, [mercatorCenter.x, mercatorCenter.y], this.ffManager.stats);

        this.map?.triggerRepaint();
    }

    onRemove(map: Map, gl: WebGL2RenderingContext): void {
        Destory();
    }
}


export {
    FlowLayer_WebGPU
}