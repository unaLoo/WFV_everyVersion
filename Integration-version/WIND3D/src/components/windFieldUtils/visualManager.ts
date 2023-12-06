import mapboxgl from 'mapbox-gl';
import { FlowFieldController , type FlowFieldConstraints} from './controller.ts';
import { GUI } from 'dat.gui';
import axios from 'axios';
import { particleLayer } from "./customLayer.ts";

class DescriptionParser {
    private url = "";

    public flowFieldResourceArray: Array<string> = [];
    public seedingResourceArray: Array<string> = [];
    public transform2DResource = "";
    public transform3DResource = "";
    public maxDropRate = 0.0;
    public maxDropRateBump = 0.0;
    public maxSegmentNum = 0.0;
    public maxTrajectoryNum = 0.0;
    public maxTextureSize = 0.0;
    public extent = [0.0, 0.0, 0.0, 0.0];
    public flowBoundary = [0.0, 0.0, 0.0, 0.0];
    public flowFieldTextureSize = [0.0, 0.0];
    public seedingTextureSize = [0.0, 0.0];
    public transformTextureSize = [0.0, 0.0];

    constructor(descriptionUrl: string) {
        this.url = descriptionUrl;
    }

    async Parsing() {

        await axios.get(this.url)
        .then(async (response) => {
            this.flowBoundary[0] = response.data["flow_boundary"]["u_min"];
            this.flowBoundary[1] = response.data["flow_boundary"]["v_min"];
            this.flowBoundary[2] = response.data["flow_boundary"]["u_max"];
            this.flowBoundary[3] = response.data["flow_boundary"]["v_max"];

            this.maxTextureSize = response.data["constraints"]["max_texture_size"],
            this.maxTrajectoryNum = response.data["constraints"]["max_streamline_num"],
            this.maxSegmentNum = response.data["constraints"]["max_segment_num"],
            this.maxDropRate = response.data["constraints"]["max_drop_rate"],
            this.maxDropRateBump = response.data["constraints"]["max_drop_rate_bump"]

            this.extent[0] = response.data["extent"][0];
            this.extent[1] = response.data["extent"][1];
            this.extent[2] = response.data["extent"][2];
            this.extent[3] = response.data["extent"][3];

            for (const url of response.data["flow_fields"]) {
                this.flowFieldResourceArray.push(url);
            }
            this.flowFieldTextureSize[0] = response.data["texture_size"]["flow_field"][0];
            this.flowFieldTextureSize[1] = response.data["texture_size"]["flow_field"][1];

            for (const url of response.data["area_masks"]) {
                this.seedingResourceArray.push(url);
            }
            this.seedingTextureSize[0] = response.data["texture_size"]["area_mask"][0];
            this.seedingTextureSize[1] = response.data["texture_size"]["area_mask"][1];

            this.transform2DResource = response.data["projection"]["2D"];
            this.transform3DResource = response.data["projection"]["3D"];
            this.transformTextureSize[0] = response.data["texture_size"]["projection"][0];
            this.transformTextureSize[1] = response.data["texture_size"]["projection"][1];

        })
        .catch((error) => {
            console.log("ERROR::RESOURCE_NOT_LOAD_BY_URL", error.toJSON());
        });
    }

}

export class FlowFieldManager {

    public parser: DescriptionParser;

    public zoomRate = 1.0;
    public _updateWorkerSetting = true;
    public _updateProgress = false;
    public controller: FlowFieldController | null;

    public effectElement: any;
    public platform: any;

    public stats: any;
    public isSuspended = false;

    public debug = false;

    constructor(descriptionUrl: string, stats?: any) {

        this.parser = new DescriptionParser(descriptionUrl);
        this.controller = null;

        this.stats = stats ? stats : null;
    }



    static async Create(descriptionUrl: string, stats?: any) {

        const ffManager = new FlowFieldManager(descriptionUrl, stats);
        await ffManager.parser.Parsing();

        // Get constraints
        const constraints: FlowFieldConstraints = {
            MAX_TEXTURE_SIZE: ffManager.parser.maxTextureSize,
            MAX_STREAMLINE_NUM: ffManager.parser.maxTrajectoryNum,
            MAX_SEGMENT_NUM: ffManager.parser.maxSegmentNum,
            MAX_DORP_RATE: ffManager.parser.maxDropRate,
            MAX_DORP_RATE_BUMP: ffManager.parser.maxDropRateBump
        }
        ffManager.controller = new FlowFieldController(constraints)!;

        // Set UI
        ffManager.UIControllerSetting();

        ffManager.InitMap();

        return ffManager;
    }

    UIControllerSetting() {

        const ffController = this.controller! as any;
        
        const MAX_TEXTURE_SIZE = ffController.constraints["MAX_TEXTURE_SIZE"];
        const MAX_STREAMLINE_NUM = ffController.constraints["MAX_STREAMLINE_NUM"];
        const MAX_SEGMENT_NUM = ffController.constraints["MAX_SEGMENT_NUM"];
        const MAX_DORP_RATE = ffController.constraints["MAX_DORP_RATE"];
        const MAX_DORP_RATE_BUMP = ffController.constraints["MAX_DORP_RATE_BUMP"];

        // Initialize the GUI
        const gui = new GUI;

        const ffFolder = gui.addFolder('Flow Fields');
        ffFolder.add(ffController, 'stop', false).onChange(()=>{ ffController.needUpdate = true;});
        ffFolder.add(ffController, 'isUnsteady', true).onChange(()=>{ ffController.needUpdate = true;});

        ffFolder.add(ffController, 'speedFactor', 0.0, 10.0, 0.001).onChange(()=>{ ffController.needUpdate = true;});
    
        ffFolder.add(ffController, 'particleNum', 1, MAX_STREAMLINE_NUM, 1.0).onChange(()=>{ffController.needUpdate = true;});
        ffFolder.add(ffController, 'fillWidth', 0.0, 30.0, 0.001).onChange(()=>{ ffController.needUpdate = true;});
        ffFolder.add(ffController, 'aaWidth', 0.0, 30.0, 0.001).onChange(()=>{ ffController.needUpdate = true;});
        ffFolder.open();
  
    }


    InitMap() {
        const opt: mapboxgl.MapboxOptions & { useWebGL2: boolean } = {
            container: "playground",
            style: 'mapbox://styles/nujabesloo/clmhdapg6018i01pv0ghs04c0', // style URL
            center: [120.980697, 31.684162], // starting position [lng, lat]
            zoom: 9,
            antialias: true,
            useWebGL2: true,
            attributionControl: false,
            accessToken: 'pk.eyJ1IjoibnVqYWJlc2xvbyIsImEiOiJjbGp6Y3czZ2cwOXhvM3FtdDJ5ZXJmc3B4In0.5DCKDt0E2dFoiRhg3yWNRA',
        }
        this.platform = new mapboxgl.Map(opt);


        this.platform.on("load", () => {
            // this.platform.addLayer(new particleLayer("flow", "2d"));
        });
    }

    DestroyMap() {
        
        if (this.platform.getLayer("flow")) this.platform.removeLayer("flow");
        this.platform.remove();
        this.platform = null;
    }


}