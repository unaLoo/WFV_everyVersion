import mapboxgl from "mapbox-gl";
import {Myprepare,Myrender,setCanvas} from "./MAIN.ts";

class particleLayer implements mapboxgl.CustomLayerInterface{

    id = "DynamicLayoutParticleLayer";
    type: "custom" = "custom";
    ready:boolean = false;
    upCanvas:HTMLCanvasElement|null = null;

    MAP:mapboxgl.Map|null = null;
    STATS:any;

    constructor(upCanvasElement:HTMLCanvasElement,st:any){
        this.upCanvas = upCanvasElement;
        this.STATS = st;
    }

    async onAdd(map:mapboxgl.Map , gl:WebGL2RenderingContext){
        console.log("customeLayer::onadd");
        
        this.MAP = map;
        setCanvas(this.upCanvas!);
        this.ready = (await Myprepare())!;
    
    }

    async render(gl:WebGL2RenderingContext,matrix:Array<number>){

        if(this.ready)
        {
            await Myrender(matrix);
            this.MAP?.triggerRepaint();
            this.STATS.update();
        }
        else 
        {
            this.MAP?.triggerRepaint();
        }

    }
}

export{
    particleLayer,
}