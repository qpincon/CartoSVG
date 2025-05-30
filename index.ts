import { mount } from 'svelte'

import Map from './src/Map.svelte';
import './src/assets/global.scss';

const app = mount(Map, {
  target: document.getElementById('app-content')!
});


export default app
