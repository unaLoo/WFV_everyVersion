// Data Size Constraints
export interface FlowFieldConstraints {
    MAX_TEXTURE_SIZE: number;
    MAX_STREAMLINE_NUM: number;
    MAX_SEGMENT_NUM: number;
    MAX_DORP_RATE: number;
    MAX_DORP_RATE_BUMP: number;

    [name: string]: number;
}
export class FlowFieldController {
    // lineNum: number;
    particleNum: number;
    segmentNum: number;
    fullLife: number;
    progressRate: number;
    speedFactor: number;
    dropRate: number;
    dropRateBump: number;
    fillWidth: number;
    aaWidth: number;
    colorScheme: number;
    isUnsteady: boolean;
    content: string;
    primitive: number;
    platform: string;
    stop: boolean;
    needUpdate: boolean;

    constraints: FlowFieldConstraints;
    
    constructor(constraints?: FlowFieldConstraints) {
        // this.lineNum = 262144;
        this.particleNum = 262144;
        // this.segmentNum = 16;
        this.segmentNum = 3;
        this.fullLife = this.segmentNum * 10;
        this.progressRate = 0.0;
        this.speedFactor = 5.0;
        this.dropRate = 0.003;
        this.dropRateBump = 0.001;
        this.fillWidth = 1.0;
        this.aaWidth = 2.0;
        this.colorScheme = 0;
        this.isUnsteady = true;
        this.content = "none";
        this.primitive = 0;
        this.platform = "WebGPU on mapbox";
        this.stop = false;
        this.needUpdate = false;
 

        // this["lineNum"] = this.lineNum;
        this["particleNum"] = this.particleNum;


        if (constraints) {
            this.constraints = constraints;
        } else {
            this.constraints = {
                MAX_TEXTURE_SIZE: 0.0,
                MAX_STREAMLINE_NUM: 0.0,
                MAX_SEGMENT_NUM: 0.0,
                MAX_DORP_RATE: 0.0,
                MAX_DORP_RATE_BUMP: 0.0
            }
        }
    }

    Create(constraints: FlowFieldConstraints) {
        return new FlowFieldController(constraints);
    }
}