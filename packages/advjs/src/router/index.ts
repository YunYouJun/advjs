import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import Home from '../views/Home.vue';
import Demo from '../views/Demo.vue';
import NotFound from '../views/NotFound.vue';

/** @type {import('vue-router').RouterOptions['routes']} */
const routes: Array<RouteRecordRaw> = [
  { path: '/', component: Home, meta: { title: 'Home' } },
  { path: '/demo', component: Demo, meta: { title: 'Demo' } },
  { path: '/:path(.*)', component: NotFound },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
