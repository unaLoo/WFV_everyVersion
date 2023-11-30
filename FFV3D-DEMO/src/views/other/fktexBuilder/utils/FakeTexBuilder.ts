
export default class FakeTexBuilder{
    //rgba8unorm texture
    TextureWidth:number;
    TextureHeight:number;
    TextureData:Uint8Array;
    SpeedBoundary:Float32Array;//[umin,umax]
    Device:GPUDevice;
    Texture:GPUTexture | null = null;

    constructor(w:number,h:number,device:GPUDevice){
       this.TextureWidth = w;
       this.TextureHeight = h;
       this.TextureData = new Uint8Array(w*h*4).fill(1);//每个texel是4个值
       this.SpeedBoundary = new Float32Array(2);
       this.SpeedBoundary[0] = 999;//umin
       this.SpeedBoundary[1] = -999;//umax
       this.Device = device;
    }

    async generateTextureData(){
        let i,j;
        let arr = [];
        for(i=0;i<this.TextureWidth;i++){
            for(j=0;j<this.TextureHeight;j++){
                
                let normSpeed = 0.5; 
                
                if(this.SpeedBoundary[0]>normSpeed)
                    this.SpeedBoundary[0] = normSpeed;

                if(this.SpeedBoundary[1]<normSpeed)
                    this.SpeedBoundary[1] = normSpeed;
                
                let bytes = this.floatToBytes(normSpeed);

                arr.push(bytes);

            }
        }
        for(i=0;i<this.TextureWidth*this.TextureHeight;i++){
            let ofs = i*4;
            this.TextureData.set([arr[i][0],arr[i][1],arr[i][2],arr[i][3]],ofs);
        }
        
    
    }

    floatToBytes = (value:number):Uint8Array =>{
        //Arraybuffer--其他语言的ByteArray -- 一个固定长度的原始二进制数据缓冲区 ，不能直接操作，借用dataviewer或类型化数组来操作

        let buffer = new ArrayBuffer(4); /// byteLength = 4 -->一个float的大小
        let view = new DataView(buffer); 
        view.setFloat32(0, value, true);
        let bytes = new Uint8Array(4);
        for (let i = 0; i < 4; i++) {
        //   bytes.push(view.getUint8(i)); 
            bytes[i] = view.getUint8(i);
        }
        
        return bytes;
      }

    bytesToFloat = (bytes:any) => {
        let buffer = new ArrayBuffer(4);
        let view = new DataView(buffer);
        for (let i = 0 ;i<4 ;i++){
            view.setUint8(i,bytes[i]);
        }
        let float = 0.0;
        float = view.getFloat32(0,true);
        
        return float;
    }

    generateTexture = ():GPUTexture=>{
        
        this.Texture = this.Device.createTexture({
            size:[this.TextureWidth,this.TextureHeight],
            format:"rgba8unorm",
            usage:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        })

        this.Device.queue.writeTexture(
            {texture:this.Texture},
            this.TextureData,
            {bytesPerRow:this.TextureWidth*4},
            {width:this.TextureWidth , height:this.TextureHeight}
        )

        return this.Texture;

    }

    generatePNG = ()=>{
        const canvas = document.createElement("canvas");
        canvas.width = this.TextureWidth;
        canvas.height= this.TextureHeight;
        const context = canvas.getContext('2d');
        const clampeddata = new Uint8ClampedArray(this.TextureData);

        const imgdata = new ImageData(clampeddata,this.TextureWidth,this.TextureHeight);
        context?.putImageData(imgdata,0,0);

        const dataURL  = canvas.toDataURL("image/png");
        const img = new Image();
        img.src = dataURL;
        document.body.appendChild(img);

    }

    getSpeedBoudary = ()=>{
        console.log("speed_min ",this.SpeedBoundary[0]);
        console.log("speed_max ",this.SpeedBoundary[1]);
        
        return this.SpeedBoundary;
    }

    rand = (min:number,max:number)=>{
        return Math.random()*(max-min)+min;
    }
}