import mapboxgl from "mapbox-gl";
import {Myprepare,Myrender,setCanvas,Debug} from "./MAIN.ts";
class particleLayer implements mapboxgl.CustomLayerInterface{

    id = "123";
    type: "custom" = "custom";
    upCanvas:HTMLCanvasElement|null = null;
    ready:boolean = false;
    MAP:mapboxgl.Map|null = null;
    STATS:any;
    firstFlag:boolean = true;

    constructor(upCanvasElement:HTMLCanvasElement,st:any){
        this.upCanvas = upCanvasElement;
        this.STATS = st;
    }

    async onAdd(map:mapboxgl.Map , gl:WebGL2RenderingContext){
        console.log("onadd");
        
        this.MAP = map;
        setCanvas(this.upCanvas!);
        this.ready = (await Myprepare())!;
    
       
    }

    async render(gl:WebGL2RenderingContext,matrix:Array<number>){

        // if(this.ready&&this.firstFlag)
        if(this.ready)
           {
            
               this.firstFlag = false;
                await Myrender(matrix);
                this.MAP?.triggerRepaint();
                this.STATS.update();


           }
        else 
            this.MAP?.triggerRepaint();

    }
}

export{
    particleLayer,
}