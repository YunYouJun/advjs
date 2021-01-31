import { createApp } from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';

import './assets/css/index.css';
import './assets/scss/index.scss';

const app = createApp(App);

// Global Registration
import IconFont from './components/common/IconFont.vue';
app.component('IconFont', IconFont);

app.use(store).use(router).mount('#app');
