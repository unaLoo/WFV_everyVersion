import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Stats from 'three/examples/jsm/libs/stats.module';
import { particleLayer } from "./CustomLayer.ts";


export default class VisualManager{
    ///ID
    mapContainerID:string = "";
    flowCanvasID:string = "";
    statsDivID:string = "";
    ///DOM
    flowCanvas:HTMLCanvasElement|undefined = undefined;
    statsDiv:HTMLDivElement|undefined = undefined;
    ///Objet
    map:mapboxgl.Map|undefined = undefined;
    stats:any = undefined;

    constructor(mapDivid:string,Canvasid:string,statsID:string){

        this.mapContainerID = mapDivid;
        this.flowCanvasID = Canvasid;
        this.statsDivID = statsID;

    }

    Initialize = ()=>{

        ///////////////////BASIC MAP/////////////////////

        // const opt: mapboxgl.MapboxOptions & { useWebGL2: boolean } = {
        //     container: "mapContainer",
        //     style: 'mapbox://styles/nujabesloo/clmhdapg6018i01pv0ghs04c0', // style URL
        //     center: [120.980697, 31.684162], // starting position [lng, lat]
        //     zoom: 10,
        //     antialias: true,
        //     useWebGL2: true,
        //     attributionControl: false,
        //     accessToken: 'pk.eyJ1IjoibnVqYWJlc2xvbyIsImEiOiJjbGp6Y3czZ2cwOXhvM3FtdDJ5ZXJmc3B4In0.5DCKDt0E2dFoiRhg3yWNRA',
        // }

        const opt: mapboxgl.MapboxOptions & { useWebGL2: boolean } = {
            container: "mapContainer",
            style: 'mapbox://styles/nujabesloo/clmhdapg6018i01pv0ghs04c0', // style URL
            center: [121.34719200846234, 48.709201155555434], // starting position [lng, lat]
            zoom: 4.523772006449529,
            pitch:77.4964374353762,
            antialias: true,
            useWebGL2: true,
            attributionControl: false,
            accessToken: 'pk.eyJ1IjoibnVqYWJlc2xvbyIsImEiOiJjbGp6Y3czZ2cwOXhvM3FtdDJ5ZXJmc3B4In0.5DCKDt0E2dFoiRhg3yWNRA',
        }

        this.map = new mapboxgl.Map(opt);



        ///////////////////STATS/////////////////////
        this.statsDiv = document.querySelector(`#${this.statsDivID}`) as HTMLDivElement;
        this.stats = new (Stats as any);
        this.statsDiv?.appendChild(this.stats.dom);



        ///////////////////WEBGPU CANVAS/////////////////////
        this.flowCanvas = document.querySelector(`#${this.flowCanvasID}`) as HTMLCanvasElement;
        this.map!.on('load',()=>{

            const flowLayer = new particleLayer(this.flowCanvas!,this.stats);
            this.map?.addLayer(flowLayer);

        })



        // this.map!.on('mousedown',()=>{
        //     let m = this.map!;
        //     console.log(m.getCenter());
        //     console.log(m.getZoom());
        //     console.log(m.getPitch());
        // })
    }
}