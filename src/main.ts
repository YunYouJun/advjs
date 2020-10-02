import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';

import './assets/css/index.css';

const app = createApp(App);

app
  .use(store)
  .use(router)
  .mount('#app');
