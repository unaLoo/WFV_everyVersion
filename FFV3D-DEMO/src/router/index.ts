import { createRouter,createWebHashHistory } from "vue-router";

const routes = [
    {  path:'/',component:()=> import("@/views/ffv3d/demo.vue") },
    {  path:'/fkTex',component:() => import("@/views/other/fktexBuilder/fkTexture.vue")},
    {  path:'/hTex',component:()=> import("@/views/other/heightTexBuilder/heightTexBuilder.vue")},

    {  path:'/NoIndirect',component:()=> import("@/views/ffv3d/utils/Dispatch_NoIndirect/NoIndirect.vue")},
    {  path:'/NoBlocksize',component:()=> import("@/views/ffv3d/utils/indirect_blocksize1/blocksize1.vue")}

]

const router = createRouter({
    history:createWebHashHistory(),
    routes,
})

export {
    router,
}