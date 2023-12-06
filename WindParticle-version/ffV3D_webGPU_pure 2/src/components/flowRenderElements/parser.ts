import axios from "axios";

class DescriptionParser {
    private url = "";

    public flowFieldResourceArray: Array<string> = [];
    public seedingResourceArray: Array<string> = [];
    public transform2DHighResource = "";
    public transform2DLowResource = "";
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

            this.transform2DHighResource = response.data["projection"]["2D"]["high"];
            this.transform2DLowResource = response.data["projection"]["2D"]["low"];
            this.transform3DResource = response.data["projection"]["3D"];
            this.transformTextureSize[0] = response.data["texture_size"]["projection"][0];
            this.transformTextureSize[1] = response.data["texture_size"]["projection"][1];

        })
        .catch((error) => {
            console.log("ERROR::RESOURCE_NOT_LOAD_BY_URL", error.toJSON());
        });
    }

}

export {
    DescriptionParser,
}