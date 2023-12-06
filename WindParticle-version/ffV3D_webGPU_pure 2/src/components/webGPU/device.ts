/// <reference types="@webgpu/types" />

export class Device {

    device: GPUDevice | null = null;

    constructor() {
    }

    static async Create() {

        const deviceInstance = new Device();

        if (!navigator.gpu) {
            fail("ERROR:: this browser does not support WebGPU");
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            fail("ERROR:: this browser supports WebGPU but it appears disabled");
            return;
        }

        const adapterFeatures = adapter.features;
        // Iterate through all the set values using values()
        console.log("Features supported by the adapter");
        const valueIterator = adapterFeatures.values();
        for (const value of valueIterator) {
            console.log(value);
        }

        // // Iterate through all the set values using keys()
        // const keyIterator = adapterFeatures.keys();
        // for (const value of keyIterator) {
        //     console.log(value);
        // }

        // // Iterate through all the set values using entries()
        // const entryIterator = adapterFeatures.entries();
        // for (const entry of entryIterator) {
        //     console.log(entry[0]);
        // }

        // // Iterate through all the set values using forEach()
        // adapterFeatures.forEach((value) => {
        //     console.log(value);
        // });

        deviceInstance.device = await adapter.requestDevice();
        deviceInstance.device.lost.then((info) => {
            console.error("ERROR:: WebGPU device was lost: ${info.message}");

            // "reason" will be "destroyed" if we intentionally destroy the device
            if (info.reason !== "destroyed") {
                // Try again
                this.Create();
            }
        });
        
        console.log(deviceInstance.device);

        return deviceInstance;
    }
}

function fail(msg: any) {
    alert(msg);
}