import { createRouter,createWebHashHistory } from "vue-router";

const routes = [
    {  path:'/',component:()=> import("@/components/ParticleView.vue") },
]

const router = createRouter({
    history:createWebHashHistory(),
    routes,
})

export {
    router,
}