import { createStore } from "./state/store.js";
import { mountApp } from "./ui/components.js";

const root = document.getElementById("app");
const store = createStore();

mountApp(root, store);
