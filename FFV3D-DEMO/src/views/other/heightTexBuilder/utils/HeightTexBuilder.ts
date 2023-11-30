
export default class HeightTexBuilder{

    layerNum:number = 0;
    layerHeights:Array<number> = [];
    TextureData:Array<number> = [];
    pngdata:Uint8Array;
    unit:number = 0;
    totalHeight:number = 0.0;

    constructor(  L_heights:Array<number> ){
        this.layerNum = L_heights.length;
        this.layerHeights = L_heights;
        this.pngdata = new Uint8Array();
    }   

    generateTexture(){
        //找最大公约数
        let flag1 =  this.findTheUnit();

        this.findTotalHeight();

        if(flag1){
            //遍历heights，依次填充000,1111,2,33这样子，构造数据
            let flag2 = this.generateTexData();

            if(flag2)
            {
                //数据构造png
                this.buildPng();
            }
        }
    }

    getHeightBufferData(){
        let flag1 =  this.findTheUnit();
        this.findTotalHeight();
        if(flag1){
            this.generateTexData();
            return this.TextureData;
        }
    }

    getMaxCommonDivisor(a:number,b:number){
        let temp;
        if(a<b){
            temp = a; a = b; b = temp;
        }
        while(b!=0)
        {
            temp = a%b; a = b;  b = temp;
        }
        return a;
    }

    findTheUnit()
    {
        //先假设高度都是整数

        let result = this.layerHeights[0];
        for(let i=1; i<this.layerNum ; i++){

            result = this.getMaxCommonDivisor(result,this.layerHeights[i]);
            if(result === 1) break;

        }
        let flag = true;
        for(let i=0; i<this.layerNum ; i++){
            
            if(this.layerHeights[i] % result != 0){
                flag = false;
                result = 1;
                break;
            }
        }

        this.unit = result;
        
        return true;
        
    }

    numberToUint8Array(x:number){

        let u8arr = new Uint8Array(4);
        u8arr[0] = (x>>24)&0xff;
        u8arr[1] = (x>>16)&0xff;
        u8arr[2] = (x>>8)&0xff;
        u8arr[3] = x&0xff;
        return u8arr;
        
    }
    

    generateTexData(){
        
        for(let i=0;i<this.layerNum;i++)
        {

            let unitNum = this.layerHeights[i] / this.unit;
            for(let j=0;j<unitNum;j++)
            {
                this.TextureData.push(i);
            }
        }
        console.log("TextureData::",this.TextureData);
        
        this.pngdata = new Uint8Array(this.TextureData.length*4);


        for(let i=0 ; i<this.TextureData.length ; i++)
        {
            let pixelData = this.numberToUint8Array(this.TextureData[i]);
            
      
            
            this.pngdata.set(pixelData,i*4);
        }

        
        return true;
    }

    buildPng(){
        let canvas = document.createElement("canvas");

        
        canvas.width = this.TextureData.length;
        canvas.height = 1;
        let context = canvas.getContext("2d");
        let clampeddata = new Uint8ClampedArray(this.pngdata);

        let imgData = new ImageData(clampeddata,this.TextureData.length,1);
        context?.putImageData(imgData,0,0);

        let url = canvas.toDataURL("image/png");
        let img = new Image();
        img.src = url;
        document.body.appendChild(img);
        
        console.log("OK");
        
    }

    findTotalHeight(){
        let t_height = 0.0;
        for(let i = 0;i<this.layerNum;i++){
            t_height += this.layerHeights[i];
        }
        console.log("total height ",t_height);
        
        this.totalHeight = t_height;
    }
}





