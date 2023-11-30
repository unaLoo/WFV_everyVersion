
export default class HeightTexBuilder{

    layerNum:number = 0;
    layerHeights:Array<number> = [];
    TextureData:Array<number> = [];
    unit:number = 0;
    totalHeight:number = 0.0;
    TextureData2:Array<number> = [];

    constructor(L_heights:Array<number>){

        this.layerNum = L_heights.length;
        this.layerHeights = L_heights;

    }   

    getHeightBufferData(){
        this.findTotalHeight();

        this.findTheUnit();
        this.generateTexData();
        return this.TextureData;
    }

    getHeightBufferData2(){
        this.findTotalHeight();

        this.findTheUnit();
        this.generateTexData2();
        return this.TextureData;
    }

    getMaxCommonDivisor(a:number,b:number){
        let temp;
        if(a < b){
            temp = a;
            a = b;      
            b = temp;
        }
        while(b != 0)
        {
            temp = a % b;   
            a = b;      
            b = temp;
        }
        return a;
    }

    findTheUnit()
    {
        //先假设高度都是整数，最小的公约数为1
        let result = this.layerHeights[0];
        for(let i=1; i<this.layerNum ; i++){

            result = this.getMaxCommonDivisor(result,this.layerHeights[i]);
            if(result === 1) break;

        }
        let flag = true;
        for(let i=0; i<this.layerNum ; i++){
            ///test
            if(this.layerHeights[i] % result != 0){
                flag = false;
                result = 1;
                break;
            }
        }

        this.unit = result;
    }
    
    generateTexData(){
        
        for(let i = 0; i < this.layerNum; i++)
        {
            let unitNum = this.layerHeights[i] / this.unit;
            for(let j = 0; j < unitNum; j++)
            {
                this.TextureData.push(i);
            }
        }

        return true;
    }

    generateTexData2() {

        for (let i = 0; i < this.layerNum; i++) {

            let unitNum = this.layerHeights[i] / this.unit;
            let smalloffset = 1.0 / unitNum;

            for (let j = 0; j < unitNum; j++) {
                let value = i + j * smalloffset;
                this.TextureData2.push(value);
            }
        }

        return true;
    }


    findTotalHeight(){

        let t_height = 0.0;
        for(let i = 0; i < this.layerNum ; i++){
            t_height += this.layerHeights[i];
        }
        
        this.totalHeight = t_height;

    }
}





