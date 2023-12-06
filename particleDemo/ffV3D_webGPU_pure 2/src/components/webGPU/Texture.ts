export class Texture {
    
    dPtr: GPUTexture | undefined;   //  texture Pointer
    components: number;

    constructor() {
        this.components = 4;
    }

    Destroy() {

        this.dPtr?.destroy();
    }

    Reset(texture: GPUTexture) {

        this.Destroy();
        this.dPtr = texture;
    }

    CreateView() {

        if (!this.dPtr) {
            console.log("CREATE_TEXTURE_VIEW_ERROR::TEXTURE_IS_UNDEFINED!");
            return null;
        }
        return this.dPtr.createView();
    }

    static async CreateByUrl(device: GPUDevice, url: string, label: string = "") {

        let texture = new Texture();

        const textureSource = await fetch(url);
        const textureBlob = await textureSource.blob();
        const imageBitmap = await createImageBitmap(textureBlob, {imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "default"});
        texture.dPtr = device.createTexture({
            label: label,
            format: "rgba8unorm",
            size: [imageBitmap.width, imageBitmap.height],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        });
        device.queue.copyExternalImageToTexture(
            {source: imageBitmap, flipY: true},
            {texture: texture.dPtr},
            {width: imageBitmap.width, height: imageBitmap.height}
        );

        return texture;
    }

    Reparsing(device: GPUDevice, targetComponent: number, targetFormat: GPUTextureFormat) {

        if (!this.dPtr) {
            console.log("REPARSING_TEXTURE_ERROR::SOURCE_RGBA8_IS_UNDEFINED!");
            return;
        }

        this.components = targetComponent;

        // - Transfer rgba8 texture to rgba32 texture
        const tmpBuffer = device.createBuffer({
            label: "temp buffer for texture transformation",
            size: this.dPtr.width * this.dPtr.height * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        const prepareEncoder = device.createCommandEncoder({label: "encoder for preparation"});
        const reparsedTexture = device.createTexture({
            label: this.dPtr.label,
            format: targetFormat,
            size: [this.dPtr.width / targetComponent, this.dPtr.height],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
        });

        // - Copy texture (rgba8) to the temp buffer
        prepareEncoder.copyTextureToBuffer(
            {texture: this.dPtr, mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
            {buffer: tmpBuffer, offset: 0, bytesPerRow: this.dPtr.width * 4, rowsPerImage: this.dPtr.height},
            [this.dPtr.width, this.dPtr.height]
        );

        // - Copy the temp buffer to texture (rg32)
        prepareEncoder.copyBufferToTexture(
            {buffer: tmpBuffer, offset: 0, bytesPerRow: this.dPtr.width * 4, rowsPerImage: this.dPtr.height},
            {texture: reparsedTexture, mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
            [this.dPtr.width / targetComponent, this.dPtr.height]
        );
        device.queue.submit([prepareEncoder.finish()]);

        // - Reset source texture
        tmpBuffer.destroy();
        this.Reset(reparsedTexture);

        return this;
    }

    async UpdateReparsing(device: GPUDevice, url: string) {

        if (!this.dPtr) {
            console.log("UPDATING_REPARSED_TEXTURE_ERROR::TEXTURE_POINTER_IS_UNDEFINED!");
            return false;
        }
        
        // - Transfer rgba8 texture to rgba32 texture
        const textureSource = await fetch(url);
        const textureBlob = await textureSource.blob();
        const imageBitmap = await createImageBitmap(textureBlob, {imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "default"});
        const sourceTexture = device.createTexture({
            label: "",
            format: "rgba8unorm",
            size: [imageBitmap.width, imageBitmap.height],
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        });
        device.queue.copyExternalImageToTexture(
            {source: imageBitmap, flipY: true},
            {texture: sourceTexture},
            {width: imageBitmap.width, height: imageBitmap.height}
        );

        const tmpBuffer = device.createBuffer({
            label: "temp buffer for texture transformation",
            size: sourceTexture.width * sourceTexture.height * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        
        const prepareEncoder = device.createCommandEncoder({label: "encoder for reparsing texture preparation"});
        // - Copy texture (rgba8) to the temp buffer
        prepareEncoder.copyTextureToBuffer(
            {texture: sourceTexture, mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
            {buffer: tmpBuffer, offset: 0, bytesPerRow: sourceTexture.width * 4, rowsPerImage: sourceTexture.height},
            [sourceTexture.width, sourceTexture.height]
        );

        // - Copy the temp buffer to texture (rg32)
        prepareEncoder.copyBufferToTexture(
            {buffer: tmpBuffer, offset: 0, bytesPerRow: sourceTexture.width * 4, rowsPerImage: sourceTexture.height},
            {texture: this.dPtr, mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
            // [sourceTexture.width / this.components, sourceTexture.height]
            [this.dPtr.width, this.dPtr.height]
        );
        device.queue.submit([prepareEncoder.finish()]);
        tmpBuffer.destroy();
        sourceTexture.destroy();

        return true;
    }

}